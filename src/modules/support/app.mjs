import { environment } from '../../shared/config.mjs';
import { Router } from '../../shared/http.mjs';
import { createRepositories } from './repositories.mjs';
import { registerRoutes } from './routes.mjs';
import { SupportService } from './support.service.mjs';
import { RateLimiter } from '../../shared/rate-limit.mjs';

export function createApp(config = environment(), { resolveUser, resolveReport } = {}) {
  const { requests: repo } = createRepositories();
  const attempts = new RateLimiter({ limit: 5, windowMs: 600_000 });
  const globalAttempts = new RateLimiter({ limit: 60, windowMs: 60_000, maxKeys: 1 });
  const service = new SupportService({ repository: repo, attempts, resolveReport });
  const router = new Router();
  registerRoutes(router, { config, globalAttempts, service, resolveUser });
  return { router, service, close: async () => {
    [attempts, globalAttempts].forEach(limiter => limiter.close());
    await repo.close?.();
  } };
}
