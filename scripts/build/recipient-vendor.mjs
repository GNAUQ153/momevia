import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
const root = fileURLToPath(new URL('../../', import.meta.url));
await build({ absWorkingDir: root, stdin: { contents: "export { default } from 'read-excel-file';", resolveDir: root },
  outfile: path.join(root, 'web/js/vendor/recipient-xlsx.mjs'), bundle: true, minify: true, format: 'esm', target: 'es2022', legalComments: 'eof' });
fs.writeFileSync(path.join(root, 'web/js/vendor/RECIPIENT_XLSX_LICENSE.txt'), ['read-excel-file', 'fflate'].map(name => `${name}\n\n${fs.readFileSync(path.join(root, 'node_modules', name, 'LICENSE'), 'utf8')}`).join('\n\n'));
