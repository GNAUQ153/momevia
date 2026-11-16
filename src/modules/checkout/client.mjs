import { internalFetch } from '../../shared/http.mjs';

export function createCheckoutClient(key) {
  return { async hasLicense(userId, templateId) {
    const result = await internalFetch(`http://127.0.0.1:4104/internal/license/${encodeURIComponent(userId)}/${encodeURIComponent(templateId)}`, key);
    return result.licensed;
  } };
}
