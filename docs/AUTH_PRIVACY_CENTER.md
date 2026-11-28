# Auth V4C.2 — Privacy Center

## Cách sử dụng

Sau khi tích hợp V4C.1, đăng nhập và chọn **Quyền riêng tư và dữ liệu** trong menu tài khoản (desktop hoặc mobile), hoặc mở `/privacy-center`. Trang dùng hai API GET hiện có: `/api/auth/consent` và `/api/auth/policies/:version`. Không ghi dữ liệu consent, không lưu bằng chứng trong bộ nhớ trình duyệt bền vững và không nhận userId để xem dữ liệu tài khoản khác.

Các trạng thái được giữ nguyên theo API: `digest-matched`, `version-only`, `not-recorded`, `archive-unavailable`, `digest-mismatch`, `unrecognized`. Lỗi tải không được chuyển thành trạng thái chưa có bằng chứng. Bản lưu hiển thị đúng ngôn ngữ lúc xác nhận và giữ nguyên văn bản nguồn. Thời điểm được trình bày theo UTC. Không xem digest là chữ ký điện tử hoặc bằng chứng đã đọc.

Yêu cầu truy cập, sửa, thu hồi hoặc xóa dữ liệu đi qua chức năng liên hệ hỗ trợ hiện có. Trang chưa tự thực hiện các quyền này, chưa quản lý nhiều lần đồng ý, chưa công bố chính sách dự thảo.

## Kiểm thử

```sh
node --test tests/unit/privacy-center.test.mjs tests/unit/policy-archive.test.mjs tests/unit/registration-consent.test.mjs tests/unit/oauth-consent.test.mjs
```

Nghiệm thu local: mở menu với từng vai trò, kiểm tra phiên hết hạn, tài khoản cũ không có bằng chứng, tài khoản mới, xem bản lưu, đổi VI/EN và logout. Dùng dữ liệu QA, không dùng thông tin cá nhân thật.
