import { environment } from '../../shared/config.mjs';
import { Router } from '../../shared/http.mjs';
import { createRepositories } from './repositories.mjs';
import { registerRoutes } from './routes.mjs';
import { CatalogService } from './catalog.service.mjs';
import { FavoritesService } from './favorites.service.mjs';

export async function createApp(config = environment(), { resolveUser } = {}) {
  const { templates: repo, favorites: favoritesRepo, favoritesService, client, mode } = createRepositories();
  if (mode === 'mysql') await repo.all(); // Fail fast if MySQL is unavailable.
  const favorites = mode === 'mysql' ? favoritesService : new FavoritesService(favoritesRepo);
  const service = new CatalogService(repo, favorites);
  const router = new Router();
  registerRoutes(router, { config, service, resolveUser });
  return { router, service, close: async () => { await client?.close(); } };
}
