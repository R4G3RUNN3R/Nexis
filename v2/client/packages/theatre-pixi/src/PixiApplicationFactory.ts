export type PixiRendererPreference = 'webgl';

export interface PixiApplicationCreateOptions {
  readonly width: number;
  readonly height: number;
  readonly resolution: number;
  readonly preference: PixiRendererPreference;
}

export interface PixiContainerHandle {
  readonly label: string;
  addChild(...children: PixiContainerHandle[]): void;
}

export interface PixiApplicationHandle {
  readonly canvas: HTMLCanvasElement;
  readonly stage: PixiContainerHandle;
  readonly renderer: { resize(width: number, height: number): void };
  readonly ticker: { stop(): void };
  createContainer(label: string): PixiContainerHandle;
  destroy(): void;
}

export type PixiApplicationCreationResult =
  | { readonly kind: 'ready'; readonly application: PixiApplicationHandle }
  | {
      readonly kind: 'unavailable';
      readonly reason: 'browserUnavailable' | 'initializationFailed';
    };

export interface PixiApplicationFactory {
  create(options: PixiApplicationCreateOptions): Promise<PixiApplicationCreationResult>;
}

/** Loads Pixi only after a browser host explicitly requests a mount. */
export class LazyPixiApplicationFactory implements PixiApplicationFactory {
  async create(options: PixiApplicationCreateOptions): Promise<PixiApplicationCreationResult> {
    if (typeof globalThis.document === 'undefined') {
      return { kind: 'unavailable', reason: 'browserUnavailable' };
    }

    try {
      const { Application, Container } = await import('pixi.js');
      const application = new Application();

      try {
        await application.init({
          width: options.width,
          height: options.height,
          resolution: options.resolution,
          preference: options.preference,
          autoDensity: true,
          antialias: true,
          backgroundAlpha: 0,
        });
      } catch {
        try {
          application.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
        } catch {
          // Initialization failure already requires the host fallback; cleanup is best effort.
        }
        return { kind: 'unavailable', reason: 'initializationFailed' };
      }

      const nativeContainers = new WeakMap<PixiContainerHandle, InstanceType<typeof Container>>();
      const wrapContainer = (
        container: InstanceType<typeof Container>,
        label: string,
      ): PixiContainerHandle => {
        const handle: PixiContainerHandle = {
          label,
          addChild: (...children) => {
            const nativeChildren = children.map((child) => nativeContainers.get(child));
            if (nativeChildren.some((child) => child === undefined)) {
              throw new TypeError('Cannot attach a container from another Pixi application.');
            }
            container.addChild(...(nativeChildren as Array<InstanceType<typeof Container>>));
          },
        };
        nativeContainers.set(handle, container);
        return handle;
      };

      const stage = wrapContainer(application.stage, 'stage');
      return {
        kind: 'ready',
        application: {
          canvas: application.canvas as HTMLCanvasElement,
          stage,
          renderer: {
            resize: (width, height) => application.renderer.resize(width, height),
          },
          ticker: {
            stop: () => application.ticker.stop(),
          },
          createContainer: (label) => {
            const container = new Container();
            container.label = label;
            return wrapContainer(container, label);
          },
          destroy: () => {
            application.destroy(
              { removeView: false },
              { children: true, texture: true, textureSource: true },
            );
          },
        },
      };
    } catch {
      return { kind: 'unavailable', reason: 'initializationFailed' };
    }
  }
}
