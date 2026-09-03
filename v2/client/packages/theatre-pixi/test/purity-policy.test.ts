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
      'assignment and computed-key namespace aliases',
      "let ns; ns = globalThis; const key = 'fetch'; ns[key]('/combat');",
      'fetch',
    ],
    [
      'destructured namespace member aliases',
      "const { fetch: send } = globalThis; send('/combat');",
      'fetch',
    ],
    [
      'bindings that have left lexical scope',
      "function local(fetch: (path: string) => void) { fetch('/local'); } fetch('/combat');",
      'fetch',
    ],
    [
      'computed dynamic-code constructor access',
      "const key = 'constructor'; (() => {})[key]('return 1')();",
      'dynamic code',
    ],
    [
      'destructured dynamic-code constructor aliases',
      "const { constructor: compile } = (() => {}); compile('return 1')();",
      'dynamic code',
    ],
    [
      'block bindings that have left lexical scope',
      "{ const fetch = (path: string): string => path; fetch('/local'); } fetch('/combat');",
      'fetch',
    ],
    [
      'loop bindings that have left lexical scope',
      "for (let fetch = () => undefined; false; ) { fetch(); } fetch('/combat');",
      'fetch',
    ],
    [
      'object destructuring declaration defaults',
      "const { send = fetch } = {}; send('/combat');",
      'fetch',
    ],
    [
      'nested object parameter defaults',
      "function invoke({ send = fetch } = {}) { send('/combat'); }",
      'fetch',
    ],
    [
      'object destructuring assignment defaults',
      "let compile; ({ compile = Function } = {}); compile('return 1')();",
      'dynamic code',
    ],
    [
      'array destructuring declaration defaults',
      "const [store = localStorage] = []; store.getItem('x');",
      'storage',
    ],
    [
      'direct parameter defaults remain inspected',
      "function invoke(send = fetch) { send('/combat'); }",
      'fetch',
    ],
  ])('rejects %s', (_label, source, expectedRule) => {
    expect(inspectPresentationRendererSource('adversarial.ts', source)).toEqual(
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
    [
      'legitimately shadowed forbidden-looking parameters',
      "export function invoke(fetch: (path: string) => void): void { fetch('/local'); }",
    ],
    [
      'legitimately shadowed block locals',
      "export function invoke(send: (path: string) => void): void { { const fetch = send; fetch('/local'); } }",
    ],
    [
      'approved presentation capability through aliases and a computed constant',
      "let browser; browser = globalThis; const capability = 'document'; export const documentRef = browser[capability];",
    ],
    [
      'approved destructured presentation capabilities',
      'const { document: documentRef } = globalThis; export { documentRef };',
    ],
    [
      'local destructuring with a forbidden-looking property name',
      "export function invoke(callbacks: { fetch: (path: string) => void }): void { const { fetch } = callbacks; fetch('/local'); }",
    ],
    [
      'computed access on local presentation data',
      "export const pick = (layers: Record<string, number>, name: string): number | null => layers[name] ?? null;",
    ],
    [
      'function-scoped var bindings declared in a block',
      "export function inspect(flag: boolean): unknown { if (flag) { var Worker = 1; } return Worker; }",
    ],
    [
      'local object destructuring declaration defaults',
      "const localSend = (path: string): string => path; const { send = localSend } = {}; export const result = send('/local');",
    ],
    [
      'local nested object parameter defaults',
      "const localSend = (path: string): string => path; export function invoke({ send = localSend } = {}): string { return send('/local'); }",
    ],
    [
      'local object destructuring assignment defaults',
      "const localCompile = (source: string): string => source; let compile; ({ compile = localCompile } = {}); export { compile };",
    ],
    [
      'local array destructuring declaration defaults',
      "const localStore = { getItem: (key: string): string => key }; const [store = localStore] = []; export const result = store.getItem('x');",
    ],
  ])('allows %s', (_label, source) => {
    expect(inspectPresentationRendererSource('allowed.ts', source)).toEqual([]);
  });

  it('flags JSX because React is forbidden in the renderer package', () => {
    expect(inspectPresentationRendererSource('canary.tsx', 'export const view = () => <div />;')).toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: 'ui framework' })]),
    );
  });
});
