import { loadEnvironment } from '../../src/shared/config.mjs';
import { productionIssues } from '../../src/shared/production.mjs';

loadEnvironment();
const issues = productionIssues(process.env);
if (issues.length) {
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('PASS: cấu hình production hợp lệ về mặt tĩnh. Cần xác minh DB, volume và proxy thực tế.');
}
