import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { demoProfile, demoEndpoints, existingDemoKeys, demoStorage } from '../../scripts/dev/web-demo-config.mjs';

test('a migrated demo keeps its MySQL database across launcher restarts', t => {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'momevia-storage-config-'));
  t.after(() => { assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); });
  assert.deepEqual(demoStorage(root), { mode: 'json', env: {} });
  const config = { formatVersion: 1, mode: 'mysql', host: '127.0.0.1', port: 3306, database: 'momevia_demo_fixture', user: 'qa', password: 'synthetic-only' };
  const file = path.join(root, 'storage.json'); fs.writeFileSync(file, JSON.stringify(config));
  const result = demoStorage(root);
  assert.equal(result.mode, 'mysql'); assert.equal(result.env.MYSQL_DATABASE, config.database);
  for (const name of ['IDENTITY', 'CATALOG', 'CHECKOUT', 'GIFTS', 'DESIGNS', 'SUPPORT']) assert.equal(result.env[name + '_STORAGE'], 'mysql');
  assert.deepEqual(demoStorage(root), result);
  fs.writeFileSync(file, JSON.stringify({ ...config, database: '../bad' })); assert.throws(() => demoStorage(root));
});

test('public demo origin controls sharing while preserving the existing loopback port', () => {
  assert.deepEqual(demoEndpoints(4110), { localBase:'http://127.0.0.1:4110', publicBase:'http://127.0.0.1:4110', allowedOrigins:[] });
  const result=demoEndpoints(4110,'https://demo.example.test/','https://secondary.example.test');
  assert.equal(result.publicBase,'https://demo.example.test');
  assert.deepEqual(result.allowedOrigins,['https://secondary.example.test','http://127.0.0.1:4110']);
  for(const bad of ['https://*.example.test','https://user:pass@example.test','https://demo.example.test/path','https://one.test,https://two.test'])
    assert.throws(()=>demoEndpoints(4110,bad));
});
test('4110 reuses its legacy profile and keys without altering accounts, gifts or environment', t => {
  const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'momevia-demo-config-'));
  t.after(()=> { assert(path.dirname(root)===fs.realpathSync(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true}); });
  const legacy=path.join(root,'local','web-demo-20261118');fs.mkdirSync(path.join(legacy,'app'),{recursive:true});
  fs.writeFileSync(path.join(legacy,'trang-thai-demo.json'),'{}');
  const env='JWT_SECRET="keep-jwt"\nINTERNAL_SERVICE_KEY=keep-internal\nPRIVATE_FIELD=do-not-copy\n';
  fs.writeFileSync(path.join(legacy,'app','.env'),env);
  assert.equal(demoProfile(root,4110),legacy);
  assert.deepEqual(existingDemoKeys(legacy),{jwtSecret:'keep-jwt',internalKey:'keep-internal'});
  assert.equal(fs.readFileSync(path.join(legacy,'app','.env'),'utf8'),env);
  assert.equal(demoProfile(root,4112),path.join(root,'local','web-demo-4112'));
  fs.mkdirSync(path.join(root,'local','web-demo-4110'));
  assert.equal(demoProfile(root,4110),path.join(root,'local','web-demo-4110'));
  assert.equal(demoProfile(root,4110,'local/explicit'),path.join(root,'local','explicit'));
});
