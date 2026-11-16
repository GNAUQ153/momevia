import { environment } from '../../shared/config.mjs';
import { Router } from '../../shared/http.mjs';
import { createRepositories } from './repositories.mjs';
import { registerRoutes } from './routes.mjs';
import { GiftService } from './gifts.service.mjs';
import { RateLimiter } from '../../shared/rate-limit.mjs';
import { createCatalogClient } from '../catalog/client.mjs';
import { createCheckoutClient } from '../checkout/client.mjs';

export function createApp(config = environment()) {
  const { gifts: giftsRepo, replies: repliesRepo, media } = createRepositories();
  const repliesLimit = new RateLimiter({ limit: 3, windowMs: 60_000 });
  const globalReplies = new RateLimiter({ limit: 300, windowMs: 60_000, maxKeys: 1 });
  const creationLimit = new RateLimiter({ limit: 10, windowMs: 600_000 });
  const service = new GiftService({ giftsRepo, repliesRepo, media, config, repliesLimit,
    catalog: createCatalogClient(config.internalKey), checkout: createCheckoutClient(config.internalKey) });
  const router = new Router();
  registerRoutes(router, { config, creationLimit, globalReplies, service });
  return { router, close: () => [repliesLimit, globalReplies, creationLimit].forEach(limiter => limiter.close()) };
}
