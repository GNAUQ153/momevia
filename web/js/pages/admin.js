import { priceText, text } from "../core/i18n.js";
import { escapeHtml as e } from "../core/api.js";
import { icon } from "../ui/icons.js";
import { storedTopicText } from "../features/support/topics.js";

export function createAdminViews() {
  function adminPage(templates, requests = [], user, queue = []) {
    const total = (templates?.length || 0) + (queue?.length || 0);
    const complete = templates !== null && queue !== null;
    const waiting = (queue || []).map(item => ({ ...item, version: true })).concat(templates || [])
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const date = value => value ? text('common.values.date', { date: { format: 'date', value, options: { dateStyle: 'short', timeStyle: 'medium' } } }) : '';
    return `<section class="section"><div class="container"><h1>${text("admin.moderation.title")}</h1>
      <p><a class="btn btn--outline" href="/admin/payments" data-link>${text("admin.moderation.payments")}</a></p>
      <h2 class="admin-title">${text('admin.moderation.pending', { count: `${total}${complete ? '' : '+'}` })}</h2>
      ${templates === null ? `<p role="alert">${text("admin.moderation.legacyUnavailable")}</p>` : ''}
      ${queue === null ? `<p role="alert">${text("admin.moderation.versionsUnavailable")}</p>` : ''}
      ${!complete ? `<button class="btn btn--outline" data-action="retry-admin-queues">${text("admin.moderation.retry")}</button>` : ''}
      ${total ? `<div class="admin-list">${waiting.map(item => item.version
      ? `<article class="admin-row"><div><h3>${e(item.title)}</h3><p>${text('admin.moderation.creatorRevision', { revision: Number(item.revision) })}${item.createdAt ? ` · ${date(item.createdAt)}` : ''}</p><small>${e(item.creator)}</small></div><a class="btn btn--dark" href="/admin/review/${e(item.templateId)}/${e(item.versionId)}" data-link>${text("admin.moderation.open")}</a></article>`
      : `<article class="admin-row"><div class="mini-theme mini-theme--${e(item.theme)}">${icon("sparkles", 22)}</div><div><h3>${e(item.title)}</h3><p>${e(item.subtitle)}</p><small>${text('admin.moderation.legacy')} · ${e(item.creator)} · ${priceText(item.price)}${item.createdAt ? ` · ${date(item.createdAt)}` : ''}</small></div><div class="admin-actions"><button class="btn btn--dark" data-action="approve-template" data-id="${e(item.id)}">${icon("check", 17)} ${text("admin.moderation.approve")}</button><button class="btn btn--outline" data-action="reject-template" data-id="${e(item.id)}">${text("admin.moderation.reject")}</button></div></article>`).join("")}</div>`
        : complete ? `<div class="empty-state empty-state--panel">${icon("check-circle", 42)}<h3>${text("admin.moderation.done")}</h3><p>${text("admin.moderation.empty")}</p></div>` : ''}
      <div class="support-admin"><h2 class="admin-title">${text('admin.support.queue', { count: requests ? ` (${requests.length})` : '' })}</h2>
        ${requests?.length
        ? `<div class="support-admin__list">${requests
          .map(
            (t) => `<article class="support-admin__item">
          <strong>${e(t.code)} · ${storedTopicText(t.topic) ?? e(t.topic)}</strong><span>${e(t.name)} · ${e(t.email)}</span>
          <p>${e(t.message)}</p><small>${date(t.createdAt)}</small>
          ${t.reportKind ? `<p>${text(t.reportKind === 'gift' ? 'admin.support.report.gift' : 'admin.support.report.template', { target: t.reportTarget })}</p>` : ''}
          <p>${text('admin.support.state', { status: ['new', 'in_progress', 'resolved'].includes(t.status) ? { format: 'message', key: `admin.support.state.${t.status}` } : t.status })}</p>
          ${t.assignedTo ? `<p>${text('admin.support.assignee', { assignee: t.assignedTo === (user?.id || user?.sub) ? user.name : t.assignedTo })}</p>` : ''}
          ${t.resolution ? `<p>${text('admin.support.resolution', { resolution: t.resolution })}</p>` : ''}
          ${t.status === "new" ? `<button class="btn btn--outline" data-action="claim-report" data-id="${e(t.id)}">${text("admin.support.claim")}</button>` : ''}
          ${t.status === "in_progress" && t.assignedTo === (user?.id || user?.sub) ? `<button class="btn btn--dark" data-action="resolve-report" data-id="${e(t.id)}">${text("admin.support.resolve")}</button>` : ''}
        </article>`,
          )
          .join("")}</div>`
        : requests ? `<p class="helper-text">${text("admin.support.empty")}</p>` : `<p role="alert">${text("admin.support.unavailable")}</p>`
      }
      </div>
    </div></section>`;
  }

  return { adminPage };
}
