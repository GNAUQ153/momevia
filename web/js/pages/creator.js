import { escapeHtml as e, formatPrice } from "../core/api.js";
import { icon } from "../ui/icons.js";

export function createCreatorViews({ state }) {
  function creatorPage(templates = [], legacy = []) {
    const creator =
      state.user && ["creator", "admin"].includes(state.user.role);
    return `<section class="creator-hero"><div class="container creator-hero__inner"><div><span class="eyebrow">MOMEVIA FOR CREATORS</span><h1>Biến sự sáng tạo<br><em>thành những món quà.</em></h1><p>Mỗi thiết kế độc đáo xứng đáng đến được với đúng người. Đăng mẫu, quản lý gian hàng và để ý tưởng của bạn được yêu mến.</p>
        ${creator ? `<a href="#creator-form" class="btn btn--light">Đăng mẫu mới ${icon("arrow", 18)}</a>` : `<p class="helper-text">${state.user ? "Liên hệ quản trị viên để được cấp quyền Creator." : "Đăng nhập bằng tài khoản được quản trị viên cấp quyền Creator để đăng mẫu."}</p>`}
        <div class="creator-perks"><span>${icon("check-circle", 17)} Đăng mẫu miễn phí</span><span>${icon("check-circle", 17)} Kiểm duyệt minh bạch</span><span>${icon("check-circle", 17)} Quản lý riêng</span></div>
      </div><div class="creator-art">${icon("pencil", 120)}<span>${icon("sparkles", 62)}</span></div></div></section>
      ${creator
        ? `<section class="section" id="creator-form"><div class="container creator-grid"><div><h2>Tạo mẫu sinh nhật</h2><p class="section-intro">Chỉnh cảnh, thêm ảnh demo và chọn vùng người gửi được cá nhân hóa trước khi gửi duyệt.</p>
        <form class="creator-form" id="creator-template-form"><label class="field"><span>Tên mẫu</span><input name="title" required maxlength="60" placeholder="Ví dụ: Lời chúc bên hiên"/></label>
        <label class="field"><span>Mô tả ngắn</span><textarea name="subtitle" required maxlength="140" rows="3" placeholder="Một điều đặc biệt về thiết kế của bạn"></textarea></label>
        <button class="btn btn--dark" type="submit">Tạo nháp mẫu</button></form></div>
        <div class="creator-list"><h3>Mẫu của tôi</h3>${templates.length ? templates.map(t => `<article class="my-gift"><div class="my-gift-detail"><strong>${e(t.title)}</strong><p>${e(t.subtitle)}</p>
          ${t.withdrawn ? '<p>Đã rút khỏi thư viện</p>' : ''}
          ${t.versions.slice().reverse().map(v => `<p>Bản r${v.revision} · ${({ pending: "Chờ duyệt", approved: "Đã duyệt", changes_requested: "Cần sửa" })[v.status]}${v.reason ? ` · ${e(v.reason)}` : ""}</p>`).join("")}</div>
          <div class="my-gift-actions"><a class="btn btn--outline" href="/design/${e(t.creatorDesignId)}" data-link>Mở nháp</a><button class="btn btn--outline" data-action="duplicate-template" data-id="${e(t.id)}">Nhân bản mẫu</button>
          ${t.versionId && !t.withdrawn ? `<button class="btn btn--outline" data-action="withdraw-template" data-id="${e(t.id)}">Rút khỏi thư viện</button>` : ''}</div></article>`).join("") : '<p class="creator-empty">Bạn chưa có nháp mẫu.</p>'}
          ${legacy.length ? `<h3>Mẫu đã tạo trước đây</h3>${legacy.map(t => `<p>${e(t.title)} · ${formatPrice(t.price)}${t.rejectionReason ? ` · ${e(t.rejectionReason)}` : ''}</p>`).join("")}` : ''}</div>
      </div></section>`
        : `<section class="section"><div class="container creator-benefits"><div class="section-heading section-heading--center"><span class="eyebrow">CÙNG MOMEVIA BẮT ĐẦU</span><h2>Một không gian cho <em>người sáng tạo.</em></h2></div><div class="steps-grid"><article class="step-card">${icon("pencil", 30)}<h3>Thiết kế của riêng bạn</h3><p>Tạo phong cách khác biệt và xây dựng bộ sưu tập mẫu.</p></article><article class="step-card">${icon("layers", 30)}<h3>Gian hàng rõ ràng</h3><p>Theo dõi trạng thái đăng mẫu và quản lý nội dung.</p></article><article class="step-card">${icon("heart", 30)}<h3>Chạm tới cảm xúc</h3><p>Mỗi mẫu có cơ hội trở thành một kỷ niệm thật đẹp.</p></article></div></div></section>`
      }`;
  }

  return { creatorPage };
}
