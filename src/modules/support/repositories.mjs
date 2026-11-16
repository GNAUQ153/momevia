import { JsonRepository } from '../../shared/storage.mjs';
import { dataPath } from '../../shared/paths.mjs';

export function createRepositories() {
  return {
    requests: new JsonRepository(dataPath('support', 'requests.json')),
  };
}
