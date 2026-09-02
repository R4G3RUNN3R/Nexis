import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { inspectPurePresentationSource } from './support/purity-policy.ts';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as Record<string, unknown>;
const publishRoots = Array.isArray(manifest['files']) ? manifest['files'].filter((value): value is string => typeof value === 'string') : [];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

function collect(directory: string): readonly string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) { const absolute = join(directory, entry); if (statSync(absolute).isDirectory()) files.push(...collect(absolute)); else if (SOURCE_EXTENSIONS.has(extname(absolute))) files.push(absolute); }
  return files;
}
const publishedSources = publishRoots.flatMap((root) => collect(join(packageRoot, root)));

describe('theatre-core presentation purity', () => {
  it('AST-inspects every publishable source extension', () => {
    expect(publishedSources.length).toBeGreaterThan(0);
    const violations = publishedSources.flatMap((file) => inspectPurePresentationSource(relative(packageRoot, file), readFileSync(file, 'utf8')));
    expect(violations).toEqual([]);
  });

  it('declares no runtime, peer, or optional dependencies', () => {
    expect(manifest['dependencies']).toBeUndefined();
    expect(manifest['peerDependencies']).toBeUndefined();
    expect(manifest['optionalDependencies']).toBeUndefined();
  });
});
