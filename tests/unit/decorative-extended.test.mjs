import { EVENT_CLUSTER_IDS } from '../../web/js/shared/canvas/event-clusters.js';
import assert from "node:assert/strict";
import test from "node:test";
import { extendedArt } from "../../web/js/shared/canvas/decorative-art-55.js";
import { extendedCollections } from "../../web/js/features/canvas-editor/decorative-sets-55.js";
import { extendedDecorativeIds, decorativeGroups } from "../../web/js/features/canvas-editor/decorations.js";
import { catalog, matchesBlock } from "../../web/js/features/canvas-editor/library.js";
import { stickerArt, vectorParts } from "../../web/js/shared/canvas/artwork.js";
import { createDocument, duplicateDocument, publicDocument, validateDocument } from "../../web/js/shared/canvas/index.js";
import { requiresCanvasV2 } from "../../web/js/shared/canvas/schema.js";
import { previewSvg } from "../../web/js/shared/canvas/cover-svg.js";

const cards = catalog.flatMap(group => group.items);
const extended = cards.filter(block => block.id.startsWith("m55-"));

test("Không mất 100 khối gốc, 24 trang trí cũ; đủ 48 vector ở sáu nhóm mới", () => {
  assert.equal(cards.length, 293);
  assert.equal(new Set(cards.map(item => item.id)).size, 293);
  assert.equal(cards.filter(item => !/^m5[45]-/.test(item.id) && !item.id.startsWith('object-') && !item.id.startsWith('natural-') && !item.id.startsWith('motion-') && !EVENT_CLUSTER_IDS.includes(item.id) && item.id!=='sound-button').length, 100);
  assert.equal(cards.filter(item => item.id.startsWith("m54-")).length, 24);
  assert.equal(extended.length, 48);
  assert.equal(Object.keys(extendedArt).length, 48);
  assert.deepEqual(extendedDecorativeIds.slice().sort(), extended.map(item => item.id).sort());
  assert.deepEqual(extendedCollections.map(([, entries]) => entries.length), [8, 8, 8, 8, 8, 8]);
  assert.deepEqual(decorativeGroups.map(([, entries]) => entries.length), [6, 6, 6, 6, 8, 8, 8, 8, 8, 8]);
});

test("SVG chỉ chứa đường path nội bộ, không cho script, HTML, URL hoặc CSS", () => {
  for (const [id, pair] of Object.entries(extendedArt)) {
    assert.match(id, /^m55-[a-z-]+$/);
    assert.equal(pair.length, 2, id);
    assert(pair[0].length > 8 && pair[1].length > 8, id);
    for (const path of pair) {
      assert(path.length < 1600, id);
      assert.match(path, /^[MmLlHhVvCcSsQqTtAaZz\s\d.,+\-]*$/, id);
      assert.doesNotMatch(path, /[<>{};@]|(?:url|script|foreignObject|javascript|data:)/i, id);
    }
  }
});

test("48 hình có metadata, từ khóa có dấu/không dấu, ID và màu hợp lệ", () => {
  for (const block of extended) {
    assert(Object.hasOwn(stickerArt, block.id), block.id);
    assert(matchesBlock(block, block.title), block.id);
    assert(matchesBlock(block, block.group), block.id);
    assert(matchesBlock(block, "hinh trang tri"), block.id);
    const [element] = block.create();
    assert.match(element.props.color, /^#[0-9A-Fa-f]{6}$/);
    assert.equal(element.type, "sticker");
    assert.equal(element.props.stickerId, block.id);
    assert.equal(element.accessibility.decorative, true);
    assert.equal(element.actions, undefined);
    assert.equal(vectorParts(element).length, 2);
    assert.notEqual(element.id, block.create()[0].id);
  }
});

test("48 hình có thể lưu, nhân bản, xuất bản và render cover SVG trên schema V2", () => {
  for (const block of extended) {
    const document = createDocument({presetId:"envelope-basic"});
    const [element] = block.create();
    document.elements.push(element);
    document.scenes[0].elementIds.push(element.id);
    assert.equal(requiresCanvasV2(document), true, block.id);
    document.schemaVersion = document.registryVersion = 2;
    assert.deepEqual(validateDocument(document), document, block.id);
    assert.equal(duplicateDocument(document).elements.at(-1).props.stickerId, block.id);
    const copy = publicDocument(document);
    assert.equal(copy.elements.at(-1).props.stickerId, block.id);
    assert.match(previewSvg(copy), /<path /, block.id);
  }
});
