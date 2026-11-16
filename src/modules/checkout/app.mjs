import { environment } from '../../shared/config.mjs';
import { Router } from '../../shared/http.mjs';
import { createRepositories } from './repositories.mjs';
import { registerRoutes } from './routes.mjs';
import { CheckoutService } from './checkout.service.mjs';
import { createCatalogClient } from '../catalog/client.mjs';

export function createApp(config = environment(), { catalog = createCatalogClient(config.internalKey), resolveUser } = {}) {
  const { orders: repository } = createRepositories();
  const service = new CheckoutService({ repository, config, catalog });
  const router = new Router();
  registerRoutes(router, { config, service, resolveUser });
  return { router, service };
}
