import { environment } from '../../shared/config.mjs';
import { Router } from '../../shared/http.mjs';
import { createRepositories } from './repositories.mjs';
import { registerRoutes } from './routes.mjs';
import { CheckoutService } from './checkout.service.mjs';
import { createCatalogClient } from '../catalog/client.mjs';
import { MySqlPaymentRepository } from '../payments/mysql.repository.mjs';
import { PaymentService } from '../payments/payment.service.mjs';
import { registerPaymentRoutes } from '../payments/routes.mjs';
import { requireCreditSchema } from './publication-credit.mjs';

export async function createApp(config = environment(), { catalog = createCatalogClient(config.internalKey), resolveUser, paymentProviders, paymentEnv, mysqlClient } = {}) {
  const { orders: repository, client, mode } = createRepositories(mysqlClient);
  if (mode === 'mysql') await client.execute('SELECT order_id FROM demo_purchases LIMIT 0');
  if (repository.quotaEnabled) await requireCreditSchema(client);
  const service = new CheckoutService({ repository, config, catalog });
  const router = new Router();
  registerRoutes(router, { config, service, resolveUser });
  const paymentRepository = new MySqlPaymentRepository(mysqlClient ?? client, {
    quotaEnabled: repository.quotaEnabled === true,
    scopedCheckout: (paymentEnv ?? process.env).PAYMENT_SCOPED_CHECKOUT_ENABLED === 'true',
  });
  const paymentService = new PaymentService({ repository: paymentRepository, catalog, checkout: service, providers: paymentProviders, ...(paymentEnv ? { env: paymentEnv } : {}) });
  registerPaymentRoutes(router, { config, service: paymentService, resolveUser });
  return { router, service, paymentService, close: async () => { paymentService.close(); if (!mysqlClient) await paymentRepository.close(); } };
}
