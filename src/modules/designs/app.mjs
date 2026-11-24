import { Router } from '../../shared/http.mjs';
import { dataPath } from '../../shared/paths.mjs';
import { MySqlClient } from '../../infrastructure/mysql/client.mjs';
import { RateLimiter } from '../../shared/rate-limit.mjs';
import { JsonDesignRepository } from './json.repository.mjs';
import { MySqlDesignsRepository } from './mysql.repository.mjs';
import { MySqlPublicationUnitOfWork } from './mysql-publication.mjs';
import { DesignsService } from './designs.service.mjs';
import { AssetsService } from './assets.service.mjs';
import { registerDesignRoutes } from './routes.mjs';
import { CanvasLibraryService } from './library.service.mjs';
import { MusicLibraryService } from './music-library.service.mjs';
import { quotaQaEnabled } from '../checkout/quota-config.mjs';
import { requireCreditSchema } from '../checkout/publication-credit.mjs';

export function canvasProfile(env = process.env) {
  const mode = env.DESIGNS_STORAGE || 'json';
  if (!['json', 'mysql'].includes(mode)) throw new Error('DESIGNS_STORAGE phải là json hoặc mysql.');
  const coherent = ['IDENTITY_STORAGE', 'CATALOG_STORAGE', 'GIFTS_STORAGE'].every(key => (env[key] || 'json') === mode);
  return { mode, checkoutMode: env.CHECKOUT_STORAGE || 'json', supported: coherent, processScope: mode === 'json' ? 'single-process' : 'mysql-transaction' };
}
export async function createApp(config, dependencies) {
  const quotaEnabled = quotaQaEnabled();
  const profile = canvasProfile(); const flags = { read: process.env.CANVAS_READ_ENABLED !== 'false', edit: process.env.CANVAS_EDIT_ENABLED !== 'false', publish: process.env.CANVAS_PUBLISH_ENABLED !== 'false', sfxCreate:process.env.SFX_CREATE_ENABLED!=='false' };
  const client = profile.mode === 'mysql' ? new MySqlClient() : null;
  const repository = client ? new MySqlDesignsRepository(client) : new JsonDesignRepository(dataPath('designs', 'canvas.json'));
  if (client) await repository.ready();
  const library = new CanvasLibraryService(client);
  await library.ready();
  if (quotaEnabled) await requireCreditSchema(client);
  const publication = client ? new MySqlPublicationUnitOfWork(client, { quotaEnabled }) : repository;
  const service = new DesignsService({ repository, publication, config, flags, mediaRoot: dataPath('designs', 'assets'), profile, ...dependencies });
  service.library = library;
  service.musicLibrary = new MusicLibraryService(client);
  await service.musicLibrary.ready();
  const assets = new AssetsService(service); const router = new Router(); const writeLimit = new RateLimiter({ limit: 240, windowMs: 60_000 });
  registerDesignRoutes(router, { service, assets, config, resolveUser: dependencies.resolveUser, writeLimit });
  return { router, service, assets, repository, publication, library, profile, flags, writeLimit, close: async () => { writeLimit.close(); await client?.close(); } };
}
