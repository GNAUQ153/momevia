// Giao diện thư viện Canvas được tách khỏi session/lưu nháp.
// Chỉ tạo DOM và lọc theo tên hiển thị; không tạo mutation hay thay đổi document.
import { message, setText, t, currentLocale } from "../../core/i18n.js";
import { createDocument } from "../../shared/canvas/index.js";
import { node, button, field } from "./dom.js";
import { bounds, catalog, matchesBlock, sampleBindings } from "./library.js";
import { discoveryModes, filteredIds } from "./library-discovery.js";
import { thumbnail } from "./thumbnail.js";
import { eventMediaUrl } from '../../shared/canvas/event-media.js';
import {visualKinds,blockVisualKind} from './library-kinds.js';

export function createDiscoveryPanel({ policy, discoveryMode, signal }) {
  const sample = sampleBindings(createDocument());
  const cards = new Map();
  const fillThumbnail = control => {
    const block = cards.get(control);
    if (!block || control.querySelector(".editor-thumbnail")) return;
    const models = block.create();
    control.prepend(thumbnail(sample, models, bounds(models), { width: 82, height: 64,assetUrl:id=>eventMediaUrl(id,{variant:'thumbnail'}) }));
  };
  const lazy = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      fillThumbnail(target);
      lazy.unobserve(target);
    }
  }, { rootMargin: "120px" });
  const kinds=node('div',{class:'editor-library-kinds',role:'group','aria-label':message('editor.interface.libraryFilters'),'data-active-kind':'all'},
    ...visualKinds.map(kind=>node('button',{type:'button','data-library-kind':kind,'aria-pressed':String(kind==='all')},message(`editor.library.kind.${kind}`))));
  kinds.addEventListener('click',event=>{
    const control=event.target.closest('[data-library-kind]');if(!control)return;event.stopPropagation();kinds.dataset.activeKind=control.dataset.libraryKind;
    for(const choice of kinds.querySelectorAll('button'))choice.setAttribute('aria-pressed',String(choice===control));
    const panel=kinds.closest('#editor-panel-add');if(panel){panel.dataset.visualKind=control.dataset.libraryKind;filterDiscoveryPanel(panel,{query:panel.querySelector('[data-block-search]').value,discoveryMode:panel.dataset.discoveryMode||discoveryMode,recentBlocks:JSON.parse(panel.dataset.recentBlocks||'[]')});}
  },{signal});
  signal.addEventListener("abort", () => lazy.disconnect(), { once: true });
  const groups = catalog.map(({ label, items, database }, index) => node("section", { class: "editor-block-group", "data-block-group": index },
    node("h3", {}, database || catalog[index].titleTexts ? (catalog[index].titleTexts?.[currentLocale()]||label) : message(`editor.library.group.${index}`)),
    node("div", { class: "editor-block-grid" }, ...items.map(block => {
      const control = button("", "add", {
        "data-block": block.id, "aria-label": block.database || block.titleTexts ? (block.titleTexts?.[currentLocale()]||block.title) : message(`editor.library.item.${block.id}`),
        disabled: policy?.kind === "creator-template",
      });
      cards.set(control, block);
      control.draggable=policy?.kind!=='creator-template';
      control.dataset.visualKind=blockVisualKind(block);
      control.append(node("span", {}, block.database || block.titleTexts ? (block.titleTexts?.[currentLocale()]||block.title) : message(`editor.library.item.${block.id}`)));
      lazy.observe(control);
      return blockVisualKind(block)==='animation'?node('div',{class:'editor-motion-library-card'},control,button(message('editor.interface.preview'),'motion-card-preview',{'data-motion-card':block.id})):control;
    })),
  ));
  return [
    field(message("editor.interface.searchDecorations"), node("input", {
      type: "search", "data-block-search": "", placeholder: message("editor.interface.searchPlaceholder"),
      "aria-describedby": "editor-block-count",
    })),
    kinds,
    node("div", { class: "editor-discovery-filters", role: "group", "aria-label": message("editor.interface.libraryFilters") },
      ...discoveryModes.map(mode => button(message(`editor.interface.discovery.${mode.id}`), "filter-blocks", {
        class: "editor-discovery-chip", "data-filter-mode": mode.id,
        "aria-pressed": mode.id === discoveryMode ? "true" : "false",
      }))),
    node("p", { class: "editor-discovery-count", id: "editor-block-count", role: "status", "aria-live": "polite" },
      message("editor.interface.totalBlocks", { count: catalog.flatMap(group => group.items).length })),
    field(message("editor.interface.group"), node("select", { "data-block-group-select": "" },
      node("option", { value: "" }, message("editor.interface.allCount", { count: cards.size })),
      ...catalog.map(({ label, items, database }, index) => node("option", { value: index }, message("editor.library.groupCount", { group: database || catalog[index].titleTexts ? (catalog[index].titleTexts?.[currentLocale()]||label) : { format: "message", key: `editor.library.group.${index}` }, count: items.length }))))),
    node("div", { class: "editor-help", "data-block-empty": "", hidden: true },
      node("p", { role: "status" }, message("editor.interface.noBlocks")),
      button(message("editor.interface.clearSearch"), "clear-block-search")),
    ...groups,
  ];
}

// Tên dịch chỉ phục vụ tìm kiếm/hiển thị, không được sửa block.title hoặc ID.
export function matchesLocalizedBlock(block, search, translateLabel = t) {
  if (matchesBlock(block, search)) return true;
  const normalize = value => String(value).toLocaleLowerCase().normalize("NFD")
    .replace(/\p{M}/gu, "").replaceAll("đ", "d");
  const groupIndex = catalog.findIndex(group => group.label === block.group);
  const translated = normalize(`${translateLabel(`editor.library.item.${block.id}`)} ${translateLabel(`editor.library.group.${groupIndex}`)}`);
  return normalize(search).trim().split(/\s+/).every(word => translated.includes(word));
}

export function filterDiscoveryPanel(panel, { query, discoveryMode, recentBlocks }) {
  if (!panel?.querySelector("[data-block-group-select]")) return;
  const selectedGroup = panel.querySelector("[data-block-group-select]").value;
  panel.dataset.discoveryMode=discoveryMode;panel.dataset.recentBlocks=JSON.stringify(recentBlocks||[]);
  let allowed = filteredIds(catalog, {
    query, group: selectedGroup, mode: discoveryMode, recent: recentBlocks,
    matches: matchesLocalizedBlock,
  });
  const kind=panel.dataset.visualKind||panel.querySelector('.editor-library-kinds')?.dataset.activeKind||'all';
  if(kind!=='all')allowed=new Set(catalog.flatMap(g=>g.items).filter(block=>allowed.has(block.id)&&blockVisualKind(block)===kind).map(block=>block.id));
  for (const [index, { items }] of catalog.entries()) {
    const section = panel.querySelector(`[data-block-group="${index}"]`);
    let count = 0;
    for (const [itemIndex, control] of [...section.querySelectorAll("[data-block]")].entries()) {
      control.hidden = !allowed.has(items[itemIndex].id);
      if(control.parentElement.classList.contains('editor-motion-library-card'))control.parentElement.hidden=control.hidden;
      if (!control.hidden) count += 1;
    }
    section.hidden = count === 0;
  }
  setText(panel.querySelector("#editor-block-count"), message("editor.interface.filteredBlocks", { count: allowed.size, total: catalog.flatMap(group => group.items).length }));
  const empty = panel.querySelector("[data-block-empty]");
  empty.hidden = allowed.size !== 0;
  setText(empty.querySelector("p"), message(discoveryMode === "recent" && recentBlocks.length === 0
    ? "editor.interface.noRecent" : "editor.interface.noMatches"));
  for (const chip of panel.querySelectorAll("[data-filter-mode]"))
    chip.setAttribute("aria-pressed", String(chip.dataset.filterMode === discoveryMode));
  for(const choice of panel.querySelectorAll('[data-library-kind]'))choice.setAttribute('aria-pressed',String(choice.dataset.libraryKind===kind));
}
