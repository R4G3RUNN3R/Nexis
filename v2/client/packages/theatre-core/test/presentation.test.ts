import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PRESENTATION_PREFERENCES,
  applyPresentationEvent,
  normalizePresentationPreferences,
  type BattlePresentationSnapshot,
  type PresentationActor,
  type PresentationEvent,
  type PresentationResource,
  type PresentationStatus,
  type TheatreIntent,
  type TheatreViewerMode,
} from '../src/index.ts';

const life: PresentationResource = {
  resourceId: 'life',
  displayName: 'Life',
  current: 100,
  maximum: 100,
};

const hero: PresentationActor = {
  actorId: 'actor-hero',
  displayName: 'Ally One',
  side: 'ally',
  facing: 'right',
  visualKey: 'placeholder.humanoid',
  resources: [life],
  statuses: [],
  attachments: [],
  defeated: false,
  isLegalTarget: false,
};

const foe: PresentationActor = {
  actorId: 'actor-foe',
  displayName: 'Hostile One',
  side: 'hostile',
  facing: 'left',
  visualKey: 'placeholder.humanoid',
  resources: [{ resourceId: 'life', displayName: 'Life', current: 40, maximum: 60 }],
  statuses: [],
  attachments: [],
  defeated: false,
  isLegalTarget: true,
};

const baseSnapshot: BattlePresentationSnapshot = {
  encounterId: 'encounter-1',
  revision: 7,
  phase: 'active',
  roundNumber: 2,
  activeActorId: 'actor-hero',
  actors: [hero, foe],
  outcome: null,
};

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

function actorOf(snapshot: BattlePresentationSnapshot, actorId: string): PresentationActor {
  const actor = snapshot.actors.find((candidate) => candidate.actorId === actorId);
  if (actor === undefined) {
    throw new Error(`test fixture missing actor ${actorId}`);
  }
  return actor;
}

function resourceOf(actor: PresentationActor, resourceId: string): PresentationResource {
  const resource = actor.resources.find((candidate) => candidate.resourceId === resourceId);
  if (resource === undefined) {
    throw new Error(`test fixture missing resource ${resourceId}`);
  }
  return resource;
}

describe('applyPresentationEvent authoritative resulting values', () => {
  it('copies the authoritative resulting life from a damage event instead of computing it', () => {
    const frozen = deepFreeze(structuredClone(baseSnapshot));
    // 100 - 37 would be 63. The authority says 55. The renderer must trust the authority.
    const event: PresentationEvent = {
      type: 'damageApplied',
      eventId: 'evt-1',
      sequence: 1,
      targetActorId: 'actor-hero',
      displayAmount: 37,
      resultingResource: { resourceId: 'life', resultingValue: 55, resultingMaximum: 120 },
    };

    const next = applyPresentationEvent(frozen, event);

    const resulting = resourceOf(actorOf(next, 'actor-hero'), 'life');
    expect(resulting.current).toBe(55);
    expect(resulting.maximum).toBe(120);
    expect(resulting.displayName).toBe('Life');
    expect(resourceOf(actorOf(frozen, 'actor-hero'), 'life').current).toBe(100);
  });

  it('copies the authoritative resulting life from a healing event instead of computing it', () => {
    const event: PresentationEvent = {
      type: 'healingApplied',
      eventId: 'evt-2',
      sequence: 2,
      targetActorId: 'actor-foe',
      displayAmount: 40,
      resultingResource: { resourceId: 'life', resultingValue: 45, resultingMaximum: 60 },
    };

    const next = applyPresentationEvent(deepFreeze(structuredClone(baseSnapshot)), event);

    expect(resourceOf(actorOf(next, 'actor-foe'), 'life').current).toBe(45);
  });

  it('copies an authoritative resource change without touching other actors or resources', () => {
    const event: PresentationEvent = {
      type: 'resourceChanged',
      eventId: 'evt-3',
      sequence: 3,
      actorId: 'actor-hero',
      resultingResource: { resourceId: 'life', resultingValue: 12, resultingMaximum: 100 },
    };

    const next = applyPresentationEvent(baseSnapshot, event);

    expect(resourceOf(actorOf(next, 'actor-hero'), 'life').current).toBe(12);
    expect(resourceOf(actorOf(next, 'actor-foe'), 'life').current).toBe(40);
  });

  it('ignores a resulting value addressed to an unknown actor rather than inventing one', () => {
    const event: PresentationEvent = {
      type: 'damageApplied',
      eventId: 'evt-4',
      sequence: 4,
      targetActorId: 'actor-missing',
      displayAmount: 5,
      resultingResource: { resourceId: 'life', resultingValue: 1, resultingMaximum: 100 },
    };

    expect(applyPresentationEvent(baseSnapshot, event)).toBe(baseSnapshot);
  });

  it('ignores a resulting value addressed to a resource the actor does not expose', () => {
    const event: PresentationEvent = {
      type: 'resourceChanged',
      eventId: 'evt-5',
      sequence: 5,
      actorId: 'actor-hero',
      resultingResource: { resourceId: 'mana', resultingValue: 3, resultingMaximum: 9 },
    };

    expect(applyPresentationEvent(baseSnapshot, event)).toBe(baseSnapshot);
  });

  it('copies authoritative turn, defeat and encounter outcome facts', () => {
    const turn = applyPresentationEvent(baseSnapshot, {
      type: 'turnChanged',
      eventId: 'evt-6',
      sequence: 6,
      roundNumber: 3,
      activeActorId: 'actor-foe',
    });
    expect(turn.roundNumber).toBe(3);
    expect(turn.activeActorId).toBe('actor-foe');

    const defeated = applyPresentationEvent(turn, {
      type: 'actorDefeated',
      eventId: 'evt-7',
      sequence: 7,
      actorId: 'actor-foe',
    });
    expect(actorOf(defeated, 'actor-foe').defeated).toBe(true);
    expect(actorOf(defeated, 'actor-hero').defeated).toBe(false);

    const ended = applyPresentationEvent(defeated, {
      type: 'encounterEnded',
      eventId: 'evt-8',
      sequence: 8,
      outcome: 'victory',
    });
    expect(ended.phase).toBe('ended');
    expect(ended.outcome).toBe('victory');
  });

  it('treats presentation-only events as display cues that change no authoritative value', () => {
    const presentationOnly: readonly PresentationEvent[] = [
      { type: 'actorMoved', eventId: 'evt-9', sequence: 9, actorId: 'actor-hero', movement: 'advanceToTarget', targetActorId: 'actor-foe' },
      { type: 'actorMoved', eventId: 'evt-10', sequence: 10, actorId: 'actor-hero', movement: 'returnToPosition' },
      { type: 'skillActivated', eventId: 'evt-11', sequence: 11, actorId: 'actor-hero', skillVisualKey: 'fixture.skill', displayName: 'Fixture Skill' },
      { type: 'attackResolved', eventId: 'evt-12', sequence: 12, actorId: 'actor-hero', targetActorId: 'actor-foe', outcome: 'critical' },
      { type: 'attackResolved', eventId: 'evt-13', sequence: 13, actorId: 'actor-foe', targetActorId: 'actor-hero', outcome: 'miss' },
      { type: 'itemUsed', eventId: 'evt-14', sequence: 14, actorId: 'actor-hero', itemVisualKey: 'fixture.item', displayName: 'Fixture Item' },
      { type: 'combatMessage', eventId: 'evt-15', sequence: 15, message: 'Fixture message' },
    ];

    for (const event of presentationOnly) {
      expect(applyPresentationEvent(baseSnapshot, event)).toBe(baseSnapshot);
    }
  });

  it('ignores an unrecognised future event type instead of guessing its meaning', () => {
    const unknownEvent = { type: 'somethingAddedLater', eventId: 'evt-16', sequence: 16 } as unknown as PresentationEvent;

    expect(applyPresentationEvent(baseSnapshot, unknownEvent)).toBe(baseSnapshot);
  });
});

describe('opaque status presentation', () => {
  const opaque: PresentationStatus = {
    kind: 'opaque',
    instanceId: 'status-instance-1',
    displayName: 'Unknown Effect',
  };

  it('keeps an unrevealed effect opaque and free of any internal identity', () => {
    const next = applyPresentationEvent(baseSnapshot, {
      type: 'statusApplied',
      eventId: 'evt-17',
      sequence: 17,
      actorId: 'actor-foe',
      status: opaque,
    });

    const [status] = actorOf(next, 'actor-foe').statuses;
    expect(status).toEqual(opaque);
    expect(status === undefined ? {} : status).not.toHaveProperty('statusId');
    expect(Object.keys(status ?? {}).sort()).toEqual(['displayName', 'instanceId', 'kind']);
  });

  it('replaces a status instance in place and removes it by instance id', () => {
    const applied = applyPresentationEvent(baseSnapshot, {
      type: 'statusApplied',
      eventId: 'evt-18',
      sequence: 18,
      actorId: 'actor-hero',
      status: {
        kind: 'known',
        instanceId: 'status-instance-2',
        statusId: 'fixture.status',
        displayName: 'Fixture Status',
        polarity: 'harmful',
        stacks: 1,
      },
    });
    expect(actorOf(applied, 'actor-hero').statuses).toHaveLength(1);

    const restacked = applyPresentationEvent(applied, {
      type: 'statusApplied',
      eventId: 'evt-19',
      sequence: 19,
      actorId: 'actor-hero',
      status: {
        kind: 'known',
        instanceId: 'status-instance-2',
        statusId: 'fixture.status',
        displayName: 'Fixture Status',
        polarity: 'harmful',
        stacks: 3,
      },
    });
    const statuses = actorOf(restacked, 'actor-hero').statuses;
    expect(statuses).toHaveLength(1);
    expect(statuses[0]?.kind === 'known' ? statuses[0].stacks : undefined).toBe(3);

    const removed = applyPresentationEvent(restacked, {
      type: 'statusRemoved',
      eventId: 'evt-20',
      sequence: 20,
      actorId: 'actor-hero',
      statusInstanceId: 'status-instance-2',
    });
    expect(actorOf(removed, 'actor-hero').statuses).toHaveLength(0);
  });

  it('ignores removal of a status instance the actor does not currently show', () => {
    expect(
      applyPresentationEvent(baseSnapshot, {
        type: 'statusRemoved',
        eventId: 'evt-21',
        sequence: 21,
        actorId: 'actor-hero',
        statusInstanceId: 'status-instance-absent',
      }),
    ).toBe(baseSnapshot);
  });
});

describe('presentation preferences never reach authority', () => {
  it('takes exactly the snapshot and the event, so no preference can influence a result', () => {
    expect(applyPresentationEvent.length).toBe(2);
  });

  it('produces identical results regardless of the preferences the host has resolved', () => {
    const event: PresentationEvent = {
      type: 'damageApplied',
      eventId: 'evt-22',
      sequence: 22,
      targetActorId: 'actor-hero',
      displayAmount: 9,
      resultingResource: { resourceId: 'life', resultingValue: 91, resultingMaximum: 100 },
    };

    const calm = normalizePresentationPreferences({
      reducedMotion: true,
      reducedShake: true,
      reducedFlashes: true,
      presentationSpeed: 0.25,
    });
    const brisk = normalizePresentationPreferences({ presentationSpeed: 4 });

    expect(calm).not.toEqual(brisk);
    expect(applyPresentationEvent(baseSnapshot, event)).toEqual(applyPresentationEvent(baseSnapshot, event));
    expect(resourceOf(actorOf(applyPresentationEvent(baseSnapshot, event), 'actor-hero'), 'life').current).toBe(91);
  });

  it('validates untrusted host preference input instead of trusting its shape', () => {
    expect(normalizePresentationPreferences(undefined)).toEqual(DEFAULT_PRESENTATION_PREFERENCES);
    expect(normalizePresentationPreferences(null)).toEqual(DEFAULT_PRESENTATION_PREFERENCES);
    expect(normalizePresentationPreferences('reduce everything')).toEqual(DEFAULT_PRESENTATION_PREFERENCES);
    expect(normalizePresentationPreferences({ reducedMotion: 'yes' }).reducedMotion).toBe(false);
    expect(normalizePresentationPreferences({ reducedMotion: true }).reducedMotion).toBe(true);
    expect(normalizePresentationPreferences({ presentationSpeed: Number.NaN }).presentationSpeed).toBe(1);
    expect(normalizePresentationPreferences({ presentationSpeed: 0 }).presentationSpeed).toBe(0.25);
    expect(normalizePresentationPreferences({ presentationSpeed: 1000 }).presentationSpeed).toBe(4);
    expect(normalizePresentationPreferences({ presentationSpeed: '2' }).presentationSpeed).toBe(1);
  });
});

describe('viewer mode and intent vocabulary', () => {
  it('exposes the viewer modes the theatre must share one rendering path for', () => {
    const modes: readonly TheatreViewerMode[] = ['live', 'replay', 'spectator'];
    expect(modes).toHaveLength(3);
  });

  it('expresses only narrow intents, never outcomes', () => {
    const intents: readonly TheatreIntent[] = [
      { kind: 'basicAttack', targetActorId: 'actor-foe' },
      { kind: 'useSkill', skillId: 'fixture.skill', targetActorId: 'actor-foe' },
      { kind: 'useItem', itemId: 'fixture.item', targetActorId: 'actor-hero' },
      { kind: 'selectTarget', targetActorId: 'actor-foe' },
      { kind: 'inspect', targetActorId: 'actor-foe' },
      { kind: 'defend' },
      { kind: 'withdraw' },
    ];

    for (const intent of intents) {
      expect(intent).not.toHaveProperty('damage');
      expect(intent).not.toHaveProperty('resultingResource');
      expect(intent).not.toHaveProperty('succeeded');
    }
  });
});
