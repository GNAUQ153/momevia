export function node(tag, attrs = {}, ...children) {
  const item = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") item.className = value;
    else if (key === "text") item.textContent = value;
    else if (key === "value") item.value = value;
    else if (key === "checked" || key === "disabled" || key === "hidden")
      item[key] = Boolean(value);
    else if (value != null) item.setAttribute(key, String(value));
  }
  item.append(...children.filter((child) => child != null));
  return item;
}
export const button = (text, action, attrs = {}) =>
  node(
    "button",
    { type: "button", "data-editor-action": action, ...attrs },
    text,
  );
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
export function trapDialog(dialog, onClose) {
  const previous = document.activeElement;
  dialog.showModal();
  const close = () => {
    dialog.close();
    dialog.remove();
    previous?.focus();
    onClose?.();
  };
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  return close;
}
