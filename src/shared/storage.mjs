import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { replaceFileWithRetry } from './atomic-file.mjs';

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

    try {
      // Giữ tệp tạm cạnh tệp chính để thao tác đổi tên nằm cùng ổ đĩa.
      fs.writeFileSync(temp, JSON.stringify(data, null, 2), {
        encoding: 'utf8',
        mode: 0o600,
      });
      replaceFileWithRetry(temp, this.filepath);
    } catch (error) {
      // Nếu thay thế thất bại, giữ nguyên tệp JSON cũ và dọn tệp tạm.
      try {
        fs.rmSync(temp, { force: true });
      } catch {
        // Không che khuất lỗi ghi/đổi tên gốc bằng lỗi dọn dẹp.
      }
      throw error;
    }
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
