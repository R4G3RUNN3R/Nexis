/** Presentation-only PixiJS lifecycle boundary for Nexis Visual Theatre. */

export {
  LazyPixiApplicationFactory,
  type PixiApplicationCreateOptions,
  type PixiApplicationCreationResult,
  type PixiApplicationFactory,
  type PixiApplicationHandle,
  type PixiContainerHandle,
  type PixiRendererPreference,
} from './PixiApplicationFactory.ts';

export {
  PixiTheatreRenderer,
  type ITheatreRenderer,
  type PixiTheatreRendererOptions,
  type ResizeObserverFactory,
  type ResizeObserverHandle,
  type TheatreMountResult,
} from './PixiTheatreRenderer.ts';

export {
  STAGE_LAYER_ORDER,
  createStageLayers,
  type StageLayerName,
  type StageLayers,
} from './stageLayers.ts';
