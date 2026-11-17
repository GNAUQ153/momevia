import { environment } from '../../shared/config.mjs';
import { Router } from '../../shared/http.mjs';
import { createRepositories } from './repositories.mjs';
import { registerRoutes } from './routes.mjs';
import { IdentityService } from './identity.service.mjs';
import { CredentialsService } from './credentials.service.mjs';
import { SessionStore } from './sessions.service.mjs';
import { RoleService } from './roles.service.mjs';
import { AuthLimits } from './auth-limits.mjs';
import { provisionTestAccount } from './test-account.service.mjs';

export async function createApp(config = environment()) {
  const { users: repo, sessions: sessionsRepo } = createRepositories();
  const sessions = new SessionStore(sessionsRepo, repo, config.jwtSecret);
  const credentials = new CredentialsService(repo);
  await provisionTestAccount(credentials, config.testAccount);
  const roles = new RoleService(repo);
  const authLimits = new AuthLimits();
  const service = new IdentityService({ users: repo, sessions, config });
  const router = new Router();
  registerRoutes(router, { config, credentials, sessions, authLimits, roles, service });
  return { router, sessions, service, close: () => authLimits.close() };
}
