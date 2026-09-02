import { describe, expect, it } from 'vitest';

import { PixiTheatreRenderer } from '../src/index.ts';
import {
  FakeApplicationFactory,
  FakeCanvas,
  FakeHost,
  createResizeObserverHarness,
} from './fakes.ts';

function createRenderer(factory = new FakeApplicationFactory()) {
  const resize = createResizeObserverHarness();
  const renderer = new PixiTheatreRenderer({
    applicationFactory: factory,
    createResizeObserver: resize.factory,
    devicePixelRatio: () => 3,
    maximumResolution: 2,
  });
  return { factory, renderer, resize };
}

describe('PixiTheatreRenderer lifecycle', () => {
  it('creates one WebGL-preferred Application for one successful mount', async () => {
    const { factory, renderer } = createRenderer();
    const host = new FakeHost(960, 540);

    await expect(renderer.mount(host as unknown as HTMLElement)).resolves.toEqual({ kind: 'mounted' });

    expect(factory.applications).toHaveLength(1);
    expect(factory.options).toEqual([{ width: 960, height: 540, resolution: 2, preference: 'webgl' }]);
    expect(host.children).toEqual([factory.applications[0]?.canvas]);
  });

  it('rejects duplicate and concurrent mounts without creating another Application', async () => {
    const { factory, renderer } = createRenderer();
    const host = new FakeHost(640, 360);
    let release!: () => void;
    factory.pending = new Promise<void>((resolve) => { release = resolve; });

    const first = renderer.mount(host as unknown as HTMLElement);
    await expect(renderer.mount(host as unknown as HTMLElement)).resolves.toEqual({
      kind: 'rejected',
      reason: 'alreadyMounted',
    });
    release();
    await expect(first).resolves.toEqual({ kind: 'mounted' });
    await expect(renderer.mount(host as unknown as HTMLElement)).resolves.toEqual({
      kind: 'rejected',
      reason: 'alreadyMounted',
    });
    expect(factory.applications).toHaveLength(1);
  });

  it('rejects an invalid host before creating an Application', async () => {
    const { factory, renderer } = createRenderer();

    await expect(renderer.mount(null as unknown as HTMLElement)).resolves.toEqual({
      kind: 'rejected',
      reason: 'invalidHost',
    });
    expect(factory.applications).toHaveLength(0);
  });

  it('resizes from the host, ResizeObserver, and explicit resize calls', async () => {
    const { factory, renderer, resize } = createRenderer();
    const host = new FakeHost(800, 450);
    await renderer.mount(host as unknown as HTMLElement);
    const application = factory.applications[0]!;

    expect(application.resizeCalls).toEqual([[800, 450]]);
    expect(resize.observers[0]?.observed).toBe(host);
    resize.observers[0]?.emit(1024, 576);
    renderer.resize(320, 180);

    expect(application.resizeCalls).toEqual([[800, 450], [1024, 576], [320, 180]]);
  });

  it('disposes every owned observer, listener, ticker, canvas and Application exactly once', async () => {
    const { factory, renderer, resize } = createRenderer();
    const host = new FakeHost(800, 450);
    await renderer.mount(host as unknown as HTMLElement);
    const application = factory.applications[0]!;
    const canvas = application.canvas as unknown as FakeCanvas;

    expect(canvas.listenerCount('webglcontextlost')).toBe(1);
    renderer.dispose();
    renderer.dispose();

    expect(resize.observers[0]?.disconnectCalls).toBe(1);
    expect(canvas.listenerCount('webglcontextlost')).toBe(0);
    expect(application.tickerStopCalls).toBe(1);
    expect(application.destroyCalls).toBe(1);
    expect(host.children).toEqual([]);
  });

  it('remounts with a clean new Application and new observer after disposal', async () => {
    const { factory, renderer, resize } = createRenderer();
    const firstHost = new FakeHost(800, 450);
    const secondHost = new FakeHost(1200, 675);

    await renderer.mount(firstHost as unknown as HTMLElement);
    renderer.dispose();
    await expect(renderer.mount(secondHost as unknown as HTMLElement)).resolves.toEqual({ kind: 'mounted' });

    expect(factory.applications).toHaveLength(2);
    expect(factory.applications[0]?.destroyCalls).toBe(1);
    expect(factory.applications[1]?.destroyCalls).toBe(0);
    expect(resize.observers).toHaveLength(2);
    expect(firstHost.children).toEqual([]);
    expect(secondHost.children).toEqual([factory.applications[1]?.canvas]);
  });
});
