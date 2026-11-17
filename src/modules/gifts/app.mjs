import { environment } from '../../shared/config.mjs';
import { Router } from '../../shared/http.mjs';
import { createRepositories } from './repositories.mjs';
import { registerRoutes } from './routes.mjs';
import { GiftService } from './gifts.service.mjs';
import { RateLimiter } from '../../shared/rate-limit.mjs';
import { createCatalogClient } from '../catalog/client.mjs';
import { createCheckoutClient } from '../checkout/client.mjs';

export async function createApp(config = environment(), { catalog = createCatalogClient(config.internalKey), checkout = createCheckoutClient(config.internalKey), resolveUser } = {}) {
  const { gifts: giftsRepo, replies: repliesRepo, media, client, mode } = createRepositories();
  if (mode === 'mysql') await giftsRepo.allForUser('00000000-0000-0000-0000-000000000000');
  const repliesLimit = new RateLimiter({ limit: 3, windowMs: 60_000 });
  const globalReplies = new RateLimiter({ limit: 300, windowMs: 60_000, maxKeys: 1 });
  const creationLimit = new RateLimiter({ limit: 10, windowMs: 600_000 });
  const service = new GiftService({ giftsRepo, repliesRepo, media, config, repliesLimit,
    catalog, checkout });
  const router = new Router();
  registerRoutes(router, { config, creationLimit, globalReplies, service, resolveUser });
  return { router, service, close: async () => {
    [repliesLimit, globalReplies, creationLimit].forEach(limiter => limiter.close());
    await client?.close();
  } };
}
