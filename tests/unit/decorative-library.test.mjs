import test from "node:test";
import assert from "node:assert/strict";
import { decorativeArt } from "../../web/js/shared/canvas/decorative-art.js";
import { decorativeGroups, decorativeIds, decorativeNames } from "../../web/js/features/canvas-editor/decorations.js";
import { catalog, matchesBlock, stickerNames } from "../../web/js/features/canvas-editor/library.js";
import { stickerArt, vectorParts } from "../../web/js/shared/canvas/artwork.js";
import { createDocument, duplicateDocument, publicDocument, validateDocument } from "../../web/js/shared/canvas/index.js";
import { requiresCanvasV2 } from "../../web/js/shared/canvas/schema.js";
import { previewSvg } from "../../web/js/shared/canvas/cover-svg.js";

const cards = catalog.flatMap(group => group.items);
const decorations = cards.filter(item => item.id.startsWith("m54-"));

// Kiểm tra bản cũ không bị xóa, đổi tên hoặc đổi thứ tự trong thư viện.
test("100 elements cũ vẫn còn, 24 trang trí mới tạo bốn nhóm độc lập", () => {
  assert.equal(cards.length, 172);
  assert.equal(new Set(cards.map(item => item.id)).size, 172);
  assert.equal(decorations.length, 24);
  assert.deepEqual(decorativeGroups.slice(0, 4).map(([, items]) => items.length), [6, 6, 6, 6]);
  assert.deepEqual(decorativeIds.slice().sort(), decorations.map(item => item.id).sort());
  assert.deepEqual(catalog.filter(group => !group.label.startsWith("Kho trang trí · ")).map(group => group.items.length),
    [15, 14, 15, 21, 12, 8, 15]);
});

test("Tên, tìm kiếm không dấu và nhóm chủ đề hiển thị đúng", () => {
  for (const block of decorations) {
    assert.equal(stickerNames[block.id], decorativeNames[block.id]);
    assert(matchesBlock(block, block.title), block.id);
    assert(matchesBlock(block, "hinh trang tri"), block.id);
    assert(Object.hasOwn(stickerArt, block.id));
  }
  assert(matchesBlock(decorations.find(item => item.id === "m54-lucky-envelope"), "li xi"));
  assert(matchesBlock(decorations.find(item => item.id === "m54-christmas-tree"), "noel"));
  assert(matchesBlock(decorations.find(item => item.id === "m54-double-hearts"), "valentine"));
});

test("Tất cả SVG path là hình học nội bộ, không chứa script, URL hay markup", () => {
  for (const [id, paths] of Object.entries(decorativeArt)) {
    assert.match(id, /^m54-[a-z-]+$/);
    assert.equal(paths.length, 2, id);
    assert(paths.some(Boolean), id);
    for (const path of paths) {
      assert.equal(typeof path, "string");
      assert(path.length < 1600, id);
      assert(!/[<>{};@]|(?:url|script|foreignObject|javascript|data:)/i.test(path), id);
      assert(/^[MmLlHhVvCcSsQqTtAaZz\s\d.,+\-]*$/.test(path), id);
    }
  }
});

test("24 ảnh vector đều tạo layer hợp lệ, tương thích V2, public và preview SVG", () => {
  for (const card of decorations) {
    const document = createDocument({ presetId: "envelope-basic" });
    const original = structuredClone(document);
    const [element] = card.create();
    assert.equal(element.type, "sticker");
    assert.equal(element.props.stickerId, card.id);
    assert.equal(element.actions, undefined);
    assert.equal(element.accessibility.decorative, true);
    const vector = vectorParts(element);
    assert(vector?.length >= 1 && vector?.length <= 2, card.id);
    document.elements.push(element);
    document.scenes[0].elementIds.push(element.id);
    assert.equal(requiresCanvasV2(document), true);
    document.schemaVersion = document.registryVersion = 2;
    assert.deepEqual(validateDocument(document), document, card.id);
    const duplicate = duplicateDocument(document);
    assert.equal(duplicate.elements.length, document.elements.length, card.id);
    const publicCopy = publicDocument(document);
    assert.equal(publicCopy.elements.at(-1).props.stickerId, card.id);
    assert.match(previewSvg(publicCopy), /<path /, card.id);
    assert.equal(original.schemaVersion, 1);
  }
});

test("Hai lần chèn cùng sticker tạo ID khác nhau, không đụng metadata khác", () => {
  const block = decorations[0];
  const one = block.create()[0];
  const two = block.create()[0];
  assert.notEqual(one.id, two.id);
  assert.equal(one.props.stickerId, two.props.stickerId);
  one.props.color = "#AABBCC";
  assert.notEqual(one.props.color, two.props.color);
});
