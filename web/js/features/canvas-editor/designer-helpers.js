// Phase 6.1a: Các tiện ích thuần UI của Designer, tách khỏi trạng thái lưu nháp.
// Không truy cập API, dữ liệu người dùng hoặc quyền chỉnh sửa trong module này.
import { node } from './dom.js';

export const zoomLevels = [0.25, 0.5, 0.75, 1, 1.5, 2];
export const libraryTabs = { add: "Thêm", content: "Nội dung", assets: "Ảnh", layers: "Lớp" };
export const sceneActions = [
  ["Nhân bản cảnh", "scene-duplicate"], ["Đưa cảnh lên", "scene-up"],
  ["Đưa cảnh xuống", "scene-down"], ["Chọn làm cảnh mở đầu", "scene-entry"],
  ["Xóa cảnh", "scene-delete"],
];
export const starterActions = { blank: "create-blank", "envelope-basic": "create-starter", celebration: "create-celebration" };
export const toPercent = value => Number((value * 100).toFixed(2));

export function imagePicker(label, slot) {
  return node("label", { class: "editor-image-picker" },
    node("span", {}, label),
    node("input", {
      type: "file", accept: "image/png,image/jpeg,image/webp",
      "data-editor-field": "upload", "data-slot": slot,
    }));
}
export const stopKeys = (target) =>
  target?.closest('input,textarea,select,[contenteditable="true"]');

export function readableInk(background) {
  const [red, green, blue] = background.slice(1).match(/../g).map(hex => {
    const value = parseInt(hex, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.179 ? "#000000" : "#FFFFFF";
}

