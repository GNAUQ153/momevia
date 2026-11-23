import fs from 'node:fs';
import { JsonRepository } from '../../shared/storage.mjs';
import { dataPath } from '../../shared/paths.mjs';
import { canvasError } from './errors.mjs';
import { SOUNDTRACKS } from '../../../web/js/shared/canvas/soundtracks.js';
import { sfxCatalog } from './audio.service.mjs';

const queues = new Map();
const check = (ok, message) => { if (!ok) throw canvasError(422, 'INVALID_AUDIO_LIBRARY', message); };
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\u0000-\u001f]/u.test(v);
export const MUSIC_MARKETS = ['international', 'vietnam', 'us-uk', 'korea'];
export const MUSIC_PROVIDERS = Object.freeze([
  { id: 'feed-clips', name: 'Feed Clips', url: 'https://clips.feed.fm/docs/', state: 'not-configured', note: 'ugc-clips' },
  { id: 'soundstripe', name: 'Soundstripe API', url: 'https://www.soundstripe.com/api', state: 'not-configured', note: 'platform-license' },
  { id: 'tuned', name: 'Tuned Global', url: 'https://www.tunedglobal.com/', state: 'not-configured', note: 'platform-license' },
  { id: 'vcpmc', name: 'VCPMC', url: 'https://vcpmc.org/', state: 'rights-contact', note: 'composition-rights' },
  { id: 'vcrrm', name: 'VCRRM', url: 'https://vcrrm.org/', state: 'rights-contact', note: 'recording-rights' },
]);

export function audioLibraryDefaults() {
  const manifest = JSON.parse(fs.readFileSync(new URL('../../../web/assets/music/v2/catalog.json', import.meta.url), 'utf8'));
  return [...SOUNDTRACKS.map(track => {
    const evidence = manifest.tracks.find(item => item.id === track.id);
    return { key: `music:${track.id}`, kind: 'music', id: track.id, version: track.version, revision: 0, status: 'active',
      title: evidence.name, theme: track.occasion, market: track.market || 'international', instrumental: evidence.instrumental,
      keywords: `${track.originalTitle} ${track.artist}`, durationMs: track.durationSeconds * 1000, src: track.src,
      artist: track.artist, license: track.license, licenseUrl: evidence.licenseUrl || 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: track.sourceUrl, sha256: evidence.sha256, evidence: evidence.evidence };
  }), ...sfxCatalog().assets.map(asset => ({ key: `sfx:${asset.version}:${asset.id}`, kind: 'sfx', id: asset.id,
    version: asset.version, revision: 0, status: 'active', title: asset.name, theme: asset.group,
    market: 'international', instrumental: true, keywords: asset.keywords, durationMs: asset.durationMs,
    src: `/api/designs/sfx/${asset.version}/${asset.id}`, artist: asset.author, license: asset.license,
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', sourceUrl: asset.provenance.sourcePage,
    sha256: asset.sha256, evidence: asset.evidence }))];
}

export function validateAudioCuration(input, original) {
  check(input && Object.getPrototypeOf(input) === Object.prototype, 'Invalid audio metadata.');
  check(Object.keys(input).every(key => ['expectedRevision', 'status', 'title', 'theme', 'keywords'].includes(key)), 'Immutable source, rights and media fields cannot be edited.');
  check(Number.isSafeInteger(input.expectedRevision) && input.expectedRevision >= 0, 'Expected revision required.');
  const next = { key: original.key, revision: input.expectedRevision + 1, status: input.status ?? original.status,
    title: input.title ?? original.title, theme: input.theme ?? original.theme, keywords: input.keywords ?? original.keywords };
  check(['active', 'disabled'].includes(next.status), 'Invalid audio status.');
  check(next.title && Object.keys(next.title).length === 2 && text(next.title.vi, 160) && text(next.title.en, 160), 'VI and EN titles are required (160 characters).');
  const themes = original.kind === 'music' ? ['general', 'birthday', 'wedding', 'christmas', 'newyear', 'tet', 'valentine'] : ['paper', 'gift', 'sparkle', 'birthday', 'memory', 'interaction', 'nature', 'melody'];
  check(themes.includes(next.theme), 'Invalid audio theme.');
  check(typeof next.keywords === 'string' && next.keywords.length <= 1000 && !/[\u0000-\u001f]/u.test(next.keywords), 'Invalid keywords.');
  return structuredClone(next);
}

// Overrides never replace source bytes or erase Admin edits on a seed/upgrade.
// Disabling removes new choices; historical gifts still resolve immutable IDs.
export class MusicLibraryService {
  constructor(client, { filepath = dataPath('designs', 'music-library.json') } = {}) {
    this.client = client; this.filepath = filepath; this.available = !client;
  }
  async ready() {
    if (this.client) {
      const [rows] = await this.client.execute("SELECT version FROM schema_migrations WHERE version='015_music_library'");
      this.available = rows.length > 0;
    }
  }
  json() { return this.repository ??= new JsonRepository(this.filepath, { formatVersion: 1, items: [], history: [] }); }
  async overrides(tx = this.client) {
    if (!this.available) return [];
    if (!tx) return this.json().read().items;
    const [rows] = await tx.execute('SELECT definition FROM music_library_overrides ORDER BY id');
    return rows.map(row => typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition);
  }
  async list() {
    const overrides = new Map((await this.overrides()).map(row => [row.key, row]));
    return { formatVersion: 1, writable: this.available, migrationRequired: !this.available ? '015_music_library' : null,
      items: audioLibraryDefaults().map(row => {
        const saved=overrides.get(row.key);
        if(!saved)return row;
        check(Number.isSafeInteger(saved.revision)&&saved.revision>0,'Invalid stored audio revision.');
        const value=validateAudioCuration({expectedRevision:saved.revision-1,status:saved.status,title:saved.title,theme:saved.theme,keywords:saved.keywords},row);
        return {...row,...value};
      }), providers: MUSIC_PROVIDERS };
  }
  async put(actor, key, input) {
    if (actor?.role !== 'admin') throw canvasError(403, 'ADMIN_REQUIRED', 'Admin required.');
    const base = audioLibraryDefaults().find(row => row.key === key);
    if (!base) throw canvasError(404, 'AUDIO_LIBRARY_NOT_FOUND', 'Audio asset not found. Import licensed media in the source catalog first.');
    if (!this.available) throw canvasError(503, 'MUSIC_MIGRATION_REQUIRED', 'Music Library requires migration 015.');
    const update = async (rows, record) => {
      const old = rows.find(row => row.key === key);
      const current = { ...base, ...old };
      if (current.revision !== input.expectedRevision) throw canvasError(409, 'AUDIO_LIBRARY_REVISION_CONFLICT', 'Audio item changed; reload before saving.');
      const next = validateAudioCuration(input, current);
      await record(old, next);
      return next;
    };
    if (this.client) await this.client.withTransaction(async tx => {
      await tx.execute("SELECT version FROM schema_migrations WHERE version='015_music_library' FOR UPDATE");
      await update(await this.overrides(tx), async (old, next) => {
        if (old) await tx.execute('INSERT INTO music_library_history(id,revision,snapshot) VALUES (?,?,?)', [key, old.revision, JSON.stringify(old)]);
        await tx.execute('INSERT INTO music_library_overrides(id,revision,definition) VALUES (?,?,?) ON DUPLICATE KEY UPDATE revision=VALUES(revision),definition=VALUES(definition)', [key, next.revision, JSON.stringify(next)]);
      });
    });
    else {
      const previous = queues.get(this.filepath) || Promise.resolve();
      const work = previous.catch(() => {}).then(async () => {
        const state = this.json().read();
        await update(state.items, async (old, next) => {
          if (old) state.history.push(old);
          state.items = [...state.items.filter(row => row.key !== key), next];
          this.json().write(state);
        });
      });
      queues.set(this.filepath, work);
      try { await work; } finally { if (queues.get(this.filepath) === work) queues.delete(this.filepath); }
    }
    return this.list();
  }
}
