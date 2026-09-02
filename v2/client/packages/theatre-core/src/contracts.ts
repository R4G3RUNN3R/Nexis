/** Pure, player-visible Visual Theatre wire and retained presentation contracts. */

export const PRESENTATION_CONTRACT_VERSION = 1 as const;
export type PresentationContractVersion = typeof PRESENTATION_CONTRACT_VERSION;

declare const presentationActorIdBrand: unique symbol;
/** Encounter-local, public-safe selector. It is neither identity nor authority. */
export type PresentationActorId = string & { readonly [presentationActorIdBrand]: 'PresentationActorId' };
export type PresentationSide = 'ally' | 'hostile';
export type PresentationFacing = 'left' | 'right';

export interface PresentationResource { readonly resourceId: string; readonly displayName: string; readonly current: number; readonly maximum: number }
export interface PresentationResourceResult { readonly resourceId: string; readonly resultingValue: number; readonly resultingMaximum: number }
export type PresentationStatusPolarity = 'beneficial' | 'harmful' | 'neutral';
export type PresentationStatus =
  | { readonly kind: 'known'; readonly instanceId: string; readonly statusId: string; readonly displayName: string; readonly polarity: PresentationStatusPolarity; readonly stacks?: number; readonly remainingRounds?: number }
  | { readonly kind: 'opaque'; readonly instanceId: string; readonly displayName: string };
export interface PresentationAttachment { readonly slotKey: string; readonly visualKey: string }
export interface PresentationActor {
  readonly actorId: PresentationActorId; readonly displayName: string; readonly side: PresentationSide;
  readonly facing: PresentationFacing; readonly visualKey: string; readonly resources: readonly PresentationResource[];
  readonly statuses: readonly PresentationStatus[]; readonly attachments: readonly PresentationAttachment[];
  readonly defeated: boolean; readonly isLegalTarget: boolean;
}

export type PresentationEncounterOutcome = 'victory' | 'defeat' | 'withdrawn' | 'ended';
export type PresentationInteractionState = 'ready' | 'blockedPendingSnapshot';
export interface BattlePresentationSnapshot {
  readonly contractVersion: PresentationContractVersion; readonly encounterId: string; readonly revision: number;
  /** Last authoritative event sequence incorporated into this projection. */
  readonly eventCursor: number;
  readonly phase: 'active' | 'ended'; readonly roundNumber: number; readonly activeActorId: PresentationActorId | null;
  readonly actors: readonly PresentationActor[]; readonly outcome: PresentationEncounterOutcome | null;
  /** Only a newly decoded authoritative snapshot restores `ready`. */
  readonly interactionState: PresentationInteractionState;
}

export type PresentationAttackOutcome = 'hit' | 'critical' | 'miss' | 'blocked' | 'dodged' | 'parried' | 'guarded';
export type PresentationMovement = 'advanceToTarget' | 'returnToPosition';
interface PresentationEventBase { readonly contractVersion: PresentationContractVersion; readonly encounterId: string; readonly eventId: string; readonly sequence: number }
export type PresentationEvent =
  | (PresentationEventBase & { readonly type: 'actorMoved'; readonly actorId: PresentationActorId; readonly movement: PresentationMovement; readonly targetActorId?: PresentationActorId })
  | (PresentationEventBase & { readonly type: 'skillActivated'; readonly actorId: PresentationActorId; readonly skillVisualKey: string; readonly displayName: string; readonly animationIntent?: string })
  | (PresentationEventBase & { readonly type: 'attackResolved'; readonly actorId: PresentationActorId; readonly targetActorId: PresentationActorId; readonly outcome: PresentationAttackOutcome })
  | (PresentationEventBase & { readonly type: 'damageApplied' | 'healingApplied'; readonly targetActorId: PresentationActorId; readonly displayAmount: number; readonly resultingResource: PresentationResourceResult })
  | (PresentationEventBase & { readonly type: 'resourceChanged'; readonly actorId: PresentationActorId; readonly resultingResource: PresentationResourceResult })
  | (PresentationEventBase & { readonly type: 'statusApplied'; readonly actorId: PresentationActorId; readonly status: PresentationStatus })
  | (PresentationEventBase & { readonly type: 'statusRemoved'; readonly actorId: PresentationActorId; readonly statusInstanceId: string })
  | (PresentationEventBase & { readonly type: 'itemUsed'; readonly actorId: PresentationActorId; readonly itemVisualKey: string; readonly displayName: string })
  | (PresentationEventBase & { readonly type: 'actorDefeated'; readonly actorId: PresentationActorId })
  | (PresentationEventBase & { readonly type: 'turnChanged'; readonly roundNumber: number; readonly activeActorId: PresentationActorId | null })
  | (PresentationEventBase & { readonly type: 'combatMessage'; readonly message: string })
  | (PresentationEventBase & { readonly type: 'encounterEnded'; readonly outcome: PresentationEncounterOutcome });

export type TheatreViewerMode = 'live' | 'replay' | 'spectator';
interface TheatreIntentBase { readonly contractVersion: PresentationContractVersion; readonly encounterId: string }
export type TheatreIntent =
  | (TheatreIntentBase & { readonly kind: 'basicAttack' | 'selectTarget' | 'inspect'; readonly targetActorId: PresentationActorId })
  | (TheatreIntentBase & { readonly kind: 'useSkill'; readonly skillId: string; readonly targetActorId?: PresentationActorId })
  | (TheatreIntentBase & { readonly kind: 'useItem'; readonly itemId: string; readonly targetActorId?: PresentationActorId })
  | (TheatreIntentBase & { readonly kind: 'defend' | 'withdraw' });
export interface PresentationPreferences { readonly reducedMotion: boolean; readonly reducedShake: boolean; readonly reducedFlashes: boolean; readonly presentationSpeed: number }

export type PresentationDecodeFailureReason = 'unsupportedVersion' | 'unknownVariant' | 'unknownField' | 'invalidShape' | 'invalidReference';
export type PresentationDecodeResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: PresentationDecodeFailureReason; readonly message: string };
export type PresentationResyncReason = 'wrongEncounter' | 'staleOrDuplicate' | 'sequenceGap' | 'invalidReference' | 'interactionProjectionStale';
export type ApplyPresentationEventResult =
  | { readonly kind: 'applied'; readonly snapshot: BattlePresentationSnapshot }
  | { readonly kind: 'resyncRequired'; readonly reason: PresentationResyncReason; readonly snapshot: BattlePresentationSnapshot };
