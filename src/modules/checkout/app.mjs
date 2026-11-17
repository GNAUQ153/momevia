import { environment } from '../../shared/config.mjs';
import { Router } from '../../shared/http.mjs';
import { createRepositories } from './repositories.mjs';
import { registerRoutes } from './routes.mjs';
import { CheckoutService } from './checkout.service.mjs';
import { createCatalogClient } from '../catalog/client.mjs';
import { MySqlPaymentRepository } from '../payments/mysql.repository.mjs';
import { PaymentService } from '../payments/payment.service.mjs';
import { registerPaymentRoutes } from '../payments/routes.mjs';

export async function createApp(config = environment(), { catalog = createCatalogClient(config.internalKey), resolveUser } = {}) {
  const { orders: repository, client, mode } = createRepositories();
  if (mode === 'mysql') await client.execute('SELECT order_id FROM demo_purchases LIMIT 0');
  const service = new CheckoutService({ repository, config, catalog });
  const router = new Router();
  registerRoutes(router, { config, service, resolveUser });
  const paymentRepository = new MySqlPaymentRepository();
  const paymentService = new PaymentService({ repository: paymentRepository, catalog, checkout: service });
  registerPaymentRoutes(router, { config, service: paymentService, resolveUser });
  return { router, service, paymentService, close: async () => { await Promise.all([client?.close(), paymentRepository.close()]); } };
}
