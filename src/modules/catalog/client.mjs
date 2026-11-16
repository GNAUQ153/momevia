import { internalFetch } from '../../shared/http.mjs';

export function createCatalogClient(key) {
  return { async getTemplate(id) {
    const result = await internalFetch(`http://127.0.0.1:4102/internal/templates/${encodeURIComponent(id)}`, key);
    return result.template;
  } };
}
