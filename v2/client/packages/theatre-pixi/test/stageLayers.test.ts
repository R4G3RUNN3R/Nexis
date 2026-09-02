import { describe, expect, it } from 'vitest';

import { STAGE_LAYER_ORDER, createStageLayers } from '../src/index.ts';
import { FakeContainer } from './fakes.ts';

describe('stage layers', () => {
  it('creates and attaches the exact approved presentation order', () => {
    const stage = new FakeContainer('stage');
    const layers = createStageLayers(stage, (label) => new FakeContainer(label));

    expect(STAGE_LAYER_ORDER).toEqual([
      'farBackground',
      'environment',
      'ground',
      'actors',
      'transientEffects',
      'floatingFeedback',
      'overlays',
    ]);
    expect(stage.children.map((child) => child.label)).toEqual(STAGE_LAYER_ORDER);
    expect(Object.keys(layers)).toEqual(STAGE_LAYER_ORDER);
  });
});
