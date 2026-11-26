import { JsonRepository } from '../../shared/storage.mjs';
import { dataPath } from '../../shared/paths.mjs';
import { MySqlClient } from '../../infrastructure/mysql/client.mjs';
import { MySqlUsersRepository } from './mysql.repositories.mjs';

export function createRepositories(mysqlClient) {
  const mode = process.env.IDENTITY_STORAGE || 'json';
  if (mode === 'mysql') {
    const client = mysqlClient ?? new MySqlClient();
    return { users: new MySqlUsersRepository(client), client, mode };
  }
  if (mode !== 'json') throw new Error(`IDENTITY_STORAGE không hợp lệ: ${mode}`);
  return { users: new JsonRepository(dataPath('identity', 'users.json')),
    sessions: new JsonRepository(dataPath('identity', 'sessions.json')), mode };
}
