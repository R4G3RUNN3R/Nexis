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
  constructor: 'dynamic code',
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

  const scopes = buildScopes(ast);
  analyzeNode(ast, scopes.root, scopes.byNode, add);
  return violations;
}

type BindingValue =
  | { readonly kind: 'unknown' }
  | { readonly kind: 'string'; readonly value: string }
  | { readonly kind: 'namespace'; readonly name: string }
  | { readonly kind: 'capability'; readonly name: string; readonly rule?: string };

interface Scope {
  readonly parent?: Scope;
  readonly functionScope: boolean;
  readonly bindings: Map<string, BindingValue>;
}

const UNKNOWN_VALUE: BindingValue = { kind: 'unknown' };

/**
 * Build lexical scopes before inspecting references. This mirrors JavaScript binding visibility:
 * block bindings do not leak after scope exit, while `var` belongs to the nearest function scope.
 */
function buildScopes(ast: AstNode): { readonly root: Scope; readonly byNode: WeakMap<object, Scope> } {
  const root: Scope = { functionScope: true, bindings: new Map() };
  const byNode = new WeakMap<object, Scope>();
  byNode.set(ast, root);

  const visit = (node: AstNode, scope: Scope, parent?: AstNode): void => {
    let activeScope = scope;
    if (isFunction(node)) {
      if (node.type === 'FunctionDeclaration') {
        declarePattern(asNode(node['id']), scope);
      }
      activeScope = { parent: scope, functionScope: true, bindings: new Map() };
      byNode.set(node, activeScope);
      if (node.type !== 'FunctionDeclaration') {
        declarePattern(asNode(node['id']), activeScope);
      }
      for (const param of nodeArray(node['params'])) {
        declarePattern(param, activeScope);
      }
    } else if (node.type === 'BlockStatement' && !isFunction(parent)) {
      activeScope = { parent: scope, functionScope: false, bindings: new Map() };
      byNode.set(node, activeScope);
    } else if (
      node.type === 'ForStatement' ||
      node.type === 'ForInStatement' ||
      node.type === 'ForOfStatement' ||
      node.type === 'SwitchStatement'
    ) {
      activeScope = { parent: scope, functionScope: false, bindings: new Map() };
      byNode.set(node, activeScope);
    } else if (node.type === 'CatchClause') {
      activeScope = { parent: scope, functionScope: false, bindings: new Map() };
      byNode.set(node, activeScope);
      declarePattern(asNode(node['param']), activeScope);
    }

    if (node.type === 'VariableDeclaration') {
      const declarationScope = node['kind'] === 'var' ? nearestFunctionScope(activeScope) : activeScope;
      for (const declaration of nodeArray(node['declarations'])) {
        declarePattern(asNode(declaration['id']), declarationScope);
      }
    } else if (node.type === 'ClassDeclaration') {
      declarePattern(asNode(node['id']), activeScope);
    } else if (
      node.type === 'ImportSpecifier' ||
      node.type === 'ImportDefaultSpecifier' ||
      node.type === 'ImportNamespaceSpecifier'
    ) {
      declarePattern(asNode(node['local']), activeScope);
    }

    for (const [key, nested] of Object.entries(node)) {
      if (key === 'parent' || TYPE_ONLY_KEYS.has(key)) {
        continue;
      }
      for (const child of nodeArray(nested)) {
        if (!isTypeOnly(child)) {
          visit(child, activeScope, node);
        }
      }
    }
  };

  for (const child of nodeArray(ast['body'])) {
    visit(child, root, ast);
  }
  return { root, byNode };
}

function analyzeNode(
  node: AstNode,
  scope: Scope,
  scopes: WeakMap<object, Scope>,
  add: (rule: string, detail: string) => void,
): void {
  const activeScope = scopes.get(node) ?? scope;
  inspectModuleGraph(node, add);

  if (isFunction(node)) {
    for (const param of nodeArray(node['params'])) {
      analyzePatternDefaults(param, activeScope, scopes, add);
    }
    const body = asNode(node['body']);
    if (body !== undefined) {
      analyzeNode(body, activeScope, scopes, add);
    }
    return;
  }
  if (node.type === 'VariableDeclarator') {
    const init = asNode(node['init']);
    if (init !== undefined) {
      analyzeNode(init, activeScope, scopes, add);
      assignPattern(asNode(node['id']), valueOf(init, activeScope, add), activeScope, add);
    }
    analyzePatternDefaults(asNode(node['id']), activeScope, scopes, add);
    return;
  }
  if (node.type === 'AssignmentExpression') {
    const right = asNode(node['right']);
    if (right !== undefined) {
      analyzeNode(right, activeScope, scopes, add);
    }
    const left = asNode(node['left']);
    if (node['operator'] === '=' && left !== undefined && isBindingPattern(left)) {
      analyzePatternDefaults(left, activeScope, scopes, add);
      assignPattern(left, valueOf(right, activeScope, add), activeScope, add);
    } else if (left !== undefined) {
      analyzeNode(left, activeScope, scopes, add);
    }
    return;
  }
  if (node.type === 'MemberExpression') {
    const object = asNode(node['object']);
    const property = asNode(node['property']);
    if (object !== undefined) {
      analyzeNode(object, activeScope, scopes, add);
    }
    if (node['computed'] === true && property !== undefined) {
      analyzeNode(property, activeScope, scopes, add);
    }
    valueOfMember(node, activeScope, add);
    return;
  }
  if (node.type === 'Identifier') {
    inspectIdentifier(String(node['name']), activeScope, add);
    return;
  }
  if (node.type === 'Property') {
    const key = asNode(node['key']);
    const value = asNode(node['value']);
    if (node['computed'] === true && key !== undefined) {
      analyzeNode(key, activeScope, scopes, add);
    }
    if (value !== undefined) {
      analyzeNode(value, activeScope, scopes, add);
    }
    return;
  }
  if (
    node.type === 'ImportSpecifier' ||
    node.type === 'ImportDefaultSpecifier' ||
    node.type === 'ImportNamespaceSpecifier' ||
    node.type === 'ExportSpecifier'
  ) {
    return;
  }
  if (isTypeOnly(node)) {
    return;
  }

  for (const [key, nested] of Object.entries(node)) {
    if (key === 'parent' || TYPE_ONLY_KEYS.has(key) || isNonReferenceMetadata(node, key)) {
      continue;
    }
    for (const child of nodeArray(nested)) {
      analyzeNode(child, activeScope, scopes, add);
    }
  }
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

function declarePattern(pattern: AstNode | undefined, scope: Scope): void {
  if (pattern === undefined) {
    return;
  }
  switch (pattern.type) {
    case 'Identifier':
      scope.bindings.set(String(pattern['name']), UNKNOWN_VALUE);
      return;
    case 'ObjectPattern': {
      for (const property of nodeArray(pattern['properties'])) {
        declarePattern(asNode(property['value']) ?? asNode(property['argument']), scope);
      }
      return;
    }
    case 'ArrayPattern': {
      for (const element of nodeArray(pattern['elements'])) {
        declarePattern(element, scope);
      }
      return;
    }
    case 'AssignmentPattern':
      declarePattern(asNode(pattern['left']), scope);
      return;
    case 'RestElement':
    case 'TSParameterProperty':
      declarePattern(asNode(pattern['argument']) ?? asNode(pattern['parameter']), scope);
      return;
    default:
      return;
  }
}

function assignPattern(
  pattern: AstNode | undefined,
  value: BindingValue,
  scope: Scope,
  add: (rule: string, detail: string) => void,
): void {
  if (pattern === undefined) {
    return;
  }
  switch (pattern.type) {
    case 'Identifier': {
      const name = String(pattern['name']);
      const binding = findBinding(scope, name);
      if (binding === undefined) {
        inspectIdentifier(name, scope, add);
      } else {
        binding.bindings.set(name, value);
      }
      return;
    }
    case 'ObjectPattern':
      for (const property of nodeArray(pattern['properties'])) {
        if (property.type === 'RestElement') {
          assignPattern(asNode(property['argument']), UNKNOWN_VALUE, scope, add);
          continue;
        }
        const propertyName = patternPropertyName(property, scope);
        const forbidden =
          propertyName === 'constructor'
            ? FORBIDDEN_MEMBERS[propertyName]
            : value.kind === 'namespace' && propertyName !== undefined
              ? FORBIDDEN_MEMBERS[propertyName] ?? FORBIDDEN_GLOBALS[propertyName]
              : undefined;
        if (forbidden !== undefined) {
          add(forbidden, propertyName ?? '');
        }
        const propertyValue =
          forbidden !== undefined && propertyName !== undefined
            ? { kind: 'capability' as const, name: propertyName, rule: forbidden }
            : value.kind === 'namespace' && propertyName !== undefined
            ? namespaceMember(value.name, propertyName)
            : UNKNOWN_VALUE;
        assignPattern(asNode(property['value']), propertyValue, scope, add);
      }
      return;
    case 'ArrayPattern':
      for (const element of nodeArray(pattern['elements'])) {
        assignPattern(element, UNKNOWN_VALUE, scope, add);
      }
      return;
    case 'AssignmentPattern':
      assignPattern(asNode(pattern['left']), value, scope, add);
      return;
    case 'RestElement':
    case 'TSParameterProperty':
      assignPattern(asNode(pattern['argument']) ?? asNode(pattern['parameter']), value, scope, add);
      return;
    default:
      return;
  }
}

function valueOf(
  source: AstNode | undefined,
  scope: Scope,
  add: (rule: string, detail: string) => void,
): BindingValue {
  const node = unwrapValue(source);
  if (node === undefined) {
    return UNKNOWN_VALUE;
  }
  if (node.type === 'Literal' || node.type === 'StringLiteral') {
    return typeof node['value'] === 'string'
      ? { kind: 'string', value: node['value'] }
      : UNKNOWN_VALUE;
  }
  if (node.type === 'Identifier') {
    const name = String(node['name']);
    const binding = findBinding(scope, name);
    if (binding !== undefined) {
      return binding.bindings.get(name) ?? UNKNOWN_VALUE;
    }
    if (GLOBAL_NAMESPACES.has(name)) {
      return { kind: 'namespace', name };
    }
    const forbidden = FORBIDDEN_GLOBALS[name];
    if (forbidden !== undefined) {
      return { kind: 'capability', name, rule: forbidden };
    }
    if (ALLOWED_GLOBAL_MEMBERS.has(name)) {
      return { kind: 'capability', name };
    }
    return UNKNOWN_VALUE;
  }
  if (node.type === 'MemberExpression') {
    return valueOfMember(node, scope, add);
  }
  return UNKNOWN_VALUE;
}

function valueOfMember(
  node: AstNode,
  scope: Scope,
  add: (rule: string, detail: string) => void,
): BindingValue {
  const property = resolvedMemberName(node, scope);
  const forbidden = property === undefined ? undefined : FORBIDDEN_MEMBERS[property];
  if (forbidden !== undefined) {
    add(forbidden, property ?? '');
  }

  const object = valueOf(asNode(node['object']), scope, add);
  if (object.kind !== 'namespace') {
    return forbidden === undefined || property === undefined
      ? UNKNOWN_VALUE
      : { kind: 'capability', name: property, rule: forbidden };
  }
  if (property === undefined) {
    add('unapproved global member', `${object.name}[computed]`);
    return { kind: 'capability', name: '[computed]', rule: 'unapproved global member' };
  }

  const capability = namespaceMember(object.name, property);
  if (capability.kind === 'capability' && capability.rule === 'unapproved global member') {
    add(capability.rule, `${object.name}.${property}`);
  }
  return capability;
}

function resolvedMemberName(node: AstNode, scope: Scope): string | undefined {
  if (node['computed'] === true) {
    const property = valueOf(asNode(node['property']), scope, () => undefined);
    return property.kind === 'string' ? property.value : undefined;
  }
  const property = asNode(node['property']);
  return property?.type === 'Identifier' ? String(property['name']) : undefined;
}

function namespaceMember(namespace: string, property: string): BindingValue {
  const forbidden = FORBIDDEN_MEMBERS[property] ?? FORBIDDEN_GLOBALS[property];
  if (forbidden !== undefined) {
    return { kind: 'capability', name: property, rule: forbidden };
  }
  if (ALLOWED_GLOBAL_MEMBERS.has(property)) {
    return { kind: 'capability', name: property };
  }
  return { kind: 'capability', name: `${namespace}.${property}`, rule: 'unapproved global member' };
}

function inspectIdentifier(
  name: string,
  scope: Scope,
  add: (rule: string, detail: string) => void,
): void {
  const binding = findBinding(scope, name);
  if (binding !== undefined) {
    const value = binding.bindings.get(name);
    if (value?.kind === 'capability' && value.rule !== undefined) {
      add(value.rule, `alias of ${value.name}`);
    }
    return;
  }
  const forbidden = FORBIDDEN_GLOBALS[name];
  if (forbidden !== undefined) {
    add(forbidden, name);
  } else if (!AMBIENT_ALLOWLIST.has(name)) {
    add('unapproved global', name);
  }
}

function findBinding(scope: Scope, name: string): Scope | undefined {
  for (let candidate: Scope | undefined = scope; candidate !== undefined; candidate = candidate.parent) {
    if (candidate.bindings.has(name)) {
      return candidate;
    }
  }
  return undefined;
}

function nearestFunctionScope(scope: Scope): Scope {
  let candidate = scope;
  while (!candidate.functionScope && candidate.parent !== undefined) {
    candidate = candidate.parent;
  }
  return candidate;
}

function analyzePatternDefaults(
  pattern: AstNode | undefined,
  scope: Scope,
  scopes: WeakMap<object, Scope>,
  add: (rule: string, detail: string) => void,
): void {
  if (pattern === undefined) {
    return;
  }
  switch (pattern.type) {
    case 'AssignmentPattern': {
      const right = asNode(pattern['right']);
      if (right !== undefined) {
        analyzeNode(right, scope, scopes, add);
      }
      analyzePatternDefaults(asNode(pattern['left']), scope, scopes, add);
      return;
    }
    case 'ObjectPattern':
      for (const property of nodeArray(pattern['properties'])) {
        analyzePatternDefaults(
          asNode(property['value']) ?? asNode(property['argument']),
          scope,
          scopes,
          add,
        );
      }
      return;
    case 'ArrayPattern':
      for (const element of nodeArray(pattern['elements'])) {
        analyzePatternDefaults(element, scope, scopes, add);
      }
      return;
    case 'RestElement':
    case 'TSParameterProperty':
      analyzePatternDefaults(
        asNode(pattern['argument']) ?? asNode(pattern['parameter']),
        scope,
        scopes,
        add,
      );
      return;
    default:
      return;
  }
}

function patternPropertyName(property: AstNode, scope: Scope): string | undefined {
  const key = asNode(property['key']);
  if (property['computed'] === true) {
    const value = valueOf(key, scope, () => undefined);
    return value.kind === 'string' ? value.value : undefined;
  }
  return key?.type === 'Identifier' ? String(key['name']) : literalText(key);
}

function unwrapValue(node: AstNode | undefined): AstNode | undefined {
  let current = node;
  while (current !== undefined && VALUE_CARRYING_TS_NODES.has(current.type)) {
    current = asNode(current['expression']);
  }
  if (current?.type === 'ChainExpression') {
    return unwrapValue(asNode(current['expression']));
  }
  return current;
}

function isBindingPattern(node: AstNode): boolean {
  return node.type === 'Identifier' || node.type === 'ObjectPattern' || node.type === 'ArrayPattern';
}

function isFunction(node: AstNode | undefined): boolean {
  return (
    node?.type === 'FunctionDeclaration' ||
    node?.type === 'FunctionExpression' ||
    node?.type === 'ArrowFunctionExpression'
  );
}

function isNonReferenceMetadata(node: AstNode, key: string): boolean {
  if ((node.type === 'ClassDeclaration' || node.type === 'ClassExpression') && key === 'id') {
    return true;
  }
  if (
    (node.type === 'PropertyDefinition' || node.type === 'MethodDefinition') &&
    key === 'key' &&
    node['computed'] !== true
  ) {
    return true;
  }
  return (
    (node.type === 'LabeledStatement' || node.type === 'BreakStatement' || node.type === 'ContinueStatement') &&
    key === 'label'
  );
}

function isTypeOnly(node: AstNode): boolean {
  return node.type.startsWith('TS') && !VALUE_CARRYING_TS_NODES.has(node.type);
}

function nodeArray(value: unknown): readonly AstNode[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const node = asNode(item);
      return node === undefined ? [] : [node];
    });
  }
  const node = asNode(value);
  return node === undefined ? [] : [node];
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
