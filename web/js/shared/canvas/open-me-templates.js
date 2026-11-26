import { canonicalText } from '../locale.js';
import { validateDocument } from './schema.js';
import { createClub22 } from './open-me-club22.js';
import { createCozyChristmas } from './open-me-cozy.js';
import { createTetLetter } from './open-me-tet.js';

// Prepared editable layouts. Catalog owns publication, pricing and creation
// permissions; defining a layout here does not publish or seed a product.
export const OPEN_ME_TEMPLATE_META = Object.freeze([
  { id: 'club-22-invitation', cardType: 'invitation', theme: 'sunshine', categoryKey: 'templates.meta.category.birthday', scenes: 4 },
  { id: 'cozy-christmas-invitation', cardType: 'invitation', theme: 'cream', categoryKey: 'templates.meta.category.christmas', scenes: 4 },
  { id: 'tet-phong-thu', cardType: 'greeting', theme: 'coral', categoryKey: 'templates.meta.category.tet', scenes: 3 },
]);
export const OPEN_ME_TEMPLATE_IDS = Object.freeze(OPEN_ME_TEMPLATE_META.map(row => row.id));
const factories = { 'club-22-invitation': createClub22, 'cozy-christmas-invitation': createCozyChristmas, 'tet-phong-thu': createTetLetter };
export function createOpenMeTemplate(id, localize = canonicalText) {
  return Object.hasOwn(factories, id) ? validateDocument(factories[id](localize)) : null;
}
