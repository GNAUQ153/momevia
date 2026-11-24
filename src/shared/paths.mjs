import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Lấy đường dẫn dữ liệu theo môi trường đang chạy.
export function dataPath(service, filename) {
  const dataRoot = process.env.MOMEVIA_DATA_DIR?.trim();

  if (dataRoot) {
    return path.join(path.resolve(dataRoot), service, filename);
  }

  return path.join(projectRoot, 'services', service, 'data', filename);
}
