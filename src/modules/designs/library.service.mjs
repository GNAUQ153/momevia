import { createHash } from 'node:crypto';
import { builtinLibraryItems } from './library.seed.mjs';
import { LIBRARY_KINDS, CORE_EFFECT_IDS, libraryId, validateAnimation, validatePortableEffect, validateVector, builtinEffectApplies } from '../../../web/js/shared/canvas/library-contract.js';
import { installLibrary, librarySnapshot, libraryEntry, libraryDocument } from '../../../web/js/shared/canvas/library-state.js';
import { templatePreviewDocument } from '../../../web/js/shared/canvas/presets.js';
import { previewSvg } from '../../../web/js/shared/canvas/cover-svg.js';
import { serverText } from '../../shared/locale.mjs';
import { pinDocumentArtwork } from '../../../web/js/shared/canvas/library-materialize.js';
import { registry, createElement } from '../../../web/js/shared/canvas/registry.js';
import { validateDocument, canonicalStringify } from '../../../web/js/shared/canvas/schema.js';
import { canvasError } from './errors.mjs';
import { buildLibraryPreview, activatePreviewDependencies } from './library-preview.mjs';
import { builtinCoverResources } from './builtin-media.mjs';
import { usesSound } from '../../../web/js/shared/canvas/sound.js';

const check = (ok, message) => { if (!ok) throw canvasError(422, 'INVALID_LIBRARY_DEFINITION', message); };
const parse = v => typeof v === 'string' ? JSON.parse(v) : v;
const fromRow = r => ({ kind: r.kind, id: r.id, revision: Number(r.revision), status: r.status, sortOrder: r.sort_order, definition: parse(r.definition) });
function documentFor(elements) { const version=usesSound({elements,assets:[]})?3:2;return { schemaVersion: version, registryVersion: version,
  artboard: { baseSize: { width: 390, height: 844 }, layoutMode: 'responsive-scene', safeInsets: { top: 24, right: 20, bottom: 24, left: 20 } },
  entrySceneId: 'library-validation', bindings: Object.fromEntries(['recipientName','senderName','message'].map(key => [key, { type: 'text', value: '' }])),
  assets: [], scenes: [{ id: 'library-validation', name: 'Library', background: { kind: 'solid', color: '#FFFFFF' }, elementIds: elements.map(e => e.id) }],
  elements, responsive: { textOverflow: 'expand-flow', sceneOverflow: 'scroll', desktop: { maxContentWidth: 720, align: 'center' } } }; }
export function validateLibrary(items) {
  check(Array.isArray(items) && items.length <= 5000, 'Library exceeds its item budget.');
  const before = librarySnapshot(), snapshot = { formatVersion: 1, items: structuredClone(items) };
  try {
    installLibrary(snapshot);
    for (const item of items) {
      check(LIBRARY_KINDS.includes(item.kind) && libraryId(item.id) && Number.isSafeInteger(item.revision) && item.revision > 0 && ['active','disabled'].includes(item.status), 'Invalid item identity.');
      check(Number.isSafeInteger(item.sortOrder), 'Invalid item order.');
      const d = item.definition;
      check(d && typeof d === 'object' && !Array.isArray(d) && Buffer.byteLength(JSON.stringify(d)) <= 1048576, 'Invalid item definition.');
      if (item.status !== 'active') continue;
      if (item.kind === 'artwork') { check(['shape','line','sticker','mask'].includes(d.target) && libraryId(d.key) && item.id === `${d.target}-${d.key}`, 'Invalid artwork target or ID.'); validateVector(d.vector); }
      if (item.kind === 'element') {
        check(d.title && d.group && Array.isArray(d.elements) && d.elements.length > 0 && d.elements.length <= 100, 'An element requires a title, group and 1–100 layers.');
        validateDocument(pinDocumentArtwork(documentFor(structuredClone(d.elements))));
      }
      if (['preset','template'].includes(item.kind)) {
        const documents = d.documents || { vi: d.document }; check(documents.vi, 'A VI document is required.');
        for (const value of Object.values(documents)) validateDocument(pinDocumentArtwork(structuredClone(value)));
      }
      if (item.kind === 'element_type') {
        check(Object.hasOwn(registry, item.id) && d.renderer === item.id, 'A new renderer requires application code; add a reusable element composition instead.');
        validateDocument(documentFor([createElement(item.id, item.id === 'interaction' ? { props: { kind: 'flip-card', entries: [{ heading: '', body: '' }] } } : {})]));
      }
      if (item.kind === 'animation') {
        check(Object.keys(CORE_EFFECT_IDS).some(f => { try { validateAnimation(d, f); return true; } catch { return false; } }), 'Invalid animation recipe.');
      }
      if (item.kind === 'effect') {
        const animation = items.find(row => row.kind === 'animation' && row.id === d.animationId && row.status === 'active');
        check(animation && CORE_EFFECT_IDS[d.family], 'Missing animation or effect family.');
        const allowed = ['id', 'definition'];
        if (d.family !== 'surface') allowed.push('speed');
        if (d.family === 'surface') allowed.push('color');
        if (d.family === 'entrance') allowed.push('delay');
        if (d.family === 'ambience') allowed.push('density', 'loop');
        check(Object.entries(d.defaults || {}).every(([k, v]) => allowed.includes(k) && !['id','definition'].includes(k) &&
          (k === 'speed' ? ['slow','normal','fast'].includes(v) : k === 'delay' ? [0,150,300].includes(v) :
            k === 'density' ? ['sparse','normal'].includes(v) : k === 'loop' ? typeof v === 'boolean' : /^#[\da-fA-F]{6}$/.test(v))), 'Invalid effect controls.');
        const portable = { id: item.id, revision: item.revision, family: d.family, title: d.title, targets: d.targets, animation: animation.definition };
        const target = d.targets?.scenes ? undefined : { type: d.targets?.types?.[0], props: { kind: d.targets?.kinds?.[0] || 'flip-card' } };
        validatePortableEffect(portable, d.family, target);
        if (animation.definition.engine === 'builtin') for (const type of d.targets.types || [])
          check((d.targets.kinds || ['flip-card']).every(kind => builtinEffectApplies(animation.definition.builtinId, { type, props: { kind } })), 'Builtin target incompatibility.');
        const sample = target ? createElement(target.type, { ...(target.type === 'interaction' ? { props: { kind: 'flip-card', entries: [{ heading: '', body: '' }] } } : {}) }) : null;
        // Validate controls using the normal document schema too (defaults may
        // not smuggle unsupported fields or invalid speed/color values).
        const doc = documentFor(sample ? [sample] : []), model = sample || doc.scenes[0];
        if (sample?.type === 'interaction' && d.targets.kinds?.length) {
          // Kind-specific prop completeness is checked in actual element rows;
          // applicability above already validates the interaction target.
          continue;
        }
        model.effects = { [d.family]: { id: item.id, ...(d.defaults || {}), definition: portable } };
        validateDocument(doc);
      }
    }
    return snapshot;
  } finally { installLibrary(before); }
}

export class CanvasLibraryService {
  constructor(client) { this.client = client; }
  async ready() {
    if (!this.client) return;
    const [ledger] = await this.client.execute("SELECT version FROM schema_migrations WHERE version='013_canvas_library'");
    if (!ledger.length) throw canvasError(503, 'CANVAS_MIGRATION_REQUIRED', 'Canvas library requires migration 013.');
    const [[row]] = await this.client.execute('SELECT COUNT(*) n FROM canvas_library_items');
    if (!Number(row.n)) await this.seed();
    else await this.seedSound();
    await this.refresh();
  }
  async seed() {
    const rows = builtinLibraryItems(); validateLibrary(rows);
    return this.client.withTransaction(async tx => {
      for (const row of rows) await tx.execute(`INSERT INTO canvas_library_items(kind,id,revision,status,sort_order,definition) VALUES (?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE id=id`, [row.kind, row.id, row.revision, row.status, row.sortOrder, JSON.stringify(row.definition)]);
      return rows.length;
    });
  }
  async seedSound() {
    // Add only absent SFX controls to populated libraries. Never overwrite Admin rows.
    const rows=builtinLibraryItems().filter(row=>(row.kind==='element_type'&&row.id==='sound-button')||(row.kind==='element'&&row.id==='sound-button'));
    await this.client.withTransaction(async tx=>{
      for(const row of rows)await tx.execute(`INSERT INTO canvas_library_items(kind,id,revision,status,sort_order,definition) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id`,[row.kind,row.id,row.revision,row.status,row.sortOrder,JSON.stringify(row.definition)]);
    });
  }
  async rows(tx = this.client) {
    const [rows] = await tx.execute('SELECT kind,id,revision,status,sort_order,definition FROM canvas_library_items ORDER BY sort_order,kind,id');
    return rows.map(fromRow);
  }
  async refresh({ admin = false } = {}) {
    if (!this.client) return null;
    const rows = await this.rows();
    const revision = createHash('sha256').update(canonicalStringify(rows)).digest('hex');
    if (revision !== this.validatedRevision) { validateLibrary(rows); this.validatedRevision = revision; }
    const snapshot = { formatVersion: 1, revision, items: rows.filter(row => admin || row.status === 'active') };
    installLibrary({ ...snapshot, items: rows });
    return snapshot;
  }
  async cover(id, locale) {
    await this.refresh();
    if (!libraryEntry('template', id)) throw canvasError(404, 'LIBRARY_ITEM_NOT_FOUND', 'Library template unavailable.');
    const localize = (key, params) => serverText(locale, key, params);
    let document;
    try { document = templatePreviewDocument({ id }, localize); }
    catch {
      document = libraryDocument('template', id, localize);
      for (const [key, name] of [['recipientName','recipient'],['senderName','sender'],['message','greeting']])
        document.bindings[key].value = localize(`templates.preview.${name}`);
    }
    this.coverResources ??= builtinCoverResources();
    return previewSvg(document, undefined, this.coverResources.images, { serifWoff2: this.coverResources.serifWoff2 });
  }
  async put(user, kind, id, input) {
    check(user?.role === 'admin', 'Admin required.');
    check(LIBRARY_KINDS.includes(kind) && libraryId(id) && Number.isSafeInteger(input.expectedRevision) && input.expectedRevision >= 0, 'Invalid item or expected revision.');
    if (!this.client) throw canvasError(503, 'LIBRARY_MYSQL_REQUIRED', 'Library management requires MySQL.');
    await this.client.withTransaction(async tx => {
      // One lock serializes cross-item dependency checks as well as item CAS.
      await tx.execute("SELECT version FROM schema_migrations WHERE version='013_canvas_library' FOR UPDATE");
      const rows = await this.rows(tx), old = rows.find(r => r.kind === kind && r.id === id);
      if ((old?.revision || 0) !== input.expectedRevision) throw canvasError(409, 'LIBRARY_REVISION_CONFLICT', 'Library item changed.');
      const next = { kind, id, revision: input.expectedRevision + 1, status: input.status || 'active', sortOrder: input.sortOrder ?? old?.sortOrder ?? 10000, definition: input.definition ?? old?.definition };
      validateLibrary([...rows.filter(r => r !== old), next]);
      if (old) await tx.execute('INSERT INTO canvas_library_history(kind,id,revision,snapshot) VALUES (?,?,?,?)', [kind, id, old.revision, JSON.stringify(old)]);
      if (old) await tx.execute('UPDATE canvas_library_items SET revision=?,status=?,sort_order=?,definition=? WHERE kind=? AND id=?',
        [next.revision, next.status, next.sortOrder, JSON.stringify(next.definition), kind, id]);
      else await tx.execute('INSERT INTO canvas_library_items(kind,id,revision,status,sort_order,definition) VALUES (?,?,?,?,?,?)',
        [kind, id, next.revision, next.status, next.sortOrder, JSON.stringify(next.definition)]);
    });
    return this.refresh({ admin: true });
  }
  async preview(user, kind, id, input, locale) {
    if (user?.role !== 'admin') throw canvasError(403, 'ADMIN_REQUIRED', 'Admin required.');
    if (!this.client) throw canvasError(503, 'LIBRARY_MYSQL_REQUIRED', 'Library management requires MySQL.');
    check(['element','effect','animation','preset','template'].includes(kind) && libraryId(id), 'Invalid preview item.');
    const rows = await this.rows(), old = rows.find(r => r.kind === kind && r.id === id);
    const next = { kind, id, revision: (old?.revision || 0) + 1, status: 'active', sortOrder: input.sortOrder ?? old?.sortOrder ?? 10000, definition: input.definition ?? old?.definition };
    const items = structuredClone([...rows.filter(r => r !== old), next]);
    const proposed = items.find(r => r.kind === kind && r.id === id);
    // Disabled dependencies are available to an Admin's private preview only.
    // Persistence still validates the actual statuses of the whole library.
    activatePreviewDependencies(proposed, items); validateLibrary(items);
    const before = librarySnapshot();
    try {
      // Synchronous materialization only: an unsaved preview must never become
      // another request's library snapshot or mutate any database record.
      installLibrary({ items });
      if (kind === 'animation') {
        // The builder adds an ephemeral effect referring to this animation.
        const result = buildLibraryPreview(proposed, items, locale, input.previewFamily);
        return result;
      }
      return buildLibraryPreview(proposed, items, locale, input.previewFamily);
    } finally { installLibrary(before); }
  }
}
