import { escapeHtml as e, formatPrice } from "../core/api.js";
import { icon } from "../ui/icons.js";

export function createCreatorViews({ state }) {
  function creatorPage(templates = []) {
    const creator =
      state.user && ["creator", "admin"].includes(state.user.role);
    return `<section class="creator-hero"><div class="container creator-hero__inner"><div><span class="eyebrow">MOMEVIA FOR CREATORS</span><h1>Biến sự sáng tạo<br><em>thành những món quà.</em></h1><p>Mỗi thiết kế độc đáo xứng đáng đến được với đúng người. Đăng mẫu, quản lý gian hàng và để ý tưởng của bạn được yêu mến.</p>
        ${creator ? `<a href="#creator-form" class="btn btn--light">Đăng mẫu mới ${icon("arrow", 18)}</a>` : `<p class="helper-text">${state.user ? "Liên hệ quản trị viên để được cấp quyền Creator." : "Đăng nhập bằng tài khoản được quản trị viên cấp quyền Creator để đăng mẫu."}</p>`}
        <div class="creator-perks"><span>${icon("check-circle", 17)} Đăng mẫu miễn phí</span><span>${icon("check-circle", 17)} Kiểm duyệt minh bạch</span><span>${icon("check-circle", 17)} Quản lý riêng</span></div>
      </div><div class="creator-art">${icon("pencil", 120)}<span>${icon("sparkles", 62)}</span></div></div></section>
      ${
        creator
          ? `<section class="section" id="creator-form"><div class="container creator-grid"><div><span class="eyebrow">ĐĂNG MẪU SÁNG TẠO</span><h2>Thiết kế tiếp theo<br><em>của bạn.</em></h2><p class="section-intro">Hiện tại, bạn có thể gửi mẫu dựa trên các bố cục tương tác có sẵn. Công cụ thiết kế tự do đang được phát triển.</p>
        <form class="creator-form" id="creator-template-form"><label class="field"><span>Tên mẫu</span><input name="title" required maxlength="60" placeholder="Ví dụ: Lời chúc bên hiên"/></label>
        <label class="field"><span>Mô tả ngắn</span><textarea name="subtitle" required maxlength="140" rows="3" placeholder="Một điều đặc biệt về thiết kế của bạn"></textarea></label>
        <div class="form-row"><label class="field"><span>Bảng màu chủ đạo</span><select name="theme"><option value="violet">Tím mộng mơ</option><option value="rose">Hồng tình cảm</option><option value="sunshine">Vàng rực rỡ</option><option value="sage">Xanh thiên nhiên</option><option value="sky">Xanh dịu nhẹ</option><option value="peach">Cam đào</option></select></label><label class="field"><span>Giá bán (VND)</span><input type="number" name="price" min="0" max="500000" step="1000" value="39000" required/></label></div>
        <p class="helper-text">Mẫu mới chuyển trạng thái “Chờ duyệt”. Chỉ xuất hiện trong thư viện sau khi được quản trị viên phê duyệt.</p>
        <button class="btn btn--dark" type="submit">Gửi mẫu để kiểm duyệt ${icon("arrow", 18)}</button></form></div>
        <div class="creator-list"><h3>Mẫu của bạn <span>(${templates.length})</span></h3>${templates.length ? templates.map((t) => `<div class="creator-list__row"><div class="mini-theme mini-theme--${e(t.theme)}">${icon("sparkles", 19)}</div><div><strong>${e(t.title)}</strong><small>${formatPrice(t.price)}</small></div><span class="status-pill status-pill--${e(t.status)}">${t.status === "published" ? "Đã đăng" : t.status === "rejected" ? "Bị từ chối" : "Chờ duyệt"}</span></div>`).join("") : '<p class="creator-empty">Bạn chưa gửi mẫu nào. Hãy bắt đầu từ ý tưởng đầu tiên.</p>'}</div>
      </div></section>`
          : `<section class="section"><div class="container creator-benefits"><div class="section-heading section-heading--center"><span class="eyebrow">CÙNG MOMEVIA BẮT ĐẦU</span><h2>Một không gian cho <em>người sáng tạo.</em></h2></div><div class="steps-grid"><article class="step-card">${icon("pencil", 30)}<h3>Thiết kế của riêng bạn</h3><p>Tạo phong cách khác biệt và xây dựng bộ sưu tập mẫu.</p></article><article class="step-card">${icon("layers", 30)}<h3>Gian hàng rõ ràng</h3><p>Theo dõi trạng thái đăng mẫu và quản lý nội dung.</p></article><article class="step-card">${icon("heart", 30)}<h3>Chạm tới cảm xúc</h3><p>Mỗi mẫu có cơ hội trở thành một kỷ niệm thật đẹp.</p></article></div></div></section>`
      }`;
  }

  return { creatorPage };
}
