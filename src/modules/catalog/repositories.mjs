import { JsonRepository } from '../../shared/storage.mjs';
import { dataPath } from '../../shared/paths.mjs';
import { templates as seed } from './seed.mjs';
import { MySqlClient } from '../../infrastructure/mysql/client.mjs';
import { MySqlTemplatesRepository, MySqlFavoritesService } from './mysql.repositories.mjs';

export function createRepositories() {
  const mode = process.env.CATALOG_STORAGE || 'json';
  if (mode === 'mysql') {
    const client = new MySqlClient();
    return { templates: new MySqlTemplatesRepository(client), favoritesService: new MySqlFavoritesService(client), client, mode };
  }
  if (mode !== 'json') throw new Error(`CATALOG_STORAGE không hợp lệ: ${mode}`);
  return { templates: new JsonRepository(dataPath('catalog', 'templates.json'), seed),
    favorites: new JsonRepository(dataPath('catalog', 'favorites.json')), mode };
}
