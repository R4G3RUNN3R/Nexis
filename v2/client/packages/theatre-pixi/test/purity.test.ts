import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  collectPresentationSourceFiles,
  inspectPresentationRendererSource,
} from './support/pixi-purity-policy.ts';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as Record<
  string,
  unknown
>;
const publishRoots = Array.isArray(manifest['files'])
  ? manifest['files'].filter((value): value is string => typeof value === 'string')
  : [];
const publishedSources = publishRoots.flatMap((root) =>
  collectPresentationSourceFiles(join(packageRoot, root)),
);

describe('theatre-pixi renderer purity', () => {
  it('discovers nested source directories, not only top-level files', () => {
    const discovered = collectPresentationSourceFiles(
      join(packageRoot, 'test', 'fixtures', 'discovery'),
    ).map((file) => relative(packageRoot, file).split('\\').join('/'));

    expect(discovered).toEqual([
      'test/fixtures/discovery/nested-level-one/nested-level-two/deep-source.ts',
      'test/fixtures/discovery/top-level-source.ts',
    ]);
  });

  it('fails closed when a publish root contains no inspectable source', () => {
    expect(() => collectPresentationSourceFiles(join(packageRoot, 'test', 'fixtures', 'absent'))).toThrow(
      /purity policy/iu,
    );
  });

  it('AST-inspects every publishable source, including nested actor sources', () => {
    expect(publishedSources.length).toBeGreaterThan(0);

    const violations = publishedSources.flatMap((file) =>
      inspectPresentationRendererSource(relative(packageRoot, file), readFileSync(file, 'utf8')),
    );

    expect(violations).toEqual([]);
  });

  it('keeps Pixi loading lazy and declares no UI framework dependency', () => {
    const sources = publishedSources.map((file) => readFileSync(file, 'utf8')).join('\n');
    const dependencies = (manifest['dependencies'] ?? {}) as Record<string, string>;

    expect(sources).toContain("await import('pixi.js')");
    expect(Object.keys(dependencies)).not.toContain('react');
    expect(Object.keys(dependencies)).not.toContain('react-dom');
    expect(dependencies['pixi.js']).toBe('8.20.1');
  });
});
