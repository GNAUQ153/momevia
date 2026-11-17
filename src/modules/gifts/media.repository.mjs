import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { HttpError } from '../../shared/http.mjs';

export class MediaRepository {
  constructor(directory) {
    this.directory = directory;
    fs.mkdirSync(directory, { recursive: true });
  }
  store({ bytes, ext }) {
    const filename = `${randomUUID()}.${ext}`;
    fs.writeFileSync(path.join(this.directory, filename), bytes);
    return filename;
  }
  remove(filename) {
    if (!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(filename)) return;
    fs.rmSync(path.join(this.directory, filename), { force: true });
  }
  find(filename) {
    if (!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(filename)) throw new HttpError(404, 'Ảnh không tồn tại.');
    const filePath = path.join(this.directory, filename);
    if (!fs.existsSync(filePath)) throw new HttpError(404, 'Ảnh không tồn tại.');
    const ext = path.extname(filePath);
    return { filePath, contentType: ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg' };
  }
}
