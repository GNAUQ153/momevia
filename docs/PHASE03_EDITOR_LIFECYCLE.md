# Phase 3.4D — Component Lifecycle & Memory Cleanup

Baseline: Git archive `5a5fc99dc7d6746a176daeb1619a0aa8d9e842d0` (Phase 3.4C).

## Phạm vi

- `trapDialog`: sở hữu AbortController riêng cho mỗi dialog, hủy listener khi đóng bằng nút, Escape, sự kiện close native hoặc abort route; tháo listener abort khỏi parent. Đóng nhiều lần không lặp callback. Không lấy focus từ route mới khi parent abort.
- Preview, Gift Access và form gửi mẫu Creator: listener chỉ sống trong dialog. Gift Access resolve `null` khi hủy route. Dialog so sánh revision cũng đóng theo route. Không hủy yêu cầu gửi mẫu đã gửi đến server chỉ vì đóng dialog; request vẫn thuộc Editor.
- Sound Editor: không mở sau khi route đã hủy, dùng signal riêng cho fetch danh mục và nguồn âm thanh; dispose player/trimmer và loại dialog khỏi tập đăng ký. Không thay đổi chính sách upload, định dạng âm thanh hoặc tính năng xuất bản.
- Fabric Studio: kiểm tra lại abort sau khi chờ font và sau tải paper texture, trước khi tiếp tục dùng Canvas. Giữ nguyên phương thức dispose Fabric hiện có.
- Stage: dispose idempotent, hủy RAF đang kéo layer, giải phóng pointer capture, xóa cache motion và chỉ xóa DOM do Stage sở hữu. Không commit text từ callback đóng Stage.
- Designer: xóa Clipboard và cache thư viện khi nạp lại thiết kế; dispose Clipboard, xóa cache và chặn ResizeObserver cũ khi đóng. Giữ Store, revision, Auto Save, recovery và beforeLeave hiện hành.

## Nghiệm thu

Chạy `node --test tests/unit/phase03-editor-lifecycle.test.mjs tests/unit/phase03-designer-events.test.mjs tests/unit/designer-dialog-refactor.test.mjs`.

Các ca mới kiểm tra 20 vòng đóng/mở dialog, cleanup native/cancel, abort route không lấy focus, không mở dialog đã hủy, Gift Access resolve, hủy fetch âm thanh, Stage không xóa DOM mới và Clipboard không ghi sau dispose. DOM fixture không thay thế trình duyệt thật.

Sau khi cài dependency theo lockfile: `npm run build`, `npm run check`, `npm test`, `npm run test:browser`, `npm run test:canvas:browser`, `npm run test:sfx`. Kiểm thử local/QA độc lập, không dùng MySQL production.

Kiểm tra thủ công: mở/đóng Preview và Sound Editor lặp lại; rời route trong khi tải Fabric hoặc âm thanh; kiểm tra Escape, phím tắt, focus, nháp chưa lưu, phục hồi và Undo/Redo; kiểm tra VI/EN. Trong Chrome DevTools, so sánh Heap Snapshot sau GC ở cùng trạng thái route qua nhiều vòng mount/unmount. Không coi số heap tuyệt đối hoặc số dòng mã là bằng chứng đã hết memory leak.

Không có migration, dependency, API, CSS hoặc chính sách production mới. Chưa đo heap/CPU trong browser; chưa kiểm thử Fabric thực tế khi font đang tải; decodeAudioData đã bắt đầu không thể được hủy trực tiếp bằng AbortSignal. Không thay đổi luồng lưu nháp hoặc bật tính năng tài chính QA.
