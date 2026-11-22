import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vi from "../../web/assets/locales/vi.json" with { type: "json" };
import en from "../../web/assets/locales/en.json" with { type: "json" };
import { translate } from "../../web/js/shared/locale.js";
import {
  isValidGiftAccess,
  giftAccessDescriptions,
  openGiftAccessDialog,
} from "../../web/js/features/canvas-editor/gift-access-dialog.js";

const access = (open = "link", send = "link", read = "link") => ({ open, send, read });

test("Quyền mở/gửi/đọc chấp nhận các tổ hợp hợp lệ", () => {
  for (const open of ["link", "invite"])
    for (const send of ["link", "invite", "disabled"])
      for (const read of ["link", "invite", "sender"])
        assert.equal(isValidGiftAccess(access(open, send, read)), true);
});

test("Từ chối quyền thiếu, sai kiểu hoặc không thuộc lựa chọn được phép", () => {
  for (const entry of [
    null, undefined, false, "link", {},
    { open: "link", send: "link" },
    access("everyone", "link", "link"),
    access("link", "all", "link"),
    access("link", "link", "admin"),
  ]) assert.equal(isValidGiftAccess(entry), false);
});

test("Liên kết thường luôn có mô tả quyền xem", () => {
  const summaries = giftAccessDescriptions(access());
  assert.deepEqual(summaries.map(item => item.key), ["editor.interface.normalLink"]);
  assert.equal(translate(vi, "vi", summaries[0].key, { description: summaries[0].description }),
    "Link thường. Mở được quà. Gửi được lời đáp. Đọc được lời đáp.");
});

test("Quyền theo lời mời hiển thị cả mô tả link thường và link mời", () => {
  const summaries = giftAccessDescriptions(access("invite", "disabled", "sender"));
  assert.deepEqual(summaries.map(item => item.key), [
    "editor.interface.normalLink", "editor.interface.inviteLink",
  ]);
  assert.ok(translate(vi, "vi", summaries[1].key, { description: summaries[1].description })
    .includes("Đã tắt gửi lời đáp"));
});

test("Mô tả quyền dùng VI/EN thực sự, không nhúng chuỗi tiếng Việt vào English", () => {
  const summaries = giftAccessDescriptions(access("invite", "disabled", "sender"));
  const english = summaries.map(item => translate(en, "en", item.key, { description: item.description }));
  assert.equal(english.length, 2);
  assert.ok(english[0].startsWith("Regular link."));
  assert.ok(english[1].startsWith("Invitation link."));
  assert.ok(english[1].includes("Replies are disabled."));
  assert.ok(english[1].includes("Only the sender can read replies."));
  assert.ok(!english.join(" ").includes("Mở được quà"));
});

test("Giá trị quyền không hợp lệ không phát sinh mô tả sai", () => {
  assert.deepEqual(giftAccessDescriptions(access("unknown", "link", "sender")), []);
});

test("Route đã đóng không mở hộp thoại hay giữ thao tác xuất bản chờ", async () => {
  const lifecycle = new AbortController();
  lifecycle.abort();
  assert.equal(await openGiftAccessDialog({ signal: lifecycle.signal }), null);
});

test("Designer dùng module riêng và không đưa quyền lên API trước khi người dùng chọn", () => {
  const source = readFileSync("web/js/pages/designer.js", "utf8");
  const giftDialog = readFileSync("web/js/features/canvas-editor/gift-access-dialog.js", "utf8");
  assert.match(source, /openGiftAccessDialog\(\{ message, signal, dialogs \}\)/);
  assert.match(source, /const access = await chooseGiftAccess\(\);/);
  assert.match(source, /if \(!access \|\| disposed\) return;/);
  assert.match(source, /request\("\/gifts\/gifts\/from-design", \{/);
  assert.match(giftDialog, /signal\?\.addEventListener\("abort", close/);
});

test("Player xem trước có riêng vòng đời và giải phóng khi rời Designer", () => {
  const source = readFileSync("web/js/pages/designer.js", "utf8");
  const preview = readFileSync("web/js/features/canvas-editor/preview-dialog.js", "utf8");
  assert.match(source, /closePreview = openCanvasPreview\(/);
  assert.match(source, /closePreview\?\.\(\);/);
  assert.match(preview, /player\?\.dispose\(\)/);
  assert.match(preview, /if \(closed\) return;/);
  assert.match(preview, /mode: "preview"/);
});
