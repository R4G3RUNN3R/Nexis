import type {
  BattlePresentationSnapshot,
  PresentationActor,
  PresentationEvent,
  PresentationPreferences,
  PresentationResource,
  PresentationResourceResult,
  PresentationStatus,
} from './contracts.ts';

/** Presentation speed bounds. Presentation timing only; never authoritative time. */
const MIN_PRESENTATION_SPEED = 0.25;
const MAX_PRESENTATION_SPEED = 4;

export const DEFAULT_PRESENTATION_PREFERENCES: PresentationPreferences = Object.freeze({
  reducedMotion: false,
  reducedShake: false,
  reducedFlashes: false,
  presentationSpeed: 1,
});

/**
 * Applies one authoritative presentation event to the player-visible snapshot.
 *
 * The function is pure and total. Displayed values are copied from the event's
 * authoritative resulting fields; nothing is derived by arithmetic from the
 * previous snapshot. An event the Theatre cannot address exactly - an unknown
 * actor, an unshown resource, an absent status or an unrecognised future event
 * type - leaves the snapshot untouched rather than inventing state.
 *
 * Preferences and viewer mode are deliberately not parameters.
 */
export function applyPresentationEvent(
  snapshot: BattlePresentationSnapshot,
  event: PresentationEvent,
): BattlePresentationSnapshot {
  switch (event.type) {
    case 'damageApplied':
    case 'healingApplied':
      return withResourceResult(snapshot, event.targetActorId, event.resultingResource);

    case 'resourceChanged':
      return withResourceResult(snapshot, event.actorId, event.resultingResource);

    case 'statusApplied':
      return withStatusApplied(snapshot, event.actorId, event.status);

    case 'statusRemoved':
      return withStatusRemoved(snapshot, event.actorId, event.statusInstanceId);

    case 'actorDefeated':
      return withActor(snapshot, event.actorId, (actor) =>
        actor.defeated ? actor : { ...actor, defeated: true },
      );

    case 'turnChanged':
      return {
        ...snapshot,
        roundNumber: event.roundNumber,
        activeActorId: event.activeActorId,
      };

    case 'encounterEnded':
      return { ...snapshot, phase: 'ended', outcome: event.outcome };

    case 'actorMoved':
    case 'skillActivated':
    case 'attackResolved':
    case 'itemUsed':
    case 'combatMessage':
      // Display cues. They change no player-visible authoritative value.
      return snapshot;

    default:
      // An event contract this build does not recognise carries no meaning here.
      return snapshot;
  }
}

/**
 * Validates untrusted host/user preference input into strict presentation
 * preferences. Only exact booleans are honoured and speed is clamped; anything
 * else falls back to the neutral default.
 */
export function normalizePresentationPreferences(input: unknown): PresentationPreferences {
  if (input === null || typeof input !== 'object') {
    return DEFAULT_PRESENTATION_PREFERENCES;
  }

  const candidate = input as Record<string, unknown>;
  return {
    reducedMotion: readBoolean(candidate['reducedMotion']),
    reducedShake: readBoolean(candidate['reducedShake']),
    reducedFlashes: readBoolean(candidate['reducedFlashes']),
    presentationSpeed: readPresentationSpeed(candidate['presentationSpeed']),
  };
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function readPresentationSpeed(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_PRESENTATION_PREFERENCES.presentationSpeed;
  }
  return Math.min(MAX_PRESENTATION_SPEED, Math.max(MIN_PRESENTATION_SPEED, value));
}

function withResourceResult(
  snapshot: BattlePresentationSnapshot,
  actorId: string,
  result: PresentationResourceResult,
): BattlePresentationSnapshot {
  return withActor(snapshot, actorId, (actor) => {
    const index = actor.resources.findIndex(
      (resource) => resource.resourceId === result.resourceId,
    );
    const existing = index === -1 ? undefined : actor.resources[index];
    if (existing === undefined) {
      return actor;
    }

    const updated: PresentationResource = {
      ...existing,
      current: result.resultingValue,
      maximum: result.resultingMaximum,
    };
    return { ...actor, resources: replaceAt(actor.resources, index, updated) };
  });
}

function withStatusApplied(
  snapshot: BattlePresentationSnapshot,
  actorId: string,
  status: PresentationStatus,
): BattlePresentationSnapshot {
  return withActor(snapshot, actorId, (actor) => {
    const index = actor.statuses.findIndex(
      (candidate) => candidate.instanceId === status.instanceId,
    );
    return {
      ...actor,
      statuses:
        index === -1
          ? [...actor.statuses, status]
          : replaceAt(actor.statuses, index, status),
    };
  });
}

function withStatusRemoved(
  snapshot: BattlePresentationSnapshot,
  actorId: string,
  statusInstanceId: string,
): BattlePresentationSnapshot {
  return withActor(snapshot, actorId, (actor) => {
    const remaining = actor.statuses.filter(
      (candidate) => candidate.instanceId !== statusInstanceId,
    );
    return remaining.length === actor.statuses.length ? actor : { ...actor, statuses: remaining };
  });
}

function withActor(
  snapshot: BattlePresentationSnapshot,
  actorId: string,
  update: (actor: PresentationActor) => PresentationActor,
): BattlePresentationSnapshot {
  const index = snapshot.actors.findIndex((actor) => actor.actorId === actorId);
  const existing = index === -1 ? undefined : snapshot.actors[index];
  if (existing === undefined) {
    return snapshot;
  }

  const updated = update(existing);
  if (updated === existing) {
    return snapshot;
  }
  return { ...snapshot, actors: replaceAt(snapshot.actors, index, updated) };
}

function replaceAt<T>(items: readonly T[], index: number, value: T): readonly T[] {
  const next = items.slice();
  next[index] = value;
  return next;
}
