import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const root = fileURLToPath(new URL('../../', import.meta.url));
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const sorted = values => [...values].sort(compare);
const functionTypes = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const decisionTypes = new Set(['IfStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement', 'CatchClause', 'ConditionalExpression', 'LogicalExpression']);

// Chỉ đọc mã nguồn do nhóm bảo trì; loại trừ vendor sinh trong build.
function sourceFiles(base, relative) {
  return fs.readdirSync(path.join(base, relative), { withFileTypes: true }).flatMap(entry => {
    const name = `${relative}/${entry.name}`;
    if (entry.isDirectory()) return name === 'web/js/vendor' ? [] : sourceFiles(base, name);
    return entry.isFile() && /\.(mjs|js)$/.test(name) ? [name] : [];
  });
}

export function inspectSource(source, file) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true });
  const lines = source.split(/\r\n|\r|\n/);
  if (lines.at(-1) === '') lines.pop();
  const result = { file, lines: lines.length, nonblank: lines.filter(line => line.trim()).length, classes: 0, functions: [], imports: [], dynamicUnknown: 0 };
  function visit(node, current, parent) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') result.classes++;
    if (functionTypes.has(node.type)) {
      const name = node.id?.name || (parent?.type === 'VariableDeclarator' ? parent.id?.name : parent?.key?.name || parent?.key?.value) || '(anonymous)';
      current = { name, line: node.loc.start.line, lines: node.loc.end.line - node.loc.start.line + 1, decisions: 0 };
      result.functions.push(current);
    }
    if (current && (decisionTypes.has(node.type) || (node.type === 'SwitchCase' && node.test))) current.decisions++;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) {
      result.imports.push({ specifier: node.source.value, dynamic: false });
    }
    if (node.type === 'ImportExpression') {
      if (node.source.type === 'Literal' && typeof node.source.value === 'string') result.imports.push({ specifier: node.source.value, dynamic: true });
      else result.dynamicUnknown++;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(child => visit(child, current, node));
      else if (value && typeof value === 'object') visit(value, current, node);
    }
  }
  visit(ast, null, null);
  return result;
}

// Tarjan: một nhóm liên thông mạnh biểu thị vòng phụ thuộc tĩnh thực sự.
export function cyclicGroups(graph) {
  let sequence = 0;
  const indices = new Map(), lows = new Map(), stack = [], active = new Set(), groups = [];
  function visit(name) {
    indices.set(name, sequence); lows.set(name, sequence++); stack.push(name); active.add(name);
    for (const target of sorted(graph.get(name) || [])) {
      if (!indices.has(target)) { visit(target); lows.set(name, Math.min(lows.get(name), lows.get(target))); }
      else if (active.has(target)) lows.set(name, Math.min(lows.get(name), indices.get(target)));
    }
    if (lows.get(name) !== indices.get(name)) return;
    const group = [];
    let member;
    do { member = stack.pop(); active.delete(member); group.push(member); } while (member !== name);
    if (group.length > 1 || graph.get(name)?.has(name)) groups.push(sorted(group));
  }
  for (const name of sorted(graph.keys())) if (!indices.has(name)) visit(name);
  return groups.sort((a, b) => compare(a[0], b[0]));
}

function area(file) {
  const parts = file.split('/');
  if (parts[0] === 'src') return parts[1] === 'modules' ? parts.slice(0, 3).join('/') : parts.slice(0, 2).join('/');
  return parts[2] === 'features' ? parts.slice(0, 4).join('/') : parts.slice(0, 3).join('/');
}

export function analyze(files) {
  const graph = new Map(files.map(file => [file.file, new Set()]));
  const cross = new Map(), boundaries = new Set(), unresolved = new Set();
  let dynamicImports = 0;
  for (const file of files) {
    for (const { specifier, dynamic } of file.imports) {
      if (dynamic) dynamicImports++;
      if (!specifier.startsWith('.')) continue;
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file.file), specifier));
      const edge = `${file.file} -> ${target}`;
      if (file.file.startsWith('web/js/') && target.startsWith('src/')) boundaries.add(edge);
      if (/^src\/(shared|infrastructure)\//.test(file.file) && target.startsWith('src/modules/')) boundaries.add(edge);
      if (!graph.has(target)) { unresolved.add(edge); continue; }
      if (dynamic) continue;
      graph.get(file.file).add(target);
      if (area(file.file) !== area(target)) {
        const key = `${area(file.file)} -> ${area(target)}`;
        if (!cross.has(key)) cross.set(key, new Set());
        cross.get(key).add(edge);
      }
    }
  }
  const cycles = cyclicGroups(graph);
  const cycleEdges = cycles.flatMap(group => group.flatMap(from => sorted(graph.get(from)).filter(to => group.includes(to)).map(to => `${from} -> ${to}`)));
  const scopes = ['src/', 'web/js/'].map(prefix => {
    const rows = files.filter(file => file.file.startsWith(prefix));
    return { scope: prefix, files: rows.length, lines: rows.reduce((sum, file) => sum + file.lines, 0), nonblank: rows.reduce((sum, file) => sum + file.nonblank, 0), classes: rows.reduce((sum, file) => sum + file.classes, 0), functions: rows.reduce((sum, file) => sum + file.functions.length, 0) };
  });
  const bySize = files.map(({ file, lines, nonblank }) => ({ file, lines, nonblank })).sort((a, b) => b.lines - a.lines || compare(a.file, b.file));
  const byDecisions = files.flatMap(file => file.functions.map(fn => ({ file: file.file, ...fn }))).sort((a, b) => b.decisions - a.decisions || compare(a.file, b.file) || a.line - b.line);
  return { scopes, staticEdges: [...graph.values()].reduce((sum, targets) => sum + targets.size, 0), dynamicImports, dynamicUnknown: files.reduce((sum, file) => sum + file.dynamicUnknown, 0), cycles, cycleEdges: sorted(cycleEdges), boundaries: sorted(boundaries), outsideScannedGraph: sorted(unresolved), crossArea: sorted(cross.keys()).map(edge => ({ edge, imports: cross.get(edge).size })), largestFiles: bySize.slice(0, 15), mostDecisions: byDecisions.slice(0, 15) };
}

export function newViolations(report, baseline) {
  return ['cycleEdges', 'boundaries'].flatMap(key => report[key].filter(edge => !baseline[key].includes(edge)).map(edge => `${key}: ${edge}`));
}

export function runAudit(base = root) {
  return analyze(sorted(['src', 'web/js'].flatMap(dir => sourceFiles(base, dir))).map(file => inspectSource(fs.readFileSync(path.join(base, file), 'utf8'), file)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = runAudit();
  console.log(JSON.stringify(report, null, 2));
  if (process.argv.includes('--check')) {
    const baseline = JSON.parse(fs.readFileSync(path.join(root, 'docs/architecture-baseline.json'), 'utf8'));
    const violations = newViolations(report, baseline);
    if (violations.length) {
      console.error(`Phát hiện phụ thuộc mới cần rà soát:\n${violations.join('\n')}`);
      process.exitCode = 1;
    } else console.error('PASS: không phát sinh vòng import tĩnh hoặc phụ thuộc ngược thuộc phạm vi kiểm tra.');
  }
}
