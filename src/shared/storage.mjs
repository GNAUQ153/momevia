import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// Mỗi microservice sở hữu tệp lưu trữ riêng; chỉ phục vụ phát triển và demo MVP.
// Khi triển khai thực tế cần thay bằng database riêng có giao dịch ACID.
export class JsonRepository {
  constructor(filepath, defaults = []) {
    this.filepath = filepath;
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    if (!fs.existsSync(filepath)) this.write(defaults);
  }
  read() {
    return JSON.parse(fs.readFileSync(this.filepath, 'utf8'));
  }
  write(data) {
    const temp = `${this.filepath}.${randomUUID()}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(temp, this.filepath);
  }
  all() { return this.read(); }
  get(id) { return this.read().find(item => item.id === id); }
  insert(item) { const rows = this.read(); rows.push(item); this.write(rows); return item; }
  insertUnique(item) {
    const previous = this.get(item.id);
    return previous || this.insert(item);
  }
  update(id, patch) {
    return this.mutate(id, () => patch);
  }
  mutate(id, update) {
    const rows = this.read();
    const index = rows.findIndex(row => row.id === id);
    if (index < 0) return null;
    const patch = update(rows[index]);
    if (!patch) return rows[index];
    rows[index] = { ...rows[index], ...patch };
    this.write(rows);
    return rows[index];
  }
}
