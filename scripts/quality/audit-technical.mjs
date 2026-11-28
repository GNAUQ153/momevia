import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAudit } from './audit-architecture.mjs';
import { runUnusedAudit } from './audit-unused.mjs';
import { auditMonitoredCss } from './check-css-style.mjs';
import { runAssetAudit } from './audit-assets.mjs';
import { auditRepository } from '../../database/scripts/migration-audit.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

// Chỉ chấp nhận các cạnh đã xác minh ngoài graph JS. Không miễn trừ cả thư mục vendor.
const sourceEdges = new Map([
  ['src/modules/identity/policy-archive.mjs -> src/modules/identity/policy-archive/2026-11-28.1.json', 'src/modules/identity/policy-archive/2026-11-28.1.json'],
  ['src/shared/locale.mjs -> web/assets/locales/en.json', 'web/assets/locales/en.json'],
  ['web/js/shared/locale.js -> web/assets/locales/vi.json', 'web/assets/locales/vi.json'],
  ['web/js/features/canvas-editor/library.js -> web/assets/canvas/vector-insertions-v1.json', 'web/assets/canvas/vector-insertions-v1.json'],
]);
const generatedEdges = new Map([
  ['web/js/features/canvas-editor/fabric-studio.js -> web/js/vendor/fabric.mjs', 'web/js/vendor/fabric.mjs'],
  ['web/js/features/gifts/qr.js -> web/js/vendor/qrcode.js', 'web/js/vendor/qrcode.js'],
  ['web/js/features/gifts/recipient-import.js -> web/js/vendor/recipient-xlsx.mjs', 'web/js/vendor/recipient-xlsx.mjs'],
]);

export function assessRelativeTargets(edges, isFile, { built = false } = {}) {
  const issues = [];
  const pending = [];
  for (const edge of edges) {
    if (sourceEdges.has(edge)) {
      if (!isFile(sourceEdges.get(edge))) issues.push({ edge, reason: 'missing-source' });
    } else if (generatedEdges.has(edge)) {
      if (!isFile(generatedEdges.get(edge))) {
        (built ? issues : pending).push({ edge, reason: 'missing-generated' });
      }
    } else {
      issues.push({ edge, reason: 'unreviewed-relative-target' });
    }
  }
  return { issues, pending };
}

const status = issues => issues.length ? 'fail' : 'pass';

export function summarizeTechnical({ architecture, targets, css, assets, migrations, unused }, { built = false } = {}) {
  const checks = {
    architecture: {
      status: status([...architecture.cycleEdges, ...architecture.boundaries]),
      scopes: architecture.scopes,
      staticEdges: architecture.staticEdges,
      cycles: architecture.cycles,
      cycleEdges: architecture.cycleEdges,
      boundaries: architecture.boundaries,
    },
    relativeTargets: { status: targets.issues.length ? 'fail' : targets.pending.length ? 'pending' : 'pass', ...targets },
    css: {
      status: css.length && css.every(row => !row.errors.length) ? 'pass' : 'fail',
      files: css.length,
      declarations: css.reduce((sum, row) => sum + row.declarationCount, 0),
      issues: css.flatMap(row => row.errors),
    },
    fonts: { status: status(assets.fontManifest.issues), ...assets.fontManifest },
    migrations: { status: status(migrations.issues), count: migrations.migrations.length, pinned: migrations.pinnedCount, tables: migrations.tableCount, issues: migrations.issues },
  };
  const failed = Object.entries(checks).filter(([, check]) => check.status === 'fail').map(([name]) => name);
  const pending = Object.entries(checks).filter(([, check]) => check.status === 'pending').map(([name]) => name);
  return {
    mode: built ? 'built-source-audit' : 'offline-source-audit',
    status: failed.length ? 'fail' : pending.length ? 'pending' : 'pass',
    failed,
    pending,
    checks,
    advisory: {
      dynamicUnknown: architecture.dynamicUnknown,
      mostDecisions: architecture.mostDecisions,
      unusedExports: unused.noObservedConsumer.length,
      modulesWithoutIncoming: unused.noIncoming.length,
      unresolvedDynamic: unused.unknownDynamic.length,
      duplicateAssetGroups: assets.duplicateGroups,
      repeatedAssetBytes: assets.repeatedBytes,
    },
    // CI, cấu hình production và dữ liệu thật không được suy ra từ audit tĩnh.
    productionReadiness: 'not-assessed',
    externalEvidenceRequired: ['full-ci', 'production-config', 'live-schema-and-integrity', 'backup-restore', 'payment-and-refund-live', 'browser-ux', 'railway-usage'],
  };
}

export async function runTechnicalAudit({ built = false } = {}) {
  const architecture = runAudit(root);
  const isFile = relative => {
    try { return fs.lstatSync(path.join(root, relative)).isFile(); }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  };
  return summarizeTechnical({
    architecture,
    targets: assessRelativeTargets(architecture.outsideScannedGraph, isFile, { built }),
    css: auditMonitoredCss(root),
    assets: runAssetAudit(root),
    migrations: await auditRepository(),
    unused: runUnusedAudit(root),
  }, { built });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => arg !== '--built')) {
    console.error('Cách dùng: npm run audit:technical [-- --built]');
    process.exitCode = 2;
  } else {
    try {
      const report = await runTechnicalAudit({ built: args.includes('--built') });
      console.log(JSON.stringify(report, null, 2));
      if (report.failed.length) process.exitCode = 1;
    } catch {
      // Không in stack trace hoặc nội dung file khi audit không hoàn tất.
      console.error('Technical audit không hoàn tất. Kiểm tra source và dependency dev.');
      process.exitCode = 1;
    }
  }
}
