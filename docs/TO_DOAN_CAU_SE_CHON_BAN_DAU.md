# “Tớ đoán cậu sẽ chọn…” — bản đầu và demo cho Hà

Ngày 21/11/2026. Nhánh `feat/guess-your-choice`, nền `main` / `54a4c83`. Tệp kế hoạch ban đầu được giữ nguyên. Chưa push hoặc triển khai production.

## Link demo của An · HTTPS cục bộ

**[Mở quà của An](https://127.0.0.1:4110/g/lUGrEO_gfhWPOp3WOi5wm7VWLd9BLfAr)** · **[Trang chia sẻ / QR](https://127.0.0.1:4110/success/lUGrEO_gfhWPOp3WOi5wm7VWLd9BLfAr)** · **[Nháp của Minh](https://127.0.0.1:4110/design/031a9375-e2ca-4851-b921-dbcbc5584c89?mode=quick)**

Theo yêu cầu mới, **Cloudflare đã ngắt**; các link công khai cũ không còn dùng. Demo hiện dùng chứng chỉ HTTPS trực tiếp trên **4110**, profile `local/web-demo-20261118`, giữ kho dữ liệu đang cấu hình. Cổng 4100 không bị thay đổi. Chứng chỉ thử localhost tự ký chưa được trình duyệt tin cậy; không tự cài CA vào máy.

```powershell
npm run demo:https
```

Link trên chỉ dành cho máy chạy dự án; chưa mở được từ điện thoại qua Internet. Khi có VPS và tên miền thật, đưa ứng dụng lên máy chủ và cấp chứng chỉ tin cậy theo [hướng dẫn HTTPS](HTTPS_CERTIFICATES.md). Cấu hình chứng chỉ không tự chuyển dữ liệu lên VPS.

Minh tặng An, dự đoán **A · Quán mì hồi năm nhất**. Cùng món quà cho cả hai nhánh; **Chơi lại** hoặc tải lại để quay từ đầu. Người nhận không cần đăng nhập; nháp/trang chia sẻ cần Sender. Mật khẩu ở `local/web-demo-20261118/tai-khoan-demo.json`. Thời hạn quà hiện tại đến 21/11/2027 hoặc khi người gửi thu hồi. Bằng chứng kiểm tra HTTPS cục bộ và quà còn đọc được: `local/web-demo-20261118/certificate-qa.json`.

Tạo quà khác: **Thư viện → tìm “Tớ đoán” → Dùng mẫu**. Dùng nhãn **“Mẫu thử sinh nhật”** trên clip quay ở demo. Kịch bản bên dưới vẫn áp dụng khi quay trên máy hoặc sau khi triển khai trên VPS.

## Kịch bản quay dọc cho Hà · 18 giây

Dùng khung 9:16, xuất 1080 × 1920. Mở sẵn **link quà của An**, ngôn ngữ VI; giữ máy dọc. Tải lại trước mỗi lượt. Với chuyển động bình thường, lựa chọn hiện ngay; dự đoán/lý do hiện sau khoảng 0,35 giây, lời kết sau khoảng 5,35 giây từ cú chạm. Chế độ giảm chuyển động hiện ngay toàn bộ kết quả. Khi quay cần nhịp giữ chữ, tắt chế độ giảm chuyển động của máy hoặc giữ/cắt khung khi dựng.

| Mốc | Hà quay | Chữ dẫn / lưu ý |
|---|---|---|
| 0–3 giây | Bìa có câu hỏi và hai lựa chọn. | “Bạn thân 7 năm đoán mình chọn món nào?” |
| 3–7 giây | Giữ A/B để khán giả chọn thầm; cuối đoạn chạm **Để Minh vào bếp**. | Không vào màn kết trước cú chạm. |
| 7–12 giây | “Cậu vừa chọn · Để Minh vào bếp”, rồi **Minh đã đoán · Quán mì hồi năm nhất** và “Lần nào đi ngang quán cũ cậu cũng nhìn vào.” | Giữ chữ đọc được khi tắt tiếng; có thể giữ thêm khung khi dựng. |
| 12–16 giây | “Trật rồi! Để tớ nấu. Nhớ rồi, phần cậu không hành.” | Nhấn câu **“Nhớ rồi, phần cậu không hành.”** |
| 16–18 giây | Khung cuối Momevia / tên tính năng. | Thêm nhãn **“Mẫu thử sinh nhật”** trên clip, vì đang quay môi trường demo. |

Quay nhánh A: chạm **Chơi lại** hoặc tải lại **cùng link**, chọn **Quán mì hồi năm nhất**. Dự đoán vẫn là A; lời kết là “Biết ngay! Thứ Bảy ghé quán cũ, lần này tớ mời.” Không sửa dự đoán hoặc xuất bản lại giữa hai lần quay.

## Phần đã triển khai

- Thêm mẫu miễn phí, bản xem mẫu và ảnh bìa VI/EN. Thẻ `prediction-choice` cùng một cảnh; không có cảnh kết để điều hướng tới trước khi chọn.
- Biểu mẫu Dùng mẫu có tên hai bên, câu hỏi, A/B, nhóm radio duy nhất hiển thị đúng hai nhãn đang nhập, lý do và hai lời kết. Cả chế độ Dùng mẫu và bảng Chỉnh bố cục sửa cùng dữ liệu. Dự đoán dùng mã `A`/`B`, không so khớp nhãn.
- Khai báo/kiểm tra dữ liệu Canvas V2 dùng chung client/server; cho phép trường còn trống khi lưu nháp. Phát hành yêu cầu câu hỏi, hai lựa chọn khác nhau sau chuẩn hóa khoảng trắng (và không chỉ khác chữ hoa/thường), một dự đoán, lý do, hai kết. Báo đúng trường, có nút đưa focus vào trường đó, giữ nội dung đã nhập. Mẫu này không yêu cầu ô lời chúc chung không dùng; nếu thêm lại lớp lời chúc chung thì vẫn phải nhập ô đó.
- Xem thử và link công khai dùng chung renderer. Trước chọn không dựng nội dung kết quả trong DOM/cây trợ năng. Sau chọn: lựa chọn → dự đoán/lý do → kết đúng nhánh; khóa lần chọn đầu, có Chơi lại. Không lưu lượt chọn lên máy chủ hay bộ nhớ bền của trình duyệt.
- Dữ liệu được chốt qua snapshot xuất bản sẵn có, giữ luồng quyền mở, thời hạn, thu hồi, chia sẻ và QR. Tặng lại tạo nháp mới đã xóa toàn bộ tên/nội dung/dự đoán cũ. Không cần migration cơ sở dữ liệu cho kiểu dữ liệu này.
- Nút lựa chọn nhiều dòng, bàn phím Enter/Space, focus kết quả, vùng thông báo `aria-live`, giảm chuyển động và nhãn VI/EN. Lời người gửi không bị dịch khi đổi ngôn ngữ. Thẻ mới được tạo từ mẫu và có thể sửa/nhân bản trong bố cục; chưa thêm một mục mới vào bộ 172 thẻ ở bảng Thêm.

## Kiểm chứng

Môi trường: Windows, Node 24.14.0, backend JSON riêng, Edge chạy tự động. Màn hình điện thoại **mô phỏng** 390 × 844 có touch; kiểm tra nhãn, lý do và lời kết dài ở 320 × 740, kể cả đưa lựa chọn mới vào vùng nhìn sau Chơi lại. Không có điện thoại vật lý, Safari/iOS, trình đọc màn hình thực hoặc lượt mở từ ứng dụng nhắn tin thật trong phiên này. Cây trợ năng được kiểm tra qua trình duyệt.

| Ca trên quà đã xuất bản | Quan sát |
|---|---|
| Đoán A, chọn A | Đoán quán mì; chọn quán mì; lý do và kết A. |
| Đoán A, chọn B | Vẫn đoán quán mì; chọn vào bếp; lý do và kết B, có “phần cậu không hành”. |
| Đoán B, chọn A | Đoán vào bếp; chọn quán mì; lý do và kết A. |
| Đoán B, chọn B | Đoán vào bếp; chọn vào bếp; lý do và kết B. |

Đã đi từ thư viện → bản xem mẫu → Dùng mẫu → lưu/tải lại nháp dở → điền/sửa nhãn → đổi chế độ → xem như người nhận → quyền mở → xuất bản → mở ở context người nhận riêng không dùng cookie Sender. Đối chiếu props snapshot với nháp trước khi xuất bản; tải và giải mã QR đúng URL đã phát hành. Thử chạm B/A/B liên tiếp, chơi lại, tải lại, sửa dự đoán/lý do trên nháp rồi đọc lại link A cũ, đổi ngôn ngữ sau khi chọn, tặng lại qua Studio, thu hồi quà thử B và mở lại, mở quà Canvas cũ và trạng thái đã thu hồi/hết hạn có sẵn. Thử nhịp bật mí bình thường, giảm chuyển động và tải lại khi bộ hẹn giờ còn chạy. Không có lỗi JavaScript hoặc vi phạm CSP ở các ca mới.

Các lệnh và kết quả cuối cùng:

- `npm run build`: PASS, 25 bìa mẫu và 2.318 khóa dịch VI/EN.
- `npm run check`: PASS cú pháp, scope, locale và nhãn giao diện.
- `TEST_ACCOUNT_ENABLED=false npm test`: **497/497 PASS** (gồm hai ca cấu hình HTTPS bổ sung). Trên PowerShell đặt `$env:TEST_ACCOUNT_ENABLED='false'` trước khi chạy; giá trị này loại ảnh hưởng cấu hình tài khoản thử kế thừa từ máy chạy.
- `npm run test:templates`: PASS luồng API 25 mẫu, lưu/mở lại, mẫu miễn phí/trả phí, danh mục đã có dữ liệu và client cũ.
- `npm run test:prediction:browser`: PASS; tự tạo môi trường tạm riêng, đi đầy đủ luồng giao diện và bốn tổ hợp. Link trong `local/prediction-browser-latest/result.json` chỉ là bằng chứng tạm, không dùng để quay.
- `node tests/browser/prediction-choice.mjs`: PASS trước đó trên profile thử 4116; bằng chứng vẫn giữ trong `local/web-demo-4116/prediction-qa`. HTTPS 4110 được kiểm tra bổ sung riêng trong `local/web-demo-20261118/https-qa.json`. Lệnh này tạo quà QA mới; không cần chạy để dùng lại món quà đã bàn giao.
- `npm run test:canvas:browser`: PASS toàn bộ. Kiểm tra hồi quy bộ 172 thẻ, 33 hiệu ứng, Canvas/legacy, quyền link/QR, Creator, lưu/mất mạng và các mẫu cũ.

Bằng chứng văn bản trong `local/prediction-*-results.txt`; ảnh các nhánh `recipient-A-A-390.png`, `recipient-A-B-390.png`, `recipient-B-A-390.png`, `recipient-B-B-390.png`, `recipient-question-390.png`, `long-label-320.png`, `sender-ready-390.png` trong thư mục QA của demo. `final-demo-check.json` và `final-demo-A-390.png` / `final-demo-B-390.png` xác nhận riêng đúng link đã bàn giao có đủ nội dung yêu cầu và mở cả hai nhánh ẩn danh.

## Giới hạn còn ảnh hưởng sử dụng/quay

1. Chưa phát hành production. Cloudflare đã ngắt; hiện chỉ có HTTPS cục bộ. Cần VPS/tên miền và chứng chỉ thật để mở từ xa.
2. Chưa có bằng chứng điện thoại thật, Safari/iOS hoặc VoiceOver/NVDA. Chưa chạy kiểm thử MySQL thật vì không có cấu hình schema QA cô lập; đã kiểm chứng JSON và bộ unit dùng chung.
3. Đây là bất ngờ trong giao diện. Người được quyền mở nhận dữ liệu snapshot gồm dự đoán và hai kết xuống trình duyệt như Canvas hiện tại.
4. Lượt chọn chỉ trong lượt chơi; chưa có thống kê, gửi lựa chọn về Studio hoặc chốt lịch. Hai bên tiếp tục hẹn nhau qua ứng dụng nhắn tin.
