import { describe, expect, it } from 'vitest';

import { applyPresentationEvent, canSubmitTheatreIntent, decodeBattlePresentationSnapshot, decodePresentationEvent, decodeTheatreIntent, type BattlePresentationSnapshot, type TheatreIntent } from '../src/index.ts';

function snapshotWire(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: 1, encounterId: 'encounter-1', revision: 1, eventCursor: 0,
    phase: 'active', roundNumber: 1, activeActorId: 'actor_hero', outcome: null,
    actors: [
      { actorId: 'actor_hero', displayName: 'Hero', side: 'ally', facing: 'right', visualKey: 'x', resources: [{ resourceId: 'life', displayName: 'Life', current: 100, maximum: 100 }], statuses: [{ kind: 'opaque', instanceId: 'aura-1', displayName: 'Aura' }], attachments: [], defeated: false, isLegalTarget: false },
      { actorId: 'actor_foe', displayName: 'Foe', side: 'hostile', facing: 'left', visualKey: 'x', resources: [{ resourceId: 'life', displayName: 'Life', current: 50, maximum: 50 }], statuses: [], attachments: [], defeated: false, isLegalTarget: true },
    ],
    ...overrides,
  };
}

function snapshot(activeActorId: unknown = 'actor_hero') {
  return decodeBattlePresentationSnapshot(snapshotWire({ activeActorId }));
}

function liveSnapshot(): BattlePresentationSnapshot {
  const decoded = snapshot(); if (!decoded.ok) throw new Error('fixture decode failed'); return decoded.value;
}

function endedSnapshot(): BattlePresentationSnapshot {
  const wire = snapshotWire({ phase: 'ended', outcome: 'victory', activeActorId: null });
  const actors = (wire['actors'] as Record<string, unknown>[]).map((actor) => ({ ...actor, isLegalTarget: false }));
  const decoded = decodeBattlePresentationSnapshot({ ...wire, actors });
  if (!decoded.ok) throw new Error('ended fixture decode failed'); return decoded.value;
}

function event(fields: Record<string, unknown>) {
  return decodePresentationEvent({ contractVersion: 1, encounterId: 'encounter-1', eventId: 'evt-1', sequence: 1, ...fields });
}

function intent(fields: Record<string, unknown>): TheatreIntent {
  const decoded = decodeTheatreIntent({ contractVersion: 1, encounterId: 'encounter-1', ...fields });
  if (!decoded.ok) throw new Error(`intent fixture decode failed: ${decoded.message}`); return decoded.value;
}

const legalTargetIntent = (): TheatreIntent => intent({ kind: 'basicAttack', targetActorId: 'actor_foe' });

describe('referential integrity and interaction resync', () => {
  it('rejects a snapshot whose active actor is not present', () => {
    expect(snapshot('actor_missing')).toMatchObject({ ok: false, reason: 'invalidReference' });
  });

  it.each([
    { type: 'actorDefeated', actorId: 'actor_foe' },
    { type: 'turnChanged', roundNumber: 2, activeActorId: 'actor_foe' },
    { type: 'encounterEnded', outcome: 'victory' },
    { type: 'damageApplied', targetActorId: 'actor_foe', displayAmount: 5, resultingResource: { resourceId: 'life', resultingValue: 45, resultingMaximum: 50 } },
    { type: 'healingApplied', targetActorId: 'actor_foe', displayAmount: 5, resultingResource: { resourceId: 'life', resultingValue: 50, resultingMaximum: 50 } },
    { type: 'resourceChanged', actorId: 'actor_hero', resultingResource: { resourceId: 'life', resultingValue: 90, resultingMaximum: 100 } },
    { type: 'statusApplied', actorId: 'actor_foe', status: { kind: 'opaque', instanceId: 'chill-1', displayName: 'Chill' } },
    { type: 'statusRemoved', actorId: 'actor_hero', statusInstanceId: 'aura-1' },
  ])('applies $type display state but blocks stale live intent pending a replacement snapshot', (fields) => {
    const decodedEvent = event(fields);
    if (!decodedEvent.ok) throw new Error('fixture decode failed');

    const result = applyPresentationEvent(liveSnapshot(), decodedEvent.value);

    expect(result.kind).toBe('resyncRequired');
    if (result.kind !== 'resyncRequired') return;
    expect(result.reason).toBe('interactionProjectionStale');
    expect(result.snapshot.interactionState).toBe('blockedPendingSnapshot');
    expect(result.snapshot.actors.every((actor) => !actor.isLegalTarget)).toBe(true);
    expect(result.snapshot.eventCursor).toBe(1);
    expect(canSubmitTheatreIntent(result.snapshot, 'live', legalTargetIntent())).toBe(false);
  });

  it.each([
    { type: 'actorMoved', actorId: 'actor_hero', movement: 'advanceToTarget', targetActorId: 'actor_foe' },
    { type: 'skillActivated', actorId: 'actor_hero', skillVisualKey: 'slash', displayName: 'Slash' },
    { type: 'attackResolved', actorId: 'actor_hero', targetActorId: 'actor_foe', outcome: 'hit' },
    { type: 'itemUsed', actorId: 'actor_hero', itemVisualKey: 'potion', displayName: 'Potion' },
    { type: 'combatMessage', message: 'Visible' },
  ])('keeps presentation-only $type cues non-blocking', (fields) => {
    const decodedEvent = event(fields);
    if (!decodedEvent.ok) throw new Error('fixture decode failed');

    const result = applyPresentationEvent(liveSnapshot(), decodedEvent.value);

    expect(result.kind).toBe('applied');
    expect(result.snapshot.interactionState).toBe('ready');
    expect(canSubmitTheatreIntent(result.snapshot, 'live', legalTargetIntent())).toBe(true);
  });

  it('fails closed when a turn event references an unknown active actor', () => {
    const decodedEvent = event({ type: 'turnChanged', roundNumber: 2, activeActorId: 'actor_missing' });
    if (!decodedEvent.ok) throw new Error('fixture decode failed');
    expect(applyPresentationEvent(liveSnapshot(), decodedEvent.value))
      .toMatchObject({ kind: 'resyncRequired', reason: 'invalidReference', snapshot: liveSnapshot() });
  });
});

describe('local intent safety gate', () => {
  it('allows a fresh live projection to offer a legal target', () => {
    expect(canSubmitTheatreIntent(liveSnapshot(), 'live', legalTargetIntent())).toBe(true);
  });

  it('allows a live targetless intent', () => {
    expect(canSubmitTheatreIntent(liveSnapshot(), 'live', intent({ kind: 'defend' }))).toBe(true);
  });

  it('blocks replay and spectator viewers', () => {
    expect(canSubmitTheatreIntent(liveSnapshot(), 'replay', legalTargetIntent())).toBe(false);
    expect(canSubmitTheatreIntent(liveSnapshot(), 'spectator', legalTargetIntent())).toBe(false);
  });

  it('blocks an intent bound to a different encounter', () => {
    const otherEncounter = decodeTheatreIntent({ contractVersion: 1, encounterId: 'encounter-2', kind: 'basicAttack', targetActorId: 'actor_foe' });
    if (!otherEncounter.ok) throw new Error('fixture decode failed');
    expect(canSubmitTheatreIntent(liveSnapshot(), 'live', otherEncounter.value)).toBe(false);
  });

  it.each([
    ['an actor that is not offered as a legal target', 'actor_hero'],
    ['an actor absent from the projection', 'actor_ghost'],
  ])('blocks a target-bearing intent naming %s', (_label, targetActorId) => {
    expect(canSubmitTheatreIntent(liveSnapshot(), 'live', intent({ kind: 'basicAttack', targetActorId }))).toBe(false);
    expect(canSubmitTheatreIntent(liveSnapshot(), 'live', intent({ kind: 'useSkill', skillId: 'skill-1', targetActorId }))).toBe(false);
    expect(canSubmitTheatreIntent(liveSnapshot(), 'live', intent({ kind: 'useItem', itemId: 'item-1', targetActorId }))).toBe(false);
  });

  it('blocks every intent once the encounter has ended', () => {
    expect(canSubmitTheatreIntent(endedSnapshot(), 'live', legalTargetIntent())).toBe(false);
    expect(canSubmitTheatreIntent(endedSnapshot(), 'live', intent({ kind: 'withdraw' }))).toBe(false);
  });
});
