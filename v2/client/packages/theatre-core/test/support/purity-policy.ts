import { parseAst } from 'rolldown/parseAst';

export interface PurityViolation { readonly file: string; readonly rule: string; readonly detail: string }
type AstNode = { readonly type: string; readonly [key: string]: unknown };

const DIRECT_GLOBAL_RULES: Readonly<Record<string, string>> = { fetch: 'fetch', XMLHttpRequest: 'transport', WebSocket: 'transport', EventSource: 'transport', localStorage: 'storage', sessionStorage: 'storage', indexedDB: 'storage', caches: 'storage', document: 'browser global', window: 'browser global', navigator: 'browser global', process: 'environment', eval: 'dynamic code', Function: 'dynamic code' };
const MEMBER_RULES: Readonly<Record<string, string>> = { fetch: 'fetch', sendBeacon: 'sendBeacon', localStorage: 'storage', sessionStorage: 'storage', indexedDB: 'storage', storage: 'storage', cookie: 'storage', env: 'environment', getRandomValues: 'randomness', random: 'randomness' };

/** Oxc AST guard supplied by the existing Vite/Rolldown test toolchain. */
export function inspectPurePresentationSource(file: string, source: string): readonly PurityViolation[] {
  const ast = parseAst(source, { lang: language(file) }, file) as unknown as AstNode;
  const violations: PurityViolation[] = [];
  const add = (rule: string, detail: string): void => { violations.push({ file, rule, detail }); };

  walk(ast, (node) => {
    if (node.type === 'ImportDeclaration') {
      const specifier = literalText(node['source']); const specifiers = node['specifiers'];
      if (Array.isArray(specifiers) && specifiers.length === 0) add('side-effect import', specifier);
      else if (node['importKind'] !== 'type' && !isRelative(specifier)) add('external dependency', specifier);
    }
    if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') {
      const specifier = literalText(node['source']); if (specifier !== '' && node['exportKind'] !== 'type' && !isRelative(specifier)) add('external dependency', specifier);
    }
    if (node.type === 'ImportExpression') add('dynamic import', 'import()');
    if (node.type === 'CallExpression' || node.type === 'NewExpression') {
      const callee = asNode(node['callee']);
      if (callee?.type === 'Identifier') { const name = String(callee['name']); const rule = DIRECT_GLOBAL_RULES[name]; if (rule !== undefined) add(rule, name); }
    }
    if (node.type === 'MemberExpression' && node['computed'] !== true) {
      const property = asNode(node['property']); const name = property?.type === 'Identifier' ? String(property['name']) : '';
      const rule = MEMBER_RULES[name]; if (rule !== undefined) add(rule, name);
      const object = asNode(node['object']);
      if (object?.type === 'Identifier') { const objectName = String(object['name']); const objectRule = DIRECT_GLOBAL_RULES[objectName]; if (objectRule !== undefined) add(objectRule, objectName); }
    }
  });
  return violations;
}

function walk(value: unknown, visit: (node: AstNode) => void): void { if (Array.isArray(value)) { for (const item of value) walk(item, visit); return; } const node = asNode(value); if (node === undefined) return; visit(node); for (const [key, nested] of Object.entries(node)) if (key !== 'parent') walk(nested, visit); }
function asNode(value: unknown): AstNode | undefined { return value !== null && typeof value === 'object' && typeof (value as Record<string, unknown>)['type'] === 'string' ? value as AstNode : undefined; }
function literalText(value: unknown): string { const node = asNode(value); return node?.type === 'Literal' || node?.type === 'StringLiteral' ? String(node['value'] ?? '') : ''; }
function isRelative(specifier: string): boolean { return specifier.startsWith('./') || specifier.startsWith('../'); }
function language(file: string): 'js' | 'jsx' | 'ts' | 'tsx' { if (file.endsWith('.tsx')) return 'tsx'; if (file.endsWith('.jsx')) return 'jsx'; if (file.endsWith('.ts')) return 'ts'; return 'js'; }
