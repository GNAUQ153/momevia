import { JsonRepository } from '../../shared/storage.mjs';
import { dataPath } from '../../shared/paths.mjs';
import { MediaRepository } from './media.repository.mjs';

export function createRepositories() {
  return {
    gifts: new JsonRepository(dataPath('gifts', 'gifts.json')),
    replies: new JsonRepository(dataPath('gifts', 'replies.json')),
    media: new MediaRepository(dataPath('gifts', 'images')),
  };
}
