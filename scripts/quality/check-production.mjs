import { loadEnvironment } from '../../src/shared/config.mjs';
import { productionIssues } from '../../src/shared/production.mjs';
import { authProductionIssues } from '../../src/shared/auth-production.mjs';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length && args[0] !== '--auth-ready')) throw new Error('Usage: npm run check:production [-- --auth-ready]');
loadEnvironment();
const issues = [...new Set([...productionIssues(process.env),
  ...(args.includes('--auth-ready') ? authProductionIssues(process.env, { requireProviders: true }) : [])])];
if (issues.length) {
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('PASS: cấu hình production hợp lệ về mặt tĩnh. Cần xác minh DB, volume và proxy thực tế.');
}
