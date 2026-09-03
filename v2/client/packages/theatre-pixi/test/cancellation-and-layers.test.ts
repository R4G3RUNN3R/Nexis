import { describe, expect, it } from 'vitest';

import { PixiTheatreRenderer, STAGE_LAYER_ORDER } from '../src/index.ts';
import { FakeApplicationFactory, FakeHost, createResizeObserverHarness } from './fakes.ts';

function pendingFactory(): {
  readonly factory: FakeApplicationFactory;
  readonly release: () => void;
} {
  const factory = new FakeApplicationFactory();
  let release!: () => void;
  factory.pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { factory, release: () => release() };
}

describe('mount cancellation', () => {
  it('reports mountCancelled when creation resolves unavailable after disposal', async () => {
    const { factory, release } = pendingFactory();
    factory.failure = 'initializationFailed';
    const renderer = new PixiTheatreRenderer({ applicationFactory: factory });
    const host = new FakeHost(800, 450);

    const mounting = renderer.mount(host as unknown as HTMLElement);
    renderer.dispose();
    release();

    await expect(mounting).resolves.toEqual({ kind: 'rejected', reason: 'mountCancelled' });
    expect(host.children).toEqual([]);
  });

  it('reports mountCancelled when creation rejects after disposal', async () => {
    const factory = new FakeApplicationFactory();
    let reject!: (error: Error) => void;
    factory.pending = new Promise<void>((_resolve, rejectPending) => {
      reject = rejectPending;
    });
    const renderer = new PixiTheatreRenderer({ applicationFactory: factory });
    const host = new FakeHost(800, 450);

    const mounting = renderer.mount(host as unknown as HTMLElement);
    renderer.dispose();
    reject(new Error('pixi initialization exploded'));

    await expect(mounting).resolves.toEqual({ kind: 'rejected', reason: 'mountCancelled' });
    expect(host.children).toEqual([]);
  });

  it('still reports fallbackRequired when creation is unavailable without cancellation', async () => {
    const factory = new FakeApplicationFactory();
    factory.failure = 'browserUnavailable';
    const renderer = new PixiTheatreRenderer({ applicationFactory: factory });

    await expect(
      renderer.mount(new FakeHost(800, 450) as unknown as HTMLElement),
    ).resolves.toEqual({ kind: 'fallbackRequired', reason: 'browserUnavailable' });
  });
});

describe('renderer-owned stage layer handles', () => {
  it('exposes no layer before mount and every ordered layer after mount', async () => {
    const resize = createResizeObserverHarness();
    const renderer = new PixiTheatreRenderer({
      applicationFactory: new FakeApplicationFactory(),
      createResizeObserver: resize.factory,
    });

    expect(renderer.stageLayer('actors')).toBeNull();

    await renderer.mount(new FakeHost(800, 450) as unknown as HTMLElement);

    for (const name of STAGE_LAYER_ORDER) {
      expect(renderer.stageLayer(name)?.label).toBe(name);
    }
  });

  it('releases layer handles on disposal and issues fresh handles on remount', async () => {
    const factory = new FakeApplicationFactory();
    const resize = createResizeObserverHarness();
    const renderer = new PixiTheatreRenderer({
      applicationFactory: factory,
      createResizeObserver: resize.factory,
    });

    await renderer.mount(new FakeHost(800, 450) as unknown as HTMLElement);
    const first = renderer.stageLayer('actors');
    renderer.dispose();

    expect(renderer.stageLayer('actors')).toBeNull();

    await renderer.mount(new FakeHost(800, 450) as unknown as HTMLElement);
    const second = renderer.stageLayer('actors');

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
  });
});
