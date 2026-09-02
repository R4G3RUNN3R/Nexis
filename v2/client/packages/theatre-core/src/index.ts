/**
 * @nexis/theatre-core
 *
 * Renderer-agnostic Nexis Visual Theatre presentation core.
 *
 * This package is pure presentation: no renderer, no UI framework, no transport,
 * no persistence, no randomness and no gameplay authority. Nexis determines
 * reality; the Theatre displays it and captures intent.
 */

export type {
  BattlePresentationSnapshot,
  PresentationActor,
  PresentationActorId,
  PresentationAttachment,
  PresentationAttackOutcome,
  PresentationEncounterOutcome,
  PresentationEvent,
  PresentationFacing,
  PresentationMovement,
  PresentationPreferences,
  PresentationResource,
  PresentationResourceResult,
  PresentationSide,
  PresentationStatus,
  PresentationStatusPolarity,
  TheatreIntent,
  TheatreViewerMode,
} from './contracts.ts';

export {
  DEFAULT_PRESENTATION_PREFERENCES,
  applyPresentationEvent,
  normalizePresentationPreferences,
} from './presentation.ts';
