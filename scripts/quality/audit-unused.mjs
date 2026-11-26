import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { isExcludedSourcePath } from '../release/policy.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const roots = ['src', 'web/js', 'web/assets/moments', 'services', 'scripts', 'tests', 'database/scripts'];
const entryFiles = ['dev.mjs', 'gateway.mjs', 'eslint.config.mjs'];
const target = file => /^(src|web\/js)\//.test(file);
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const sorted = values => [...values].sort(order);
const consumerKind = file => file.startsWith('tests/') ? 'test' : /^(scripts|database\/scripts)\//.test(file) || file === 'eslint.config.mjs' ? 'tool' : 'runtime';
const nameOf = node => node?.name ?? node?.value;

function bindings(node) {
  if (!node) return [];
  switch (node.type) {
    case 'Identifier': return [node.name];
    case 'ObjectPattern': return node.properties.flatMap(p => bindings(p.type === 'RestElement' ? p.argument : p.value));
    case 'ArrayPattern': return node.elements.flatMap(bindings);
    case 'AssignmentPattern': return bindings(node.left);
    case 'RestElement': return bindings(node.argument);
    default: return [];
  }
}

// Không thực thi module. Namespace, import động và export * được xử lý bảo thủ.
export function inspectModule(source, file) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true, locations: true });
  const exports = new Set(), references = [], unknownDynamic = [];
  let starExport = false;
  const add = (node, names, kind, opaque = false) => references.push({ specifier: node.value, names, kind, opaque, line: node.loc.start.line });
  function visit(node) {
    if (!node || typeof node.type !== 'string') return;
    switch (node.type) {
      case 'ImportDeclaration':
        add(node.source, node.specifiers.flatMap(s => s.type === 'ImportDefaultSpecifier' ? ['default'] : s.type === 'ImportSpecifier' ? [nameOf(s.imported)] : []), 'static', node.specifiers.some(s => s.type === 'ImportNamespaceSpecifier'));
        break;
      case 'ExportNamedDeclaration': {
        const decl = node.declaration;
        if (decl?.type === 'VariableDeclaration') decl.declarations.forEach(d => bindings(d.id).forEach(n => exports.add(n)));
        else if (decl?.id) exports.add(decl.id.name);
        node.specifiers.forEach(s => exports.add(nameOf(s.exported)));
        if (node.source) add(node.source, node.specifiers.map(s => nameOf(s.local)), 'reexport');
        break;
      }
      case 'ExportDefaultDeclaration': exports.add('default'); break;
      case 'ExportAllDeclaration':
        if (node.exported) exports.add(nameOf(node.exported));
        else starExport = true;
        add(node.source, [], 'reexport', true);
        break;
      case 'ImportExpression': {
        const value = node.source.type === 'Literal' ? node.source.value : node.source.type === 'TemplateLiteral' && node.source.expressions.length === 0 ? node.source.quasis[0].value.cooked : null;
        if (typeof value === 'string') add({ value, loc: node.source.loc }, [], 'dynamic', true);
        else unknownDynamic.push(node.loc.start.line);
        break;
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(ast);
  return { file, exports: sorted(exports), references, unknownDynamic, starExport };
}

function resolveLocal(file, specifier) {
  if (specifier.startsWith('.')) return path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
  if (file.startsWith('web/') && /^\/(js|assets)\//.test(specifier)) return `web${specifier}`;
  return null;
}

export function analyzeUnused(modules, entries = []) {
  const byFile = new Map(modules.map(m => [m.file, m]));
  const edges = new Map(modules.map(m => [m.file, []]));
  const unresolved = [], unknownDynamic = [], entrySet = new Set(entries);
  for (const module of modules) {
    for (const line of module.unknownDynamic) unknownDynamic.push({ file: module.file, line });
    for (const ref of module.references) {
      const destination = resolveLocal(module.file, ref.specifier);
      if (!destination) continue;
      if (!byFile.has(destination)) {
        unresolved.push({ file: module.file, line: ref.line, destination });
        continue;
      }
      edges.get(destination).push({ ...ref, from: module.file, consumer: consumerKind(module.file) });
    }
  }
  const noIncoming = [], noObservedConsumer = [], testOnly = [], toolOrTestOnly = [], opaqueModules = [];
  const scopes = { runtime: 0, tool: 0, test: 0 };
  let explicitExports = 0, targets = 0;
  for (const module of modules) {
    scopes[consumerKind(module.file)]++;
    if (!target(module.file)) continue;
    targets++;
    explicitExports += module.exports.length;
    const inbound = edges.get(module.file);
    if (!inbound.length && !entrySet.has(module.file)) noIncoming.push(module.file);
    const opaque = inbound.filter(e => e.opaque);
    if (opaque.length || module.starExport) opaqueModules.push(module.file);
    if (entrySet.has(module.file) || module.starExport) continue;
    for (const name of module.exports) {
      const observed = inbound.filter(e => e.opaque || e.names.includes(name));
      const item = { file: module.file, name };
      if (!observed.length) noObservedConsumer.push(item);
      else if (observed.every(e => e.consumer === 'test')) testOnly.push(item);
      else if (observed.every(e => e.consumer !== 'runtime')) toolOrTestOnly.push(item);
    }
  }
  return {
    mode: 'advisory-only',
    scannedModules: modules.length, targets, explicitExports, scopes,
    entries: sorted(entrySet), unknownDynamic, unresolved, opaqueModules,
    noIncoming, noObservedConsumer, testOnly, toolOrTestOnly,
  };
}

function files(base, relative) {
  const full = path.join(base, relative);
  if (!fs.existsSync(full) || fs.lstatSync(full).isSymbolicLink() || isExcludedSourcePath(relative) || relative === 'web/js/vendor') return [];
  if (fs.statSync(full).isDirectory()) return sorted(fs.readdirSync(full)).flatMap(name => files(base, `${relative}/${name}`));
  return /\.(mjs|js)$/.test(relative) ? [relative] : [];
}

export function runUnusedAudit(base = root) {
  const sources = sorted(new Set([...roots, ...entryFiles].flatMap(dir => files(base, dir))));
  // Entry HTML và lệnh chạy trực tiếp không nhất thiết có import đi vào.
  const html = fs.readFileSync(path.join(base, 'web/index.html'), 'utf8');
  const packageInfo = JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf8'));
  const entries = [...html.matchAll(/<script\b[^>]*\bsrc=["']\/(js\/[^"'?#]+)[^"']*["']/gi)].map(m => `web/${m[1]}`);
  for (const command of Object.values(packageInfo.scripts ?? {})) {
    for (const match of command.matchAll(/(?:^|\s)(src\/[\w./-]+\.mjs)(?=\s|$)/g)) entries.push(match[1]);
  }
  return analyzeUnused(sources.map(file => inspectModule(fs.readFileSync(path.join(base, file), 'utf8'), file)), entries);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(runUnusedAudit(), null, 2));
}
