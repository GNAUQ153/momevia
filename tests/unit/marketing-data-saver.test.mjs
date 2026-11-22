import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  marketingDataSaverEnabled, marketingConnection, marketingShouldShowStatic,
} from '../../web/js/features/marketing/motion-preferences.js';

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('Chế độ tiết kiệm dữ liệu tắt mặc định, bật khi saveData hoặc reduced-data bật', () => {
  assert.equal(marketingDataSaverEnabled(), false);
  assert.equal(marketingDataSaverEnabled({ saveData: true }), true);
  assert.equal(marketingDataSaverEnabled({ reducedData: true }), true);
  assert.equal(marketingDataSaverEnabled({ saveData: false, reducedData: false }), false);
});

test('Reduced motion luôn khiến trang chọn ảnh tĩnh, kể cả không có Network Information API', () => {
  assert.equal(marketingShouldShowStatic({ reducedMotion: true }), true);
  assert.equal(marketingShouldShowStatic({ saveData: true }), true);
  assert.equal(marketingShouldShowStatic({ reducedData: true }), true);
  assert.equal(marketingShouldShowStatic(), false);
});

test('Lấy connection có fallback mà không cần cấp quyền hoặc truy cập mạng', () => {
  assert.equal(marketingConnection(null), null);
  assert.equal(marketingConnection({}), null);
  assert.equal(marketingConnection({ mozConnection: { saveData: true } }).saveData, true);
  assert.equal(marketingConnection({ webkitConnection: { saveData: true } }).saveData, true);
  assert.equal(marketingConnection({ connection: { saveData: false } }).saveData, false);
});

test('Hero dừng autoplay mặc định khi bật Save-Data, giữ nút cho phép người dùng tự phát', () => {
  const source = read('../../web/js/features/marketing/hero-templates.js');
  assert.match(source, /let dataPaused = savingData\(\)/);
  assert.match(source, /!dataPaused && !document\.hidden && visible && !dialog\.open/);
  assert.match(source, /if \(dataPaused\) \{ dataPaused = false; userPaused = false; \}/);
  assert.match(source, /connection\?\.addEventListener\?\.\('change', onDataPreferenceChange/);
  assert.match(source, /root\.toggleAttribute\('data-mkt-ambient-running', running\)/);
  assert.match(source, /const paused = userPaused \|\| dataPaused/);
  assert.match(source, /!reduce\.matches/);
});

test('Lối thoát nội dung reveal vẫn hiện khi dữ liệu hạn chế, không thay đổi Canvas', () => {
  const source = read('../../web/js/features/marketing/scene-motion.js');
  assert.match(source, /staticPreferred\(\) \|\| typeof window\.IntersectionObserver/);
  assert.match(source, /reducedData\?\.addEventListener\?\.\('change', onPreferenceChange/);
  assert.match(source, /connection\?\.addEventListener\?\.\('change', onPreferenceChange/);
  assert.doesNotMatch(source, /localStorage|fetch\(|\.post\(/);
});
