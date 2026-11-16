import { JsonRepository } from '../../shared/storage.mjs';
import { dataPath } from '../../shared/paths.mjs';

export function createRepositories() {
  return {
    users: new JsonRepository(dataPath('identity', 'users.json')),
    sessions: new JsonRepository(dataPath('identity', 'sessions.json')),
  };
}
