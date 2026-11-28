import { extendedArt } from "../../shared/canvas/decorative-art-55.js";
import { extendedCollections } from "./decorative-sets-55.js";
import { createElement } from "../../shared/canvas/registry.js";
import { decorativeArt } from "../../shared/canvas/decorative-art.js";

// Bộ trang trí Momevia: cùng schema V2 và cùng renderer với các sticker có sẵn.
// Không tải file từ mạng, không dùng emoji và không thêm định dạng document mới.
const collections = [
  ["Giáng sinh", [
    ["m54-christmas-tree", "Cây thông lễ hội", "thông Noel Christmas", "#4C987A"],
    ["m54-snowflake", "Bông tuyết", "tuyết mùa đông winter", "#6299C4"],
    ["m54-snow-globe", "Quả cầu tuyết", "quà mùa đông", "#87ACD1"],
    ["m54-holiday-ornament", "Quả châu", "trang trí cây thông", "#BD7695"],
    ["m54-winter-stocking", "Tất Giáng sinh", "Noel quà tặng", "#C76F79"],
    ["m54-bells", "Chuông đôi", "chuông mùa lễ", "#C49A52"],
  ]],
  ["Tết Nguyên đán", [
    ["m54-apricot-blossom", "Hoa mai", "Tết xuân hoa vàng", "#E6B74B"],
    ["m54-lucky-envelope", "Lì xì", "bao đỏ mừng tuổi", "#C85F62"],
    ["m54-tet-lantern", "Đèn lồng", "lễ hội Tết", "#D36E56"],
    ["m54-peach-sprig", "Hoa đào", "xuân sắc hồng", "#D77F9A"],
    ["m54-firecrackers", "Pháo giấy", "chúc mừng năm mới", "#C95360"],
    ["m54-festival-fan", "Quạt xuân", "quạt giấy truyền thống", "#C28A57"],
  ]],
  ["Valentine", [
    ["m54-double-hearts", "Hai trái tim", "yêu thương tình yêu", "#C65E82"],
    ["m54-love-letter", "Thư tình", "phong bì lá thư", "#BF6893"],
    ["m54-rose", "Hoa hồng", "bông hoa Valentine", "#C86B7A"],
    ["m54-heart-arrow", "Mũi tên yêu", "tình yêu Cupid", "#C85D7C"],
    ["m54-cupid-wings", "Đôi cánh", "thiên thần tình yêu", "#A77BCB"],
    ["m54-love-bow", "Nơ tình yêu", "dải nơ quà", "#B56EAA"],
  ]],
  ["Kỷ niệm", [
    ["m54-polaroid-stack", "Chồng ảnh Polaroid", "ảnh ký ức", "#C9ABBE"],
    ["m54-confetti", "Pháo hoa giấy", "vui vẻ ăn mừng", "#B78DB9"],
    ["m54-music-notes", "Nốt nhạc", "giai điệu kỷ niệm", "#8B74B3"],
    ["m54-birthday-slice", "Miếng bánh sinh nhật", "sinh nhật bánh", "#D3A174"],
    ["m54-star-trail", "Dải sao", "ước nguyện lấp lánh", "#C4A15A"],
    ["m54-floral-wreath", "Vòng hoa", "khung hoa kỷ niệm", "#B47D99"],
  ]],
];

collections.push(...extendedCollections);

export const extendedDecorativeIds = Object.freeze(Object.keys(extendedArt));

export const decorativeNames = Object.fromEntries(
  collections.flatMap(([, entries]) => entries.map(([id, name]) => [id, name])),
);

export const decorativeGroups = collections.map(([group, entries]) => [
  `Kho trang trí - ${group}`,
  entries.map(([id, title, keywords, color]) => [
    id,
    title,
    () => [createElement("sticker", {
      name: title,
      layout: { x: 0, y: 0, width: 102, height: 102 },
      props: { stickerId: id, color },
      accessibility: { decorative: true },
    })],
    `hình trang trí vector ${group} ${keywords}`,
  ]),
]);

export const decorativeIds = Object.freeze(Object.keys(decorativeArt));
