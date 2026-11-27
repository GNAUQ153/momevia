import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mysqlDate, mysqlTimestampToIso } from '../../src/infrastructure/mysql/datetime.mjs';
import { mysqlDate as legacyMysqlDate } from '../../src/modules/identity/mysql.repositories.mjs';
import { iso as designIso } from '../../src/modules/designs/mysql-row-mapping.mjs';
import { iso as legacyDesignIso } from '../../src/modules/designs/mysql.repository.mjs';
import { MySqlUsersRepository } from '../../src/modules/identity/mysql.repositories.mjs';
import { MySqlTemplatesRepository } from '../../src/modules/catalog/mysql.repositories.mjs';
import { MySqlCheckoutRepository } from '../../src/modules/checkout/mysql.repository.mjs';
import { MySqlGiftsRepository } from '../../src/modules/gifts/mysql.repositories.mjs';
import { MySqlSupportRepository } from '../../src/modules/support/mysql.repository.mjs';

const utc = '2026-11-26T03:04:05.678Z';
const sql = '2026-11-26 03:04:05.678';

test('Đọc Date, DATETIME và ISO UTC cùng giữ mili giây', () => {
  for (const value of [new Date(utc), sql, utc, utc.slice(0, -1)]) {
    assert.equal(mysqlTimestampToIso(value), utc);
  }
  assert.equal(mysqlTimestampToIso('2026-11-26 03:04:05'), '2026-11-26T03:04:05.000Z');
});

test('Ghi UTC giữ chính xác mili giây và chuyển offset', () => {
  for (const value of [new Date(utc), utc, '2026-11-26T10:04:05.678+07:00', Date.parse(utc)]) {
    assert.equal(mysqlDate(value), sql);
  }
});

test('Giữ hành vi lỗi và null riêng của mapping Canvas', () => {
  for (const value of [null, undefined, 'invalid', new Date(NaN)]) {
    assert.throws(() => mysqlTimestampToIso(value), RangeError);
  }
  assert.throws(() => mysqlDate('invalid'), { message: 'Invalid MySQL datetime' });
  assert.equal(mysqlDate(null), '1970-01-01 00:00:00.000');
  assert.equal(designIso(null), null);
  assert.equal(designIso(undefined), null);
  assert.equal(designIso(sql), utc);
  assert.throws(() => designIso('invalid'), RangeError);
});

test('Giữ export tương thích Identity và Designs', () => {
  assert.equal(legacyMysqlDate, mysqlDate);
  assert.equal(legacyDesignIso, designIso);
});

test('Mapping UTC không phụ thuộc timezone tiến trình', () => {
  const url = new URL('../../src/infrastructure/mysql/datetime.mjs', import.meta.url).href;
  const code = `import {mysqlDate,mysqlTimestampToIso} from ${JSON.stringify(url)}; console.log(mysqlTimestampToIso(${JSON.stringify(sql)})); console.log(mysqlDate(${JSON.stringify(utc)}));`;
  for (const TZ of ['UTC', 'Asia/Ho_Chi_Minh', 'America/New_York']) {
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, TZ }, encoding: 'utf8' });
    assert.deepEqual(out.trim().split(/\r?\n/), [utc, sql]);
  }
});

test('Năm Repository trả cùng timestamp với dữ liệu SQL dạng chuỗi và Date', async () => {
  // Client giả lập: kiểm tra contract mapping, không kết nối MySQL.
  for (const value of [sql, new Date(utc)]) {
    const client = { execute: async () => [[{ created_at: value, expires_at: value, createdAt: value }]] };
    assert.equal((await new MySqlUsersRepository(client).all())[0].createdAt, utc);
    assert.equal((await new MySqlTemplatesRepository(client).all())[0].createdAt, utc);
    assert.equal((await new MySqlCheckoutRepository(client).allForUser('qa'))[0].createdAt, utc);
    const gift = (await new MySqlGiftsRepository(client).allForUser('qa'))[0];
    assert.equal(gift.createdAt, utc);
    assert.equal(gift.expiresAt, utc);
    assert.equal((await new MySqlSupportRepository(client).all())[0].createdAt, utc);
  }
});
