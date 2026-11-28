import { registrationPolicyVersion } from '../shared/registration-consent.js';
import { attr, t, text } from '../core/i18n.js';

// Draft policies. The section order is shared by both languages.
const sections = { general: 5, payment: 5, privacy: 5, content: 4 };
const policyKey = (id, field) => `policies.${id}.${field}`;

export const legalPages = Object.fromEntries(Object.entries(sections).map(([id, count]) => [id, {
  get title() { return t(policyKey(id, 'title')); },
  get description() { return t(policyKey(id, 'description')); },
  sections: Array.from({ length: count }, (_, index) => ({
    get title() { return t(policyKey(id, `sections.${index + 1}.title`)); },
    get text() { return t(policyKey(id, `sections.${index + 1}.text`)); },
  })),
}]));

export function legalPage(key) {
  if (!Object.hasOwn(legalPages, key)) return '';
  const menu = Object.keys(legalPages).map(id => `
    <a href="/policies/${id}" data-link class="${id === key ? 'is-active' : ''}" ${id === key ? 'aria-current="page"' : ''}>${text(policyKey(id, 'title'))}</a>`).join('');
  const renderedSections = Array.from({ length: sections[key] }, (_, index) => {
    const prefix = `sections.${index + 1}`;
    return `<section class="legal-section"><h2>${text(policyKey(key, `${prefix}.title`))}</h2><p>${text(policyKey(key, `${prefix}.text`))}</p></section>`;
  }).join('');
  return `<section class="legal-hero"><div class="container">
    <span class="eyebrow">${text('policies.info')}</span>
    <h1>${text(policyKey(key, 'title'))}</h1>
    <p>${text(policyKey(key, 'description'))}</p>
  </div></section>
  <section class="legal-body"><div class="container legal-layout">
    <nav class="legal-sidebar" ${attr('aria-label', 'policies.navigation')}><h2>${text('policies.list')}</h2>${menu}</nav>
    <article class="legal-document">
      <p class="legal-draft"><strong>${text('policies.note')}</strong> ${text('policies.draft')}</p>
      ${key === 'general' || key === 'privacy' ? `<p class="legal-draft">${text('policies.registrationVersion', { version: registrationPolicyVersion })}</p>` : ''}
      ${renderedSections}
      <div class="legal-help"><h2>${text('policies.help')}</h2><p>${text('policies.helpDescription')}</p><button class="btn btn--outline" type="button" data-action="support">${text('common.actions.support')}</button></div>
    </article>
  </div></section>`;
}
