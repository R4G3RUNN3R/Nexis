import type { ApplyPresentationEventResult, BattlePresentationSnapshot, PresentationActor, PresentationAttachment, PresentationEvent, PresentationPreferences, PresentationResource, PresentationResourceResult, PresentationStatus, TheatreIntent, TheatreViewerMode } from './contracts.ts';

const MIN_PRESENTATION_SPEED = 0.25;
const MAX_PRESENTATION_SPEED = 4;
export const DEFAULT_PRESENTATION_PREFERENCES: PresentationPreferences = Object.freeze({ reducedMotion: false, reducedShake: false, reducedFlashes: false, presentationSpeed: 1 });

/** Applies exactly the next encounter event or returns an explicit resync requirement. */
export function applyPresentationEvent(snapshot: BattlePresentationSnapshot, event: PresentationEvent): ApplyPresentationEventResult {
  const owned = internalizeSnapshot(snapshot);
  if (event.encounterId !== owned.encounterId) return resync(owned, 'wrongEncounter');
  if (event.sequence <= owned.eventCursor) return resync(owned, 'staleOrDuplicate');
  if (event.sequence !== owned.eventCursor + 1) return resync(owned, 'sequenceGap');

  if (!eventReferencesExist(owned, event)) return resync(owned, 'invalidReference');

  let next: BattlePresentationSnapshot;
  switch (event.type) {
    case 'damageApplied': case 'healingApplied': next = withResourceResult(owned, event.targetActorId, event.resultingResource); break;
    case 'resourceChanged': next = withResourceResult(owned, event.actorId, event.resultingResource); break;
    case 'statusApplied': next = withStatusApplied(owned, event.actorId, cloneStatus(event.status)); break;
    case 'statusRemoved': next = withStatusRemoved(owned, event.actorId, event.statusInstanceId); break;
    case 'actorDefeated': next = withActor(owned, event.actorId, (actor) => ({ ...actor, defeated: true })); break;
    case 'turnChanged': next = { ...owned, roundNumber: event.roundNumber, activeActorId: event.activeActorId }; break;
    case 'encounterEnded': next = { ...owned, phase: 'ended', outcome: event.outcome, activeActorId: null }; break;
    case 'actorMoved': case 'skillActivated': case 'attackResolved': case 'itemUsed': case 'combatMessage': next = owned; break;
    default: return assertNever(event);
  }

  next = { ...next, eventCursor: event.sequence };
  if (changesInteractionLegality(event.type)) {
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

/**
 * Local safety/UX gate only. It refuses intents the latest authoritative projection
 * already contradicts; the authority still revalidates every submitted intent.
 */
export function canSubmitTheatreIntent(snapshot: BattlePresentationSnapshot, viewerMode: TheatreViewerMode, intent: TheatreIntent): boolean {
  if (viewerMode !== 'live') return false;
  if (snapshot.phase !== 'active' || snapshot.interactionState !== 'ready') return false;
  if (intent.contractVersion !== snapshot.contractVersion || intent.encounterId !== snapshot.encounterId) return false;
  const targetActorId = 'targetActorId' in intent ? intent.targetActorId : undefined;
  if (targetActorId === undefined) return true;
  return snapshot.actors.some((actor) => actor.actorId === targetActorId && actor.isLegalTarget && !actor.defeated);
}

/** Every retained-state change can invalidate the offered action/target projection. */
function changesInteractionLegality(type: PresentationEvent['type']): boolean {
  switch (type) {
    case 'damageApplied': case 'healingApplied': case 'resourceChanged': case 'statusApplied': case 'statusRemoved': case 'actorDefeated': case 'turnChanged': case 'encounterEnded': return true;
    case 'actorMoved': case 'skillActivated': case 'attackResolved': case 'itemUsed': case 'combatMessage': return false;
    default: return assertNever(type);
  }
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

/** Rebuilds the caller's snapshot so results never freeze, mutate or alias caller-owned objects. */
function internalizeSnapshot(snapshot: BattlePresentationSnapshot): BattlePresentationSnapshot {
  return freeze({ contractVersion: snapshot.contractVersion, encounterId: snapshot.encounterId, revision: snapshot.revision, eventCursor: snapshot.eventCursor, phase: snapshot.phase, roundNumber: snapshot.roundNumber, activeActorId: snapshot.activeActorId, actors: snapshot.actors.map(cloneActor), outcome: snapshot.outcome, interactionState: snapshot.interactionState });
}
function cloneActor(actor: PresentationActor): PresentationActor {
  return { actorId: actor.actorId, displayName: actor.displayName, side: actor.side, facing: actor.facing, visualKey: actor.visualKey, resources: actor.resources.map(cloneResource), statuses: actor.statuses.map(cloneStatus), attachments: actor.attachments.map(cloneAttachment), defeated: actor.defeated, isLegalTarget: actor.isLegalTarget };
}
function cloneResource(resource: PresentationResource): PresentationResource { return { resourceId: resource.resourceId, displayName: resource.displayName, current: resource.current, maximum: resource.maximum }; }
function cloneAttachment(attachment: PresentationAttachment): PresentationAttachment { return { slotKey: attachment.slotKey, visualKey: attachment.visualKey }; }
function cloneStatus(status: PresentationStatus): PresentationStatus {
  if (status.kind === 'opaque') return { kind: 'opaque', instanceId: status.instanceId, displayName: status.displayName };
  return { kind: 'known', instanceId: status.instanceId, statusId: status.statusId, displayName: status.displayName, polarity: status.polarity, ...(status.stacks === undefined ? {} : { stacks: status.stacks }), ...(status.remainingRounds === undefined ? {} : { remainingRounds: status.remainingRounds }) };
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
