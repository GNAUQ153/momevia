# Auth V4A — xác nhận chính sách khi đăng ký email

API POST `/api/auth/register` yêu cầu `consent: { terms: true, privacy: true, version: "2026-11-28.1" }`. Đây là thay đổi hợp đồng API: frontend và backend phải phát hành đồng bộ. Không áp dụng riêng backend lên Railway khi Hostinger còn bản cũ. Client cũ sẽ bị từ chối đăng ký, không mất tài khoản hiện có.

Thời điểm, mục đích, nguồn và phiên bản được ghi trong `registrationConsent` trên bản ghi người dùng khi INSERT. MySQL hiện lưu bản ghi đầy đủ trong `legacy_payload` (JSON), nên không thêm migration; JSON repository lưu trực tiếp. `publicUser` không xuất dữ liệu này. Không thu IP hoặc user-agent cho mục đích này. Tài khoản cũ, provisioning nội bộ và OAuth không được tự ghi nhận đồng ý. Chưa hỗ trợ quản lý lịch sử thu hồi, cập nhật consent hay xuất bằng chứng cho Admin.

Phiên bản `2026-11-28.1` là mã kỹ thuật cho nội dung hiện tại, không phải chứng nhận pháp lý. Khi đổi nội dung điều khoản/quyền riêng tư, cần lưu bản nội dung VI/EN đã phát hành, tăng `registrationPolicyVersion` trong `web/js/shared/registration-consent.js`, rồi triển khai đồng bộ. Không dùng giá trị mặc định true ở server. Các fixture QA dùng boolean true một cách tường minh với dữ liệu giả.

OAuth Google/Zalo vẫn chưa được bảo vệ bởi consent này: cần flow xác nhận dành cho người dùng mới sau callback, ràng buộc với phiên OAuth đã xác minh, chống replay, không cấp session trước khi hoàn thành và không ép tài khoản cũ đăng ký lại. V4A chưa giải quyết yêu cầu này. Không triển khai production với tuyên bố đã hoàn thiện consent cho mọi phương thức đăng ký.

Kiểm thử: `node --test tests/unit/registration-consent.test.mjs tests/unit/credentials.test.mjs tests/unit/sessions.test.mjs`.
