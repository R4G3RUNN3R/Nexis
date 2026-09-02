/**
 * Nexis Visual Theatre presentation contracts.
 *
 * Nexis determines reality. The Theatre displays it and captures intent.
 *
 * Everything in this file describes player-visible presentation data supplied by
 * an authoritative Nexis projection, or a narrow intent the player may request.
 * Nothing here is authoritative: there are no formulas, no ownership, no rewards,
 * no cooldown truth and no legality decisions. Values that a player sees are
 * carried by the authoritative event that produced them, never recomputed here.
 */

/** Public-safe selector for an actor on the stage. Never an internal CharacterId. */
export type PresentationActorId = string;

/** Which side of the battlefield an actor presents on. */
export type PresentationSide = 'ally' | 'hostile';

/** Presentation facing only. It carries no gameplay meaning. */
export type PresentationFacing = 'left' | 'right';

/** A player-visible resource bar supplied by the authoritative projection. */
export interface PresentationResource {
  readonly resourceId: string;
  readonly displayName: string;
  readonly current: number;
  readonly maximum: number;
}

/** The authoritative resulting value of a resource after an authoritative event. */
export interface PresentationResourceResult {
  readonly resourceId: string;
  readonly resultingValue: number;
  readonly resultingMaximum: number;
}

/** How a revealed status reads to the player. Meaning must not depend on colour alone. */
export type PresentationStatusPolarity = 'beneficial' | 'harmful' | 'neutral';

/**
 * A status the player may see.
 *
 * An unrevealed effect stays opaque: the Theatre is given a display label such as
 * `Unknown Effect` and an opaque instance key, never the internal status identity.
 */
export type PresentationStatus =
  | {
      readonly kind: 'known';
      readonly instanceId: string;
      readonly statusId: string;
      readonly displayName: string;
      readonly polarity: PresentationStatusPolarity;
      readonly stacks?: number;
      readonly remainingRounds?: number;
    }
  | {
      readonly kind: 'opaque';
      readonly instanceId: string;
      readonly displayName: string;
    };

/** A supplied visual attachment descriptor. Visuals never grant ownership or effects. */
export interface PresentationAttachment {
  readonly slotKey: string;
  readonly visualKey: string;
}

/** One actor as the player is entitled to see it. */
export interface PresentationActor {
  readonly actorId: PresentationActorId;
  readonly displayName: string;
  readonly side: PresentationSide;
  readonly facing: PresentationFacing;
  /** Stable actor visual identity key resolved by the renderer to a placeholder or asset. */
  readonly visualKey: string;
  readonly resources: readonly PresentationResource[];
  readonly statuses: readonly PresentationStatus[];
  readonly attachments: readonly PresentationAttachment[];
  readonly defeated: boolean;
  /** Offered by the authority. The Theatre may never promote an illegal target. */
  readonly isLegalTarget: boolean;
}

/** Encounter completion as reported by the authority. */
export type PresentationEncounterOutcome = 'victory' | 'defeat' | 'withdrawn' | 'ended';

/** The player-visible encounter state the stage renders. */
export interface BattlePresentationSnapshot {
  readonly encounterId: string;
  /** Monotonic projection revision supplied by the authority; ordering aid only. */
  readonly revision: number;
  readonly phase: 'active' | 'ended';
  readonly roundNumber: number;
  readonly activeActorId: PresentationActorId | null;
  readonly actors: readonly PresentationActor[];
  readonly outcome: PresentationEncounterOutcome | null;
}

/** How an attack read to the player. The Theatre displays this; it never decides it. */
export type PresentationAttackOutcome =
  | 'hit'
  | 'critical'
  | 'miss'
  | 'blocked'
  | 'dodged'
  | 'parried'
  | 'guarded';

/** Presentation-only movement cue. It is not pathfinding and not a position authority. */
export type PresentationMovement = 'advanceToTarget' | 'returnToPosition';

interface PresentationEventBase {
  readonly eventId: string;
  /** Authoritative ordering supplied with the event; the Theatre preserves it. */
  readonly sequence: number;
}

/**
 * Semantic presentation events.
 *
 * The existence of an event type creates no gameplay mechanic. Only authoritative
 * Nexis systems may emit the corresponding occurrence, and every event that changes
 * a displayed value carries that authoritative resulting value with it.
 */
export type PresentationEvent =
  | (PresentationEventBase & {
      readonly type: 'actorMoved';
      readonly actorId: PresentationActorId;
      readonly movement: PresentationMovement;
      readonly targetActorId?: PresentationActorId;
    })
  | (PresentationEventBase & {
      readonly type: 'skillActivated';
      readonly actorId: PresentationActorId;
      readonly skillVisualKey: string;
      readonly displayName: string;
      readonly animationIntent?: string;
    })
  | (PresentationEventBase & {
      readonly type: 'attackResolved';
      readonly actorId: PresentationActorId;
      readonly targetActorId: PresentationActorId;
      readonly outcome: PresentationAttackOutcome;
    })
  | (PresentationEventBase & {
      readonly type: 'damageApplied';
      readonly targetActorId: PresentationActorId;
      /** Display figure supplied by the authority. It is shown, never used to derive state. */
      readonly displayAmount: number;
      readonly resultingResource: PresentationResourceResult;
    })
  | (PresentationEventBase & {
      readonly type: 'healingApplied';
      readonly targetActorId: PresentationActorId;
      readonly displayAmount: number;
      readonly resultingResource: PresentationResourceResult;
    })
  | (PresentationEventBase & {
      readonly type: 'resourceChanged';
      readonly actorId: PresentationActorId;
      readonly resultingResource: PresentationResourceResult;
    })
  | (PresentationEventBase & {
      readonly type: 'statusApplied';
      readonly actorId: PresentationActorId;
      readonly status: PresentationStatus;
    })
  | (PresentationEventBase & {
      readonly type: 'statusRemoved';
      readonly actorId: PresentationActorId;
      readonly statusInstanceId: string;
    })
  | (PresentationEventBase & {
      readonly type: 'itemUsed';
      readonly actorId: PresentationActorId;
      readonly itemVisualKey: string;
      readonly displayName: string;
    })
  | (PresentationEventBase & {
      readonly type: 'actorDefeated';
      readonly actorId: PresentationActorId;
    })
  | (PresentationEventBase & {
      readonly type: 'turnChanged';
      readonly roundNumber: number;
      readonly activeActorId: PresentationActorId | null;
    })
  | (PresentationEventBase & {
      readonly type: 'combatMessage';
      readonly message: string;
    })
  | (PresentationEventBase & {
      readonly type: 'encounterEnded';
      readonly outcome: PresentationEncounterOutcome;
    });

/** Live, replay and spectator presentation share one rendering path. */
export type TheatreViewerMode = 'live' | 'replay' | 'spectator';

/**
 * Narrow player intents the Theatre may request.
 *
 * An intent never states an outcome. The authority re-evaluates every intent
 * against current authoritative state.
 */
export type TheatreIntent =
  | { readonly kind: 'basicAttack'; readonly targetActorId: PresentationActorId }
  | {
      readonly kind: 'useSkill';
      readonly skillId: string;
      readonly targetActorId?: PresentationActorId;
    }
  | {
      readonly kind: 'useItem';
      readonly itemId: string;
      readonly targetActorId?: PresentationActorId;
    }
  | { readonly kind: 'selectTarget'; readonly targetActorId: PresentationActorId }
  | { readonly kind: 'inspect'; readonly targetActorId: PresentationActorId }
  | { readonly kind: 'defend' }
  | { readonly kind: 'withdraw' };

/**
 * Binding user presentation preferences.
 *
 * Preferences affect presentation only. They are deliberately not an input to
 * snapshot application, so no preference can change an authoritative value.
 */
export interface PresentationPreferences {
  readonly reducedMotion: boolean;
  readonly reducedShake: boolean;
  readonly reducedFlashes: boolean;
  /** Presentation timing multiplier only. It never affects authoritative time. */
  readonly presentationSpeed: number;
}
