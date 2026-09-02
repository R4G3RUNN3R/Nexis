import type { ApplyPresentationEventResult, BattlePresentationSnapshot, PresentationActor, PresentationEvent, PresentationPreferences, PresentationResource, PresentationResourceResult, PresentationStatus, TheatreViewerMode } from './contracts.ts';

const MIN_PRESENTATION_SPEED = 0.25;
const MAX_PRESENTATION_SPEED = 4;
export const DEFAULT_PRESENTATION_PREFERENCES: PresentationPreferences = Object.freeze({ reducedMotion: false, reducedShake: false, reducedFlashes: false, presentationSpeed: 1 });

/** Applies exactly the next encounter event or returns an explicit resync requirement. */
export function applyPresentationEvent(snapshot: BattlePresentationSnapshot, event: PresentationEvent): ApplyPresentationEventResult {
  if (event.encounterId !== snapshot.encounterId) return resync(snapshot, 'wrongEncounter');
  if (event.sequence <= snapshot.eventCursor) return resync(snapshot, 'staleOrDuplicate');
  if (event.sequence !== snapshot.eventCursor + 1) return resync(snapshot, 'sequenceGap');

  if (!eventReferencesExist(snapshot, event)) return resync(snapshot, 'invalidReference');

  let next: BattlePresentationSnapshot;
  switch (event.type) {
    case 'damageApplied': case 'healingApplied': next = withResourceResult(snapshot, event.targetActorId, event.resultingResource); break;
    case 'resourceChanged': next = withResourceResult(snapshot, event.actorId, event.resultingResource); break;
    case 'statusApplied': next = withStatusApplied(snapshot, event.actorId, event.status); break;
    case 'statusRemoved': next = withStatusRemoved(snapshot, event.actorId, event.statusInstanceId); break;
    case 'actorDefeated': next = withActor(snapshot, event.actorId, (actor) => ({ ...actor, defeated: true })); break;
    case 'turnChanged': next = { ...snapshot, roundNumber: event.roundNumber, activeActorId: event.activeActorId }; break;
    case 'encounterEnded': next = { ...snapshot, phase: 'ended', outcome: event.outcome, activeActorId: null }; break;
    case 'actorMoved': case 'skillActivated': case 'attackResolved': case 'itemUsed': case 'combatMessage': next = snapshot; break;
    default: return assertNever(event);
  }

  next = { ...next, eventCursor: event.sequence };
  if (event.type === 'actorDefeated' || event.type === 'turnChanged' || event.type === 'encounterEnded') {
    next = blockInteractions(next);
    return freeze({ kind: 'resyncRequired', reason: 'interactionProjectionStale', snapshot: freeze(next) });
  }
  return freeze({ kind: 'applied', snapshot: freeze(next) });
}

export function normalizePresentationPreferences(input: unknown): PresentationPreferences {
  if (input === null || typeof input !== 'object') return DEFAULT_PRESENTATION_PREFERENCES;
  const candidate = input as Record<string, unknown>; const speed = candidate['presentationSpeed'];
  return freeze({ reducedMotion: candidate['reducedMotion'] === true, reducedShake: candidate['reducedShake'] === true, reducedFlashes: candidate['reducedFlashes'] === true, presentationSpeed: typeof speed === 'number' && Number.isFinite(speed) ? Math.min(MAX_PRESENTATION_SPEED, Math.max(MIN_PRESENTATION_SPEED, speed)) : 1 });
}

/** Global safety gate only; the authority still decides whether any submitted intent is legal. */
export function canSubmitTheatreIntent(snapshot: BattlePresentationSnapshot, viewerMode: TheatreViewerMode): boolean {
  return viewerMode === 'live' && snapshot.phase === 'active' && snapshot.interactionState === 'ready';
}

function eventReferencesExist(snapshot: BattlePresentationSnapshot, event: PresentationEvent): boolean {
  const hasActor = (id: string | null | undefined): boolean => id === null || id === undefined || snapshot.actors.some((actor) => actor.actorId === id);
  const referencedActor = (id: string): PresentationActor | undefined => snapshot.actors.find((actor) => actor.actorId === id);
  const hasResource = (id: string, resourceId: string): boolean => referencedActor(id)?.resources.some((resource) => resource.resourceId === resourceId) === true;
  switch (event.type) {
    case 'actorMoved': return hasActor(event.actorId) && hasActor(event.targetActorId);
    case 'skillActivated': case 'statusApplied': case 'itemUsed': case 'actorDefeated': return hasActor(event.actorId);
    case 'resourceChanged': return hasResource(event.actorId, event.resultingResource.resourceId);
    case 'statusRemoved': return referencedActor(event.actorId)?.statuses.some((status) => status.instanceId === event.statusInstanceId) === true;
    case 'attackResolved': return hasActor(event.actorId) && hasActor(event.targetActorId);
    case 'damageApplied': case 'healingApplied': return hasResource(event.targetActorId, event.resultingResource.resourceId);
    case 'turnChanged': return hasActor(event.activeActorId);
    case 'combatMessage': case 'encounterEnded': return true;
    default: return assertNever(event);
  }
}

function withResourceResult(snapshot: BattlePresentationSnapshot, actorId: string, result: PresentationResourceResult): BattlePresentationSnapshot {
  return withActor(snapshot, actorId, (actor) => { const index = actor.resources.findIndex((resource) => resource.resourceId === result.resourceId); const existing = actor.resources[index]; if (existing === undefined) return actor; const updated: PresentationResource = { ...existing, current: result.resultingValue, maximum: result.resultingMaximum }; return { ...actor, resources: replaceAt(actor.resources, index, updated) }; });
}
function withStatusApplied(snapshot: BattlePresentationSnapshot, actorId: string, status: PresentationStatus): BattlePresentationSnapshot { return withActor(snapshot, actorId, (actor) => { const index = actor.statuses.findIndex((candidate) => candidate.instanceId === status.instanceId); return { ...actor, statuses: index === -1 ? [...actor.statuses, status] : replaceAt(actor.statuses, index, status) }; }); }
function withStatusRemoved(snapshot: BattlePresentationSnapshot, actorId: string, statusId: string): BattlePresentationSnapshot { return withActor(snapshot, actorId, (actor) => { const statuses = actor.statuses.filter((status) => status.instanceId !== statusId); return statuses.length === actor.statuses.length ? actor : { ...actor, statuses }; }); }
function withActor(snapshot: BattlePresentationSnapshot, actorId: string, update: (actor: PresentationActor) => PresentationActor): BattlePresentationSnapshot { const index = snapshot.actors.findIndex((actor) => actor.actorId === actorId); const existing = snapshot.actors[index]; if (existing === undefined) return snapshot; const updated = update(existing); return updated === existing ? snapshot : { ...snapshot, actors: replaceAt(snapshot.actors, index, updated) }; }
function blockInteractions(snapshot: BattlePresentationSnapshot): BattlePresentationSnapshot { return { ...snapshot, interactionState: 'blockedPendingSnapshot', actors: snapshot.actors.map((actor) => actor.isLegalTarget ? { ...actor, isLegalTarget: false } : actor) }; }
function replaceAt<T>(items: readonly T[], index: number, value: T): readonly T[] { const next = items.slice(); next[index] = value; return next; }
function resync(snapshot: BattlePresentationSnapshot, reason: 'wrongEncounter' | 'staleOrDuplicate' | 'sequenceGap' | 'invalidReference'): ApplyPresentationEventResult { return freeze({ kind: 'resyncRequired', reason, snapshot }); }
function assertNever(value: never): never { throw new Error(`unreachable event: ${String(value)}`); }
function freeze<T>(value: T): T { if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) { for (const nested of Object.values(value as Record<string, unknown>)) freeze(nested); Object.freeze(value); } return value; }
