import { environment } from '../../shared/config.mjs';
import { Router } from '../../shared/http.mjs';
import { createRepositories } from './repositories.mjs';
import { registerRoutes } from './routes.mjs';
import { CatalogService } from './catalog.service.mjs';
import { FavoritesService } from './favorites.service.mjs';
import { addedSystemTemplates } from './seed.mjs';
import { signatureQaEnabled, signatureQaTemplates } from './signature-qa.mjs';

export async function createApp(config = environment(), { resolveUser, mysqlClient } = {}) {
  const signatureQa = signatureQaEnabled();
  const { templates: repo, favorites: favoritesRepo, favoritesService, client, mode } = createRepositories(mysqlClient);
  for (const template of [...addedSystemTemplates, ...(signatureQa ? signatureQaTemplates() : [])]) {
    if (await repo.get(template.id)) continue;
    try { await repo.insertUnique(template); }
    catch (error) {
      if (error.code !== 'ER_DUP_ENTRY' || !await repo.get(template.id)) throw error;
    }
  }
  const favorites = mode === 'mysql' ? favoritesService : new FavoritesService(favoritesRepo);
  const service = new CatalogService(repo, favorites, { signatureQa });
  const router = new Router();
  registerRoutes(router, { config, service, resolveUser });
  return { router, service, close: async () => { if (!mysqlClient) await client?.close(); } };
}
