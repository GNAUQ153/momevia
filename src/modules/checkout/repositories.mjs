import { JsonRepository } from '../../shared/storage.mjs';
import { dataPath } from '../../shared/paths.mjs';

export function createRepositories() {
  return {
    orders: new JsonRepository(dataPath('checkout', 'orders.json')),
  };
}
