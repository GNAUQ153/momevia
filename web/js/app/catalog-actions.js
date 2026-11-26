import { attr, message, t, text } from '../core/i18n.js';
import { escapeHtml as e } from '../core/api.js';
import { icon } from '../ui/icons.js';
import { focusVisibleTarget } from '../core/motion.js';
import { paginateTemplates } from '../features/catalog/filter.js';

// Nhóm hành động catalog; nhận dependency từ Application Controller.
export function createCatalogActions({
  state,
  api,
  toast,
  render,
  openModal,
  navigate,
  requireLogin,
  saveFavorite,
  commitCatalogFilters,
  matchingTemplates,
  loadTemplates,
}) {
  return [
    [["duplicate-template", "withdraw-template"], async (action, element) => {
      const withdraw = action === "withdraw-template";
      if (withdraw && !window.confirm(t("creator.actions.confirmWithdraw"))) return;
      element.disabled = true;
      try {
        const body = withdraw ? {} : { mutationId: element.dataset.mutation || (element.dataset.mutation = crypto.randomUUID()) };
        const result = await api.post(`/catalog/creator/workspaces/${encodeURIComponent(element.dataset.id)}/${withdraw ? "withdraw" : "duplicate"}`, body);
        if (withdraw) return render();
        navigate(`/design/${encodeURIComponent(result.id)}`);
      } finally { element.disabled = false; }
      return;
    }],
    [["creator-jump"], async (action, element) => {
      const target = document.getElementById(element.getAttribute('href')?.slice(1));
      if (target?.closest('.creator-space')) focusVisibleTarget(target, { block: 'start' });
      return;
    }],
    [["creator-login"], async (action, element) => {
      return requireLogin('/creator');
    }],
    [["toggle-favorite"], async (action, element) => {
      const templateId = element.dataset.id;
      if (!state.user) {
        requireLogin(location.pathname + location.search + location.hash, templateId);
        return;
      }
      element.disabled = true;
      try {
        const saved = !state.favorites.has(templateId);
        await saveFavorite(templateId, saved);
        toast(saved ? message("catalog.saved.added") : message("catalog.saved.removed"));
        if (location.pathname === "/favorites") render();
      } finally {
        element.disabled = false;
      }
      return;
    }],
    [["filter-seasonal"], async (action, element) => {
      // Chỉ thay đổi bộ lọc phía client; không đưa link mời riêng tư vào URL.
      state.filter = "Lễ hội";
      state.search = "";
      state.catalogPage = 1;
      state.freeOnly = false;
      state.photoOnly = false;
      state.occasion=state.palette=state.cardType="all";
      for(const id of ["occasion-filter","palette-filter","card-type-filter"]){const control=document.getElementById(id);if(control)control.value="all";}
      const style = document.getElementById("style-filter");
      if (style) style.value = state.filter;
      const search = document.getElementById("template-search");
      if (search) search.value = "";
      const free = document.getElementById("free-filter");
      if (free) free.checked = false;
      const photo = document.getElementById("photo-filter");
      if (photo) photo.checked = false;
      commitCatalogFilters();
      document.getElementById("catalog-range")?.focus();
      return;
    }],
    [["retry-catalog"], async (action, element) => {
      return render();
    }],
    [["clear-filters"], async (action, element) => {
      state.catalogPage = 1;
      state.filter = "all";
      state.freeOnly = false;
      state.photoOnly = false;
      state.occasion=state.palette=state.cardType="all";
      for(const id of ["occasion-filter","palette-filter","card-type-filter"]){const control=document.getElementById(id);if(control)control.value="all";}
      const style = document.getElementById("style-filter");
      const free = document.getElementById("free-filter");
      const photo = document.getElementById("photo-filter");
      const search = document.getElementById("template-search");
      if (style) style.value = "all";
      if (free) free.checked = false;
      if (photo) photo.checked = false;
      if (search && element.hasAttribute('data-clear-search')) search.value = state.search = '';
      commitCatalogFilters();
      document.querySelector('.catalog-reset')?.focus();
      return;
    }],
    [["set-page"], async (action, element) => {
      const page = Number(element.dataset.page);
      const list = element.dataset.list;
      if (list === "catalog" && Number.isInteger(page)) {
        const result = paginateTemplates(matchingTemplates(), page);
        if (state.catalogPage === result.page) return;
        state.catalogPage = result.page;
        commitCatalogFilters();
        focusVisibleTarget(document.getElementById("catalog-range"), { block: "start" });
      } else if (list === "favorites" && Number.isInteger(page)) {
        const templates = state.templates.filter((item) =>
          state.favorites.has(item.id),
        );
        const result = paginateTemplates(templates, page);
        if (state.favoritePage === result.page) return;
        state.favoritePage = result.page;
        render().then(() => {
          if (location.pathname === "/favorites") focusVisibleTarget(document.getElementById("catalog-range"), { block: "start" });
        });
      }
      return;
    }],
    [["approve-template", "reject-template"], async (action, element) => {
      const id = encodeURIComponent(element.dataset.id);
      if (action === "approve-template") {
        await api.post(`/catalog/admin/templates/${id}/approve`);
        toast(message("admin.moderation.approved"));
        await loadTemplates();
        render();
      } else {
        openModal(
          `<div class="reject-modal"><span class="eyebrow">${text("admin.moderation.rejectionBadge")}</span><h2>${text("admin.moderation.rejectionTitle")}</h2><p>${text("admin.moderation.rejectionHint")}</p><form id="reject-form" data-template-id="${e(id)}"><label class="field"><span>${text("admin.moderation.rejectionReason")}</span><textarea name="reason" rows="4" maxlength="250" required ${attr("placeholder", "admin.moderation.rejectionExample")}></textarea></label><button type="submit" class="btn btn--dark btn--wide">${text("admin.moderation.confirmReject")} ${icon("arrow", 17)}</button></form></div>`,
        );
      }
      return;
    }],
  ];
}
