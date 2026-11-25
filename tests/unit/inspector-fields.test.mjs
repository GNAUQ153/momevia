import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "../../web/js/shared/canvas/registry.js";
import {
  buildInspectorPropertyFields,
  buildInspectorGeometryFields,
  geometryOutsideCanvas,
  canEditInspectorField,
  canUseInspectorAction,
  lockInspectorControls,
} from "../../web/js/features/canvas-editor/inspector-fields.js";

// DOM tối giản để kiểm tra cấu trúc control mà không cần khởi động browser.
class MockNode {
  constructor(tag, text = "") {
    this.tag = tag;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.textContent = text;
    this.disabled = false;
  }
  append(...items) { this.children.push(...items); }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name.startsWith("data-"))
      this.dataset[name.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())] = String(value);
  }
  removeAttribute(name) { delete this.attributes[name]; }
}
const previousDocument = globalThis.document;
globalThis.document = {
  createElement: name => new MockNode(name),
  createTextNode: value => new MockNode("#text", value),
};
// Chỉ test các trường; không gọi render toàn bộ ứng dụng.
function descendants(items) {
  const values = Array.isArray(items) ? items : [items];
  return values.flatMap(item => item && typeof item === "object"
    ? [item, ...descendants(item.children || [])] : []);
}
const fields = controls => descendants(controls)
  .filter(item => item.dataset?.editorField).map(item => item.dataset.editorField);
const actions = controls => descendants(controls)
  .filter(item => item.dataset?.editorAction).map(item => item.dataset.editorAction);

test("Inspector chỉ dựng trường chung của từng loại, không nhân đôi text/crop", () => {
  const cases = {
    text: ["props.color"],
    shape: ["props.kind", "props.color", "props.strokeColor", "props.strokeWidth", "props.radius"],
    line: ["props.color", "props.strokeWidth"],
    sticker: ["props.stickerId", "props.color"],
    image: ["props.fit", "props.radius"],
    button: ["props.label", "props.color"],
    reply: ["props.title", "props.submitLabel"],
    interaction: [],
  };
  for (const [type, expected] of Object.entries(cases)) {
    const item = createElement(type);
    const actual = fields(buildInspectorPropertyFields(item));
    assert.deepEqual(actual, expected, type);
    assert.equal(new Set(actual).size, actual.length);
  }
});

test("Các trường ảnh tùy chọn không làm lộ điều khiển không được định nghĩa", () => {
  const image = createElement("image", { props: { mask: "round", caption: "Ngày đầu", optional: true } });
  const values = fields(buildInspectorPropertyFields(image));
  assert.ok(values.includes("props.mask"));
  assert.ok(values.includes("props.caption"));
  assert.ok(!values.includes("props.optional"));
  assert.ok(!values.includes("props.maskPath"));
});

test("Trường hình học giữ đủ 5 toạ độ, opacity và 6 thao tác Layer", () => {
  const shape = createElement("shape", { opacity: 0.72 });
  const controls = buildInspectorGeometryFields(shape, { width: 1000, height: 1000 });
  assert.deepEqual(fields(controls), ["layout.x", "layout.y", "layout.width", "layout.height", "layout.rotation", "element.opacity"]);
  assert.deepEqual(actions(controls), ["center", "inside", "layer-visibility", "layer-lock", "layer-up", "layer-down", "element-duplicate", "element-delete"]);
  const opacity = descendants(controls).find(el => el.dataset?.editorField === "element.opacity");
  assert.equal(opacity.value, 28);
});

test("Kiểm tra hình học phát hiện ra khỏi artboard cả bốn phía", () => {
  const size = { width: 400, height: 300 };
  const valid = { x: 0, y: 0, width: 400, height: 300 };
  assert.equal(geometryOutsideCanvas(valid, size), false);
  for (const bad of [{ x: -1 }, { y: -0.1 }, { x: 1 }, { y: 1 }])
    assert.equal(geometryOutsideCanvas({ ...valid, ...bad }, size), true);
  const item = createElement("shape", { layout: { ...valid, x: -1 } });
  assert.equal(descendants(buildInspectorGeometryFields(item, size))
    .some(el => el.tag === "p" && el.className === "editor-help"), true);
});

test("Mặc định không mở khóa field không được policy cho phép", () => {
  const allowed = ["color", "focalPoint", "assetId"];
  for (const key of ["props.color", "crop.x", "crop.y", "upload"])
    assert.equal(canEditInspectorField(key, allowed), true, key);
  for (const key of ["layout.x", "scene.color", "element.opacity", "props.text", "props.constructor", "action.type", "accessibility.alt", "", null])
    assert.equal(canEditInspectorField(key, allowed), false, String(key));
  assert.equal(canEditInspectorField("props.color", "color"), false);
});

test("Action theo policy chỉ giữ Close và chức năng được cấp quyền", () => {
  assert.equal(canUseInspectorAction("close-sheet"), true);
  assert.equal(canUseInspectorAction("text-align", ["align"]), true);
  assert.equal(canUseInspectorAction("text-font", ["fontToken"]), true);
  assert.equal(canUseInspectorAction("inline-text", [], true), true);
  for (const action of ["effect-remove", "element-delete", "scene-delete", "center", "layer-lock"])
    assert.equal(canUseInspectorAction(action, ["align", "fontToken"], true), false);
  assert.equal(canUseInspectorAction("inline-text", [], false), false);
});

test("Khóa Inspector áp dụng vào DOM nhưng vẫn cho phép đóng panel", () => {
  const controls = [
    ...["props.color", "props.text", "crop.x", "upload", "layout.x"].map(key => ({ dataset: { editorField: key }, disabled: false })),
    ...["close-sheet", "text-font", "element-delete"].map(key => ({ dataset: { editorAction: key }, disabled: false })),
  ];
  const host = {
    children: [{}, {}],
    insertBefore(item) { this.notice = item; },
    querySelectorAll(selector) { return selector === "[data-editor-field]" ? controls.slice(0, 5) : controls.slice(5); },
  };
  lockInspectorControls(host, { editableProps: ["color", "focalPoint"] }, false);
  assert.deepEqual(controls.map(c => c.disabled), [false, true, false, true, true, false, true, true]);
  assert.equal(host.notice.className, "editor-help");
});

test("Không có policy không thay đổi trạng thái điều khiển", () => {
  let changed = false;
  lockInspectorControls({ insertBefore() { changed = true; }, querySelectorAll() { changed = true; } }, null);
  assert.equal(changed, false);
});

test("Designer kết nối module Inspector, không tự sao chép luật khóa", () => {
  const designer = readFileSync("web/js/pages/designer.js", "utf8");
  const source = readFileSync("web/js/features/canvas-editor/inspector-panel.js", "utf8");
  assert.match(designer, /createInspectorPanel\(\{/);
  assert.match(source, /buildInspectorPropertyFields\(element\)/);
  assert.match(source, /buildInspectorGeometryFields\(element, store\.get\(\)\.document\.artboard\.baseSize\)/);
  assert.match(source, /lockInspectorControls\(host, policy/);
  assert.match(source, /host\.querySelectorAll\("\[data-editor-field\], \[data-editor-action='effect-remove'\]"\)/);
  assert.doesNotMatch(source, /for \(const key of element\.type === "interaction" \? \[\] : registry\[element\.type\]\.inspector\)/);
});

test.after(() => {
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
});
