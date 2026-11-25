import { attr, priceText, text } from "../core/i18n.js";
import { escapeHtml as e } from "../core/api.js";
import { icon } from "../ui/icons.js";

function latestVersion(template) {
  return (template.versions || []).reduce((latest, version) =>
    !latest || Number(version.revision) > Number(latest.revision) ? version : latest, null);
}

function templateStatus(template) {
  if (template.withdrawn) return 'withdrawn';
  const status = latestVersion(template)?.status;
  return ['pending', 'approved', 'changes_requested'].includes(status) ? status : 'draft';
}

function creatorJourney(creator) {
  return `<nav class="creator-journey" ${attr('aria-label', 'creator.journey.label')}>
    ${[
      ['pencil', 'draft', '#creator-form'],
      ['layers', 'design', '#creator-list'],
      ['shield', 'review', '#creator-finance'],
    ].map(([glyph, step, href]) => `<a class="creator-journey__step" href="${creator ? href : '#creator-benefits'}" data-action="creator-jump">
      <span class="creator-journey__icon">${icon(glyph, 22)}</span>
      <span><strong>${text(`creator.journey.${step}`)}</strong><small>${text(`creator.journey.${step}Hint`)}</small></span>
      ${icon('chevron', 18)}
    </a>`).join('')}
  </nav>`;
}

function creatorTemplateCard(template) {
  const status = templateStatus(template);
  return `<article class="my-gift creator-template">
    <div class="creator-template__top"><span class="creator-template__icon" aria-hidden="true">${icon('gift', 23)}</span>
      <span class="creator-template__status creator-template__status--${status}">${text(`creator.status.${status}`)}</span></div>
    <div class="my-gift-detail"><strong>${e(template.title)}</strong><p>${e(template.subtitle)}</p>
      ${(template.versions || []).slice().sort((a, b) => Number(b.revision) - Number(a.revision)).map(version => `<p class="creator-template__revision">${text('creator.list.revision', {
        revision: version.revision,
        status: ['pending', 'approved', 'changes_requested'].includes(version.status)
          ? { format: 'message', key: `creator.status.${version.status}` } : version.status,
      })}${version.reason ? ` · ${e(version.reason)}` : ''}</p>`).join('')}
    </div>
    <div class="my-gift-actions"><a class="btn btn--dark creator-cta" href="/design/${e(template.creatorDesignId)}" data-link>${icon('pencil', 16)} ${text('creator.actions.open')}</a>
      <button type="button" class="btn btn--outline" data-action="duplicate-template" data-id="${e(template.id)}">${icon('copy', 16)} ${text('creator.actions.duplicate')}</button>
      ${template.versionId && !template.withdrawn ? `<button type="button" class="creator-template__withdraw" data-action="withdraw-template" data-id="${e(template.id)}">${text('creator.actions.withdraw')}</button>` : ''}
    </div></article>`;
}

export function creatorFinancePanel(statement) {
  const renderMetric = (caption, value) => `<div class="finance-metric"><span>${text(caption)}</span><strong>${priceText(value)}</strong></div>`;
  return `<section class="section finance-panel role-workspace__section" id="creator-finance" aria-labelledby="creator-finance-heading"><div class="container">
    <div class="finance-panel__heading"><div><h2 id="creator-finance-heading">${text('finance.creator.title')}</h2>
      <p>${text('finance.creator.subtitle')}</p></div>
      ${statement?.recent?.length ? `<button type="button" class="btn btn--outline" data-action="creator-finance-export">${text('finance.export.csv')}</button>` : ''}
    </div>
    ${statement ? `<div class="finance-panel__groups">
      ${['live', 'sandbox'].map(group => `<article class="finance-panel__group">
        <h3>${text('finance.group.' + group)}</h3>
        <p>${text('finance.orders', { count: statement.summary[group].orders })}</p>
        ${renderMetric('finance.gross', statement.summary[group].grossVnd)}
        ${renderMetric('finance.platform', statement.summary[group].platformFeeVnd)}
        ${renderMetric('finance.creatorShare', statement.summary[group].creatorVnd)}
      </article>`).join('')}
    </div>` : `<p role="status">${text('finance.unavailable')}</p>`}
    ${statement && Array.isArray(statement.recent) ? `<div class="finance-recent">
      <h3>${text('finance.creator.recentTitle')}</h3>
      ${statement.recent.length ? `<div class="finance-recent__list">${statement.recent.map(item => `<article class="finance-recent__row">
        <div><strong>${e(String(item.templateId || ''))}</strong>
          <p>${text('finance.creator.orderRef', { id: String(item.orderId || '').slice(0, 8) })}</p></div>
        <div class="finance-recent__amount"><strong>${priceText(Number(item.creatorVnd))}</strong>
          <span>${text(item.sandbox ? 'finance.group.sandbox' : 'finance.group.live')}</span></div>
      </article>`).join('')}</div>` : `<p>${text('finance.creator.recentEmpty')}</p>`}
    </div>` : ''}
    <p class="finance-panel__notice" role="note">${text('finance.disclaimer')}</p>
  </div></section>`;
}

// Chỉ hiển thị phản hồi của phiên bản mới nhất; không biến đổi dữ liệu gốc.
export function creatorReviewFeedback(templates = []) {
  return templates.flatMap(template => {
    const versions = Array.isArray(template.versions) ? template.versions : [];
    const latest = versions.reduce((current, candidate) =>
      !current || Number(candidate.revision) > Number(current.revision) ? candidate : current, null);
    if (latest?.status !== 'changes_requested' || !String(latest.reason || '').trim()) return [];
    return [{ title: String(template.title || ''), reason: String(latest.reason) }];
  });
}

export function createCreatorViews({ state }) {
  function creatorPage(templates = [], legacy = [], statement = null) {
    const creator =
      state.user && ["creator", "admin"].includes(state.user.role);
    const feedback = creator ? creatorReviewFeedback(templates) : [];
    return `<div class="creator-space">
      <section class="creator-hero" aria-labelledby="creator-heading"><div class="container creator-hero__inner">
        <div class="creator-hero__lead"><span class="creator-eyebrow">${icon('sparkles', 16)} ${text('creator.eyebrow')}</span>
          <h1 id="creator-heading">${text('creator.title')}<br><em>${text('creator.emphasis')}</em></h1><p>${text('creator.description')}</p>
          <div class="creator-hero__actions">${creator
            ? `<a href="#creator-form" data-action="creator-jump" class="btn btn--dark creator-cta">${icon('pencil', 19)} ${text('creator.actions.new')}</a><a href="#creator-list" data-action="creator-jump" class="btn btn--outline">${icon('layers', 18)} ${text('creator.actions.collection')}</a>`
            : `${state.user ? `<button type="button" class="btn btn--dark creator-cta" data-action="support">${icon('message-circle', 18)} ${text('creator.actions.contact')}</button>` : `<button type="button" class="btn btn--dark creator-cta" data-action="creator-login">${icon('user', 18)} ${text('creator.actions.login')}</button>`}<a href="/explore" data-link class="btn btn--outline">${text('creator.actions.inspiration')}</a>`}
          </div>
          ${!creator ? `<p class="creator-hero__access">${text(state.user ? 'creator.access.requestRole' : 'creator.access.login')}</p>` : ''}
          <div class="creator-perks"><span>${icon('check-circle', 16)} ${text('creator.perks.free')}</span><span>${icon('check-circle', 16)} ${text('creator.perks.review')}</span><span>${icon('check-circle', 16)} ${text('creator.perks.management')}</span></div>
        </div>
        <div class="creator-showcase"><span class="creator-showcase__spark" aria-hidden="true">${icon('sparkles', 36)}</span>
          <div class="creator-showcase__window"><div class="creator-showcase__bar"><span>${icon('gift', 18)} ${text('creator.preview.title')}</span><span>${icon('heart', 16)}</span></div>
            <div class="creator-showcase__stage"><img ${attr('src', 'creator.preview.cover')} ${attr('alt', 'creator.preview.alt')} width="390" height="844" fetchpriority="high" />
              <div class="creator-showcase__tools" aria-hidden="true">${icon('pencil', 18)}${icon('image', 18)}${icon('music', 18)}${icon('sparkles', 18)}</div>
            </div>
            <a class="creator-showcase__link" href="/template/birthday-radiance" data-link>${icon('play', 16)} ${text('creator.preview.action')}</a>
          </div>
          <span class="creator-showcase__note">${icon('heart', 18)} ${text('creator.preview.note')}</span>
        </div>
      </div></section>
      <div class="container creator-journey-wrap">${creatorJourney(creator)}</div>
      ${feedback.length ? `<div class="container role-workspace__review-wrap"><section class="role-workspace__review-notice" role="status" aria-labelledby="creator-review-notice-title" data-creator-review-notice>
        <div class="role-workspace__review-header"><h2 id="creator-review-notice-title">${text('creator.status.changes_requested')}</h2>
          <a class="btn btn--outline" href="#creator-list" data-action="creator-jump">${text('role.creator.templatesLink')}</a></div>
        <ul>${feedback.map(item => `<li><strong>${e(item.title)}</strong><p>${e(item.reason)}</p></li>`).join('')}</ul>
      </section></div>` : ''}
      ${creator
        ? `<section class="section role-workspace role-workspace--creator creator-workbench"><div class="container creator-grid">
        <div class="creator-create" id="creator-form" tabindex="-1"><span class="creator-eyebrow">${icon('pencil', 16)} ${text('creator.form.badge')}</span><h2>${text("creator.form.title")}</h2><p class="section-intro">${text("creator.form.intro")}</p>
        <form class="creator-form" id="creator-template-form"><label class="field"><span>${text("creator.form.name")}</span><input name="title" required maxlength="60" ${attr("placeholder", "creator.form.nameExample")}/></label>
        <label class="field"><span>${text("creator.form.subtitle")}</span><textarea name="subtitle" required maxlength="140" rows="3" ${attr("placeholder", "creator.form.subtitleHint")}></textarea></label>
        <button class="btn btn--dark creator-cta btn--wide" type="submit">${icon('sparkles', 18)} ${text("creator.actions.create")}</button>
        <p class="creator-form__next">${icon('shield', 16)} ${text('creator.form.next')}</p></form>
        <div class="creator-tip">${icon('heart', 20)}<p><strong>${text('creator.form.tipTitle')}</strong>${text('creator.form.tip')}</p></div></div>
        <div class="creator-list" id="creator-list" tabindex="-1"><div class="creator-list__heading"><div><span class="creator-eyebrow">${text('creator.list.badge')}</span><h2>${text("creator.list.title")}</h2></div><span class="creator-list__count">${text('creator.list.count', { count: templates.length })}</span></div>
          <p class="creator-list__intro">${text('creator.list.intro')}</p>
          <div class="creator-list__summary">${['draft', 'pending', 'approved'].map(status => `<span>${text(`creator.status.${status}`)}<strong>${templates.filter(template => templateStatus(template) === status).length}</strong></span>`).join('')}</div>
          <div class="creator-list__items">${templates.length ? templates.map(creatorTemplateCard).join('') : `<div class="creator-empty"><span aria-hidden="true">${icon('layers', 32)}</span><h3>${text('creator.list.empty')}</h3><p>${text('creator.list.emptyHint')}</p><a class="btn btn--outline" href="#creator-form" data-action="creator-jump">${icon('pencil', 17)} ${text('creator.actions.first')}</a></div>`}</div>
          ${legacy.length ? `<h3>${text("creator.list.legacy")}</h3>${legacy.map(t => `<p>${e(t.title)} - ${priceText(t.price)}${t.rejectionReason ? ` - ${e(t.rejectionReason)}` : ''}</p>`).join("")}` : ''}</div>
      </div></section>${creatorFinancePanel(statement)}`
        : `<section class="section" id="creator-benefits" tabindex="-1"><div class="container creator-benefits"><div class="section-heading section-heading--center"><span class="eyebrow">${text("creator.benefits.badge")}</span><h2>${text("creator.benefits.title")} <em>${text("creator.benefits.emphasis")}</em></h2></div><div class="steps-grid"><article class="step-card">${icon("pencil", 30)}<h3>${text("creator.benefits.design")}</h3><p>${text("creator.benefits.designHint")}</p></article><article class="step-card">${icon("layers", 30)}<h3>${text("creator.benefits.management")}</h3><p>${text("creator.benefits.managementHint")}</p></article><article class="step-card">${icon("heart", 30)}<h3>${text("creator.benefits.reach")}</h3><p>${text("creator.benefits.reachHint")}</p></article></div></div></section>`
      }</div>`;
  }

  return { creatorPage };
}
