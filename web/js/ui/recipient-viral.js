import { attr, text } from "../core/i18n.js";
import { icon } from './icons.js';
import { vietnamDay, isInSeason } from '../features/catalog/seasonal.js';
import { templateCover } from '../features/catalog/template-copy.js';
import { templateCopyKey } from '../shared/template-copy.js';

// CTA cố định, không mang gift slug, invite token hay nội dung riêng tư sang trang khám phá.
export const RECIPIENT_CREATE_URL = '/explore?source=recipient';

const suggestions = [
  { id: 'winter-wishes-2026', title: 'Winter Wishes', from: '2026-11-10', to: '2026-12-26' },
  { id: 'new-year-spark-2027', title: 'Midnight Countdown', from: '2026-12-20', to: '2027-01-07' },
  { id: 'spring-blessing-2027', title: 'Spring Blessing', from: '2027-01-15', to: '2027-02-22' },
  { id: 'velvet-valentine-2027', title: 'Velvet Valentine', from: '2027-02-01', to: '2027-02-15' },
  { id: 'birthday-radiance', title: 'Birthday Radiance' },
  { id: 'thank-you-bloom', title: 'Thank You Bloom' },
  { id: 'calm-light', title: 'Calm Light' },
];

export function recipientSuggestions(day = vietnamDay()) {
  const active = suggestions.filter(item => isInSeason({ isSeasonal: Boolean(item.from), availableFrom: item.from, availableTo: item.to }, day));
  const evergreen = suggestions.filter(item => !item.from);
  return [...active, ...evergreen].slice(0, 3);
}

export function recipientViralCta(day = vietnamDay()) {
  return `<aside class="recipient-viral" aria-labelledby="recipient-viral-heading">
    <span class="recipient-viral__spark" aria-hidden="true">${icon('sparkles', 23)}</span>
    <h2 id="recipient-viral-heading">${text("gift.discover.title")}</h2>
    <p>${text("gift.discover.description")}</p>
    <div class="recipient-viral__actions">
      <a class="btn btn--dark" href="${RECIPIENT_CREATE_URL}" data-link referrerpolicy="no-referrer">${text("gift.discover.create")} ${icon('arrow-up-right', 18)}</a>
      <a class="btn btn--outline" href="/explore" data-link referrerpolicy="no-referrer">${text("gift.discover.more")}</a>
    </div>
    <div class="recipient-viral__suggestions" ${attr("aria-label", "gift.discover.suggestions")}>
      ${recipientSuggestions(day).map(item => `<a href="/template/${encodeURIComponent(item.id)}" class="recipient-viral__suggestion" data-link referrerpolicy="no-referrer">
        <img ${templateCover(item.id)} alt="" width="390" height="844" loading="lazy"/>
        <span>${text(templateCopyKey(item.id, 'title'))}</span>
      </a>`).join('')}
    </div>
    <a class="recipient-viral__brand" href="/" data-link referrerpolicy="no-referrer">${icon('gift', 15)} ${text("gift.discover.madeWith")} <strong>Momevia</strong></a>
  </aside>`;
}
