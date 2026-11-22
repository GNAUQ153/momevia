import { attr, text } from "../core/i18n.js";
import { icon } from "../ui/icons.js";

export function createAuthViews({ state, buttonLink }) {
  function authPage(mode = "login") {
    const registering = mode === "register";
    if (state.user)
      return `<section class="auth-page"><div class="container auth-signed-in"><div class="auth-signed-in__icon">${icon("check-circle", 30)}</div><h1>${text("auth.signedIn.title")}</h1><p>${text("auth.signedIn.description")}</p>${buttonLink("/studio", text("auth.signedIn.studio"))}</div></section>`;

    const providerLogo = provider => {
      if (provider === "google") {
        return `<span class="auth-provider-logo auth-provider-logo--google" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65Z"></path>
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.1-6.72-4.93H1.29v3.1A12 12 0 0 0 12 24Z"></path>
            <path fill="#FBBC05" d="M5.28 14.31A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.38-2.31v-3.1H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.41l3.99-3.1Z"></path>
            <path fill="#EA4335" d="M12 4.77c1.76 0 3.33.61 4.57 1.81l3.43-3.43C17.94 1.08 15.24 0 12 0A12 12 0 0 0 1.29 6.59l3.99 3.1c.95-2.83 3.6-4.92 6.72-4.92Z"></path>
          </svg>
        </span>`;
      }
      return `<span class="auth-provider-logo auth-provider-logo--zalo" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <rect x="1.5" y="1.5" width="21" height="21" rx="10.5" fill="#fff" stroke="#0A6CFF" stroke-width="1.5"></rect>
          <path fill="#0A6CFF" d="M7.2 8.25h9.6v1.75l-6.12 5.76h6.12v1.99H7.02v-1.8l6.05-5.71H7.2z"></path>
        </svg>
      </span>`;
    };

    // Trang đăng ký tập trung hoàn tất biểu mẫu email. Chỉ trang đăng nhập mới hiển thị OAuth.
    const providers = [
      { id: "google", label: "Google", enabled: state.providers?.google === true },
      { id: "zalo", label: "Zalo", enabled: state.providers?.zalo === true },
    ];
    const providerButton = ({ id, label, enabled }) => {
      const content = `${providerLogo(id)}<span>${text("auth.providers.signInWith", { provider: label })}</span>`;
      return enabled
        ? `<a class="auth-social" href="/api/auth/${id}" data-auth-provider="${id}" ${attr("aria-label", "auth.providers.signInWith", { provider: label })}>${content}</a>`
        : `<button type="button" class="auth-social auth-social--disabled" data-auth-provider="${id}" disabled ${attr("aria-label", "auth.providers.notEnabled", { provider: label })} ${attr("title", "auth.providers.notEnabled", { provider: label })}>${content}</button>`;
    };
    const socialSection = !registering ? `<div class="auth-divider auth-divider--social" role="separator"><span>${text("auth.providers.orSocialLogin")}</span></div>
    <div class="auth-oauth" role="group" ${attr("aria-label", "auth.providers.title")}>
      <div class="auth-buttons">${providers.map(providerButton).join("")}</div>
      ${providers.some(provider => !provider.enabled) ? `<p class="auth-provider-note" role="status">${text("auth.providers.unavailableHint")}</p>` : ""}
    </div>` : "";
    const passwordField = (
      name,
      label,
      autocomplete,
    ) => `<label class="auth-field"><span class="auth-field__label">${label} <span class="auth-required" aria-hidden="true">*</span></span>
      <span class="auth-input"><span class="auth-field-icon" aria-hidden="true">${icon("lock", 19)}</span>
        <input name="${name}" type="password" autocomplete="${autocomplete}" minlength="${registering ? 8 : 1}" maxlength="128" required ${attr("placeholder", registering ? "auth.password.minimum" : "auth.password.placeholder")}/>
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
          <a class="auth-showcase__explore" href="/explore" data-link>${text("shell.nav.explore")} ${icon("arrow", 16)}</a>
        </div>
      </aside>
      <div class="auth-panel">
        <div class="auth-panel__brand" aria-label="Momevia"><img src="/assets/momevia-icon-128.png" width="40" height="40" alt=""/><span>momevia<span class="auth-showcase__dot">.</span></span></div>
        <div class="auth-panel__top"><a href="/" data-link class="auth-back">${icon("arrow-left", 17)} ${text("shell.nav.home")}</a>
          <span class="auth-panel__welcome">${registering ? text("auth.register.badge") : text("auth.login.badge")}</span></div>
        <div class="auth-panel__intro"><h1 id="auth-page-title">${registering ? text("auth.register.title") : text("auth.login.title")}</h1>
          <p class="auth-lead">${registering ? text("auth.register.lead") : text("auth.login.lead")}</p></div>
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
        ${socialSection}
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
        ${verify ? '' : `<label class="field"><span>${text("auth.recovery.newPassword")}</span><input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required/></label><label class="field"><span>${text("auth.recovery.confirmPassword")}</span><input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" required/></label>`}
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
