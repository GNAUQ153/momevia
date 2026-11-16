import { icon } from '../ui/icons.js';


export function createAuthViews({ state, buttonLink }) {
  function authPage(mode = 'login') {
    const registering = mode === 'register';
    if (state.user) return `<section class="auth-page"><div class="container auth-signed-in"><div class="auth-signed-in__icon">${icon('check-circle', 30)}</div><h1>Bạn đã đăng nhập</h1><p>Tiếp tục khám phá và tạo món quà theo cách riêng của bạn.</p>${buttonLink('/studio', 'Về không gian của tôi')}</div></section>`;
    const googleLogo = 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg';
    const zaloLogo = 'https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg';
    const social = (provider, enabled, label, logo) => enabled
      ? `<a class="auth-social" href="/api/auth/${provider}" aria-label="${registering ? 'Đăng ký' : 'Đăng nhập'} bằng ${label}"><img class="provider-logo" src="${logo}" alt=""/><span>${label}</span></a>`
      : `<button type="button" class="auth-social" disabled title="${label} chưa được kết nối" aria-label="${label} chưa được kích hoạt"><img class="provider-logo" src="${logo}" alt=""/><span>${label}</span></button>`;
    const passwordField = (name, label, autocomplete) => `<label class="auth-field"><span class="auth-field__label">${label} <span class="auth-required" aria-hidden="true">*</span></span>
      <span class="auth-input"><span class="auth-field-icon" aria-hidden="true">${icon('lock', 19)}</span>
        <input name="${name}" type="password" autocomplete="${autocomplete}" minlength="${registering ? 10 : 1}" maxlength="128" required placeholder="${registering ? 'Tối thiểu 10 ký tự' : 'Nhập mật khẩu'}"/>
        <button type="button" class="auth-toggle-password" data-action="toggle-password" aria-label="Hiện mật khẩu" aria-pressed="false">${icon('eye',20)}</button>
      </span></label>`;
    return `<section class="auth-page auth-page--${mode}"><div class="container auth-layout">
      <aside class="auth-showcase" aria-label="Giới thiệu Momevia">
        <div class="auth-showcase__top"><img src="/assets/momevia-icon-128.png" width="43" height="43" alt=""/><span>momevia<span class="auth-showcase__dot">.</span></span></div>
        <div class="auth-showcase__art" aria-hidden="true">
          <div class="auth-showcase__halo auth-showcase__halo--outer"></div>
          <div class="auth-showcase__halo auth-showcase__halo--inner"></div>
          <span class="auth-showcase__spark auth-showcase__spark--one">${icon('sparkles', 31)}</span>
          <span class="auth-showcase__spark auth-showcase__spark--two">${icon('heart', 28)}</span>
          <img src="/assets/momevia-logo-3d.png" alt="" loading="eager" width="330" height="330"/>
        </div>
        <div class="auth-showcase__story">
          <span class="auth-showcase__eyebrow">MỘT ĐIỀU NHỎ THẬT ĐÁNG NHỚ</span>
          <h2>Gửi điều thương.<br/><em>Giữ kỷ niệm.</em></h2>
          <p>Chọn một thiết kế bạn yêu, thêm lời nhắn riêng và trao đi khoảnh khắc khiến ai đó mỉm cười.</p>
          <div class="auth-showcase__benefits"><span>${icon('check-circle',17)} Quà tặng mang dấu ấn riêng</span><span>${icon('check-circle',17)} Lưu lại những mẫu yêu thích</span></div>
        </div>
      </aside>
      <div class="auth-panel">
        <div class="auth-panel__top"><a href="/" data-link class="auth-back">${icon('arrow-left',17)} Trang chủ</a>
          <span class="auth-panel__welcome">${registering ? 'THAM GIA MOMEVIA' : 'TÀI KHOẢN MOMEVIA'}</span></div>
        <div class="auth-panel__intro"><h1>${registering ? 'Tạo tài khoản của bạn' : 'Rất vui khi bạn quay lại!'}</h1>
          <p class="auth-lead">${registering ? 'Chỉ vài bước để bắt đầu lưu mẫu, tạo quà và lưu giữ những kỷ niệm đẹp.' : 'Đăng nhập để tiếp tục tạo quà và xem lại những mẫu bạn đã lưu.'}</p></div>
        <form id="${registering ? 'register-form' : 'email-login-form'}" class="auth-form" aria-label="${registering ? 'Đăng ký tài khoản' : 'Đăng nhập tài khoản'}">
          ${registering ? `<label class="auth-field"><span class="auth-field__label">Họ và tên <span class="auth-required" aria-hidden="true">*</span></span>
            <span class="auth-input"><span class="auth-field-icon" aria-hidden="true">${icon('user',19)}</span><input name="name" autocomplete="name" minlength="2" maxlength="50" required placeholder="Tên hiển thị của bạn"/></span></label>` : ''}
          <label class="auth-field"><span class="auth-field__label">Email <span class="auth-required" aria-hidden="true">*</span></span>
            <span class="auth-input"><span class="auth-field-icon" aria-hidden="true">${icon('mail',19)}</span><input name="email" type="email" autocomplete="email" inputmode="email" maxlength="254" required placeholder="tenban@example.com"/></span></label>
          ${passwordField('password', 'Mật khẩu', registering ? 'new-password' : 'current-password')}
          ${registering ? passwordField('confirmPassword', 'Xác nhận mật khẩu', 'new-password') : ''}
          ${registering ? `<p class="auth-password-hint">${icon('shield',16)} Mật khẩu ít nhất 10 ký tự, có chữ cái và số.</p>` : ''}
          <p class="auth-inline-error" role="alert" hidden></p>
          <button class="btn btn--dark btn--wide auth-submit" type="submit"><span>${registering ? 'Tạo tài khoản' : 'Đăng nhập'}</span>${icon('arrow',18)}</button>
        </form>
        <div class="auth-divider" role="separator"><span>Hoặc ${registering ? 'đăng ký' : 'đăng nhập'} bằng</span></div>
        <div class="auth-buttons">${social('google', state.providers.google, 'Google', googleLogo)}${social('zalo', state.providers.zalo, 'Zalo', zaloLogo)}</div>
        ${!state.providers.google || !state.providers.zalo ? '<p class="auth-provider-note">Phương thức chưa kết nối sẽ được kích hoạt khi hệ thống hỗ trợ.</p>' : ''}
        <p class="auth-switch">${registering ? 'Bạn đã có tài khoản?' : 'Bạn chưa có tài khoản?'} <a href="${registering ? '/login' : '/register'}" data-link>${registering ? 'Đăng nhập ngay' : 'Đăng ký ngay'}</a></p>
        <p class="auth-policy-note">Bằng việc tiếp tục, bạn đồng ý với <a href="/policies/general" data-link>Quy định chung</a> và <a href="/policies/privacy" data-link>Chính sách bảo mật</a>.</p>
      </div>
    </div></section>`;
  }

  return { authPage };
}
