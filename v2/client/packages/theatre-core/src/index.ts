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
  ApplyPresentationEventResult,
  BattlePresentationSnapshot,
  PresentationActor,
  PresentationActorId,
  PresentationAttachment,
  PresentationAttackOutcome,
  PresentationContractVersion,
  PresentationDecodeFailureReason,
  PresentationDecodeResult,
  PresentationEncounterOutcome,
  PresentationEvent,
  PresentationFacing,
  PresentationInteractionState,
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

export { PRESENTATION_CONTRACT_VERSION } from './contracts.ts';

export {
  DEFAULT_PRESENTATION_PREFERENCES,
  applyPresentationEvent,
  canSubmitTheatreIntent,
  normalizePresentationPreferences,
} from './presentation.ts';

export {
  decodeBattlePresentationSnapshot,
  decodePresentationEvent,
  decodeTheatreIntent,
} from './wire.ts';
