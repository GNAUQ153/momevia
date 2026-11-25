# Phase 2.5B — Thời hạn và gia hạn thiệp

- Sender thấy cảnh báo khi thiệp đang mở còn tối đa 7 ngày. Không gửi mail tự động.
- `GIFT_RENEWAL_DAYS=0` (mặc định) tắt gia hạn. Chỉ thử 1–30 trên môi trường local/QA độc lập sau khi xác nhận điều khoản sản phẩm. Không bật production khi chưa chốt chính sách Free/Premium.
- Gia hạn một lần, trước hạn, trong 7 ngày cuối; cộng số ngày cố định vào hạn cũ theo UTC. Không thay đổi `GIFT_TTL_DAYS` hoặc tự gia hạn thiệp cũ.
- POST `/api/gifts/gifts/mine/:slug/renew` với `{ "expectedExpiresAt": "<hạn ISO từ owner API>" }`. Chủ thiệp được xác định qua session. Không nhận số ngày từ client. Retry cùng hạn cũ không cộng thêm lần nữa.
- Thiệp expired, revoked, archived hoặc thời hạn lỗi không được gia hạn. Giữ slug, token, ảnh, snapshot, replies và RSVP. Không thay đổi thời điểm đóng RSVP theo giờ sự kiện.
- MySQL khóa hàng và cập nhật `expires_at` cùng payload; JSON dùng thao tác mutate hiện có. Không có migration. Không cấp/hoàn publication credit.
- Trước production: chạy full CI, kiểm tra MySQL QA thật, sao lưu; chốt điều khoản gia hạn và giới hạn lưu trữ. Frontend Hostinger cần build mới để hiện cảnh báo/nút; backend Railway phải cập nhật trước. Tắt cờ không hoàn tác hạn đã gia hạn.
