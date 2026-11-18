import { escapeHtml as e, formatPrice } from "../core/api.js";
import { icon } from "../ui/icons.js";

export function createAdminViews() {
  function adminPage(templates, requests = [], user, queue = []) {
    const total = (templates?.length || 0) + (queue?.length || 0);
    const complete = templates !== null && queue !== null;
    const waiting = (queue || []).map(item => ({ ...item, version: true })).concat(templates || [])
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const date = value => value ? ` · ${new Date(value).toLocaleString('vi-VN')}` : '';
    return `<section class="section"><div class="container"><h1>Kiểm duyệt mẫu thiết kế</h1>
      <p><a class="btn btn--outline" href="/admin/payments" data-link>Giám sát thanh toán chờ &amp; đối soát</a></p>
      <h2 class="admin-title">Cần duyệt (${total}${complete ? '' : '+'})</h2>
      ${templates === null ? '<p role="alert">Chưa tải được hàng đợi mẫu cũ.</p>' : ''}
      ${queue === null ? '<p role="alert">Chưa tải được hàng đợi phiên bản Creator.</p>' : ''}
      ${!complete ? '<button class="btn btn--outline" data-action="retry-admin-queues">Thử lại hàng đợi</button>' : ''}
      ${total ? `<div class="admin-list">${waiting.map(item => item.version
      ? `<article class="admin-row"><div><h3>${e(item.title)}</h3><p>Creator · r${Number(item.revision)}${date(item.createdAt)}</p><small>${e(item.creator)}</small></div><a class="btn btn--dark" href="/admin/review/${e(item.templateId)}/${e(item.versionId)}" data-link>Mở phiên bản để duyệt</a></article>`
      : `<article class="admin-row"><div class="mini-theme mini-theme--${e(item.theme)}">${icon("sparkles", 22)}</div><div><h3>${e(item.title)}</h3><p>${e(item.subtitle)}</p><small>Mẫu cũ · ${e(item.creator)} · ${formatPrice(item.price)}${date(item.createdAt)}</small></div><div class="admin-actions"><button class="btn btn--dark" data-action="approve-template" data-id="${e(item.id)}">${icon("check", 17)} Duyệt</button><button class="btn btn--outline" data-action="reject-template" data-id="${e(item.id)}">Từ chối</button></div></article>`).join("")}</div>`
        : complete ? `<div class="empty-state empty-state--panel">${icon("check-circle", 42)}<h3>Đã xử lý tất cả mẫu</h3><p>Không có thiết kế nào đang chờ phê duyệt.</p></div>` : ''}
      <div class="support-admin"><h2 class="admin-title">Yêu cầu hỗ trợ${requests ? ` (${requests.length})` : ''}</h2>
        ${requests?.length
        ? `<div class="support-admin__list">${requests
          .map(
            (t) => `<article class="support-admin__item">
          <strong>${e(t.code)} · ${e(t.topic)}</strong><span>${e(t.name)} · ${e(t.email)}</span>
          <p>${e(t.message)}</p><small>${new Date(t.createdAt).toLocaleString("vi-VN")}</small>
          ${t.reportKind ? `<p>Báo cáo ${t.reportKind === "gift" ? "quà" : "mẫu"} · ${e(t.reportTarget)}</p>` : ''}
          <p>Trạng thái: ${e(({ new: "Mới", in_progress: "Đang xử lý", resolved: "Đã xử lý" })[t.status] || t.status)}</p>
          ${t.assignedTo ? `<p>Người xử lý: ${e(t.assignedTo === (user?.id || user?.sub) ? user.name : t.assignedTo)}</p>` : ''}
          ${t.resolution ? `<p>Kết quả: ${e(t.resolution)}</p>` : ''}
          ${t.status === "new" ? `<button class="btn btn--outline" data-action="claim-report" data-id="${e(t.id)}">Nhận xử lý</button>` : ''}
          ${t.status === "in_progress" && t.assignedTo === (user?.id || user?.sub) ? `<button class="btn btn--dark" data-action="resolve-report" data-id="${e(t.id)}">Ghi kết quả</button>` : ''}
        </article>`,
          )
          .join("")}</div>`
        : requests ? '<p class="helper-text">Chưa có yêu cầu hỗ trợ mới.</p>' : '<p role="alert">Chưa tải được yêu cầu hỗ trợ.</p>'
      }
      </div>
    </div></section>`;
  }

  return { adminPage };
}
