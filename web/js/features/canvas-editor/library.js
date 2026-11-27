import { signatureLibraryCards } from '../../shared/canvas/signature/registry.js';
import {ANIMATED_GROUPS,animatedElementCards} from '../../shared/canvas/animated-elements.js';
import { EVENT_CLUSTER_IDS, eventCluster } from '../../shared/canvas/event-clusters.js';
import { REFRESH_21 } from '../../shared/canvas/refresh-21-config.js';
import vectorInsertions from '../../../assets/canvas/vector-insertions-v1.json' with {type:'json'};
import {naturalElementCards,naturalCompositionCards} from '../../shared/canvas/natural-elements.js';
import { canonicalText } from '../../shared/locale.js';
import { decorativeGroups, decorativeNames } from "./decorations.js";
import { createElement } from "../../shared/canvas/registry.js";
import { originalStickerIds } from "../../shared/canvas/artwork.js";
import { createDocument } from "../../shared/canvas/presets.js";
import { decorations, geometry, illustratedStickers, interactions, lettering, photoLayouts, stories } from "./library-presets.js";

export const stickerNames = {
  ...decorativeNames,
  heart: "Trái tim", star: "Ngôi sao", flower: "Hoa", sparkles: "Lấp lánh",
  balloon: "Bóng bay", cake: "Bánh sinh nhật", gift: "Quà",
  ...Object.fromEntries(illustratedStickers.map(([id, title]) => [id, title])),
  leaf: "Lá", lace: "Ren", "paper-wave": "Mảng sóng", bunting: "Cờ dây",
  "washi-tape": "Băng washi", sunburst: "Hoa thị",
};

const piece = (type, width, height, props = {}, options = {}) => () => [
  createElement(type, { layout: { x: 0, y: 0, width, height }, props, ...options }),
];
const text = (width, height, props, options) => piece("text", width, height, { color: "#32243B", ...props }, options);
const heading = text(300, 70, { text: "Gửi bạn thương", fontToken: "heading", fontSize: 38, align: "center" }, { accessibility: { role: "heading", level: 2 } });
const sticker = (id, size = 80, color = "#AA5275") => piece("sticker", size, size, { stickerId: id, color });
const motif = (templateId, matches) => () => {
  const document = createDocument({ template: { id: templateId } });
  return document.elements.filter(model => matches.test(model.id)).map(model => {
    const copy = { ...model, id: crypto.randomUUID() };
    delete copy.name;
    return copy;
  });
};
const vectorInsertion=id=>()=>structuredClone(vectorInsertions[id]).map(e=>({...e,id:crypto.randomUUID()}));
const replay = [{ on: "activate", type: "replay" }];
const polaroidLabel = "Ảnh trong khung Polaroid";

export function isPolaroidPlaceholder(model) {
  return model?.type === "shape" && model.accessibility.label === polaroidLabel;
}

export function fillPolaroid(model, assetId) {
  return createElement("image", {
    id: model.id,
    name: model.name || polaroidLabel,
    layout: model.layout,
    props: { assetId, radius: model.props.radius },
    accessibility: { alt: "Ảnh kỷ niệm", label: polaroidLabel },
    ...(Object.hasOwn(model, "visible") ? { visible: model.visible } : {}),
    ...(Object.hasOwn(model, "locked") ? { locked: model.locked } : {}),
    ...(Object.hasOwn(model, "opacity") ? { opacity: model.opacity } : {}),
  });
}

function polaroid() {
  const [paper] = piece("shape", 232, 244, {
    color: "#FFFFFF", radius: 6, strokeWidth: 1, strokeColor: "#D8CBE0",
  }, { name: "Giấy Polaroid" })();
  const [caption] = piece("text", 204, 60, {
    text: "Ngày mình nhớ", fontToken: "serif", fontSize: 20, align: "center",
  }, { name: "Chú thích Polaroid" })();
  Object.assign(caption.layout, { x: 14, y: 182 });
  const [window] = piece("shape", 204, 154, {
    color: "#E9E1F0", radius: 4,
  }, { accessibility: { label: polaroidLabel } })();
  Object.assign(window.layout, { x: 14, y: 14 });
  return [paper, caption, window];
}

export const catalog = [
  ["Chữ", [
    ["heading", "Tiêu đề", heading, "font chữ lớn"],
    ["paragraph", "Đoạn văn", text(300, 86, { text: "Có một điều mình muốn kể bạn nghe." }), "văn bản chữ nội dung"],
    ["greeting", "Lời chúc", text(320, 120, { textBinding: "message", align: "center" }), "lời nhắn liên kết"],
    ["recipient", "Tên người nhận", text(280, 60, { textBinding: "recipientName", fontToken: "serif", fontSize: 34, align: "center" }), "liên kết"],
    ["signature", "Chữ ký người gửi", text(245, 55, { textBinding: "senderName", fontToken: "serif", align: "right" }), "tên liên kết"],
    ...lettering,
  ]],
  ["Ảnh", [
    ["photo", "Ảnh thường", piece("image", 240, 168, { radius: 0 }), "hình chụp"],
    ["rounded-photo", "Ảnh bo góc", piece("image", 240, 168, { radius: 24 }), "hình chụp"],
    ["polaroid", "Polaroid", polaroid, "khung ảnh chú thích ảnh tùy chọn"],
    ...photoLayouts,
  ]],
  ["Hình và nét", [
    ["rectangle", "Chữ nhật", piece("shape", 180, 102, { color: "#DDD0FF", radius: 0 }), "hình vuông"],
    ["rounded", "Ô bo góc", piece("shape", 180, 102, { color: "#F0C4D2", radius: 22 }), "hình chữ nhật"],
    ["ellipse", "Bầu dục", piece("shape", 156, 104, { kind: "ellipse", color: "#BEDCCB" }), "hình elip oval"],
    ["circle", "Hình tròn", piece("shape", 100, 100, { kind: "ellipse", color: "#F2D591" }), "vòng tròn"],
    ["divider", "Nét phân cách", piece("line", 245, 12, { color: "#8B5EAB", strokeWidth: 4 }), "đường kẻ gạch ngang"],
    ...geometry,
  ]],
  ["Sticker", [...originalStickerIds.map(id =>
    [id, stickerNames[id], sticker(id, 80, id === "star" || id === "sparkles" ? "#A97413" : "#AA5275"), "hình dán sticker"]), ...illustratedStickers]],
  ["Cụm trang trí", [
    ["flowers", "Cụm hoa", vectorInsertion('flowers'), "cánh hoa"],
    ["leaves", "Cành lá", vectorInsertion('leaves'), "cây cụm lá"],
    ...Object.entries(REFRESH_21).map(([id,spec])=>[`object-${id}`,canonicalText(`editor.library.item.object-${id}`),motif(id,/^cover-object-/),`${id} ${spec.object} ${spec.material}`]),
    ["stars", "Cụm sao", vectorInsertion('stars'), "chòm sao lấp lánh"],
    ...decorations,
  ]],
  ["Kể chuyện và kỷ niệm", [...stories, ...EVENT_CLUSTER_IDS.map(id=>[id, canonicalText(`interactive.${id}`), ()=>eventCluster(id,canonicalText), canonicalText(`interactive.${id}`)])]],
  ...decorativeGroups,
  ["Tương tác", [
    ['sound-button','Nút âm thanh',piece('sound-button',205,54),'âm thanh nghe audio sound'],
    ["envelope", "Phong bì", piece("envelope", 260, 168), "mở thư"],
    ["gift-box", "Hộp quà", piece("gift-box", 228, 168), "mở hộp"],
    ["continue", "Đọc tiếp", piece("button", 205, 54, { label: "Đọc tiếp" }), "nút chuyển cảnh đích"],
    ["replay", "Xem lại", piece("button", 205, 54, { label: "Xem lại" }, { actions: replay }), "nút phát lại"],
    ["reply", "Lời hồi đáp", piece("reply", 320, 298), "trả lời phản hồi"],
    ...interactions,
  ]],
].map(([label, items]) => ({
  label,
  items: items.map(([id, title, create, keywords]) => ({ id, title, create, keywords, group: label })),
}));
for(const [kind,label]of [['graphics','Đồ họa tự nhiên'],['materials','Chất liệu giấy và vải'],['three-d','Vật thể 3D'],['animation','Chuyển động nhẹ']]){
 const items=naturalElementCards(kind,canonicalText);if(items.length)catalog.push({label,items:items.map(card=>({...card,group:label}))});
}
const naturalStories=naturalCompositionCards(canonicalText);
if(naturalStories.length)catalog.push({label:'Cụm thiệp tự nhiên',items:naturalStories.map(card=>({...card,group:'Cụm thiệp tự nhiên'}))});

for(const [group,titles]of ANIMATED_GROUPS.entries())catalog.push({label:titles[0],titleTexts:{vi:titles[0],en:titles[1]},items:animatedElementCards(group).map(card=>({...card,group:titles[0]}))});
// Giữ thứ tự các nhóm Classic để không đổi các khóa dịch và dữ liệu cũ.
const signatureGroup = canonicalText('editor.library.group.27');
catalog.push({ label: signatureGroup, items: signatureLibraryCards(signatureGroup) });
const normalized = value => value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replaceAll("đ", "d");
const searchIndex = new Map(catalog.flatMap(({ items }) => items.map(block => [
  block.id, normalized(`${block.title} ${block.group} ${block.keywords}`),
])));
export function matchesBlock(block, query) {
  const label = block.database ? normalized(`${block.title} ${block.group} ${block.keywords}`) : searchIndex.get(block.id);
  return normalized(query).trim().split(/\s+/).every(word => label.includes(word));
}
export function replaceCatalog(groups) { catalog.splice(0, catalog.length, ...groups); }

export function sampleBindings(document) {
  document.bindings.recipientName.value = "Gửi Ánh Mai";
  document.bindings.senderName.value = "Thương mến, An";
  document.bindings.message.value = "Chúc bạn một ngày thật dịu dàng!";
  return document;
}

export function bounds(models) {
  const boxes = models.map(({ layout }) => {
    const { x, y, width, height, rotation } = layout;
    const angle = rotation * Math.PI / 180;
    const horizontal = (Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * height) / 2;
    const vertical = (Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * height) / 2;
    return { left: x + width / 2 - horizontal, top: y + height / 2 - vertical,
      right: x + width / 2 + horizontal, bottom: y + height / 2 + vertical };
  });
  return { left: Math.min(...boxes.map(box => box.left)), top: Math.min(...boxes.map(box => box.top)),
    right: Math.max(...boxes.map(box => box.right)), bottom: Math.max(...boxes.map(box => box.bottom)) };
}

function overlap(a, b) {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

export function placeBlock(models, viewport, existing) {
  const box = bounds(models);
  const width = box.right - box.left, height = box.bottom - box.top;
  const left = viewport.left + 12, top = viewport.top + 12;
  const right = Math.max(left, viewport.right - width - 12);
  const bottom = Math.max(top, viewport.bottom - height - 12);
  const occupied = existing.filter(model => model.visible !== false).map(model => bounds([model]));
  const steps = [0.5, 0.28, 0.72, 0, 1];
  let best;
  for (const vertical of steps) {
    for (const horizontal of steps) {
      const x = left + horizontal * (right - left);
      const y = top + vertical * (bottom - top);
      const candidate = { left: x, top: y, right: x + width, bottom: y + height };
      const score = occupied.reduce((sum, other) => sum + overlap(candidate, other), 0);
      if (!best || score < best.score) best = { x, y, score };
    }
  }
  const offsetX = best.x - box.left, offsetY = best.y - box.top;
  for (const model of models) {
    model.layout.x = Math.round((model.layout.x + offsetX) * 100) / 100;
    model.layout.y = Math.round((model.layout.y + offsetY) * 100) / 100;
  }
  return models;
}
