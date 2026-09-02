import { describe, expect, it } from 'vitest';

import { PixiTheatreRenderer } from '../src/index.ts';
import {
  FakeApplicationFactory,
  FakeCanvas,
  FakeHost,
  FakeResizeObserver,
  createResizeObserverHarness,
} from './fakes.ts';

describe('host-controlled fallback boundary', () => {
  it.each(['browserUnavailable', 'initializationFailed'] as const)(
    'returns typed fallback control for %s without leaving a blank canvas',
    async (reason) => {
      const factory = new FakeApplicationFactory();
      factory.failure = reason;
      const resize = createResizeObserverHarness();
      const renderer = new PixiTheatreRenderer({
        applicationFactory: factory,
        createResizeObserver: resize.factory,
      });
      const host = new FakeHost(800, 450);

      await expect(renderer.mount(host as unknown as HTMLElement)).resolves.toEqual({
        kind: 'fallbackRequired',
        reason,
      });
      expect(host.children).toEqual([]);
      expect(resize.observers).toHaveLength(0);
    },
  );

  it('can retry after fallback because failed initialization does not retain mounted state', async () => {
    const factory = new FakeApplicationFactory();
    factory.failure = 'initializationFailed';
    const renderer = new PixiTheatreRenderer({ applicationFactory: factory });
    const host = new FakeHost(800, 450);

    await renderer.mount(host as unknown as HTMLElement);
    factory.failure = null;

    await expect(renderer.mount(host as unknown as HTMLElement)).resolves.toEqual({ kind: 'mounted' });
    expect(factory.applications).toHaveLength(1);
  });

  it('rolls back canvas, listener, observer, ticker and Application when mount setup fails', async () => {
    const factory = new FakeApplicationFactory();
    let observer: FakeResizeObserver | null = null;
    const renderer = new PixiTheatreRenderer({
      applicationFactory: factory,
      createResizeObserver: (callback) => {
        observer = new FakeResizeObserver(callback);
        observer.observe = () => { throw new Error('observer setup failed'); };
        return observer;
      },
    });
    const host = new FakeHost(800, 450);

    await expect(renderer.mount(host as unknown as HTMLElement)).resolves.toEqual({
      kind: 'fallbackRequired',
      reason: 'initializationFailed',
    });

    const application = factory.applications[0]!;
    const canvas = application.canvas as unknown as FakeCanvas;
    expect(observer).not.toBeNull();
    expect(observer!.disconnectCalls).toBe(1);
    expect(canvas.listenerCount('webglcontextlost')).toBe(0);
    expect(application.tickerStopCalls).toBe(1);
    expect(application.destroyCalls).toBe(1);
    expect(host.children).toEqual([]);
  });
});
