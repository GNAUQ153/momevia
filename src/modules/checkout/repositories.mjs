import { JsonRepository } from '../../shared/storage.mjs';
import { dataPath } from '../../shared/paths.mjs';
import { MySqlClient } from '../../infrastructure/mysql/client.mjs';
import { MySqlCheckoutRepository } from './mysql.repository.mjs';
import { quotaQaEnabled } from '../../shared/feature-config.mjs';

export function createRepositories() {
  const quotaEnabled = quotaQaEnabled();
  const mode = process.env.CHECKOUT_STORAGE || 'json';
  if (!['json', 'mysql'].includes(mode)) throw new Error('CHECKOUT_STORAGE phải là json hoặc mysql.');
  if (mode === 'mysql') {
    const client = new MySqlClient();
    return { orders: new MySqlCheckoutRepository(client, { quotaEnabled }), client, mode };
  }
  return { orders: new JsonRepository(dataPath('checkout', 'orders.json')), mode };
}
