import { JsonRepository } from '../../shared/storage.mjs';
import { dataPath } from '../../shared/paths.mjs';
import { MediaRepository } from './media.repository.mjs';
import { MySqlClient } from '../../infrastructure/mysql/client.mjs';
import { MySqlGiftsRepository, MySqlRepliesRepository } from './mysql.repositories.mjs';
import { quotaQaEnabled } from '../checkout/quota-config.mjs';

export function createRepositories() {
  const quotaEnabled = quotaQaEnabled();
  const mode = process.env.GIFTS_STORAGE || 'json';
  if (!['json', 'mysql'].includes(mode)) throw new Error('GIFTS_STORAGE phải là json hoặc mysql.');
  const media = new MediaRepository(dataPath('gifts', 'images'));
  if (mode === 'mysql') {
    const client = new MySqlClient();
    return { gifts: new MySqlGiftsRepository(client, { quotaEnabled }), replies: new MySqlRepliesRepository(client),
      media, client, mode };
  }
  return { gifts: new JsonRepository(dataPath('gifts', 'gifts.json')),
    replies: new JsonRepository(dataPath('gifts', 'replies.json')), media, mode };
}
