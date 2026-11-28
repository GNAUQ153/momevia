import { message, setAttr, t } from '../core/i18n.js';
import { clearAuthReturn } from '../core/auth-return.js';
import { icon } from '../ui/icons.js';
import { scrollBehavior } from '../core/motion.js';

// Nhóm hành động shell; nhận dependency từ Application Controller.
export function createShellActions({
  api,
  toast,
  render,
  navigate,
  openSupport,
  closeModal,
  setAccountMenu,
  setMobileMenu,
  header,
  getRouteController,
  clearRouteController,
  setUser,
}) {
  return [
    [["report-content"], async (action, element) => {
      return openSupport({ kind: element.dataset.kind, id: element.dataset.id });
    }],
    [["claim-report", "resolve-report"], async (action, element) => {
      const claim = action === "claim-report";
      const resolution = claim ? null : window.prompt(t("admin.support.prompt"));
      if (!claim && !resolution?.trim()) return;
      await api.post(`/support/admin/requests/${encodeURIComponent(element.dataset.id)}/resolve`, { action: claim ? "claim" : "resolve", resolution });
      await render();
      return;
    }],
    [["login"], async (action, element) => {
      return navigate("/login");
    }],
    [["register"], async (action, element) => {
      return navigate("/register");
    }],
    [["support"], async (action, element) => {
      return openSupport(undefined, { withdrawal: element.dataset.privacyWithdrawal === "true" });
    }],
    [["back-to-top"], async (action, element) => {
      window.scrollTo({ top: 0, behavior: scrollBehavior() });
      return;
    }],
    [["demo-mode"], async (action, element) => {
      const demo = document.getElementById("auth-demo");
      if (demo) {
        demo.hidden = !demo.hidden;
        demo.querySelector("input")?.focus();
      }
      return;
    }],
    [["toggle-password"], async (action, element) => {
      const input = element.parentElement?.querySelector("input");
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
      const showing = input.type === "text";
      element.innerHTML = icon(showing ? "eye-off" : "eye", 19);
      setAttr(
        element,
        "aria-label",
        message(showing ? "auth.password.hide" : "auth.password.show"),
      );
      element.setAttribute("aria-pressed", String(showing));
      return;
    }],
    [["close-modal"], async (action, element) => {
      return closeModal();
    }],
    [["account-menu"], async (action, element) => {
      const menu = document.getElementById('mobile-nav');
      if (menu && !menu.hidden) setMobileMenu(header.querySelector('[data-action="toggle-menu"]'), menu, false);
      return setAccountMenu(element.getAttribute('aria-expanded') !== 'true');
    }],
    [["toggle-menu"], async (action, element) => {
      const menu = document.getElementById("mobile-nav");
      setAccountMenu(false);
      setMobileMenu(element, menu, menu.hidden);
      return;
    }],
    [["logout"], async (action, element) => {
      const routeController = getRouteController();
      if (routeController?.beforeLeave && !routeController.beforeLeave()) return;
      routeController?.dispose?.();
      clearRouteController();
      await api.post("/auth/logout");
      clearAuthReturn();
      setUser(null);
      toast(message("auth.logout.done"));
      navigate("/");
      return;
    }],
  ];
}
