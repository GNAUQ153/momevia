import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { betaMetrics, eventFields } from './beta-metrics.mjs';

const root = fileURLToPath(new URL('../../local/beta-pilot/', import.meta.url));
const retentionMs = 30 * 24 * 60 * 60 * 1000;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const choices = {
  role: ['sender', 'recipient', 'creator', 'admin'],
  device: ['ios', 'android', 'desktop'],
  browser: ['safari', 'chrome', 'edge', 'in-app', 'other'],
  network: ['wifi', 'mobile', 'slow', 'offline'],
  entry: ['app', 'link', 'qr', 'return'],
  lastStep: ['start', 'draft', 'photo', 'preview', 'checkout', 'published', 'opened', 'reply', 'submitted', 'reviewed'],
  result: ['complete', 'blocked'],
  cause: ['none', 'network', 'upload', 'permissions', 'checkout', 'browser', 'confusing-ui', 'other'],
};

function pilotFile(id) {
  if (!uuid.test(id || '')) throw new Error('Cần mã pilot dạng UUID do công cụ tạo.');
  return path.join(root, `${id}.json`);
}

function readPilot(id) {
  const file = pilotFile(id);
  const ledger = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (ledger.id !== id) throw new Error('Mã pilot trong tệp không khớp.');
  if (Date.now() >= Date.parse(ledger.expiresAt)) {
    fs.unlinkSync(file);
    throw new Error('Kỳ pilot đã hết 30 ngày, bản ghi thô đã được gỡ.');
  }
  return ledger;
}

function writePilot(ledger) {
  const file = pilotFile(ledger.id);
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, JSON.stringify(ledger, null, 2) + '\n', { flag: 'wx' });
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}

function createPilot() {
  fs.mkdirSync(root, { recursive: true });
  const now = Date.now();
  const ledger = { id: randomUUID(), createdAt: new Date(now).toISOString(), expiresAt: new Date(now + retentionMs).toISOString(), records: [], checks: [] };
  writePilot(ledger);
  return { id: ledger.id, expiresAt: ledger.expiresAt };
}

async function promptRecord() {
  const input = createInterface({ input: process.stdin, output: process.stderr, terminal: Boolean(process.stdin.isTTY) });
  const lines = input[Symbol.asyncIterator]();
  const ask = async label => {
    process.stderr.write(`${label}: `);
    const item = await lines.next();
    if (item.done) throw new Error('Đã dừng nhập trước khi có đủ trường.');
    return item.value.trim();
  };
  const pick = async (label, options) => {
    const value = await ask(`${label} (${options.join(' / ')})`);
    if (!options.includes(value)) throw new Error(`Lựa chọn không hợp lệ cho ${label}.`);
    return value;
  };
  async function alias(label) {
    const value = await ask(`${label}, mã UUID do công cụ tạo; để trống để cấp mã`);
    if (value && !uuid.test(value)) throw new Error('Chỉ nhập mã ngẫu nhiên, không nhập tên, email, ID ứng dụng hoặc link quà.');
    const result = value || randomUUID();
    process.stderr.write(`${label} = ${result}\n`);
    return result;
  }
  try {
    const type = await pick('Loại ghi nhận', ['check', ...Object.keys(eventFields)]);
    const record = { id: randomUUID(), type, at: new Date().toISOString() };
    if (type === 'check') {
      record.session = await alias('Mã lượt thử');
      for (const [key, options] of Object.entries(choices)) record[key] = await pick(key, options);
      if (record.result === 'complete' && record.cause !== 'none' || record.result === 'blocked' && record.cause === 'none')
        throw new Error('Chọn nguyên nhân tương ứng với kết quả.');
      record.version = await ask('Phiên bản OS hoặc trình duyệt, dạng 17.4; có thể bỏ trống');
      if (record.version && !/^\d{1,4}(?:\.\d{1,5}){0,3}$/.test(record.version)) throw new Error('Phiên bản phải là số.');
      return record;
    }
    for (const key of eventFields[type]) {
      if (key === 'selectedAt') record[key] = await ask('Thời điểm chọn mẫu UTC, dạng 2026-11-18T08:00:00Z');
      else if (key === 'channel') record[key] = await pick('Loại lượt mở', ['interaction', 'preview', 'unclassified']);
      else record[key] = await alias(key);
    }
    record.at = (await ask('Thời điểm thao tác UTC, dạng 2026-11-18T08:00:00Z; để trống để lấy giờ hiện tại')) || new Date().toISOString();
    return record;
  } finally { input.close(); }
}

function purge() {
  if (!fs.existsSync(root)) return { removed: 0 };
  let removed = 0;
  for (const file of fs.readdirSync(root, { withFileTypes: true })) {
    const id = path.basename(file.name, '.json');
    if (!file.isFile() || !file.name.endsWith('.json') || !uuid.test(id)) continue;
    const ledger = JSON.parse(fs.readFileSync(pilotFile(id), 'utf8'));
    if (ledger.id === id && Date.now() >= Date.parse(ledger.expiresAt)) {
      fs.unlinkSync(pilotFile(id));
      removed++;
    }
  }
  return { removed };
}

try {
  const [command, id] = process.argv.slice(2);
  let result;
  if (command === 'new') result = createPilot();
  else if (command === 'purge') result = purge();
  else if (command === 'report') {
    const ledger = readPilot(id);
    const to = new Date(Math.max(Date.now() + 1, Date.parse(ledger.createdAt) + 1)).toISOString();
    result = { pilot: ledger.id, expiresAt: ledger.expiresAt, metrics: betaMetrics(ledger.records, { from: ledger.createdAt, to }),
      checks: ledger.checks.map(({ role, device, browser, version, network, entry, lastStep, result, cause }) =>
        ({ role, device, browser, version, network, entry, lastStep, result, cause })) };
  } else if (command === 'record') {
    readPilot(id);
    const record = await promptRecord();
    const ledger = readPilot(id);
    if (record.type === 'check') ledger.checks.push(record);
    else {
      if (Date.parse(record.at) < Date.parse(ledger.createdAt) || Date.parse(record.at) > Date.now())
        throw new Error('Thời điểm phải nằm trong kỳ pilot đã bắt đầu.');
      betaMetrics([record], { from: ledger.createdAt, to: new Date(Date.parse(record.at) + 1).toISOString() });
      ledger.records.push(record);
    }
    writePilot(ledger);
    result = { saved: true, id: record.id, type: record.type, expiresAt: ledger.expiresAt };
  } else throw new Error('Dùng new, record <mã pilot>, report <mã pilot> hoặc purge.');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
