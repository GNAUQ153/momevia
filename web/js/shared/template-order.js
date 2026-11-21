export const PRIORITY_TEMPLATE_IDS = Object.freeze(['birthday-radiance', 'hai-phong-bi', 'proud-of-you']);
const priorities = new Map(PRIORITY_TEMPLATE_IDS.map((id, index) => [id, index]));

// A read-only display order works with existing JSON/MySQL catalogs. Do not
// change seed rows, prices, publication status, favorites or saved gift layouts.
export function prioritizeTemplates(templates) {
  const rank = template => {
    const system = template?.systemOwned === true || (template?.creatorId === 'system' && template?.creator === 'Momevia Originals');
    if (!system || template.versionId || template.creatorDesignId) return PRIORITY_TEMPLATE_IDS.length;
    return priorities.get(template.id) ?? PRIORITY_TEMPLATE_IDS.length;
  };
  return templates.slice().sort((a, b) => rank(a) - rank(b));
}
