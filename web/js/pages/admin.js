import { escapeHtml as e, formatPrice } from "../core/api.js";
import { icon } from "../ui/icons.js";

export function createAdminViews() {
  function adminPage(templates, requests = [], user, queue = []) {
    return `<section class="page-banner"><div class="container"><span class="eyebrow">MOMEVIA ADMIN</span><h1>Kiểm duyệt <em>mẫu thiết kế.</em></h1><p>Chỉ duyệt mẫu có nội dung phù hợp và quyền sử dụng tài nguyên hợp lệ.</p></div></section><section class="section"><div class="container"><h2 class="admin-title">Mẫu đang chờ duyệt (${templates.length})</h2>
      ${templates.length ? `<div class="admin-list">${templates.map((t) => `<article class="admin-row"><div class="mini-theme mini-theme--${e(t.theme)}">${icon("sparkles", 22)}</div><div><h3>${e(t.title)}</h3><p>${e(t.subtitle)}</p><small>${e(t.creator)} · ${formatPrice(t.price)}</small></div><div class="admin-actions"><button class="btn btn--dark" data-action="approve-template" data-id="${e(t.id)}">${icon("check", 17)} Duyệt</button><button class="btn btn--outline" data-action="reject-template" data-id="${e(t.id)}">Từ chối</button></div></article>`).join("")}</div>` : `<div class="empty-state empty-state--panel">${icon("check-circle", 42)}<h3>Đã xử lý tất cả mẫu</h3><p>Không có thiết kế nào đang chờ phê duyệt.</p></div>`}

      <h2 class="admin-title">Phiên bản Creator đang chờ (${queue.length})</h2>
      <div class="admin-list">${queue.map(item => `<article class="admin-row"><div><h3>${e(item.title)}</h3><p>${e(item.creator)}</p></div><a class="btn btn--dark" href="/admin/review/${e(item.templateId)}/${e(item.versionId)}" data-link>Mở phiên bản để duyệt</a></article>`).join("")}</div>
      <div class="support-admin"><h2 class="admin-title">Yêu cầu hỗ trợ (${requests.length})</h2>
        ${
          requests.length
            ? `<div class="support-admin__list">${requests
                .map(
                  (t) => `<article class="support-admin__item">
          <strong>${e(t.code)} · ${e(t.topic)}</strong><span>${e(t.name)} · ${e(t.email)}</span>
          <p>${e(t.message)}</p><small>${new Date(t.createdAt).toLocaleString("vi-VN")}</small>
          ${t.reportKind ? `<p>${t.reportKind === "gift" ? "Quà" : "Mẫu"} · ${e(t.reportTarget)} · ${e(({ new: "Mới", in_progress: "Đang xử lý", resolved: "Đã xử lý" })[t.status])}</p>
          ${t.assignedTo ? `<p>Người xử lý: ${e(t.assignedTo === (user?.id || user?.sub) ? user.name : t.assignedTo)}</p>` : ''}
          ${t.resolution ? `<p>Kết quả: ${e(t.resolution)}</p>` : ''}
          ${t.status === "new" ? `<button class="btn btn--outline" data-action="claim-report" data-id="${e(t.id)}">Nhận xử lý</button>` : ''}
          ${t.status === "in_progress" && t.assignedTo === (user?.id || user?.sub) ? `<button class="btn btn--dark" data-action="resolve-report" data-id="${e(t.id)}">Ghi kết quả</button>` : ''}` : ''}
        </article>`,
                )
                .join("")}</div>`
            : '<p class="helper-text">Chưa có yêu cầu hỗ trợ mới.</p>'
        }
      </div>
    </div></section>`;
  }

  return { adminPage };
}
