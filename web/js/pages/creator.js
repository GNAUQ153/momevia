import { attr, priceText, text } from "../core/i18n.js";
import { escapeHtml as e } from "../core/api.js";
import { icon } from "../ui/icons.js";

export function creatorFinancePanel(statement) {
  const renderMetric = (caption, value) => `<div class="finance-metric"><span>${text(caption)}</span><strong>${priceText(value)}</strong></div>`;
  return `<section class="section finance-panel"><div class="container">
    <div class="finance-panel__heading"><div><h2>${text('finance.creator.title')}</h2>
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

export function createCreatorViews({ state }) {
  function creatorPage(templates = [], legacy = [], statement = null) {
    const creator =
      state.user && ["creator", "admin"].includes(state.user.role);
    return `<section class="creator-hero"><div class="container creator-hero__inner"><div><span class="eyebrow">${text("creator.eyebrow")}</span><h1>${text("creator.title")}<br><em>${text("creator.emphasis")}</em></h1><p>${text("creator.description")}</p>
        ${creator ? `<a href="#creator-form" class="btn btn--light">${text("creator.actions.new")} ${icon("arrow", 18)}</a>` : `<p class="helper-text">${state.user ? text("creator.access.requestRole") : text("creator.access.login")}</p>`}
        <div class="creator-perks"><span>${icon("check-circle", 17)} ${text("creator.perks.free")}</span><span>${icon("check-circle", 17)} ${text("creator.perks.review")}</span><span>${icon("check-circle", 17)} ${text("creator.perks.management")}</span></div>
      </div><div class="creator-art">${icon("pencil", 120)}<span>${icon("sparkles", 62)}</span></div></div></section>
      ${creator
        ? `<section class="section" id="creator-form"><div class="container creator-grid"><div><h2>${text("creator.form.title")}</h2><p class="section-intro">${text("creator.form.intro")}</p>
        <form class="creator-form" id="creator-template-form"><label class="field"><span>${text("creator.form.name")}</span><input name="title" required maxlength="60" ${attr("placeholder", "creator.form.nameExample")}/></label>
        <label class="field"><span>${text("creator.form.subtitle")}</span><textarea name="subtitle" required maxlength="140" rows="3" ${attr("placeholder", "creator.form.subtitleHint")}></textarea></label>
        <button class="btn btn--dark" type="submit">${text("creator.actions.create")}</button></form></div>
        <div class="creator-list"><h3>${text("creator.list.title")}</h3>${templates.length ? templates.map(t => `<article class="my-gift"><div class="my-gift-detail"><strong>${e(t.title)}</strong><p>${e(t.subtitle)}</p>
          ${t.withdrawn ? `<p>${text("creator.list.withdrawn")}</p>` : ''}
          ${t.versions.slice().reverse().map(v => `<p>${text('creator.list.revision', {
            revision: v.revision,
            status: ['pending', 'approved', 'changes_requested'].includes(v.status) ? { format: 'message', key: `creator.status.${v.status}` } : v.status,
          })}${v.reason ? ` · ${e(v.reason)}` : ""}</p>`).join("")}</div>
          <div class="my-gift-actions"><a class="btn btn--outline" href="/design/${e(t.creatorDesignId)}" data-link>${text("creator.actions.open")}</a><button class="btn btn--outline" data-action="duplicate-template" data-id="${e(t.id)}">${text("creator.actions.duplicate")}</button>
          ${t.versionId && !t.withdrawn ? `<button class="btn btn--outline" data-action="withdraw-template" data-id="${e(t.id)}">${text("creator.actions.withdraw")}</button>` : ''}</div></article>`).join("") : `<p class="creator-empty">${text("creator.list.empty")}</p>`}
          ${legacy.length ? `<h3>${text("creator.list.legacy")}</h3>${legacy.map(t => `<p>${e(t.title)} · ${priceText(t.price)}${t.rejectionReason ? ` · ${e(t.rejectionReason)}` : ''}</p>`).join("")}` : ''}</div>
      </div></section>${creatorFinancePanel(statement)}`
        : `<section class="section"><div class="container creator-benefits"><div class="section-heading section-heading--center"><span class="eyebrow">${text("creator.benefits.badge")}</span><h2>${text("creator.benefits.title")} <em>${text("creator.benefits.emphasis")}</em></h2></div><div class="steps-grid"><article class="step-card">${icon("pencil", 30)}<h3>${text("creator.benefits.design")}</h3><p>${text("creator.benefits.designHint")}</p></article><article class="step-card">${icon("layers", 30)}<h3>${text("creator.benefits.management")}</h3><p>${text("creator.benefits.managementHint")}</p></article><article class="step-card">${icon("heart", 30)}<h3>${text("creator.benefits.reach")}</h3><p>${text("creator.benefits.reachHint")}</p></article></div></div></section>`
      }`;
  }

  return { creatorPage };
}
