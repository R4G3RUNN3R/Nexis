import type {
  PixiApplicationCreateOptions,
  PixiApplicationFactory,
  PixiApplicationHandle,
  PixiContainerHandle,
  ResizeObserverFactory,
  ResizeObserverHandle,
} from '../src/index.ts';

export class FakeContainer implements PixiContainerHandle {
  readonly children: PixiContainerHandle[] = [];

  constructor(readonly label: string) {}

  addChild(...children: PixiContainerHandle[]): void {
    this.children.push(...children);
  }
}

export class FakeCanvas {
  readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.get(type)?.delete(listener);
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

export class FakeApplication implements PixiApplicationHandle {
  readonly canvas = new FakeCanvas() as unknown as HTMLCanvasElement;
  readonly stage = new FakeContainer('stage');
  readonly resizeCalls: Array<readonly [number, number]> = [];
  tickerStopCalls = 0;
  destroyCalls = 0;

  readonly renderer = {
    resize: (width: number, height: number): void => {
      this.resizeCalls.push([width, height]);
    },
  };

  readonly ticker = {
    stop: (): void => {
      this.tickerStopCalls += 1;
    },
  };

  createContainer(label: string): PixiContainerHandle {
    return new FakeContainer(label);
  }

  destroy(): void {
    this.destroyCalls += 1;
  }
}

export class FakeApplicationFactory implements PixiApplicationFactory {
  readonly applications: FakeApplication[] = [];
  readonly options: PixiApplicationCreateOptions[] = [];
  failure: 'browserUnavailable' | 'initializationFailed' | null = null;
  pending: Promise<void> | null = null;

  async create(options: PixiApplicationCreateOptions) {
    this.options.push(options);
    if (this.pending !== null) {
      await this.pending;
    }
    if (this.failure !== null) {
      return { kind: 'unavailable' as const, reason: this.failure };
    }
    const application = new FakeApplication();
    this.applications.push(application);
    return { kind: 'ready' as const, application };
  }
}

export class FakeResizeObserver implements ResizeObserverHandle {
  observed: Element | null = null;
  disconnectCalls = 0;

  constructor(private readonly callback: (width: number, height: number) => void) {}

  observe(target: Element): void {
    this.observed = target;
  }

  disconnect(): void {
    this.disconnectCalls += 1;
    this.observed = null;
  }

  emit(width: number, height: number): void {
    this.callback(width, height);
  }
}

export class FakeHost {
  readonly children: HTMLCanvasElement[] = [];

  constructor(
    readonly clientWidth: number,
    readonly clientHeight: number,
  ) {}

  appendChild(canvas: HTMLCanvasElement): HTMLCanvasElement {
    this.children.push(canvas);
    return canvas;
  }

  contains(canvas: HTMLCanvasElement): boolean {
    return this.children.includes(canvas);
  }

  removeChild(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const index = this.children.indexOf(canvas);
    if (index >= 0) {
      this.children.splice(index, 1);
    }
    return canvas;
  }
}

export function createResizeObserverHarness(): {
  readonly factory: ResizeObserverFactory;
  readonly observers: FakeResizeObserver[];
} {
  const observers: FakeResizeObserver[] = [];
  return {
    observers,
    factory: (callback) => {
      const observer = new FakeResizeObserver(callback);
      observers.push(observer);
      return observer;
    },
  };
}
