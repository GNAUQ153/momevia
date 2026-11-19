import { STICKERS } from "../../shared/canvas/index.js";
import { masks, vectorParts } from "../../shared/canvas/artwork.js";
import { renderInteraction } from "./interactions.js";
import { applySurface, playReaction } from "./effects.js";

const svgNamespace = "http://www.w3.org/2000/svg";
let clipSequence = 0;
const navigationArt = {
  R01: [
    {d:"M5 23H95V81H5Z",fill:"#FFF1DF",stroke:"#DBBDF0","stroke-width":3},
    {d:"M7 24 50 53 93 24M7 79 38 47M93 79 62 47",fill:"none",stroke:"#8A6397","stroke-width":3},
  ],
  R02: [
    {d:"M20 35H80V84H20Z",fill:"#FFF1DF",stroke:"#C89D5A","stroke-width":3},
    {d:"M13 27H87V46H13Z",fill:"#F4D195",stroke:"#C89D5A","stroke-width":3},
    {d:"M50 27C13 19 26-2 50 26 74-2 87 19 50 27V83",fill:"none",stroke:"#AC5478","stroke-width":6},
  ],
};

function clipPhoto(frame, mask) {
  const clipId = `gift-photo-clip-${++clipSequence}`;
  const svg = drawVector([]);
  const clip = globalThis.document.createElementNS(svgNamespace, "clipPath");
  const path = globalThis.document.createElementNS(svgNamespace, "path");
  svg.classList.add("gift-runtime-clip");
  clip.id = clipId;
  clip.setAttribute("clipPathUnits", "objectBoundingBox");
  path.setAttribute("d", masks[mask]);
  path.setAttribute("transform", "scale(.01)");
  clip.append(path);
  svg.append(clip);
  frame.append(svg);
  frame.style.clipPath = `url("#${clipId}")`;
}
export function drawVector(parts, { stretch = false } = {}) {
  const svg = globalThis.document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", stretch ? "none" : "xMidYMid meet");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "gift-runtime-vector");
  for (const part of parts) {
    const path = globalThis.document.createElementNS(svgNamespace, "path");
    for (const [key, value] of Object.entries(part)) if (value != null) path.setAttribute(key, value);
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.append(path);
  }
  return svg;
}

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
export function textFont(token) {
  return token === "heading" ? "var(--font-display)" :
    token === "serif" ? "var(--font-serif)" : "var(--font-body)";
}

export function applyFocalPoint(img, focalPoint) {
  img.style.objectPosition = `${(focalPoint?.x ?? 0.5) * 100}% ${(focalPoint?.y ?? 0.5) * 100}%`;
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
  if (model.type === "image" && model.props.caption)
    node.style.setProperty("--gift-layer-height", `${layout.height * (responsive ? scale : 1)}px`);
  node.style.transform = `rotate(${layout.rotation || 0}deg)`;
  if (model.opacity !== undefined) node.style.opacity = String(model.opacity);
  if (model.type === "sticker")
    node.style.fontSize = `${Math.max(20, Math.min(layout.width, layout.height) * scale * 0.8)}px`;
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
    motion,
    previewFamily,
    onReply = () => {},
  } = {},
) {
  const { type, props: p, accessibility: a = {} } = model;
  const vector = vectorParts(model);
  const pendingControls = new WeakSet();
  function activate(control, event, action, wait) {
    if (signal?.aborted || pendingControls.has(control) || control.getAttribute("aria-disabled") === "true") return;
    const preset = !previewFamily || previewFamily === "reaction" ? model.effects?.reaction : null;
    if (!wait) action();
    const played = playReaction(control, preset, motion, signal, event);
    if (!played) {
      if (wait) action();
      return;
    }
    pendingControls.add(control);
    void played.then(() => {
      pendingControls.delete(control);
      if (wait && !signal?.aborted) action();
    });
  }
  let node;
  if (vector) {
    node = element("div", `gift-runtime-vector-box gift-runtime-${type}`);
    node.setAttribute("aria-hidden", "true");
    node.append(drawVector(vector, { stretch: type !== "sticker" || ["paper-wave", "lace", "bunting", "washi-tape"].includes(p.stickerId) }));
  } else if (type === "text") {
    node = element(
      a.role === "heading" ? `h${a.level || 2}` : "p",
      "gift-runtime-text",
      resolveText(model, document),
    );
    node.style.fontFamily = textFont(p.fontToken);
    if (p.dropCap) node.classList.add("gift-runtime-drop-cap");
    if (a.decorative) node.setAttribute("aria-hidden", "true");
    node.style.fontSize = `${p.fontSize || 24}px`;
    node.style.lineHeight = String(p.lineHeight || 1.4);
    node.style.textAlign = p.align || "left";
    node.style.color = p.color || "#32243B";
  } else if (type === "image") {
    node = element("div", "gift-runtime-image");
    const url = p.assetId ? imageUrl(assetUrl(p.assetId), mode) : null;
    const framed = p.optional || p.mask || p.caption !== undefined;
    const frame = framed ? element("div", "gift-runtime-photo-frame") : node;
    if (framed) {
      node.classList.add("gift-runtime-photo");
      if (p.caption) node.classList.add("gift-runtime-photo-captioned");
      frame.style.borderRadius = `${p.radius || 0}px`;
      if (p.mask) clipPhoto(frame, p.mask);
      node.append(frame);
      if (p.caption) node.append(element("p", "gift-runtime-photo-caption", p.caption));
    }
    if (url) {
      const img = element("img");
      img.src = url;
      img.alt = a.decorative ? "" : a.alt || "";
      img.loading = "lazy";
      img.decoding = "async";
      img.style.objectFit = p.fit || "cover";
      applyFocalPoint(img, p.focalPoint);
      img.addEventListener(
        "error",
        () => {
          if (signal?.aborted) return;
          img.remove();
          frame.append(
            element("span", "gift-runtime-placeholder", "Không tải được ảnh"),
          );
        },
        signal ? { signal } : {},
      );
      frame.append(img);
    } else if (framed) {
      frame.append(drawVector([
        {d:"M0 0H100V100H0Z",fill:"#EBDEF4"},
        {d:"M71 18a11 11 0 1 0 0 22 11 11 0 1 0 0-22Z",fill:"#FFF2C9"},
        {d:"M0 82 28 43 54 72 67 55 100 87V100H0Z",fill:"#AD94BF"},
        {d:"M0 92 23 75 46 87 77 73 100 86V100H0Z",fill:"#7F698F"},
      ], { stretch: true }));
    } else
      frame.append(
        element("span", "gift-runtime-placeholder", "Chọn ảnh của bạn"),
      );
    if (!framed) node.style.borderRadius = `${p.radius || 0}px`;
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
    node = element(mode === "thumbnail" ? "span" : "button", `gift-runtime-control gift-runtime-${type}`);
    if (mode !== "thumbnail") node.type = "button";
    node.style.backgroundColor = p.color;
    if (type !== "button") {
      const illustration = navigationArt[model.effects?.reaction?.id];
      const icon = element(
        "span",
        illustration ? "gift-runtime-control-icon gift-control-illustration" : "gift-runtime-control-icon",
        illustration ? undefined : type === "envelope" ? "✉" : "🎁",
      );
      icon.setAttribute("aria-hidden", "true");
      if (illustration) icon.append(drawVector(illustration, {stretch:true}));
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
    else if (mode !== "thumbnail")
      node.addEventListener(
        "click",
        event => activate(node, event, () => onAction(model.actions || []), true),
        signal ? { signal } : {},
      );
  } else if (type === "interaction") {
    node = renderInteraction(model, {
      mode, signal, onAction, activate, renderArt: drawVector,
      renderPhoto: photo => renderElement({
        id: photo.id, type: "image",
        props: { assetId: photo.assetId, fit: "cover", focalPoint: photo.focalPoint, optional: true },
        accessibility: { alt: photo.alt },
      }, { document, assetUrl, mode, signal }),
    });
  } else if (type === "reply") {
    node = element("section", "gift-runtime-reply");
    node.setAttribute("aria-label", a.label || p.title || "Lời hồi đáp");
    if (mode === "thumbnail") {
      node.append(element("h2", "", p.title || "Gửi lời đáp"));
      node.append(element("div", "gift-runtime-placeholder", "Lời đáp của bạn"));
      applySurface(node, model.effects?.surface);
      return node;
    }
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
  applySurface(node, model.effects?.surface);
  if (model.visible === false) node.hidden = true;
  if (model.opacity !== undefined) node.style.opacity = String(model.opacity);
  return node;
}
