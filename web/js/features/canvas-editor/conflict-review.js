// Phase 6.3b. This is a *read-only* review of two known versions.
// All data stays in the authenticated editor; no writes, merges, cache keys or API changes.
import { message } from "../../core/i18n.js";
import { node } from "./dom.js";

const asRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const keys = ["scenes", "elements", "bindings", "assets"];
const count = value => Array.isArray(value) ? value.length : 0;
const validRevision = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

export function summarizeCanvasConflict({ local, remote, localRevision } = {}) {
  if (!asRecord(local) || !asRecord(local.document) ||
      typeof local.title !== "string" || !asRecord(remote) ||
      !asRecord(remote.document) || typeof remote.title !== "string") {
    throw new TypeError("Thiếu bản thiết kế hợp lệ để so sánh.");
  }
  const lhs = local.document, rhs = remote.document;
  for (const doc of [lhs, rhs]) {
    if (!Array.isArray(doc.scenes) || !Array.isArray(doc.elements) ||
        !Array.isArray(doc.assets) || !asRecord(doc.bindings)) {
      throw new TypeError("Cấu trúc Canvas để so sánh không hợp lệ.");
    }
  }
  const categories = [
    { key: "title", changed: local.title !== remote.title, local: local.title, remote: remote.title },
    { key: "scenes", changed: !same(lhs.scenes, rhs.scenes), local: String(count(lhs.scenes)), remote: String(count(rhs.scenes)) },
    { key: "layers", changed: !same(lhs.elements, rhs.elements), local: String(count(lhs.elements)), remote: String(count(rhs.elements)) },
    { key: "assets", changed: !same(lhs.assets, rhs.assets), local: String(count(lhs.assets)), remote: String(count(rhs.assets)) },
  ];
  const localBindings = lhs.bindings;
  const serverBindings = rhs.bindings;
  const bindingKeys = [...new Set([...Object.keys(localBindings), ...Object.keys(serverBindings)])].sort();
  const bindingChanged = !same(localBindings, serverBindings);
  categories.push({ key: "bindings", changed: bindingChanged,
    local: String(Object.keys(localBindings).length), remote: String(Object.keys(serverBindings).length) });
  const rest = doc => Object.fromEntries(Object.entries(doc).filter(([key]) => !keys.includes(key)));
  categories.push({ key: "other", changed: !same(rest(lhs), rest(rhs)), local: "—", remote: "—" });
  // Show at most eight text fields. Never leak opaque recovery envelopes or auth tokens.
  const bindings = bindingKeys.slice(0, 8).map(key => {
    const lhsText = typeof localBindings[key]?.value === "string" ? localBindings[key].value : "";
    const rhsText = typeof serverBindings[key]?.value === "string" ? serverBindings[key].value : "";
    return { key, changed: !same(localBindings[key], serverBindings[key]),
      local: lhsText, remote: rhsText };
  });
  return {
    localRevision: validRevision(localRevision),
    serverRevision: validRevision(remote.revision),
    categories,
    changedCount: categories.filter(category => category.changed).length,
    bindingCount: bindingKeys.length,
    bindings,
    sameDocument: same(lhs, rhs) && local.title === remote.title,
  };
}

function versionColumn(kind, revision, title, value) {
  return node("div", { class: `conflict-review__column conflict-review__column--${kind}` },
    node("span", { class: "conflict-review__eyebrow" }, message(`editor.conflict.${kind}`)),
    node("h3", {}, title),
    node("p", { class: "conflict-review__revision" }, revision === null
      ? message("editor.conflict.unknownRevision")
      : message("editor.conflict.revision", { revision })),
    node("p", { class: "conflict-review__description" }, value),
  );
}

function comparisonRow(category) {
  return node("li", { class: `conflict-review__row ${category.changed ? "is-different" : "is-equal"}` },
    node("span", { class: "conflict-review__row-name" }, message(`editor.conflict.field.${category.key}`)),
    node("span", { class: "conflict-review__row-values" },
      node("span", { title: "Local" }, category.local),
      node("span", { "aria-hidden": "true" }, "→"),
      node("span", { title: "Server" }, category.remote)),
    node("span", { class: "conflict-review__row-status" },
      message(category.changed ? "editor.conflict.different" : "editor.conflict.same")),
  );
}

export function renderCanvasConflictReview({ local, remote, localRevision }) {
  const summary = summarizeCanvasConflict({ local, remote, localRevision });
  const list = node("ul", { class: "conflict-review__list" },
    ...summary.categories.map(comparisonRow));
  const textList = node("div", { class: "conflict-review__text-list" });
  for (const field of summary.bindings) {
    textList.append(node("div", { class: `conflict-review__field ${field.changed ? "is-different" : "is-equal"}` },
      node("h4", {}, field.key),
      node("div", { class: "conflict-review__values" },
        node("p", {}, node("strong", {}, message("editor.conflict.local")),
          node("span", {}, field.local || message("editor.conflict.empty"))),
        node("p", {}, node("strong", {}, message("editor.conflict.server")),
          node("span", {}, field.remote || message("editor.conflict.empty"))))));
  }
  if (summary.bindingCount > summary.bindings.length) {
    textList.append(node("p", { class: "conflict-review__hint" },
      message("editor.conflict.extraFields", { count: summary.bindingCount - summary.bindings.length })));
  }
  return node("dialog", { class: "editor-preview-dialog conflict-review", "aria-label": message("editor.conflict.title") },
    node("div", { class: "conflict-review__head" },
      node("p", { class: "conflict-review__eyebrow" }, "MOMEVIA · CANVAS"),
      node("h2", {}, message("editor.conflict.title")),
      node("p", {}, message("editor.conflict.description"))),
    node("div", { class: "conflict-review__versions" },
      versionColumn("local", summary.localRevision, local.title, message("editor.conflict.localHelp")),
      versionColumn("server", summary.serverRevision, remote.title, message("editor.conflict.serverHelp"))),
    node("p", { class: "conflict-review__count", role: "status" },
      message(summary.sameDocument ? "editor.conflict.noChanges" : "editor.conflict.changes", { count: summary.changedCount })),
    list,
    summary.bindings.length ? node("details", { class: "conflict-review__details" },
      node("summary", {}, message("editor.conflict.bindings")), textList) : null,
    node("p", { class: "conflict-review__warning" }, message("editor.conflict.warning")),
    node("div", { class: "conflict-review__actions" },
      node("button", { type: "button", "data-editor-action": "comparison-close" }, message("editor.conflict.close"))),
  );
}
