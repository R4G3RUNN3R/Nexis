import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const sourceRoot = join(packageRoot, 'src');

/**
 * theatre-core is pure presentation code. It may never gain gameplay authority,
 * a transport, persistence, randomness or dynamic code execution.
 */
const FORBIDDEN_SOURCE_PATTERNS: readonly string[] = [
  'fetch(',
  'XMLHttpRequest',
  'WebSocket',
  'localStorage',
  'sessionStorage',
  'Math.random',
  'crypto.getRandomValues',
  'eval(',
  'new Function',
  'indexedDB',
  'document.',
  'window.',
  'process.env',
];

function collectSourceFiles(directory: string): readonly string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry);
    if (statSync(absolute).isDirectory()) {
      found.push(...collectSourceFiles(absolute));
    } else if (absolute.endsWith('.ts')) {
      found.push(absolute);
    }
  }
  return found;
}

const sourceFiles = collectSourceFiles(sourceRoot);

describe('theatre-core presentation purity', () => {
  it('has source files to inspect', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  it.each(FORBIDDEN_SOURCE_PATTERNS)('never uses %s', (pattern) => {
    const offenders = sourceFiles.filter((file) => readFileSync(file, 'utf8').includes(pattern));
    expect(offenders.map((file) => relative(packageRoot, file))).toEqual([]);
  });

  it('imports nothing outside its own relative sources', () => {
    const externalImportPattern = /(?:^|\n)\s*(?:import|export)[^;\n]*?\sfrom\s+['"]([^'"]+)['"]/g;
    const offenders: string[] = [];

    for (const file of sourceFiles) {
      const contents = readFileSync(file, 'utf8');
      for (const match of contents.matchAll(externalImportPattern)) {
        const specifier = match[1] ?? '';
        if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
          offenders.push(`${relative(packageRoot, file)} -> ${specifier}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('declares no runtime dependencies', () => {
    const manifest: unknown = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
    expect(manifest).toBeTypeOf('object');
    const record = manifest as Record<string, unknown>;
    expect(record['dependencies']).toBeUndefined();
    expect(record['peerDependencies']).toBeUndefined();
    expect(record['optionalDependencies']).toBeUndefined();
  });
});
