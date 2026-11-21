import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Dùng trước khi commit; không sửa lịch sử Git và không tự tạo nội dung CHANGELOG.
export const affectsProduct = filename => /^(?:src|services|web|scripts|tests|database|\.github)\//.test(filename) ||
  ['package.json', 'package-lock.json', 'dev.mjs', 'gateway.mjs'].includes(filename);

export function assessChangelog(files) {
  const changed = [...new Set(files)].filter(Boolean);
  const product = changed.filter(affectsProduct);
  return {
    required: product.length > 0,
    updated: changed.includes('CHANGELOG.md'),
    product,
    valid: product.length === 0 || changed.includes('CHANGELOG.md'),
  };
}

export function changedStagedFiles(cwd) {
  const value = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  return value.split(/\r?\n/).filter(Boolean);
}

const current = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (current) {
  if (process.argv[2] && process.argv[2] !== '--staged') {
    console.error('Usage: npm run changelog:check (after git add)');
    process.exitCode = 2;
  } else {
    try {
      const result = assessChangelog(changedStagedFiles(process.cwd()));
      if (!result.valid) {
        console.error('CHANGELOG.md is missing from the staged changes.');
        console.error(`Product files staged: ${result.product.length}`);
        console.error('Update CHANGELOG.md, then run: git add CHANGELOG.md');
        process.exitCode = 1;
      } else {
        console.log(result.required
          ? 'PASS CHANGELOG.md is staged together with product changes.'
          : 'PASS No staged product changes require a changelog entry.');
      }
    } catch (error) {
      console.error('Unable to inspect staged files:', error.message);
      process.exitCode = 2;
    }
  }
}
