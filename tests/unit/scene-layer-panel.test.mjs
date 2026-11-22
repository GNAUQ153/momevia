import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createSceneLayerPanel,
  sceneLayerEntries,
  sceneStructureKey,
} from "../../web/js/features/canvas-editor/scene-layer-panel.js";

function fixture() {
  return {
    entrySceneId: "scene-a",
    scenes: [
      { id: "scene-a", name: "Bìa", elementIds: ["background", "title", "sticker"] },
      { id: "scene-b", name: "Lời nhắn", elementIds: ["note"] },
    ],
    elements: [
      { id: "background", type: "shape", name: "Nền", visible: true },
      { id: "title", type: "text", name: "Tiêu đề", visible: true },
      { id: "sticker", type: "sticker", name: "Hoa", visible: false },
      { id: "note", type: "text", name: "Lời nhắn", visible: true },
    ],
  };
}

test("Panel hiển thị các lớp từ trên xuống theo thứ tự xếp chồng ngược", () => {
  const doc = fixture();
  const entries = sceneLayerEntries(doc, "scene-a", "title");
  assert.deepEqual(entries.map(item => item.id), ["sticker", "title", "background"]);
  assert.equal(entries[1].selected, true);
  assert.equal(entries.filter(item => item.selected).length, 1);
  assert.deepEqual(doc.scenes[0].elementIds, ["background", "title", "sticker"]);
});

test("Lớp bị ẩn và bị khóa có hai trạng thái độc lập", () => {
  const doc = fixture();
  doc.elements[1].locked = true;
  const entries = sceneLayerEntries(doc, "scene-a", null, { sticker: { editableProps: [] } });
  assert.equal(entries[0].hidden, true);
  assert.equal(entries[0].locked, true);
  assert.equal(entries[1].hidden, false);
  assert.equal(entries[1].locked, true);
  assert.equal(entries[2].locked, false);
});

test("Chỉ đổi cảnh hiện tại, panel không chọn nhầm lớp từ cảnh trước", () => {
  const entries = sceneLayerEntries(fixture(), "scene-b", "title");
  assert.deepEqual(entries.map(item => item.id), ["note"]);
  assert.equal(entries[0].selected, false);
});

test("ID cảnh không còn tồn tại dùng cảnh đầu theo logic Designer trước đây", () => {
  assert.deepEqual(sceneLayerEntries(fixture(), "scene-removed", null).map(item => item.id),
    ["sticker", "title", "background"]);
});

test("Không dựng nút từ ID lớp đã mất khi mở nháp cũ", () => {
  const doc = fixture();
  doc.scenes[0].elementIds.push("missing");
  assert.equal(sceneLayerEntries(doc, "scene-a", null).length, 3);
  assert.deepEqual(sceneLayerEntries({ scenes: [], elements: [] }, null, null), []);
});

test("Đổi tên, sắp xếp cảnh, chế độ và policy đều làm mới DOM cảnh", () => {
  const doc = fixture();
  const original = sceneStructureKey(doc, false, "sender");
  assert.notEqual(original, sceneStructureKey(doc, true, "sender"));
  assert.notEqual(original, sceneStructureKey(doc, false, "creator-template"));
  doc.scenes[1].name = "Lời chúc";
  assert.notEqual(original, sceneStructureKey(doc, false, "sender"));
  doc.scenes.reverse();
  assert.notEqual(original, sceneStructureKey(doc, false, "sender"));
});

test("Chỉ sửa nội dung lớp không tạo lại nút chuyển cảnh, thumbnail cập nhật riêng", () => {
  const doc = fixture();
  const original = sceneStructureKey(doc, false, "sender");
  doc.elements[1].name = "Tiêu đề mới";
  assert.equal(original, sceneStructureKey(doc, false, "sender"));
});

test("Chế độ nhanh không tạo danh sách Layer và không đọc Canvas quá sớm", () => {
  let called = false;
  const host = { replaceChildren() { called = true; } };
  const panel = createSceneLayerPanel({
    main: { querySelector: selector => selector === ".editor-layers" ? host : null },
    getDocument() { throw new Error("Không nên đọc document"); },
    isQuickMode: () => true,
    getSceneId: () => null,
    getSelection: () => null,
    getPolicy: () => null,
  });
  panel.renderLayers();
  panel.renderScenes();
  panel.clear();
  assert.equal(called, true);
});

test("Designer dùng Scene/Layer Panel riêng, cache được xóa khi tải thiết kế", () => {
  const designer = readFileSync("web/js/pages/designer.js", "utf8");
  const panel = readFileSync("web/js/features/canvas-editor/scene-layer-panel.js", "utf8");
  assert.match(designer, /createSceneLayerPanel\(\{/);
  assert.match(designer, /sceneLayerPanel\.clear\(\)/);
  assert.match(designer, /const \{ renderLayers, renderScenes \} = sceneLayerPanel;/);
  assert.match(panel, /const sceneThumbs = new Map\(\)/);
  assert.match(panel, /focusTarget\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(panel, /"aria-pressed"/);
  assert.match(panel, /action === "scene-delete" && doc\.scenes\.length === 1/);
});
