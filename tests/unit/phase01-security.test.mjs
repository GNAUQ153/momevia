import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { productionIssues, checkProductionStartup } from '../../src/shared/production.mjs';
import { createGiftAccess, requireGiftPermission } from '../../src/modules/gifts/access.mjs';
import { requireRequestOrigin } from '../../src/shared/request-origin.mjs';
import { parseJson } from '../../src/shared/http.mjs';
import { resolveMysqlConfig } from '../../src/infrastructure/mysql/client.mjs';

const env = { NODE_ENV:'production', PUBLIC_BASE_URL:'https://momevia.io.vn', JWT_SECRET:'a'.repeat(64), INTERNAL_SERVICE_KEY:'b'.repeat(64),
  IDENTITY_STORAGE:'mysql', CATALOG_STORAGE:'mysql', CHECKOUT_STORAGE:'mysql', GIFTS_STORAGE:'mysql', DESIGNS_STORAGE:'mysql', SUPPORT_STORAGE:'mysql',
  MYSQL_HOST:'mysql.internal', MYSQL_DATABASE:'momevia', MYSQL_USER:'app', MYSQL_PASSWORD:'test-only', MOMEVIA_DATA_DIR:process.cwd() };
test('Kiểm tra production hợp lệ và không làm lộ mật khẩu', () => {
  assert.deepEqual(productionIssues(env), []);
  const issues = productionIssues({...env, DESIGNS_STORAGE:'json', MOMEVIA_DATA_DIR:'relative', DEMO_AUTH_ENABLED:'true', PUBLIC_BASE_URL:'http://localhost:4100'});
  assert.equal(issues.length,4);
  assert(!issues.join().includes(env.MYSQL_PASSWORD));
});
test('Strict từ chối trước khởi động, chế độ chuyển tiếp chỉ cảnh báo', () => {
  assert.throws(() => checkProductionStartup({...env, GIFTS_STORAGE:'json', PRODUCTION_STRICT:'true'}), /GIFTS_STORAGE/);
  let warning = '';
  checkProductionStartup({...env, GIFTS_STORAGE:'json'}, value => { warning = value; });
  assert.match(warning,/GIFTS_STORAGE/);
  assert.doesNotThrow(() => checkProductionStartup({NODE_ENV:'development'}));
});
test('Thiệp mới không công khai phản hồi mặc định; thiệp cũ và quyền chủ động không đổi', () => {
  const gift = { expiresAt: new Date(Date.now()+60000).toISOString(), ...createGiftAccess() };
  assert.equal(requireGiftPermission(gift, null).canSend,true);
  assert.throws(() => requireGiftPermission(gift,null,'canRead'),{status:403});
  assert.equal(requireGiftPermission({expiresAt:gift.expiresAt},null).canRead,true);
  assert.equal(requireGiftPermission({...gift,...createGiftAccess({open:'link',send:'link',read:'link'})},null).canRead,true);
});
test('Chặn POST cross-site thiếu Origin nhưng giữ callback server-to-server', () => {
  const config = {baseUrl:env.PUBLIC_BASE_URL,allowedOrigins:[]};
  assert.throws(() => requireRequestOrigin({headers:{'sec-fetch-site':'cross-site'}},config),{status:403});
  assert.doesNotThrow(() => requireRequestOrigin({headers:{}},config));
});
test('Chỉ nhận media type JSON chính xác', async () => {
  const request = type => Object.assign(Readable.from([Buffer.from('{}')]),{headers:{'content-type':type}});
  await assert.rejects(parseJson(request('application/jsonp')),{status:415});
  assert.deepEqual(await parseJson(request('Application/JSON; charset=utf-8')),{});
});
test('Giới hạn pool cấu hình được và từ chối giá trị sai', () => {
  assert.equal(resolveMysqlConfig(env).connectionLimit,5);
  assert.equal(resolveMysqlConfig({...env,MYSQL_CONNECTION_LIMIT:'2'}).connectionLimit,2);
  for (const value of ['0','21','abc','1.5']) assert.throws(() => resolveMysqlConfig({...env,MYSQL_CONNECTION_LIMIT:value}), /MYSQL_CONNECTION_LIMIT/);
});
