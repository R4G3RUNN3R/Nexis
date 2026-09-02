import { describe, expect, it } from 'vitest';

import { applyPresentationEvent, canSubmitTheatreIntent, decodeBattlePresentationSnapshot, decodePresentationEvent } from '../src/index.ts';

function snapshot(activeActorId: unknown = 'actor_hero') {
  const result = decodeBattlePresentationSnapshot({
    contractVersion: 1, encounterId: 'encounter-1', revision: 1, eventCursor: 0,
    phase: 'active', roundNumber: 1, activeActorId, outcome: null,
    actors: [
      { actorId: 'actor_hero', displayName: 'Hero', side: 'ally', facing: 'right', visualKey: 'x', resources: [], statuses: [], attachments: [], defeated: false, isLegalTarget: false },
      { actorId: 'actor_foe', displayName: 'Foe', side: 'hostile', facing: 'left', visualKey: 'x', resources: [], statuses: [], attachments: [], defeated: false, isLegalTarget: true },
    ],
  });
  return result;
}

function event(fields: Record<string, unknown>) {
  return decodePresentationEvent({ contractVersion: 1, encounterId: 'encounter-1', eventId: 'evt-1', sequence: 1, ...fields });
}

describe('referential integrity and interaction resync', () => {
  it('rejects a snapshot whose active actor is not present', () => {
    expect(snapshot('actor_missing')).toMatchObject({ ok: false, reason: 'invalidReference' });
  });

  it.each([
    { type: 'actorDefeated', actorId: 'actor_foe' },
    { type: 'turnChanged', roundNumber: 2, activeActorId: 'actor_foe' },
    { type: 'encounterEnded', outcome: 'victory' },
  ])('applies $type display state but blocks stale live intent pending a replacement snapshot', (fields) => {
    const decodedSnapshot = snapshot();
    const decodedEvent = event(fields);
    if (!decodedSnapshot.ok || !decodedEvent.ok) throw new Error('fixture decode failed');

    const result = applyPresentationEvent(decodedSnapshot.value, decodedEvent.value);

    expect(result.kind).toBe('resyncRequired');
    if (result.kind !== 'resyncRequired') return;
    expect(result.reason).toBe('interactionProjectionStale');
    expect(result.snapshot.interactionState).toBe('blockedPendingSnapshot');
    expect(result.snapshot.actors.every((actor) => !actor.isLegalTarget)).toBe(true);
    expect(result.snapshot.eventCursor).toBe(1);
    expect(canSubmitTheatreIntent(result.snapshot, 'live')).toBe(false);
  });

  it('fails closed when a turn event references an unknown active actor', () => {
    const decodedSnapshot = snapshot();
    const decodedEvent = event({ type: 'turnChanged', roundNumber: 2, activeActorId: 'actor_missing' });
    if (!decodedSnapshot.ok || !decodedEvent.ok) throw new Error('fixture decode failed');
    expect(applyPresentationEvent(decodedSnapshot.value, decodedEvent.value))
      .toMatchObject({ kind: 'resyncRequired', reason: 'invalidReference', snapshot: decodedSnapshot.value });
  });

  it('allows the host intent bridge only for a fresh live authoritative projection', () => {
    const decoded = snapshot(); if (!decoded.ok) throw new Error('fixture decode failed');
    expect(canSubmitTheatreIntent(decoded.value, 'live')).toBe(true);
    expect(canSubmitTheatreIntent(decoded.value, 'replay')).toBe(false);
    expect(canSubmitTheatreIntent(decoded.value, 'spectator')).toBe(false);
  });
});
