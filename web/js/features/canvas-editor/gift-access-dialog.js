// Hộp thoại quyền xem/gửi/đọc quà, tách khỏi vòng đời lưu Canvas Designer.
// Dữ liệu chọn chỉ là đầu vào của API; máy chủ vẫn phải kiểm tra quyền.
import { giftLinkDescriptionKeys } from "../../shared/gift-permissions.js";
import { node, select, trapDialog } from "./dom.js";

const options = {
  open: new Set(["link", "invite"]),
  send: new Set(["link", "invite", "disabled"]),
  read: new Set(["link", "invite", "sender"]),
};

export function isValidGiftAccess(value) {
  return Boolean(value && typeof value === "object" &&
    Object.keys(value).length === 3 &&
    Object.entries(options).every(([key, allowed]) => allowed.has(value[key])));
}

export function giftAccessDescriptions(access) {
  if (!isValidGiftAccess(access)) return [];
  const descriptions = [{
    key: "editor.interface.normalLink",
    description: { format: "sentences", keys: giftLinkDescriptionKeys(access, false) },
  }];
  if (Object.values(access).includes("invite")) {
    descriptions.push({
      key: "editor.interface.inviteLink",
      description: { format: "sentences", keys: giftLinkDescriptionKeys(access, true) },
    });
  }
  return descriptions;
}

export function openGiftAccessDialog({ message, signal, dialogs }) {
  // Khi route đã đóng, không mở modal hoặc giữ Promise chưa giải quyết.
  if (signal?.aborted) return Promise.resolve(null);
  const lifetime = new AbortController();
  const choose = ["", message("editor.access.choose")];
  const link = ["link", message("editor.access.link")];
  const invite = ["invite", message("editor.access.invite")];
  const descriptions = node("div", { role: "status", "aria-live": "polite" });
  const form = node("form", {},
    node("h2", {}, message("editor.access.title")),
    node("p", {}, message("editor.access.help")),
    select(message("editor.access.open"), "open", "", [choose, link, invite]),
    select(message("editor.access.send"), "send", "", [choose, link, invite, ["disabled", message("editor.access.disabled")]]),
    select(message("editor.access.read"), "read", "", [choose, link, invite, ["sender", message("editor.access.sender")]]),
    descriptions,
    node("button", { type: "submit", class: "editor-primary" }, message("editor.access.publish")),
    node("button", { type: "button" }, message("editor.actions.back")),
  );
  const controls = [...form.querySelectorAll("select")];
  controls.forEach(control => { control.required = true; });
  const selection = () => Object.fromEntries(controls.map(control => [control.dataset.editorField, control.value]));
  form.addEventListener("change", () => {
    descriptions.replaceChildren(...giftAccessDescriptions(selection()).map(item =>
      node("p", {}, message(item.key, { description: item.description }))));
  }, { signal: lifetime.signal });
  const dialog = node("dialog", {
    class: "editor-preview-dialog",
    "aria-label": message("editor.access.title"),
  }, form);

  return new Promise(resolve => {
    let result = null;
    let closed = false;
    document.body.append(dialog);
    dialogs.add(dialog);
    const closeDialog = trapDialog(dialog, () => {
      if (closed) return;
      closed = true;
      dialogs.delete(dialog);
      resolve(result);
    }, { signal, lifetime });
    const close = () => {
      if (!closed) closeDialog();
    };
    form.querySelector('button[type="button"]').addEventListener("click", close, { signal: lifetime.signal });
    form.addEventListener("submit", event => {
      event.preventDefault();
      const access = selection();
      if (!isValidGiftAccess(access)) return;
      result = access;
      close();
    }, { signal: lifetime.signal });
  });
}
