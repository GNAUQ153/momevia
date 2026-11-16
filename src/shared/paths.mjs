import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Giữ vị trí dữ liệu cũ; tách mã nguồn không di chuyển hoặc ghi lại dữ liệu local.
export function dataPath(service, filename) {
  return path.join(projectRoot, 'services', service, 'data', filename);
}
