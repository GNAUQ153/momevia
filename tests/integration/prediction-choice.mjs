import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { runPredictionBrowser } from '../browser/prediction-choice.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const temporaryRoot = fs.realpathSync(os.tmpdir());
const fixture = fs.mkdtempSync(path.join(temporaryRoot, 'momevia-prediction-'));
const reserved = net.createServer().listen(0, '127.0.0.1');
await once(reserved, 'listening'); const port = reserved.address().port;
await new Promise(resolve => reserved.close(resolve));
const base = `http://127.0.0.1:${port}`;
const profile = path.join(fixture, 'local', `web-demo-${port}`);
const artifacts = process.env.BROWSER_ARTIFACT_DIR || path.join(root, 'local', 'prediction-browser-latest');
let child, ended, logs = '';
try {
  for (const entry of ['src', 'web', 'scripts/dev', 'package.json', 'dev.mjs'])
    fs.cpSync(path.join(root, entry), path.join(fixture, entry), { recursive: true });
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'junction');
  child = spawn(process.execPath, ['scripts/dev/web-demo.mjs', '--port', String(port), '--no-watch'], {
    cwd: fixture, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, TEST_ACCOUNT_ENABLED: 'false' },
  });
  ended = once(child, 'exit');
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Demo startup timed out: '+logs)), 30000);
    const listen = bytes => {
      logs = (logs+bytes).slice(-8000);
      if (logs.includes('Tài khoản và link các bước:')) { clearTimeout(timeout); resolve(); }
    };
    child.stdout.on('data', listen); child.stderr.on('data', listen);
    child.once('exit', code => { clearTimeout(timeout); reject(new Error('Demo exited '+code+': '+logs)); });
  });
  const account = JSON.parse(fs.readFileSync(path.join(profile,'tai-khoan-demo.json'),'utf8')).sender;
  const state = JSON.parse(fs.readFileSync(path.join(profile,'trang-thai-demo.json'),'utf8'));
  await runPredictionBrowser(base, { account, artifactDir: artifacts, oldGift: state.gift, revokedGift: state.revoked, expiredGift: state.expired });
  console.log('PASS Isolated prediction browser: full library-to-publication journey and all four branches. Temporary links are test evidence only.');
} finally {
  if (child?.exitCode === null) {
    child.send('demo-stop', () => {});
    const force = setTimeout(() => child.kill(), 15000);
    try { await ended; } finally { clearTimeout(force); }
  }
  // Unlink only junctions owned by this verified temporary fixture before removal.
  assert(path.dirname(fixture) === temporaryRoot && path.basename(fixture).startsWith('momevia-prediction-'));
  for (const modules of [path.join(profile,'app','node_modules'), path.join(fixture,'node_modules')])
    if (fs.lstatSync(modules, { throwIfNoEntry: false })?.isSymbolicLink()) fs.unlinkSync(modules);
  fs.rmSync(fixture, { recursive: true, force: true });
}
