import type { PixiContainerHandle } from './PixiApplicationFactory.ts';

export const STAGE_LAYER_ORDER = [
  'farBackground',
  'environment',
  'ground',
  'actors',
  'transientEffects',
  'floatingFeedback',
  'overlays',
] as const;

export type StageLayerName = (typeof STAGE_LAYER_ORDER)[number];
export type StageLayers = Readonly<Record<StageLayerName, PixiContainerHandle>>;

export function createStageLayers(
  stage: PixiContainerHandle,
  createContainer: (label: StageLayerName) => PixiContainerHandle,
): StageLayers {
  const farBackground = createContainer('farBackground');
  const environment = createContainer('environment');
  const ground = createContainer('ground');
  const actors = createContainer('actors');
  const transientEffects = createContainer('transientEffects');
  const floatingFeedback = createContainer('floatingFeedback');
  const overlays = createContainer('overlays');

  const layers: StageLayers = {
    farBackground,
    environment,
    ground,
    actors,
    transientEffects,
    floatingFeedback,
    overlays,
  };
  stage.addChild(...STAGE_LAYER_ORDER.map((name) => layers[name]));
  return layers;
}
