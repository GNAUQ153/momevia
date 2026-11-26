import { icon } from "../../ui/icons.js";
import { createLocaleControl, isMessage, setAttr, setText } from "../../core/i18n.js";

export function node(tag, attrs = {}, ...children) {
  const item = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") item.className = value;
    else if (key === "text") setText(item, value);
    else if (key === "value") item.value = value;
    else if (key === "checked" || key === "disabled" || key === "hidden")
      item[key] = Boolean(value);
    else if (value != null) setAttr(item, key, value);
  }
  for (const child of children) {
    if (isMessage(child)) {
      const label = document.createTextNode("");
      setText(label, child);
      item.append(label);
    } else if (child != null) item.append(child);
  }
  return item;
}
export const button = (text, action, attrs = {}) =>
  node(
    "button",
    { type: "button", "data-editor-action": action, ...attrs },
    text,
  );
export function iconButton(label, action, symbol, attrs = {}) {
  const { class: className = "", ...attributes } = attrs;
  const control = button("", action, {
    class: `editor-icon-button ${className}`,
    "aria-label": label,
    title: label,
    ...attributes,
  });
  control.innerHTML = icon(symbol, 18);
  return control;
}
export function field(label, input) {
  return node(
    "label",
    { class: "editor-field" },
    node("span", {}, label),
    input,
  );
}
export function input(label, name, value, { type = "text", ...attrs } = {}) {
  return field(
    label,
    node("input", {
      type,
      "data-editor-field": name,
      value: value ?? "",
      ...attrs,
    }),
  );
}
export function select(label, name, value, options) {
  const control = node("select", { "data-editor-field": name });
  for (const [id, title] of options)
    control.append(node("option", { value: id }, title));
  control.value = value ?? "";
  return field(label, control);
}
// Mỗi dialog có vòng đời riêng, không giữ listener đến hết vòng đời Editor.
export function trapDialog(dialog, onClose, { signal, lifetime = new AbortController() } = {}) {
  const previous = document.activeElement;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    signal?.removeEventListener("abort", close);
    lifetime.abort();
    try {
      if (dialog.open) dialog.close();
      dialog.remove();
      if (!signal?.aborted && previous?.isConnected) previous.focus();
    } finally {
      onClose?.();
    }
  };
  if (signal?.aborted) {
    close();
    return close;
  }
  try {
    dialog.prepend(createLocaleControl());
    dialog.showModal();
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    }, { signal: lifetime.signal });
    dialog.addEventListener("close", close, { signal: lifetime.signal });
    signal?.addEventListener("abort", close, { once: true });
  } catch (error) {
    close();
    throw error;
  }
  return close;
}
