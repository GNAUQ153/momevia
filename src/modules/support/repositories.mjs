import { MySqlSupportRepository } from './mysql.repository.mjs';
import { JsonRepository } from '../../shared/storage.mjs';
import { dataPath } from '../../shared/paths.mjs';

export function createRepositories(mysqlClient) {
  const mode = process.env.SUPPORT_STORAGE || 'json';
  if (mode === 'mysql') return { requests: new MySqlSupportRepository(mysqlClient) };
  if (mode !== 'json') throw new Error(`SUPPORT_STORAGE không hợp lệ: ${mode}`);
  return { requests: new JsonRepository(dataPath('support', 'requests.json')) };
}
