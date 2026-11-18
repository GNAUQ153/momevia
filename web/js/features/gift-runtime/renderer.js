import { STICKERS } from "../../shared/canvas/index.js";

function element(tag, className, text) {
  const node = globalThis.document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function imageUrl(value, mode) {
  if (typeof value !== "string" || value.includes("\\")) return null;
  if (/^\/api\/(?:designs|gifts)\//.test(value)) return value;
  if (mode === "preview" && (/^\/api\/catalog\/(?:admin\/)?templates\/[\w-]+\/versions\/[\w-]+\/assets\/[\w-]+$/.test(value)
    || /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value))) return value;
  return null;
}
export function resolveText(node, document) {
  return node.props.textBinding
    ? document.bindings[node.props.textBinding]?.value || ""
    : node.props.text || "";
}

// Assigning typed CSSOM properties is CSP-compatible; there is no style attribute markup,
// stylesheet string, CSS expression, custom URL, or user supplied property name.
export function applyLayout(
  node,
  model,
  baseSize,
  { responsive = false, scale = 1 } = {},
) {
  const layout = model.layout || model;
  node.style.position = "absolute";
  node.style.left = responsive
    ? `${(layout.x / baseSize.width) * 100}%`
    : `${layout.x}px`;
  node.style.top = `${layout.y * (responsive ? scale : 1)}px`;
  node.style.width = responsive
    ? `${(layout.width / baseSize.width) * 100}%`
    : `${layout.width}px`;
  node.style.minHeight = `${layout.height * (responsive ? scale : 1)}px`;
  node.style.height = `${layout.height * (responsive ? scale : 1)}px`;
  node.style.transform = `rotate(${layout.rotation || 0}deg)`;
  if (model.opacity !== undefined) node.style.opacity = String(model.opacity);
}

export function renderElement(
  model,
  {
    document,
    assetUrl = () => null,
    mode = "preview",
    onAction = () => {},
    replyAdapter,
    signal,
    onReply = () => {},
  } = {},
) {
  const { type, props: p, accessibility: a = {} } = model;
  let node;
  if (type === "text") {
    node = element(
      a.role === "heading" ? `h${a.level || 2}` : "p",
      "gift-runtime-text",
      resolveText(model, document),
    );
    node.style.fontFamily =
      p.fontToken === "heading"
        ? "var(--font-display)"
        : p.fontToken === "serif"
          ? "var(--font-serif)"
          : "var(--font-body)";
    node.style.fontSize = `${p.fontSize || 24}px`;
    node.style.lineHeight = String(p.lineHeight || 1.4);
    node.style.textAlign = p.align || "left";
    node.style.color = p.color || "#32243B";
  } else if (type === "image") {
    node = element("div", "gift-runtime-image");
    const url = p.assetId ? imageUrl(assetUrl(p.assetId), mode) : null;
    if (url) {
      const img = element("img");
      img.src = url;
      img.alt = a.decorative ? "" : a.alt || "";
      img.loading = "lazy";
      img.decoding = "async";
      img.style.objectFit = p.fit || "cover";
      img.style.objectPosition = `${(p.focalPoint?.x ?? 0.5) * 100}% ${(p.focalPoint?.y ?? 0.5) * 100}%`;
      img.addEventListener(
        "error",
        () => {
          if (signal?.aborted) return;
          img.remove();
          node.append(
            element("span", "gift-runtime-placeholder", "Không tải được ảnh"),
          );
        },
        signal ? { signal } : {},
      );
      node.append(img);
    } else
      node.append(
        element("span", "gift-runtime-placeholder", "Chọn ảnh của bạn"),
      );
    node.style.borderRadius = `${p.radius || 0}px`;
  } else if (type === "shape" || type === "line") {
    node = element("div", `gift-runtime-shape gift-runtime-${type}`);
    node.style.backgroundColor =
      type === "line" || p.kind === "line" ? "transparent" : p.color;
    node.style.borderColor = p.strokeColor || p.color;
    node.style.borderStyle = "solid";
    node.style.borderWidth =
      type === "line" || p.kind === "line"
        ? `${p.strokeWidth ?? 1}px 0 0`
        : `${p.strokeWidth || 0}px`;
    node.style.borderRadius =
      p.kind === "ellipse" ? "50%" : `${p.radius || 0}px`;
    node.setAttribute("aria-hidden", "true");
  } else if (type === "sticker") {
    node = element("div", "gift-runtime-sticker", STICKERS[p.stickerId]);
    node.style.color = p.color;
    node.setAttribute("aria-hidden", "true");
  } else if (["button", "envelope", "gift-box"].includes(type)) {
    node = element("button", `gift-runtime-control gift-runtime-${type}`);
    node.type = "button";
    node.style.backgroundColor = p.color;
    if (type !== "button") {
      const icon = element(
        "span",
        "gift-runtime-control-icon",
        type === "envelope" ? "✉" : "🎁",
      );
      icon.setAttribute("aria-hidden", "true");
      node.append(icon);
    }
    node.append(
      element(
        "span",
        "gift-runtime-control-label",
        p.label || a.label || "Tiếp tục",
      ),
    );
    node.setAttribute("aria-label", a.label || p.label || "Tiếp tục");
    if (mode === "editor") node.tabIndex = -1;
    else
      node.addEventListener(
        "click",
        () => onAction(model.actions || []),
        signal ? { signal } : {},
      );
  } else if (type === "reply") {
    node = element("section", "gift-runtime-reply");
    node.setAttribute("aria-label", a.label || p.title || "Lời hồi đáp");
    node.append(
      element("h2", "", p.title || "Gửi lời đáp"),
      element(
        "p",
        "gift-runtime-reply-privacy",
        mode === "public" ? ({
          link: "Người gửi và ai có link quà đều đọc được lời đáp.",
          invite: "Chỉ người gửi và người có link mời đọc được lời đáp.",
          sender: "Chỉ người gửi quà đọc được lời đáp.",
        }[replyAdapter?.replyAudience] || "") : "Lời đáp trong bản xem trước được mô phỏng.",
      ),
    );
    const form = element("form"),
      nameLabel = element("label", "", "Tên của bạn"),
      name = element("input"),
      messageLabel = element("label", "", "Lời đáp"),
      message = element("textarea"),
      submit = element(
        "button",
        "gift-runtime-submit",
        p.submitLabel || "Gửi lời đáp",
      ),
      status = element("p", "gift-runtime-reply-status");
    name.name = "name";
    name.maxLength = 50;
    name.autocomplete = "name";
    message.name = "message";
    message.maxLength = 1000;
    message.required = true;
    message.rows = 3;
    submit.type = "submit";
    status.setAttribute("role", "status");
    nameLabel.append(name);
    messageLabel.append(message);
    form.append(nameLabel, messageLabel, submit, status);
    node.append(form);
    if (mode === "public" && !replyAdapter?.canSend) {
      form.hidden = true;
      node.append(element("p", "", replyAdapter?.repliesDisabled
        ? "Người gửi đã tắt hồi đáp." : "Cần link mời để gửi hồi đáp."));
    }
    const replies = element("div", "gift-runtime-replies");
    const displayedReplies = new Set();
    node.append(replies);
    replies.hidden = mode === "public" && !replyAdapter?.canRead;
    const appendReply = (reply) => {
      if (reply.id && displayedReplies.has(reply.id)) return;
      if (reply.id) displayedReplies.add(reply.id);
      const item = element("blockquote");
      item.append(
        element("p", "", reply.message),
        element("cite", "", reply.name || "Người nhận"),
      );
      replies.prepend(item);
    };
    if (mode === "editor") {
      for (const control of [name, message, submit]) {
        control.disabled = true;
        control.tabIndex = -1;
      }
    } else
      form.addEventListener(
        "submit",
        async (event) => {
          event.preventDefault();
          if (!form.reportValidity() || submit.disabled) return;
          submit.disabled = true;
          status.textContent = "Đang gửi…";
          try {
            const input = {
              name: name.value.trim(),
              message: message.value.trim(),
            };
            if (!input.message) throw new Error("Vui lòng nhập lời đáp.");
            const reply =
              mode === "preview"
                ? input
                : await replyAdapter?.send(input, { signal });
            if (signal?.aborted) return;
            if (!reply)
              throw new Error("Không gửi được lời đáp. Vui lòng thử lại.");
            appendReply(reply);
            message.value = "";
            status.textContent =
              mode === "preview"
                ? "Đã mô phỏng lời đáp. Không gửi cho người tặng."
                : "Đã gửi lời đáp.";
            onReply(reply);
          } catch (error) {
            if (!signal?.aborted)
              status.textContent = error.message || "Không gửi được lời đáp.";
          } finally {
            if (!signal?.aborted) submit.disabled = false;
          }
        },
        signal ? { signal } : {},
      );
    if (mode === "public" && replyAdapter?.list)
      Promise.resolve()
        .then(() => (signal?.aborted ? [] : replyAdapter.list({ signal })))
        .then((items) => {
          if (!signal?.aborted) items.slice().reverse().forEach(appendReply);
        })
        .catch(() => {
          if (!signal?.aborted)
            status.textContent =
              "Chưa tải được lời đáp.";
        });
  } else throw new Error("Phiên bản element chưa được hỗ trợ.");
  node.dataset.runtimeElement = model.id;
  if (model.visible === false) node.hidden = true;
  if (model.opacity !== undefined) node.style.opacity = String(model.opacity);
  return node;
}
