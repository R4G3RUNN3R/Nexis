import { describe, expect, it } from 'vitest';

import { applyPresentationEvent, type BattlePresentationSnapshot, type PresentationEvent } from '../src/index.ts';

/**
 * The public event-application boundary must neither freeze nor mutate objects the
 * caller still owns, and must never retain a caller-owned mutable alias in a result.
 */
function callerOwned() {
  const heroResource = { resourceId: 'life', displayName: 'Life', current: 100, maximum: 100 };
  const heroStatus = { kind: 'known' as const, instanceId: 'burn-1', statusId: 'burn', displayName: 'Burn', polarity: 'harmful' as const, stacks: 1 };
  const heroAttachment = { slotKey: 'mainHand', visualKey: 'sword' };
  const hero = { actorId: 'actor_hero', displayName: 'Hero', side: 'ally' as const, facing: 'right' as const, visualKey: 'hero', resources: [heroResource], statuses: [heroStatus], attachments: [heroAttachment], defeated: false, isLegalTarget: false };
  const foe = { actorId: 'actor_foe', displayName: 'Foe', side: 'hostile' as const, facing: 'left' as const, visualKey: 'foe', resources: [{ resourceId: 'life', displayName: 'Life', current: 50, maximum: 50 }], statuses: [], attachments: [], defeated: false, isLegalTarget: true };
  const actors = [hero, foe];
  const snapshot = { contractVersion: 1 as const, encounterId: 'encounter-1', revision: 3, eventCursor: 4, phase: 'active' as const, roundNumber: 2, activeActorId: 'actor_hero', actors, outcome: null, interactionState: 'ready' as const };
  return { snapshot, actors, hero, heroResource, heroStatus, heroAttachment };
}

function asSnapshot(value: unknown): BattlePresentationSnapshot { return value as BattlePresentationSnapshot; }
function asEvent(value: unknown): PresentationEvent { return value as PresentationEvent; }

function frozenFlags(values: readonly unknown[]): readonly boolean[] { return values.map((value) => Object.isFrozen(value)); }

function deeplyFrozen(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value as Record<string, unknown>).every((nested) => deeplyFrozen(nested));
}

describe('caller-owned alias and mutation safety', () => {
  it('never freezes a caller-owned snapshot on the accepted path', () => {
    const owned = callerOwned();
    const result = applyPresentationEvent(asSnapshot(owned.snapshot), asEvent({ contractVersion: 1, encounterId: 'encounter-1', eventId: 'evt-5', sequence: 5, type: 'combatMessage', message: 'Visible' }));

    expect(result.kind).toBe('applied');
    expect(frozenFlags([owned.snapshot, owned.actors, owned.hero, owned.hero.resources, owned.heroResource, owned.hero.statuses, owned.heroStatus, owned.hero.attachments, owned.heroAttachment])).toEqual([false, false, false, false, false, false, false, false, false]);
    owned.heroResource.current = 1;
    owned.hero.displayName = 'mutated';
    expect(result.snapshot.actors[0]).toMatchObject({ displayName: 'Hero', resources: [{ current: 100 }] });
  });

  it('never freezes a caller-owned snapshot on the resync path', () => {
    const owned = callerOwned();
    const result = applyPresentationEvent(asSnapshot(owned.snapshot), asEvent({ contractVersion: 1, encounterId: 'encounter-2', eventId: 'evt-5', sequence: 5, type: 'combatMessage', message: 'Elsewhere' }));

    expect(result).toMatchObject({ kind: 'resyncRequired', reason: 'wrongEncounter' });
    expect(frozenFlags([owned.snapshot, owned.actors, owned.hero, owned.heroResource, owned.heroStatus])).toEqual([false, false, false, false, false]);
    owned.heroResource.current = 7;
    expect(result.snapshot.actors[0]?.resources[0]?.current).toBe(100);
  });

  it('never freezes or retains a caller-owned event status object', () => {
    const owned = callerOwned();
    const status = { kind: 'known' as const, instanceId: 'chill-1', statusId: 'chill', displayName: 'Chill', polarity: 'harmful' as const, stacks: 2 };
    const event = { contractVersion: 1, encounterId: 'encounter-1', eventId: 'evt-5', sequence: 5, type: 'statusApplied', actorId: 'actor_foe', status };

    const result = applyPresentationEvent(asSnapshot(owned.snapshot), asEvent(event));

    expect(frozenFlags([event, status])).toEqual([false, false]);
    status.displayName = 'mutated';
    status.stacks = 99;
    expect(result.snapshot.actors[1]?.statuses[0]).toEqual({ kind: 'known', instanceId: 'chill-1', statusId: 'chill', displayName: 'Chill', polarity: 'harmful', stacks: 2 });
  });

  it('returns deeply frozen results that share no caller-owned object', () => {
    const owned = callerOwned();
    const result = applyPresentationEvent(asSnapshot(owned.snapshot), asEvent({ contractVersion: 1, encounterId: 'encounter-1', eventId: 'evt-5', sequence: 5, type: 'damageApplied', targetActorId: 'actor_hero', displayAmount: 40, resultingResource: { resourceId: 'life', resultingValue: 60, resultingMaximum: 100 } }));

    expect(deeplyFrozen(result)).toBe(true);
    expect(result.snapshot.actors[0]).not.toBe(owned.hero);
    expect(result.snapshot.actors[0]?.statuses[0]).not.toBe(owned.heroStatus);
    expect(result.snapshot.actors[0]?.attachments[0]).not.toBe(owned.heroAttachment);
    expect(result.snapshot.actors[1]).not.toBe(owned.actors[1]);
  });
});
