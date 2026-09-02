import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('SSR and presentation-only boundary', () => {
  it('evaluates the public module in Node without a browser or GPU', async () => {
    expect('window' in globalThis).toBe(false);
    expect('document' in globalThis).toBe(false);

    const publicModule = await import('../src/index.ts');

    expect(publicModule.PixiTheatreRenderer).toBeTypeOf('function');
  });

  it('keeps Pixi initialization lazy and forbids authority, I/O, storage, React, and dynamic code', () => {
    const sourceDir = join(packageRoot, 'src');
    const source = readdirSync(sourceDir)
      .filter((name) => name.endsWith('.ts'))
      .map((name) => readFileSync(join(sourceDir, name), 'utf8'))
      .join('\n');
    const packageJson = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };

    expect(source).toContain("await import('pixi.js')");
    expect(source).not.toMatch(/from\s+['"]pixi\.js['"]/u);
    expect(source).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB)\b/u);
    expect(source).not.toMatch(/\b(?:eval|Function)\s*\(/u);
    expect(source).not.toMatch(/\b(?:Math\.random|crypto\.getRandomValues)\b/u);
    expect(Object.keys(packageJson.dependencies ?? {})).not.toContain('react');
    expect(packageJson.dependencies?.['pixi.js']).toBe('8.20.1');
  });
});
