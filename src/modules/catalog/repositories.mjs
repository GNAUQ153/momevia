import { JsonRepository } from '../../shared/storage.mjs';
import { dataPath } from '../../shared/paths.mjs';
import { templates as seed } from './seed.mjs';

export function createRepositories() {
  return {
    templates: new JsonRepository(dataPath('catalog', 'templates.json'), seed),
    favorites: new JsonRepository(dataPath('catalog', 'favorites.json')),
  };
}
