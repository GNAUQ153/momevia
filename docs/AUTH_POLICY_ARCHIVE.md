# Auth V4C.1 — Lưu phiên bản chính sách và đọc bằng chứng đăng ký

Bản chụp `src/modules/identity/policy-archive/2026-11-28.1.json` gồm nội dung Quy định chung, Chính sách bảo mật, cảnh báo dự thảo và lời xác nhận checkbox VI/EN đúng với dictionary baseline. Không sửa nội dung pháp lý hoặc tuyên bố bản dự thảo đã được duyệt.

- `GET /api/auth/policies/2026-11-28.1`: công khai bản chụp, gồm hai ngôn ngữ; phiên bản không tồn tại trả 404. Không đọc đường dẫn do client cung cấp.
- `GET /api/auth/consent`: yêu cầu session hợp lệ, trả bằng chứng đăng ký của chính tài khoản; bỏ qua userId do client cung cấp, không trả email, mật khẩu, hồ sơ OAuth hoặc trường tùy ý. Cache-Control: no-store.
- SHA-256 tính trên JSON `[version, status, locale, entries]`, entries là danh sách cặp key/value sắp xếp tăng dần theo key. Digest đại diện nội dung bản chụp, không phải chữ ký điện tử hay bằng chứng độc lập rằng người dùng đã đọc chính sách.
- `digest-matched`: digest lưu cùng consent khớp bản chụp; `version-only`: dữ liệu V4A/V4B có phiên bản nhưng chưa lưu digest; `not-recorded`: không có bằng chứng; `archive-unavailable`, `digest-mismatch`, `unrecognized`: cần kiểm tra. Không sửa dữ liệu cũ để tạo bằng chứng hồi tố.
- Dữ liệu mới dùng trường `registrationConsent.policyDigest` trong payload hiện có. Không migration; không thay đổi phiên đăng nhập của tài khoản hiện có.

## Khi cập nhật chính sách

1. Rà soát và phê duyệt nội dung, xác định ngày hiệu lực và phạm vi đồng ý. Giữ nguyên bản chụp cũ.
2. Tạo file JSON phiên bản mới, đăng ký trong Map của `policy-archive.mjs`, tăng `registrationPolicyVersion`, đồng bộ VI/EN. Không sửa nội dung archive cũ.
3. Chạy `node --test tests/unit/policy-archive.test.mjs tests/unit/registration-consent.test.mjs tests/unit/oauth-consent.test.mjs`. Test cố định digest phiên bản đầu và so sánh nội dung phiên bản hiện tại với dictionary. Thêm test cố định digest cho phiên bản mới.
4. Triển khai frontend/backend đồng bộ. Chưa tự ép tài khoản cũ đồng ý lại, chưa bổ sung luồng thu hồi, lưu lịch sử nhiều lần xác nhận hay UI quản lý consent cho người dùng. Thiết kế các chức năng này riêng sau khi xác định nghiệp vụ retention, xóa tài khoản, thiệp đã xuất bản và các nghĩa vụ lưu trữ.

Bản này chỉ triển khai nền tảng lưu phiên bản và đọc receipt; không thay thế rà soát pháp lý hoặc kiểm thử MySQL/OAuth thực tế.
