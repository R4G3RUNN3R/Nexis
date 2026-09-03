import { readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

import { parseAst } from 'rolldown/parseAst';

export interface PurityViolation {
  readonly file: string;
  readonly rule: string;
  readonly detail: string;
}

type AstNode = { readonly type: string; readonly [key: string]: unknown };

const SOURCE_EXTENSIONS: ReadonlySet<string> = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);

/** Packages the renderer may reference statically. Pixi stays dynamic so SSR/import stays safe. */
const STATIC_IMPORT_ALLOWLIST: ReadonlySet<string> = new Set(['@nexis/theatre-core']);
/** The single module the renderer may load lazily once a browser host requests a mount. */
const DYNAMIC_IMPORT_ALLOWLIST: ReadonlySet<string> = new Set(['pixi.js']);
const UI_FRAMEWORKS: ReadonlySet<string> = new Set([
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react-dom/client',
]);

/**
 * Browser capabilities this presentation package legitimately needs. Everything absent from this
 * list is a violation, so a new global capability must be reviewed rather than silently adopted.
 */
const ALLOWED_GLOBAL_MEMBERS: ReadonlySet<string> = new Set([
  'document',
  'ResizeObserver',
  'devicePixelRatio',
]);
const GLOBAL_NAMESPACES: ReadonlySet<string> = new Set(['globalThis', 'window', 'self', 'global']);

/** Language and capability bindings the renderer may reference without declaring them. */
const AMBIENT_ALLOWLIST: ReadonlySet<string> = new Set([
  'globalThis',
  'undefined',
  'NaN',
  'Infinity',
  'Array',
  'Boolean',
  'Error',
  'JSON',
  'Map',
  'Math',
  'Number',
  'Object',
  'Promise',
  'RangeError',
  'Set',
  'String',
  'Symbol',
  'TypeError',
  'WeakMap',
  'WeakSet',
  ...ALLOWED_GLOBAL_MEMBERS,
]);

/** Named so an alias or computed lookup still reports the capability it laundered. */
const FORBIDDEN_GLOBALS: Readonly<Record<string, string>> = {
  fetch: 'fetch',
  XMLHttpRequest: 'transport',
  WebSocket: 'transport',
  EventSource: 'transport',
  RTCPeerConnection: 'transport',
  Worker: 'transport',
  SharedWorker: 'transport',
  localStorage: 'storage',
  sessionStorage: 'storage',
  indexedDB: 'storage',
  caches: 'storage',
  process: 'environment',
  eval: 'dynamic code',
  Function: 'dynamic code',
  require: 'dynamic code',
  importScripts: 'dynamic code',
};

const FORBIDDEN_MEMBERS: Readonly<Record<string, string>> = {
  fetch: 'fetch',
  sendBeacon: 'sendBeacon',
  XMLHttpRequest: 'transport',
  WebSocket: 'transport',
  EventSource: 'transport',
  localStorage: 'storage',
  sessionStorage: 'storage',
  indexedDB: 'storage',
  caches: 'storage',
  cookie: 'storage',
  env: 'environment',
  random: 'randomness',
  getRandomValues: 'randomness',
  randomUUID: 'randomness',
  eval: 'dynamic code',
  Function: 'dynamic code',
};

/** TS nodes that still carry a runtime expression; every other `TS*` node is type-only. */
const VALUE_CARRYING_TS_NODES: ReadonlySet<string> = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSInstantiationExpression',
]);
const TYPE_ONLY_KEYS: ReadonlySet<string> = new Set([
  'typeAnnotation',
  'typeArguments',
  'typeParameters',
  'returnType',
  'superTypeArguments',
  'implements',
]);

/**
 * Recursively collects every inspectable source under `root`. Discovery is fail-closed: a missing or
 * empty publish root throws instead of silently inspecting nothing.
 */
export function collectPresentationSourceFiles(root: string): readonly string[] {
  const files = collectRecursively(root);
  if (files.length === 0) {
    throw new Error(
      `Renderer purity policy found no inspectable source under "${root}"; discovery must never pass vacuously.`,
    );
  }
  return [...files].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function collectRecursively(directory: string): readonly string[] {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectRecursively(absolute));
    } else if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
      files.push(absolute);
    }
  }
  return files;
}

/**
 * AST guard for presentation-only renderer sources. It allows the browser and Pixi capabilities this
 * package needs and rejects transport, storage, environment, dynamic-code, randomness, UI-framework
 * and unreviewed global access, including computed and aliased forms.
 */
export function inspectPresentationRendererSource(
  file: string,
  source: string,
): readonly PurityViolation[] {
  const ast = parseAst(source, { lang: language(file) }, file) as unknown as AstNode;
  const violations: PurityViolation[] = [];
  const add = (rule: string, detail: string): void => {
    violations.push({ file, rule, detail });
  };

  const declared = new Set<string>();
  const namespaces = new Set<string>(GLOBAL_NAMESPACES);
  walk(ast, (node) => {
    collectBindings(node, declared);
    collectNamespaceAliases(node, namespaces);
  });

  walk(ast, (node) => {
    inspectModuleGraph(node, add);
    inspectMemberAccess(node, namespaces, add);
  });
  for (const reference of collectFreeReferences(ast)) {
    if (declared.has(reference)) {
      continue;
    }
    const forbidden = FORBIDDEN_GLOBALS[reference];
    if (forbidden !== undefined) {
      add(forbidden, reference);
    } else if (!AMBIENT_ALLOWLIST.has(reference)) {
      add('unapproved global', reference);
    }
  }
  return violations;
}

function inspectModuleGraph(node: AstNode, add: (rule: string, detail: string) => void): void {
  if (node.type === 'ImportDeclaration') {
    const specifier = literalText(node['source']);
    const specifiers = node['specifiers'];
    if (Array.isArray(specifiers) && specifiers.length === 0) {
      add('side-effect import', specifier);
      return;
    }
    if (node['importKind'] === 'type') {
      return;
    }
    reportStaticSpecifier(specifier, add);
    return;
  }
  if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') {
    const specifier = literalText(node['source']);
    if (specifier !== '' && node['exportKind'] !== 'type') {
      reportStaticSpecifier(specifier, add);
    }
    return;
  }
  if (node.type === 'ImportExpression') {
    const specifier = literalText(node['source']);
    if (UI_FRAMEWORKS.has(specifier)) {
      add('ui framework', specifier);
      return;
    }
    if (!DYNAMIC_IMPORT_ALLOWLIST.has(specifier)) {
      add('dynamic import', specifier === '' ? 'non-literal specifier' : specifier);
    }
    return;
  }
  if (node.type.startsWith('JSX')) {
    add('ui framework', node.type);
  }
}

function reportStaticSpecifier(
  specifier: string,
  add: (rule: string, detail: string) => void,
): void {
  if (UI_FRAMEWORKS.has(specifier)) {
    add('ui framework', specifier);
    return;
  }
  if (!isRelative(specifier) && !STATIC_IMPORT_ALLOWLIST.has(specifier)) {
    add('external dependency', specifier);
  }
}

function inspectMemberAccess(
  node: AstNode,
  namespaces: ReadonlySet<string>,
  add: (rule: string, detail: string) => void,
): void {
  if (node.type !== 'MemberExpression') {
    return;
  }
  const property = memberName(node);
  const forbidden = property === undefined ? undefined : FORBIDDEN_MEMBERS[property];
  if (forbidden !== undefined) {
    add(forbidden, property ?? '');
    return;
  }
  const object = asNode(node['object']);
  if (object?.type !== 'Identifier' || !namespaces.has(String(object['name']))) {
    return;
  }
  if (property === undefined) {
    add('unapproved global member', `${String(object['name'])}[computed]`);
    return;
  }
  if (!ALLOWED_GLOBAL_MEMBERS.has(property)) {
    add('unapproved global member', `${String(object['name'])}.${property}`);
  }
}

/** A local binding must not launder a global namespace past the member allowlist. */
function collectNamespaceAliases(node: AstNode, namespaces: Set<string>): void {
  if (node.type !== 'VariableDeclarator') {
    return;
  }
  const id = asNode(node['id']);
  const init = asNode(node['init']);
  if (id?.type === 'Identifier' && init?.type === 'Identifier' && namespaces.has(String(init['name']))) {
    namespaces.add(String(id['name']));
  }
}

function collectBindings(node: AstNode, declared: Set<string>): void {
  switch (node.type) {
    case 'ImportSpecifier':
    case 'ImportDefaultSpecifier':
    case 'ImportNamespaceSpecifier':
      addPatternNames(asNode(node['local']), declared);
      return;
    case 'VariableDeclarator':
      addPatternNames(asNode(node['id']), declared);
      return;
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
    case 'ClassDeclaration':
    case 'ClassExpression': {
      addPatternNames(asNode(node['id']), declared);
      const params = node['params'];
      if (Array.isArray(params)) {
        for (const param of params) {
          addPatternNames(asNode(param), declared);
        }
      }
      return;
    }
    case 'CatchClause':
      addPatternNames(asNode(node['param']), declared);
      return;
    default:
      return;
  }
}

function addPatternNames(pattern: AstNode | undefined, declared: Set<string>): void {
  if (pattern === undefined) {
    return;
  }
  switch (pattern.type) {
    case 'Identifier':
      declared.add(String(pattern['name']));
      return;
    case 'ObjectPattern': {
      const properties = pattern['properties'];
      if (Array.isArray(properties)) {
        for (const property of properties) {
          const propertyNode = asNode(property);
          addPatternNames(asNode(propertyNode?.['value']), declared);
          addPatternNames(asNode(propertyNode?.['argument']), declared);
        }
      }
      return;
    }
    case 'ArrayPattern': {
      const elements = pattern['elements'];
      if (Array.isArray(elements)) {
        for (const element of elements) {
          addPatternNames(asNode(element), declared);
        }
      }
      return;
    }
    case 'AssignmentPattern':
      addPatternNames(asNode(pattern['left']), declared);
      return;
    case 'RestElement':
    case 'TSParameterProperty':
      addPatternNames(asNode(pattern['argument']) ?? asNode(pattern['parameter']), declared);
      return;
    default:
      return;
  }
}

/** Identifier names used in value position, excluding property names and module specifiers. */
function collectFreeReferences(ast: AstNode): ReadonlySet<string> {
  const references = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }
    const node = asNode(value);
    if (node === undefined || isTypeOnly(node)) {
      return;
    }
    if (node.type === 'Identifier') {
      references.add(String(node['name']));
      return;
    }
    for (const [key, nested] of Object.entries(node)) {
      if (TYPE_ONLY_KEYS.has(key) || isSkippedReferenceKey(node, key)) {
        continue;
      }
      visit(nested);
    }
  };
  visit(ast);
  return references;
}

function isSkippedReferenceKey(node: AstNode, key: string): boolean {
  if (node.type === 'ImportSpecifier' || node.type === 'ExportSpecifier') {
    return true;
  }
  if (node.type === 'MemberExpression' && key === 'property') {
    return node['computed'] !== true;
  }
  if (
    (node.type === 'Property' || node.type === 'PropertyDefinition' || node.type === 'MethodDefinition') &&
    key === 'key'
  ) {
    return node['computed'] !== true && node['shorthand'] !== true;
  }
  if (node.type === 'LabeledStatement' || node.type === 'BreakStatement' || node.type === 'ContinueStatement') {
    return key === 'label';
  }
  return false;
}

function isTypeOnly(node: AstNode): boolean {
  return node.type.startsWith('TS') && !VALUE_CARRYING_TS_NODES.has(node.type);
}

function memberName(node: AstNode): string | undefined {
  if (node['computed'] === true) {
    const property = asNode(node['property']);
    const isLiteral = property?.type === 'Literal' || property?.type === 'StringLiteral';
    return isLiteral && typeof property['value'] === 'string' ? property['value'] : undefined;
  }
  const property = asNode(node['property']);
  return property?.type === 'Identifier' ? String(property['name']) : undefined;
}

function walk(value: unknown, visit: (node: AstNode) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      walk(item, visit);
    }
    return;
  }
  const node = asNode(value);
  if (node === undefined) {
    return;
  }
  visit(node);
  for (const [key, nested] of Object.entries(node)) {
    if (key !== 'parent') {
      walk(nested, visit);
    }
  }
}

function asNode(value: unknown): AstNode | undefined {
  return value !== null && typeof value === 'object' && typeof (value as Record<string, unknown>)['type'] === 'string'
    ? (value as AstNode)
    : undefined;
}

function literalText(value: unknown): string {
  const node = asNode(value);
  const isLiteral = node?.type === 'Literal' || node?.type === 'StringLiteral';
  return isLiteral && typeof node['value'] === 'string' ? node['value'] : '';
}

function isRelative(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

function language(file: string): 'js' | 'jsx' | 'ts' | 'tsx' {
  if (file.endsWith('.tsx')) {
    return 'tsx';
  }
  if (file.endsWith('.jsx')) {
    return 'jsx';
  }
  if (file.endsWith('.ts')) {
    return 'ts';
  }
  return 'js';
}
