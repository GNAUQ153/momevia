import { environment } from '../../shared/config.mjs';
import { Router } from '../../shared/http.mjs';
import { createRepositories } from './repositories.mjs';
import { registerRoutes } from './routes.mjs';
import { CheckoutService } from './checkout.service.mjs';
import { createCatalogClient } from '../catalog/client.mjs';

export async function createApp(config = environment(), { catalog = createCatalogClient(config.internalKey), resolveUser } = {}) {
  const { orders: repository, client, mode } = createRepositories();
  if (mode === 'mysql') await client.execute('SELECT order_id FROM demo_purchases LIMIT 0');
  const service = new CheckoutService({ repository, config, catalog });
  const router = new Router();
  registerRoutes(router, { config, service, resolveUser });
  return { router, service, close: async () => { await client?.close(); } };
}
