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
import { MySqlSessionStore, MySqlRoleService } from './mysql.repositories.mjs';

export async function createApp(config = environment()) {
  const { users: repo, sessions: sessionsRepo, client, mode } = createRepositories();
  if (mode === 'mysql') await repo.all(); // Fail fast if MySQL/migrations are unavailable.
  const sessions = mode === 'mysql' ? new MySqlSessionStore(client, repo, config.jwtSecret)
    : new SessionStore(sessionsRepo, repo, config.jwtSecret);
  const credentials = new CredentialsService(repo);
  await provisionTestAccount(credentials, config.testAccount);
  const roles = mode === 'mysql' ? new MySqlRoleService(repo) : new RoleService(repo);
  const authLimits = new AuthLimits();
  const service = new IdentityService({ users: repo, sessions, config });
  const router = new Router();
  registerRoutes(router, { config, credentials, sessions, authLimits, roles, service });
  return { router, sessions, service, close: async () => { authLimits.close(); await client?.close(); } };
}
