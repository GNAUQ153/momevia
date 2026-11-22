import { attr, text } from "../core/i18n.js";
import { icon } from "../ui/icons.js";

export function createAuthViews({ state, buttonLink }) {
  function authPage(mode = "login") {
    const registering = mode === "register";
    if (state.user)
      return `<section class="auth-page"><div class="container auth-signed-in"><div class="auth-signed-in__icon">${icon("check-circle", 30)}</div><h1>${text("auth.signedIn.title")}</h1><p>${text("auth.signedIn.description")}</p>${buttonLink("/studio", text("auth.signedIn.studio"))}</div></section>`;
    // Luôn hiển thị lựa chọn Google/Zalo, kể cả khi môi trường chưa cấu hình OAuth.
    // Không tạo đường dẫn đăng nhập nếu server không xác nhận phương thức sẵn sàng.
    const providers = [
      { id: "google", label: "Google", enabled: state.providers?.google === true, symbol: "G" },
      { id: "zalo", label: "Zalo", enabled: state.providers?.zalo === true, symbol: "Z" },
    ];
    const providerButton = ({ id, label, enabled, symbol }) => {
      const content = `<span class="auth-provider-symbol auth-provider-symbol--${id}" aria-hidden="true">${symbol}</span><span>${text(registering ? "auth.providers.registerWith" : "auth.providers.signInWith", { provider: label })}</span>`;
      return enabled
        ? `<a class="auth-social" href="/api/auth/${id}" data-auth-provider="${id}" ${attr("aria-label", registering ? "auth.providers.registerWith" : "auth.providers.signInWith", { provider: label })}>${content}</a>`
        : `<button type="button" class="auth-social auth-social--disabled" data-auth-provider="${id}" disabled ${attr("aria-label", "auth.providers.notEnabled", { provider: label })} ${attr("title", "auth.providers.notEnabled", { provider: label })}>${content}</button>`;
    };
    const socialSection = `<div class="auth-oauth" ${attr("aria-label", "auth.providers.title")}>
      <div class="auth-buttons">${providers.map(providerButton).join("")}</div>
      ${providers.some(provider => !provider.enabled) ? `<p class="auth-provider-note" role="status">${text("auth.providers.unavailableHint")}</p>` : ""}
    </div>
    <div class="auth-divider" role="separator"><span>${text("auth.providers.emailInstead")}</span></div>`;
    const passwordField = (
      name,
      label,
      autocomplete,
    ) => `<label class="auth-field"><span class="auth-field__label">${label} <span class="auth-required" aria-hidden="true">*</span></span>
      <span class="auth-input"><span class="auth-field-icon" aria-hidden="true">${icon("lock", 19)}</span>
        <input name="${name}" type="password" autocomplete="${autocomplete}" minlength="${registering ? 10 : 1}" maxlength="128" required ${attr("placeholder", registering ? "auth.password.minimum" : "auth.password.placeholder")}/>
        <button type="button" class="auth-toggle-password" data-action="toggle-password" ${attr("aria-label", "auth.password.show")} aria-pressed="false">${icon("eye", 20)}</button>
      </span></label>`;
    return `<section class="auth-page auth-page--${registering ? "register" : "login"}" aria-labelledby="auth-page-title"><div class="container auth-layout">
      <aside class="auth-showcase" ${attr("aria-label", "auth.showcase.about")}>
        <div class="auth-showcase__top"><img src="/assets/momevia-icon-128.png" width="43" height="43" alt=""/><span>momevia<span class="auth-showcase__dot">.</span></span></div>
        <div class="auth-showcase__art" aria-hidden="true">
          <div class="auth-showcase__halo auth-showcase__halo--outer"></div>
          <div class="auth-showcase__halo auth-showcase__halo--inner"></div>
          <span class="auth-showcase__spark auth-showcase__spark--one">${icon("sparkles", 31)}</span>
          <span class="auth-showcase__spark auth-showcase__spark--two">${icon("heart", 28)}</span>
          <img src="/assets/momevia-logo-3d.png" alt="" loading="eager" width="330" height="330"/>
        </div>
        <div class="auth-showcase__story">
          <span class="auth-showcase__eyebrow">${text("auth.showcase.eyebrow")}</span>
          <h2>${text("auth.showcase.lineOne")}<br/><em>${text("auth.showcase.lineTwo")}</em></h2>
          <p>${text("auth.showcase.description")}</p>
          <div class="auth-showcase__benefits"><span>${icon("check-circle", 17)} ${text("auth.showcase.personal")}</span><span>${icon("check-circle", 17)} ${text("auth.showcase.favorites")}</span></div>
        </div>
      </aside>
      <div class="auth-panel">
        <div class="auth-panel__brand" aria-label="Momevia"><img src="/assets/momevia-icon-128.png" width="40" height="40" alt=""/><span>momevia<span class="auth-showcase__dot">.</span></span></div>
        <div class="auth-panel__top"><a href="/" data-link class="auth-back">${icon("arrow-left", 17)} ${text("shell.nav.home")}</a>
          <span class="auth-panel__welcome">${registering ? text("auth.register.badge") : text("auth.login.badge")}</span></div>
        <div class="auth-panel__intro"><h1 id="auth-page-title">${registering ? text("auth.register.title") : text("auth.login.title")}</h1>
          <p class="auth-lead">${registering ? text("auth.register.lead") : text("auth.login.lead")}</p></div>
        ${socialSection}
        <form id="${registering ? "register-form" : "email-login-form"}" class="auth-form" ${attr("aria-label", registering ? "auth.register.form" : "auth.login.form")}>
          ${registering
        ? `<label class="auth-field"><span class="auth-field__label">${text("auth.fields.fullName")} <span class="auth-required" aria-hidden="true">*</span></span>
            <span class="auth-input"><span class="auth-field-icon" aria-hidden="true">${icon("user", 19)}</span><input name="name" autocomplete="name" minlength="2" maxlength="50" required ${attr("placeholder", "auth.fields.displayName")}/></span></label>`
        : ""
      }
          <label class="auth-field"><span class="auth-field__label">${text("auth.fields.email")} <span class="auth-required" aria-hidden="true">*</span></span>
            <span class="auth-input"><span class="auth-field-icon" aria-hidden="true">${icon("mail", 19)}</span><input name="email" type="email" autocomplete="email" inputmode="email" maxlength="254" required ${attr("placeholder", "auth.fields.emailExample")}/></span></label>
          ${passwordField("password", text("auth.fields.password"), registering ? "new-password" : "current-password")}
          ${registering ? passwordField("confirmPassword", text("auth.fields.confirmPassword"), "new-password") : ""}
          ${registering ? `<p class="auth-password-hint">${icon("shield", 16)} ${text("auth.password.hint")}</p>` : `<p class="auth-recovery-link"><a href="/recover" data-link>${text("auth.recovery.link")}</a></p>`}
          <p class="auth-inline-error" role="alert" hidden></p>
          <button class="btn btn--dark btn--wide auth-submit" type="submit"><span>${text(registering ? "auth.register.submit" : "shell.pages.login")}</span>${icon("arrow", 18)}</button>
        </form>
        ${registering ? `<p class="auth-switch">${text("auth.register.haveAccount")} <a href="/login" data-link>${text("auth.login.switch")}</a></p>` : `<p class="auth-switch auth-switch--signup">${text("auth.login.noAccount")} <a href="/register" data-link>${text("auth.register.switch")}</a></p>`}
        <p class="auth-policy-note">${text("auth.policies.prefix")} <a href="/policies/general" data-link>${text("auth.policies.general")}</a> ${text("auth.policies.conjunction")} <a href="/policies/privacy" data-link>${text("shell.footer.privacy")}</a>.</p>
        <button type="button" class="btn btn--outline auth-support" data-action="support">${text("common.actions.support")}</button>
      </div>
    </div></section>`;
  }

  function recoveryPage({ verify = false, googleUnlinked = false } = {}) {
    if (verify && state.user?.provider !== "email")
      return `<section class="section"><div class="container"><h1>${text("auth.verify.title")}</h1><p>${text("auth.verify.signIn")}</p>${buttonLink("/login", text("shell.pages.login"))}</div></section>`;
    const enabled = state.providers.recoveryEmail && (!verify || !state.user.emailVerified);
    const code = `<label class="field"><span>${text("auth.recovery.code")}</span><input name="code" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" required/></label>`;
    const email = `<label class="field"><span>${text("auth.recovery.address")}</span><input name="email" type="email" maxlength="254" autocomplete="email" required/></label>`;
    return `<section class="section"><div class="container"><div class="auth-panel recovery-panel">
      <h1>${verify ? text("auth.verify.title") : text("auth.recovery.title")}</h1>
      ${verify && state.user.emailVerified ? `<p>${text("auth.verify.done")}</p>` : ''}
      ${googleUnlinked ? `<p role="alert">${text("auth.recovery.googleUnlinked")}</p>` : ''}
      ${enabled ? `<form id="recovery-request-form" data-verify="${verify}" class="auth-form">
        ${verify ? `<p>${text("auth.verify.destination")}</p>` : email}
        <p class="auth-inline-error" role="alert" hidden></p>
        <button class="btn btn--dark" type="submit">${text("auth.recovery.send")}</button>
      </form><p id="recovery-notice" role="status"></p>
      <form id="recovery-confirm-form" data-verify="${verify}" class="auth-form" hidden>
        ${!verify ? '<input type="hidden" name="email"/>' : ''}${code}
        ${verify ? '' : `<label class="field"><span>${text("auth.recovery.newPassword")}</span><input name="password" type="password" autocomplete="new-password" minlength="10" maxlength="128" required/></label><label class="field"><span>${text("auth.recovery.confirmPassword")}</span><input name="confirmPassword" type="password" autocomplete="new-password" minlength="10" maxlength="128" required/></label>`}
        <p class="auth-inline-error" role="alert" hidden></p>
        <button class="btn btn--dark" type="submit">${verify ? text("auth.verify.title") : text("auth.recovery.reset")}</button>
      </form>` : ''}
      ${!verify && state.providers.google ? `<p><a class="btn btn--outline" href="/api/auth/google?recover=1">${text("auth.recovery.useGoogle")}</a></p>` : ''}
      ${verify ? `<p>${buttonLink("/studio", text("auth.recovery.studio"), "btn--outline")}</p>` : `<p>${text("auth.recovery.help")}</p>`}
      <button type="button" class="btn btn--outline" data-action="support">${text("common.actions.support")}</button>
    </div></div></section>`;
  }

  return { authPage, recoveryPage };
}
