import { environment } from '../../shared/config.mjs';
import { Router } from '../../shared/http.mjs';
import { createRepositories } from './repositories.mjs';
import { registerRoutes } from './routes.mjs';
import { CatalogService } from './catalog.service.mjs';
import { FavoritesService } from './favorites.service.mjs';

export function createApp(config = environment()) {
  const { templates: repo, favorites: favoritesRepo } = createRepositories();
  const favorites = new FavoritesService(favoritesRepo);
  const service = new CatalogService(repo, favorites);
  const router = new Router();
  registerRoutes(router, { config, service });
  return { router };
}
