import { describe, expect, it } from 'vitest';

describe('SSR-safe module evaluation', () => {
  it('evaluates the public module in Node without a browser or GPU', async () => {
    expect('window' in globalThis).toBe(false);
    expect('document' in globalThis).toBe(false);

    const publicModule = await import('../src/index.ts');

    expect(publicModule.PixiTheatreRenderer).toBeTypeOf('function');
  });
});
