import { describe, expect, it } from 'vitest';

import { inspectPurePresentationSource } from './support/purity-policy.ts';

describe('AST purity policy canaries', () => {
  it.each([
    ["import('remote-client')", 'dynamic import'],
    ["import 'side-effect-package'", 'side-effect import'],
    ["globalThis.fetch('/combat')", 'fetch'],
    ["navigator.sendBeacon('/combat', 'x')", 'sendBeacon'],
    ["indexedDB.open('combat')", 'storage'],
    ["globalThis.localStorage.getItem('x')", 'storage'],
    ["new WebSocket('wss://example.invalid')", 'transport'],
    ["Math.random()", 'randomness'],
    ["crypto.getRandomValues(new Uint8Array(1))", 'randomness'],
    ["process.env['THEATRE_ENDPOINT']", 'environment'],
    ["document.cookie", 'storage'],
  ])('detects %s', (source, expectedRule) => {
    expect(inspectPurePresentationSource('canary.ts', source))
      .toEqual(expect.arrayContaining([expect.objectContaining({ rule: expectedRule })]));
  });

  it('allows local type-only imports and pure computation', () => {
    expect(inspectPurePresentationSource('pure.ts', "import type { Value } from './value.ts'; export const copy = (value: Value) => value;"))
      .toEqual([]);
  });
});
