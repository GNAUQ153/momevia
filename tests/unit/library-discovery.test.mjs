import assert from "node:assert/strict";
import test from "node:test";
import { catalog } from "../../web/js/features/canvas-editor/library.js";
import { addRecent, discoveryModes, filteredIds, readRecent } from "../../web/js/features/canvas-editor/library-discovery.js";

const ids = () => [...filteredIds(catalog)];

test("Thư viện giữ 172 mục, tìm kiếm không dấu và lọc nhóm không làm mất ID", () => {
  assert.equal(ids().length, 293);
  assert.deepEqual([...filteredIds(catalog, {mode:"new"})].length, 159);
  assert.equal([...filteredIds(catalog, {mode:"season"})].length > 24, true);
  const search = filteredIds(catalog, {query:"huong duong"});
  assert.deepEqual([...search], ["m55-sunflower"]);
  const group = catalog.findIndex(x => x.label.includes("Du lịch & ký ức"));
  assert.equal(filteredIds(catalog, {group:String(group)}).size, 8);
  assert.equal(filteredIds(catalog, {query:"chuoi khong co"}).size, 0);
  assert.equal(discoveryModes.length, 4);
});

test("Mục vừa dùng chỉ lưu ID hợp lệ, loại trùng và giới hạn 12", () => {
  assert.deepEqual(readRecent("not-json", catalog), []);
  assert.deepEqual(readRecent(JSON.stringify(["m55-camera", "bad-id", "m55-camera", "m54-snowflake"]), catalog),
    ["m55-camera", "m54-snowflake"]);
  const all = ids();
  let recent = [];
  for (const id of all.slice(0, 20)) recent = addRecent(recent, id, catalog);
  assert.equal(recent.length, 12);
  recent = addRecent(recent, all[10], catalog);
  assert.equal(recent[0], all[10]);
  assert.equal(new Set(recent).size, 12);
  assert.deepEqual(addRecent(recent, "unknown", catalog), recent);
  assert.deepEqual([...filteredIds(catalog, {mode:"recent", recent})],
    all.filter(id => recent.includes(id)));
});

test("Lọc theo chủ đề và từ khóa vẫn kết hợp độc lập", () => {
  assert.deepEqual([...filteredIds(catalog, {query:"bao li xi",mode:"season"})], ["m54-lucky-envelope"]);
  assert([...filteredIds(catalog, {query:"tet",mode:"new"})].length >= 1);
  assert.equal(filteredIds(catalog, {mode:"recent", recent:[]}).size, 0);
});
