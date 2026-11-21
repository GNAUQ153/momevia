# Hiệu ứng lặp và điều khiển riêng trong Canvas

Hoàn thành trên `plan/event-card-redesign`, ngày 21/11/2026. Bong bóng, bướm, pháo hoa và hoa nở có cấu hình **độc lập theo từng cảnh**: bật/tắt, tốc độ Chậm/Vừa/Nhanh, mật độ Thưa/Vừa/Dày và Lặp lại. Có thể bật nhiều hiệu ứng cùng lúc; tắt không làm mất tốc độ/mật độ đã chọn.

Commit triển khai: `155a642`.

## Cách dùng

**Canvas → chọn cảnh → Chỉnh → Không khí chạy lặp**. Mỗi hiệu ứng có hàng chỉnh riêng và nút xem thử riêng. Nút Xem trước chung phát toàn bộ cấu hình của cảnh. Các giá trị được lưu trong nháp, giữ qua tải lại và đưa vào snapshot khi phát hành.

Ba mẫu mới bật lặp sẵn cho những hiệu ứng đang dùng trong từng trang:

- [Sinh nhật](http://127.0.0.1:4182/template/birthday-radiance?preview=1)
- [Đám cưới](http://127.0.0.1:4182/template/hai-phong-bi?preview=1)
- [Tốt nghiệp](http://127.0.0.1:4182/template/proud-of-you?preview=1)

[Ảnh bộ chỉnh Canvas](canvas-controls.png) · [GIF minh họa cả bốn hiệu ứng chạy lặp](birthday-radiance-motion.gif) · [Kết quả kiểm tra](results.json).

Các nháp/quà trước đó không tự đổi hành vi. Hiệu ứng một lượt cũ vẫn chạy một lượt; khi sửa trong Canvas có thể chuyển riêng sang lặp. Cấu hình mới dùng `scene.effects.celebrations` với bốn khóa B05–B08; schema kiểm chặt kiểu, tốc độ, mật độ và chỉ cho đặt trên cảnh. Không đổi giá hoặc quyền.

## Vòng đời và hiệu năng

Mỗi hiệu ứng chạy theo đợt có giới hạn; chỉ tạo đợt tiếp theo khi đợt trước kết thúc. Tối đa một lớp đang hoạt động cho mỗi hiệu ứng, không cộng dồn lớp qua các vòng. Chuyển cảnh, đóng player, tắt chuyển động hoặc bật giảm chuyển động đều hủy animation và bộ hẹn giờ. Ẩn tab tạm dừng, hiện tab tiếp tục. Bật lại chuyển động khởi động lại đúng các hiệu ứng được bật trong cảnh.

Chuyển động dùng cơ chế WAAPI và token tốc độ sẵn có; không vòng JS mỗi frame hoặc thêm thư viện. Kiểm thử 12,5 giây với cả bốn hiệu ứng ghi nhận 5/3/7/5 lượt, tối đa 4 lớp cùng lúc. Mẫu đo trên Edge desktop với CPU mô phỏng 4×: 144 khoảng khung hình, p95 khoảng 16,8 ms. Đây không phải kết quả trên điện thoại vật lý.

## Kiểm thử

- PASS: bốn cấu hình khác nhau chọn trong Canvas, lưu, tải lại; tắt/bật riêng vẫn giữ tùy chọn và không đổi các hiệu ứng còn lại.
- PASS: xem thử một hiệu ứng không phát các hiệu ứng khác; bốn hiệu ứng có thể chạy đồng thời trong quà công khai.
- PASS: lặp qua nhiều đợt, số lớp không tăng; tắt/bật chung, giảm chuyển động, ẩn/hiện tab mô phỏng và chuyển cảnh đều dừng/tiếp tục đúng.
- PASS: bố cục Canvas tại 320/390/768/1440 px; kiểm dữ liệu V2, duplicate/public projection, cấu hình sai bị từ chối và hành vi cũ không bị chuyển thành lặp.
- PASS: build/check, 384 bài unit, `test:templates`.
- PASS: MySQL 8.4.13 cô lập, gồm 13 ca gốc và tạo/lưu/phát hành/ghim ảnh/tặng lại cả ba mẫu với cấu hình mới.
- PASS: toàn bộ `test:canvas:browser` trên bản nguồn đã commit `65eaa54` cộng thay đổi web của lượt này. Bản sao cô lập chỉ điều chỉnh sao chép dependency để theo junction Windows; không đổi bất kỳ assertion nào.

Lượt `test:canvas:browser` chạy trực tiếp trên thư mục làm việc chung hiện dừng ở `tests/integration/canvas.mjs:167`: ca kiểm nguồn gọi mong 403 nhưng nhận 201. Các tệp backend kiểm nguồn gọi đang có thay đổi ngoài phạm vi; chúng được giữ nguyên, không stage hoặc sửa để làm test xanh. Bộ kiểm riêng cho hiệu ứng và bản hồi quy cô lập nêu trên đã đạt.

Nguồn được đối chiếu trực tiếp ở schema/effects dùng chung, bộ chỉnh Designer, vòng đời player và scheduler. Áp dụng hướng dẫn về mẫu chỉnh sửa được, chuyển động và hiệu năng đã dùng ở các lượt trước. Không push hoặc triển khai máy chủ. Bản xem thử 4182 dùng dữ liệu thử riêng.
