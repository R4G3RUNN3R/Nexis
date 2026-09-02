import { describe, expect, it } from 'vitest';

import {
  PRESENTATION_CONTRACT_VERSION,
  decodeBattlePresentationSnapshot,
  decodePresentationEvent,
  decodeTheatreIntent,
  type PresentationActorId,
} from '../src/index.ts';

const validSnapshot = {
  contractVersion: 1,
  encounterId: 'encounter-1', revision: 1, eventCursor: 0, phase: 'active', roundNumber: 1,
  activeActorId: 'actor_hero', outcome: null,
  actors: [{
    actorId: 'actor_hero', displayName: 'Hero', side: 'ally', facing: 'right', visualKey: 'placeholder',
    resources: [{ resourceId: 'life', displayName: 'Life', current: 10, maximum: 10 }],
    statuses: [], attachments: [], defeated: false, isLegalTarget: false,
  }],
};

describe('versioned fail-closed V1 wire decoding', () => {
  it('decodes supported V1 snapshot, event, and intent contracts', () => {
    expect(PRESENTATION_CONTRACT_VERSION).toBe(1);
    expect(decodeBattlePresentationSnapshot(validSnapshot).ok).toBe(true);
    expect(decodePresentationEvent({
      contractVersion: 1, encounterId: 'encounter-1', type: 'combatMessage',
      eventId: 'evt-1', sequence: 1, message: 'Visible message',
    }).ok).toBe(true);
    expect(decodeTheatreIntent({
      contractVersion: 1, encounterId: 'encounter-1', kind: 'defend',
    }).ok).toBe(true);
  });

  it.each([
    ['snapshot', () => decodeBattlePresentationSnapshot({ ...validSnapshot, contractVersion: 2 })],
    ['event', () => decodePresentationEvent({ contractVersion: 2, encounterId: 'encounter-1', type: 'combatMessage', eventId: 'evt', sequence: 1, message: 'x' })],
    ['intent', () => decodeTheatreIntent({ contractVersion: 2, encounterId: 'encounter-1', kind: 'defend' })],
  ])('rejects unsupported known %s versions', (_name, decode) => {
    expect(decode()).toMatchObject({ ok: false, reason: 'unsupportedVersion' });
  });

  it('rejects unknown state-changing event variants instead of silently ignoring them', () => {
    expect(decodePresentationEvent({
      contractVersion: 1, encounterId: 'encounter-1', type: 'lootGranted',
      eventId: 'evt-1', sequence: 1, item: 'hidden',
    })).toMatchObject({ ok: false, reason: 'unknownVariant' });
  });

  it('decodes every historical V1 event variant explicitly', () => {
    const variants: readonly Record<string, unknown>[] = [
      { type: 'actorMoved', actorId: 'actor_hero', movement: 'advanceToTarget', targetActorId: 'actor_foe' },
      { type: 'skillActivated', actorId: 'actor_hero', skillVisualKey: 'skill.fixture', displayName: 'Fixture' },
      { type: 'attackResolved', actorId: 'actor_hero', targetActorId: 'actor_foe', outcome: 'hit' },
      { type: 'damageApplied', targetActorId: 'actor_foe', displayAmount: 2, resultingResource: { resourceId: 'life', resultingValue: 8, resultingMaximum: 10 } },
      { type: 'healingApplied', targetActorId: 'actor_hero', displayAmount: 2, resultingResource: { resourceId: 'life', resultingValue: 10, resultingMaximum: 10 } },
      { type: 'resourceChanged', actorId: 'actor_hero', resultingResource: { resourceId: 'life', resultingValue: 9, resultingMaximum: 10 } },
      { type: 'statusApplied', actorId: 'actor_hero', status: { kind: 'known', instanceId: 'status-1', statusId: 'fixture', displayName: 'Fixture', polarity: 'neutral' } },
      { type: 'statusRemoved', actorId: 'actor_hero', statusInstanceId: 'status-1' },
      { type: 'itemUsed', actorId: 'actor_hero', itemVisualKey: 'item.fixture', displayName: 'Fixture' },
      { type: 'actorDefeated', actorId: 'actor_foe' },
      { type: 'turnChanged', roundNumber: 2, activeActorId: 'actor_foe' },
      { type: 'combatMessage', message: 'Visible' },
      { type: 'encounterEnded', outcome: 'victory' },
    ];
    for (const [index, variant] of variants.entries()) {
      expect(decodePresentationEvent({ contractVersion: 1, encounterId: 'encounter-1', eventId: `evt-${index}`, sequence: index + 1, ...variant }).ok).toBe(true);
    }
  });

  it('decodes every V1 intent variant without accepting outcome claims', () => {
    const variants: readonly Record<string, unknown>[] = [
      { kind: 'basicAttack', targetActorId: 'actor_foe' },
      { kind: 'useSkill', skillId: 'fixture.skill', targetActorId: 'actor_foe' },
      { kind: 'useItem', itemId: 'fixture.item', targetActorId: 'actor_hero' },
      { kind: 'selectTarget', targetActorId: 'actor_foe' },
      { kind: 'inspect', targetActorId: 'actor_foe' },
      { kind: 'defend' },
      { kind: 'withdraw' },
    ];
    for (const variant of variants) {
      const decoded = decodeTheatreIntent({ contractVersion: 1, encounterId: 'encounter-1', ...variant });
      expect(decoded.ok).toBe(true);
      if (decoded.ok) {
        expect(decoded.value).not.toHaveProperty('damage');
        expect(decoded.value).not.toHaveProperty('succeeded');
      }
    }
  });
});

describe('opaque presentation actor selectors', () => {
  it('is mechanically distinct from an ordinary string at compile time', () => {
    // @ts-expect-error internal/plain identifiers cannot be used as presentation selectors
    const leaked: PresentationActorId = '018f47ac-2e2a-7c77-9abc-123456789abc';
    expect(leaked).toBeTypeOf('string');
  });

  it('rejects UUID/internal-looking IDs and accepts only scoped presentation selectors', () => {
    expect(decodeBattlePresentationSnapshot({
      ...validSnapshot,
      activeActorId: '018f47ac-2e2a-7c77-9abc-123456789abc',
      actors: [{ ...validSnapshot.actors[0], actorId: '018f47ac-2e2a-7c77-9abc-123456789abc' }],
    })).toMatchObject({ ok: false, reason: 'invalidShape' });
    expect(decodeBattlePresentationSnapshot(validSnapshot).ok).toBe(true);
  });
});

describe('sanitized immutable retained values', () => {
  it('rejects unknown fields at every accepted wire boundary', () => {
    expect(decodeBattlePresentationSnapshot({ ...validSnapshot, accountId: 'secret' }))
      .toMatchObject({ ok: false, reason: 'unknownField' });
    expect(decodeBattlePresentationSnapshot({
      ...validSnapshot,
      actors: [{ ...validSnapshot.actors[0], hiddenStats: { strength: 999 } }],
    })).toMatchObject({ ok: false, reason: 'unknownField' });
    expect(decodePresentationEvent({
      contractVersion: 1, encounterId: 'encounter-1', type: 'combatMessage', eventId: 'evt', sequence: 1,
      message: 'visible', adminNote: 'secret',
    })).toMatchObject({ ok: false, reason: 'unknownField' });
  });

  it('retains field-by-field deep-frozen data with no caller-owned nested aliases', () => {
    const input = structuredClone(validSnapshot);
    const decoded = decodeBattlePresentationSnapshot(input);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    input.actors[0]!.resources[0]!.current = 0;
    expect(decoded.value.actors[0]?.resources[0]?.current).toBe(10);
    expect(Object.isFrozen(decoded.value)).toBe(true);
    expect(Object.isFrozen(decoded.value.actors)).toBe(true);
    expect(Object.isFrozen(decoded.value.actors[0]?.resources)).toBe(true);
  });
});
