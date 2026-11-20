import { createBasicTemplate, canonicalStringify } from '../../shared/canvas/index.js';

// Materialize only a NEW draft using normal owner-only CAS. This also keeps a
// refreshed static library consistent with a server process still using v1 presets.
// A saved/replayed edited draft or template lock is never replaced by this helper.
export async function materializeTemplateStart(design, { template, createMutationId, request, localize }) {
  if (design.startingLocale) return design;
  if (design.revision !== 1 || design.source.kind !== 'template' || design.source.templateId !== template.id) return design;
  if (design.policy?.kind !== 'sender-basic' || Object.keys(design.policy.lockedElements || {}).length) return design;
  if (design.document.assets.length || Object.values(design.document.bindings).some(binding => binding.value)) return design;
  const document = createBasicTemplate(template, localize);
  if (!document || canonicalStringify(document) === canonicalStringify(design.document)) return design;
  const last = createMutationId.slice(-1), mutationId = createMutationId.slice(0, -1) + (parseInt(last, 16) ^ 1).toString(16);
  await request(`/designs/designs/${encodeURIComponent(design.id)}/save`, { expectedRevision: 1, mutationId, title: design.title, document });
  return (await request(`/designs/designs/${encodeURIComponent(design.id)}`)).design;
}
