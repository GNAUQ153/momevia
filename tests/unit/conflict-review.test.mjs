import test from "node:test";
import assert from "node:assert/strict";
import { summarizeCanvasConflict } from "../../web/js/features/canvas-editor/conflict-review.js";

const canvas = (extras = {}) => ({
  title: "Lời chúc",
  document: {
    scenes: [{ id: "scene-1", name: "Đầu", elementIds: ["layer-1"] }],
    elements: [{ id: "layer-1", type: "text", props: { text: "A" } }],
    assets: [], bindings: { message: { value: "Chúc mừng" } },
    width: 720, ...extras,
  },
});

test("Identical drafts report no differences without mutating originals", () => {
  const local = canvas(), remote = { ...structuredClone(local), revision: 7 };
  const before = JSON.stringify(local);
  const summary = summarizeCanvasConflict({ local, remote, localRevision: 6 });
  assert.equal(summary.sameDocument, true);
  assert.equal(summary.changedCount, 0);
  assert.equal(summary.localRevision, 6);
  assert.equal(summary.serverRevision, 7);
  assert.equal(JSON.stringify(local), before);
});

test("An edited layer with unchanged layer count is still marked changed", () => {
  const local = canvas(), remote = { ...canvas(), revision: 8 };
  remote.document.elements[0].props.text = "B";
  const summary = summarizeCanvasConflict({ local, remote, localRevision: 7 });
  assert.equal(summary.categories.find(row => row.key === "layers").changed, true);
  assert.equal(summary.categories.find(row => row.key === "layers").local, "1");
  assert.equal(summary.categories.find(row => row.key === "layers").remote, "1");
});

test("Title, added scenes, and distinct binding values are compared without reordering", () => {
  const local = canvas();
  const remote = { ...canvas(), title: "Một lời chúc", revision: 9 };
  remote.document.scenes.push({ id: "scene-2", name: "Sau", elementIds: [] });
  remote.document.bindings.message.value = "Một lời nhắn khác";
  const summary = summarizeCanvasConflict({ local, remote, localRevision: 5 });
  assert.equal(summary.changedCount, 3);
  assert.equal(summary.bindings[0].key, "message");
  assert.equal(summary.bindings[0].changed, true);
});

test("Other top-level canvas settings are checked without declaring a false match", () => {
  const local = canvas(), remote = { ...canvas(), revision: 6 };
  remote.document.width = 1080;
  const summary = summarizeCanvasConflict({ local, remote });
  assert.equal(summary.categories.find(row => row.key === "other").changed, true);
  assert.equal(summary.sameDocument, false);
});

test("Invalid or missing snapshots fail closed", () => {
  assert.throws(() => summarizeCanvasConflict(), /Thiếu bản/);
  assert.throws(() => summarizeCanvasConflict({ local: canvas(), remote: { title: "X", document: {} } }), /Cấu trúc/);
  assert.equal(summarizeCanvasConflict({ local: canvas(), remote: { ...canvas(), revision: -10 }, localRevision: -2 }).serverRevision, null);
});

test("Long and unknown bindings do not expand preview indefinitely", () => {
  const local = canvas();
  for (let i = 0; i < 20; i++) local.document.bindings[`field-${i}`] = { value: "x" };
  const summary = summarizeCanvasConflict({ local, remote: { ...canvas(), revision: 1 } });
  assert.equal(summary.bindings.length, 8);
  assert.equal(summary.bindingCount, 21);
  assert.equal(summary.categories.find(row => row.key === "bindings").changed, true);
});

test("Comparison stays separate from autosave, recovery keys, API mutations and server reload", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../../web/js/features/canvas-editor/conflict-review.js", import.meta.url), "utf8"));
  assert.equal(/session\.save\(|fetch\(|localStorage|sessionStorage|\.replace\(/.test(source), false);
});
