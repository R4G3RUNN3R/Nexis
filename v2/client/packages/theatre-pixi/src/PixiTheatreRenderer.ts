import type { BattlePresentationSnapshot, PresentationEvent } from '@nexis/theatre-core';

import {
  LazyPixiApplicationFactory,
  type PixiApplicationFactory,
  type PixiApplicationHandle,
} from './PixiApplicationFactory.ts';
import { createStageLayers } from './stageLayers.ts';

const DEFAULT_MAXIMUM_RESOLUTION = 2;

export interface ResizeObserverHandle {
  observe(target: Element): void;
  disconnect(): void;
}

export type ResizeObserverFactory = (
  callback: (width: number, height: number) => void,
) => ResizeObserverHandle | null;

export type TheatreMountResult =
  | { readonly kind: 'mounted' }
  | {
      readonly kind: 'fallbackRequired';
      readonly reason: 'browserUnavailable' | 'initializationFailed';
    }
  | {
      readonly kind: 'rejected';
      readonly reason: 'alreadyMounted' | 'invalidHost' | 'mountCancelled';
    };

export interface ITheatreRenderer {
  mount(host: HTMLElement): Promise<TheatreMountResult>;
  render(snapshot: BattlePresentationSnapshot): void;
  present(event: PresentationEvent): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

export interface PixiTheatreRendererOptions {
  readonly applicationFactory?: PixiApplicationFactory;
  readonly createResizeObserver?: ResizeObserverFactory;
  readonly devicePixelRatio?: () => number;
  readonly maximumResolution?: number;
}

type RendererState = 'idle' | 'mounting' | 'mounted';

function defaultResizeObserverFactory(
  callback: (width: number, height: number) => void,
): ResizeObserverHandle | null {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    return null;
  }
  const observer = new globalThis.ResizeObserver((entries) => {
    const first = entries[0];
    if (first !== undefined) {
      callback(first.contentRect.width, first.contentRect.height);
    }
  });
  return observer;
}

function defaultDevicePixelRatio(): number {
  return typeof globalThis.devicePixelRatio === 'number' ? globalThis.devicePixelRatio : 1;
}

function isMountHost(host: unknown): host is HTMLElement {
  if (host === null || typeof host !== 'object') {
    return false;
  }
  const candidate = host as Partial<HTMLElement>;
  return (
    typeof candidate.appendChild === 'function' &&
    typeof candidate.removeChild === 'function' &&
    typeof candidate.contains === 'function' &&
    typeof candidate.clientWidth === 'number' &&
    typeof candidate.clientHeight === 'number'
  );
}

function normalizedDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export class PixiTheatreRenderer implements ITheatreRenderer {
  private readonly applicationFactory: PixiApplicationFactory;
  private readonly createResizeObserver: ResizeObserverFactory;
  private readonly devicePixelRatio: () => number;
  private readonly maximumResolution: number;
  private state: RendererState = 'idle';
  private generation = 0;
  private application: PixiApplicationHandle | null = null;
  private host: HTMLElement | null = null;
  private resizeObserver: ResizeObserverHandle | null = null;
  private contextLostListener: EventListener | null = null;

  constructor(options: PixiTheatreRendererOptions = {}) {
    this.applicationFactory = options.applicationFactory ?? new LazyPixiApplicationFactory();
    this.createResizeObserver = options.createResizeObserver ?? defaultResizeObserverFactory;
    this.devicePixelRatio = options.devicePixelRatio ?? defaultDevicePixelRatio;
    this.maximumResolution = normalizedDimension(
      options.maximumResolution ?? DEFAULT_MAXIMUM_RESOLUTION,
    );
  }

  async mount(host: HTMLElement): Promise<TheatreMountResult> {
    if (!isMountHost(host)) {
      return { kind: 'rejected', reason: 'invalidHost' };
    }
    if (this.state !== 'idle') {
      return { kind: 'rejected', reason: 'alreadyMounted' };
    }

    this.state = 'mounting';
    const generation = ++this.generation;
    const width = normalizedDimension(host.clientWidth);
    const height = normalizedDimension(host.clientHeight);
    const pixelRatio = normalizedDimension(this.devicePixelRatio());
    const resolution = Math.min(pixelRatio, this.maximumResolution);
    let creation;
    try {
      creation = await this.applicationFactory.create({
        width,
        height,
        resolution,
        preference: 'webgl',
      });
    } catch {
      if (generation === this.generation) {
        this.state = 'idle';
      }
      return { kind: 'fallbackRequired', reason: 'initializationFailed' };
    }

    if (creation.kind === 'unavailable') {
      if (generation === this.generation) {
        this.state = 'idle';
      }
      return { kind: 'fallbackRequired', reason: creation.reason };
    }
    if (generation !== this.generation || this.state !== 'mounting') {
      this.destroyApplication(creation.application);
      return { kind: 'rejected', reason: 'mountCancelled' };
    }

    const application = creation.application;
    let contextLostListener: EventListener | null = null;
    let resizeObserver: ResizeObserverHandle | null = null;
    try {
      createStageLayers(application.stage, (label) => application.createContainer(label));
      host.appendChild(application.canvas);
      contextLostListener = (event) => event.preventDefault();
      application.canvas.addEventListener('webglcontextlost', contextLostListener);
      resizeObserver = this.createResizeObserver((nextWidth, nextHeight) => {
        if (this.application === application && this.state === 'mounted') {
          application.renderer.resize(
            normalizedDimension(nextWidth),
            normalizedDimension(nextHeight),
          );
        }
      });

      this.application = application;
      this.host = host;
      this.contextLostListener = contextLostListener;
      this.resizeObserver = resizeObserver;
      this.state = 'mounted';
      application.renderer.resize(width, height);
      resizeObserver?.observe(host);
      return { kind: 'mounted' };
    } catch {
      resizeObserver?.disconnect();
      if (contextLostListener !== null) {
        application.canvas.removeEventListener('webglcontextlost', contextLostListener);
      }
      this.removeCanvas(host, application);
      this.destroyApplication(application);
      this.clearMountedReferences();
      return { kind: 'fallbackRequired', reason: 'initializationFailed' };
    }
  }

  render(snapshot: BattlePresentationSnapshot): void {
    void snapshot;
  }

  present(event: PresentationEvent): void {
    void event;
  }

  resize(width: number, height: number): void {
    this.application?.renderer.resize(normalizedDimension(width), normalizedDimension(height));
  }

  dispose(): void {
    ++this.generation;
    if (this.state === 'mounting') {
      this.state = 'idle';
      return;
    }
    if (this.application === null) {
      this.state = 'idle';
      return;
    }

    const application = this.application;
    const host = this.host;
    this.resizeObserver?.disconnect();
    if (this.contextLostListener !== null) {
      application.canvas.removeEventListener('webglcontextlost', this.contextLostListener);
    }
    if (host !== null) {
      this.removeCanvas(host, application);
    }
    this.destroyApplication(application);
    this.clearMountedReferences();
  }

  private removeCanvas(host: HTMLElement, application: PixiApplicationHandle): void {
    if (host.contains(application.canvas)) {
      host.removeChild(application.canvas);
    }
  }

  private destroyApplication(application: PixiApplicationHandle): void {
    application.ticker.stop();
    application.destroy();
  }

  private clearMountedReferences(): void {
    this.application = null;
    this.host = null;
    this.resizeObserver = null;
    this.contextLostListener = null;
    this.state = 'idle';
  }
}
