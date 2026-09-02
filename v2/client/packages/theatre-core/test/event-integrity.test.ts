import { describe, expect, it } from 'vitest';

import {
  applyPresentationEvent,
  decodeBattlePresentationSnapshot,
  decodePresentationEvent,
} from '../src/index.ts';

const snapshotWire = (eventCursor = 7) => ({
  contractVersion: 1,
  encounterId: 'encounter-1',
  revision: 4,
  eventCursor,
  phase: 'active',
  roundNumber: 2,
  activeActorId: 'actor_hero',
  actors: [
    {
      actorId: 'actor_hero', displayName: 'Hero', side: 'ally', facing: 'right',
      visualKey: 'placeholder', resources: [{ resourceId: 'life', displayName: 'Life', current: 100, maximum: 100 }],
      statuses: [], attachments: [], defeated: false, isLegalTarget: false,
    },
    {
      actorId: 'actor_foe', displayName: 'Foe', side: 'hostile', facing: 'left',
      visualKey: 'placeholder', resources: [{ resourceId: 'life', displayName: 'Life', current: 50, maximum: 50 }],
      statuses: [], attachments: [], defeated: false, isLegalTarget: true,
    },
  ],
  outcome: null,
});

function decodedSnapshot(eventCursor = 7) {
  const result = decodeBattlePresentationSnapshot(snapshotWire(eventCursor));
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

function decodedEvent(overrides: Record<string, unknown> = {}) {
  const result = decodePresentationEvent({
    contractVersion: 1,
    encounterId: 'encounter-1',
    type: 'resourceChanged',
    eventId: 'evt-8',
    sequence: 8,
    actorId: 'actor_hero',
    resultingResource: { resourceId: 'life', resultingValue: 80, resultingMaximum: 100 },
    ...overrides,
  });
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

describe('authoritative presentation stream integrity', () => {
  it.each([
    ['wrongEncounter', { encounterId: 'encounter-2' }],
    ['staleOrDuplicate', { sequence: 7 }],
    ['staleOrDuplicate', { sequence: 6 }],
    ['sequenceGap', { sequence: 9 }],
  ] as const)('requires resync for %s without mutating the snapshot', (reason, overrides) => {
    const snapshot = decodedSnapshot();
    const result = applyPresentationEvent(snapshot, decodedEvent(overrides));

    expect(result).toEqual({ kind: 'resyncRequired', reason, snapshot });
  });

  it('advances the cursor after every accepted event and rejects a replayed event', () => {
    const first = applyPresentationEvent(decodedSnapshot(), decodedEvent());
    expect(first.kind).toBe('applied');
    if (first.kind !== 'applied') return;
    expect(first.snapshot.eventCursor).toBe(8);
    expect(first.snapshot.actors[0]?.resources[0]?.current).toBe(80);

    const duplicate = applyPresentationEvent(first.snapshot, decodedEvent());
    expect(duplicate).toEqual({ kind: 'resyncRequired', reason: 'staleOrDuplicate', snapshot: first.snapshot });
  });

  it('continues deterministic V1 replay from a mid-stream snapshot cursor', () => {
    const event = decodedEvent({ eventId: 'evt-42', sequence: 42 });
    const result = applyPresentationEvent(decodedSnapshot(41), event);

    expect(result.kind).toBe('applied');
    if (result.kind === 'applied') expect(result.snapshot.eventCursor).toBe(42);
  });

  it.each([
    { type: 'resourceChanged', actorId: 'actor_hero', resultingResource: { resourceId: 'hidden-resource', resultingValue: 1, resultingMaximum: 1 } },
    { type: 'statusRemoved', actorId: 'actor_hero', statusInstanceId: 'absent-status' },
  ])('requires resync rather than consuming an event with an invalid nested reference', (fields) => {
    const decoded = decodePresentationEvent({ contractVersion: 1, encounterId: 'encounter-1', eventId: 'evt-8', sequence: 8, ...fields });
    if (!decoded.ok) throw new Error(decoded.message);
    const before = decodedSnapshot();

    expect(applyPresentationEvent(before, decoded.value))
      .toEqual({ kind: 'resyncRequired', reason: 'invalidReference', snapshot: before });
  });

  it('rejects reversed status/resource order and a stale encounter end without mutation', () => {
    const status = decodePresentationEvent({ contractVersion: 1, encounterId: 'encounter-1', eventId: 'evt-8', sequence: 8, type: 'statusApplied', actorId: 'actor_hero', status: { kind: 'opaque', instanceId: 'opaque-1', displayName: 'Unknown Effect' } });
    const resource = decodePresentationEvent({ contractVersion: 1, encounterId: 'encounter-1', eventId: 'evt-7', sequence: 7, type: 'resourceChanged', actorId: 'actor_hero', resultingResource: { resourceId: 'life', resultingValue: 1, resultingMaximum: 100 } });
    const ended = decodePresentationEvent({ contractVersion: 1, encounterId: 'encounter-1', eventId: 'evt-end', sequence: 7, type: 'encounterEnded', outcome: 'defeat' });
    if (!status.ok || !resource.ok || !ended.ok) throw new Error('fixture decode failed');
    const applied = applyPresentationEvent(decodedSnapshot(), status.value);
    if (applied.kind !== 'applied') throw new Error('status fixture did not apply');

    expect(applyPresentationEvent(applied.snapshot, resource.value)).toMatchObject({ kind: 'resyncRequired', reason: 'staleOrDuplicate', snapshot: applied.snapshot });
    expect(applyPresentationEvent(applied.snapshot, ended.value)).toMatchObject({ kind: 'resyncRequired', reason: 'staleOrDuplicate', snapshot: applied.snapshot });
    expect(applied.snapshot.phase).toBe('active');
  });
});
