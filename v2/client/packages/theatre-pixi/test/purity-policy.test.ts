import { describe, expect, it } from 'vitest';

import { inspectPresentationRendererSource } from './support/pixi-purity-policy.ts';

describe('theatre-pixi AST purity policy canaries', () => {
  it.each([
    ["import('remote-client')", 'dynamic import'],
    ['const key = String(1); import(key);', 'dynamic import'],
    ["import 'side-effect-package'", 'side-effect import'],
    ["import { thing } from 'untrusted-package'; export { thing };", 'external dependency'],
    ["import { Application } from 'pixi.js'; export { Application };", 'external dependency'],
    ["import { useState } from 'react'; export { useState };", 'ui framework'],
    ["export * from 'react-dom'", 'ui framework'],
    ["fetch('/combat')", 'fetch'],
    ["globalThis.fetch('/combat')", 'fetch'],
    ["globalThis['fetch']('/combat')", 'fetch'],
    ["const escape = fetch;", 'fetch'],
    ["navigator.sendBeacon('/combat', 'x')", 'sendBeacon'],
    ["new WebSocket('wss://example.invalid')", 'transport'],
    ["new globalThis['WebSocket']('wss://example.invalid')", 'transport'],
    ["new XMLHttpRequest()", 'transport'],
    ["localStorage.setItem('a', 'b')", 'storage'],
    ["globalThis.localStorage.getItem('x')", 'storage'],
    ["indexedDB.open('combat')", 'storage'],
    ['document.cookie', 'storage'],
    ["process.env['THEATRE_ENDPOINT']", 'environment'],
    ["let sink; sink = process;", 'environment'],
    ["eval('1 + 1')", 'dynamic code'],
    ["new Function('return 1')", 'dynamic code'],
    ["const F = Function; new F('return 1');", 'dynamic code'],
    ['Math.random()', 'randomness'],
    ['crypto.getRandomValues(new Uint8Array(1))', 'randomness'],
    ["const source = globalThis; source['crypto'];", 'unapproved global member'],
    ['const name = String(1); globalThis[name];', 'unapproved global member'],
    ['unapprovedGlobalHelper()', 'unapproved global'],
  ])('detects %s', (source, expectedRule) => {
    expect(inspectPresentationRendererSource('canary.ts', source)).toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: expectedRule })]),
    );
  });

  it.each([
    [
      'lazy pixi loading',
      "export async function load() { const { Application } = await import('pixi.js'); return new Application(); }",
    ],
    [
      'browser availability probe',
      "export const canMount = (): boolean => typeof globalThis.document !== 'undefined';",
    ],
    [
      'ResizeObserver and devicePixelRatio capabilities',
      'export const ratio = (): number => globalThis.devicePixelRatio;\nexport const watch = (cb: () => void) => new globalThis.ResizeObserver(cb);',
    ],
    [
      'canvas event listeners',
      'export function attach(canvas: HTMLCanvasElement, listener: EventListener): void { canvas.addEventListener("webglcontextlost", listener); canvas.removeEventListener("webglcontextlost", listener); }',
    ],
    [
      'type-only core contract import',
      "import type { PresentationActor } from '@nexis/theatre-core';\nexport const nameOf = (actor: PresentationActor): string => actor.displayName;",
    ],
    [
      'relative sibling imports and pure computation',
      "import { helper } from './helper.ts';\nexport const scaled = (value: number): number => Math.min(helper(value), Number.MAX_SAFE_INTEGER);",
    ],
    ['object shorthand over declared bindings', 'const width = 1; export const size = { width };'],
  ])('allows %s', (_label, source) => {
    expect(inspectPresentationRendererSource('allowed.ts', source)).toEqual([]);
  });

  it('flags JSX because React is forbidden in the renderer package', () => {
    expect(inspectPresentationRendererSource('canary.tsx', 'export const view = () => <div />;')).toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: 'ui framework' })]),
    );
  });
});
