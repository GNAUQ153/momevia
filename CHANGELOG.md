## Unreleased - Khắc phục browser CI (2026-11-28)

- Thu gọn khoảng cách giữa bộ mẫu và phần hành trình trên desktop, giữ kiểm tra giới hạn khoảng trắng hiện có.
- Đồng bộ kỳ vọng Catalog/MySQL với bộ 16 Originals và kiểm tra carousel quay vòng đủ 16 mẫu.

## Unreleased - UI theo mùa và bộ 16 thiệp (2026-11-27)

- Làm lại hero, chữ, màu và chuyển động CSS 3D; dùng cùng bố cục VI/EN.
- Thêm chiến dịch Giáng sinh, năm mới, đoàn viên, có tắt hiệu ứng và hỗ trợ giảm chuyển động/tiết kiệm dữ liệu.
- Thiết kế lại 16 Originals với lời dẫn riêng, 4 cảnh nối tiếp, đường bỏ qua hiệu ứng và ảnh cover phù hợp Catalog.
- Ưu tiên 16 mẫu hệ thống, giữ nguyên giá, quyền, nháp và quà đã phát hành.
- Bổ sung nguồn cấu hình và build Hostinger, đề xuất cập nhật thư viện có revision, cùng báo cáo kỹ thuật/nghiệp vụ.
- Chưa triển khai lên Hostinger/Railway hoặc áp dụng cập nhật MySQL.

## Unreleased — Signature S5B (2026-11-27)

- Thêm sáu hiệu ứng mở thiệp riêng trên layer Signature, sử dụng nút chạm/bàn phím và lifecycle motion hiện có.
- Giữ rotation, opacity và artwork của Sender; nhận diện qua kind để hoạt động khi nhân bản.
- Bổ sung nhãn VI/EN, giảm chuyển động và hủy animation khi rời cảnh; tiếp tục giữ Catalog QA riêng.

## Unreleased — Signature S5A Local Review (2026-11-27)

- Cho phép xem và tạo nháp sáu mẫu Signature trong Catalog profile demo JSON riêng qua `--signature`; giữ production mặc định tắt.
- Nạp ảnh cover từ Canvas renderer theo quyền đọc Catalog, bổ sung metadata VI/EN và slot sự kiện cho Sender.
- Không chèn mẫu vào seed thương mại hoặc MySQL; chưa khôi phục animation đặc trưng.

## Unreleased — Signature S4 (2026-11-27)

- Tạo sáu Canvas template nghiệm thu nội bộ VI/EN với artwork Signature riêng, bốn cảnh và slot sự kiện, ảnh tùy chọn.
- Bổ sung factory và công cụ xuất JSON/SVG local; chưa kích hoạt Catalog hoặc MySQL seed, chưa triển khai opening riêng.
- Không thêm dependency, migration hoặc ảnh cá nhân.

## Unreleased — Signature S3 (2026-11-27)

- Cho phép đổi màu vector Signature chỉ có nét viền, giữ màu cố định và đường nét khi áp dụng Fabric.
- Giới hạn Inspector của vector Signature ở các thuộc tính có tác dụng; giữ điều khiển hình học và ảnh hiện tại.
- Cho phép sắp xếp ô ảnh tùy chọn chưa tải ảnh trong Fabric Studio, không thay đổi quyền Creator hoặc cho phép xuất ảnh placeholder.
- Bổ sung kiểm thử hồi quy theo 6 concept; không thêm dependency hoặc migration.

## Unreleased — Signature S2 (2026-11-27)

- Đăng ký sáu cụm artwork Signature vào thư viện Elements, hỗ trợ chèn 34 layer độc lập và tìm kiếm VI/EN.
- Bổ sung các mục thiếu trong MySQL theo giao dịch, giữ nguyên chỉnh sửa và trạng thái Admin; không tạo template công khai hoặc migration mới.
- Cập nhật kiểm thử số lượng Elements, giữ nguyên 293 mục cũ.

## Unreleased — Momevia Originals 16 (2026-11-27)

- Thêm 16 mẫu Canvas gốc VI/EN, 4 scene tương tác, artwork SVG và khung ảnh cá nhân hóa; giữ nguyên 28 mẫu cũ.
- Thêm dữ liệu thư viện thiếu theo giao dịch, không ghi đè bản sửa Admin; giá mẫu mới mặc định 0 VND để nghiệm thu.
- Bổ sung đếm ngược, bản đồ và lịch sự kiện theo thông tin công khai đã xác thực; tạm dừng nhạc khi phát bản ghi cá nhân.
- Không thêm dependency hoặc migration.

## Unreleased — Phase 4.6A Auth Aurora (2026-11-27)

- Làm mới bố cục Login/Register tối với artwork 3D tách khỏi nội dung, nút dùng gradient thương hiệu và typography tự xuống dòng.
- Giới hạn animation giới thiệu một lần trên desktop, giữ vùng bấm ổn định, focus rõ ràng và hỗ trợ reduced motion.
- Giữ nguyên OAuth, biểu mẫu, bản dịch VI/EN, tài khoản, phân quyền và dữ liệu; không thêm dependency.

## Unreleased — Phase 4.5H Catalog Acceptance (2026-11-27)

- Bổ sung kiểm thử liên kết renderer, giá mẫu, phân trang, quyền yêu thích Guest/Customer và phiên bản Creator bằng fixture.
- Nghiệm thu Catalog trên sáu cấu hình VI/EN bằng Browser E2E, đối chiếu giá API, bộ lọc, Preview, focus và điều hướng Back; lưu ảnh khi có thư mục artifact.
- Không thay đổi runtime, dữ liệu, dependency hoặc migration.

## Unreleased — Phase 4.5G Catalog Cover Loading (2026-11-27)

- Trì hoãn ảnh bộ sưu tập theo mùa và ảnh Creator trong lưới danh mục/yêu thích bằng bộ tải ảnh theo viewport hiện có.
- Giữ nguyên URL, kích thước ảnh, giá, bản dịch, ảnh Hero và ảnh trang chi tiết; không thêm cache dữ liệu người dùng hoặc dependency.
- Bổ sung kiểm thử markup, chuyển trạng thái tải ảnh và tái sử dụng ảnh khi lọc.

## Unreleased — Phase 4.5F.1 Preview Price Marker (2026-11-27)

- Đổi marker giá Preview để tránh trùng tiền tố với nút mở Preview; giữ nguyên giá và luồng tạo thiệp.
- Bổ sung kiểm thử hồi quy marker, không nới lỏng các kiểm thử Hero hiện có.

## Unreleased — Phase 4.5F Catalog Price Discovery (2026-11-27)

- Phân loại giá mẫu theo số nguyên VND hợp lệ; không coi giá thiếu, rỗng hoặc sai kiểu là miễn phí.
- Hiển thị giá và nhãn trả phí rõ ràng; đồng bộ giá trong Preview khi Hero đổi mẫu, giải thích phạm vi giá và quyền xuất bản bằng VI/EN.
- Giữ tuyến tạo thiệp, quyền sử dụng, thanh toán, dữ liệu và phân trang; không thêm dependency hoặc migration.

## Unreleased — Phase 4.5E Seasonal Collections (2026-11-27)

- Ưu tiên chiến dịch đang diễn ra, mùa sắp tới, sau đó các mùa đã qua; dữ liệu lịch thiếu không làm lỗi danh mục.
- Hiển thị nhãn theo mùa, tên dịp, giá thật và số mẫu; đồng bộ VI/EN, token, responsive, focus và reduced motion.
- Giữ danh sách chính, bộ lọc, quyền sử dụng mẫu và dữ liệu seed; không thêm dependency hoặc migration.

## Unreleased — Phase 4.5D Template Preview Experience (2026-11-27)

- Chuẩn hóa giao diện xem thử theo token, ưu tiên CTA dùng mẫu, trạng thái tải/lỗi rõ ràng và bố cục responsive.
- Giữ ghi chú mô phỏng trong suốt phiên xem; đặt lại trạng thái tải và vị trí cuộn khi mở lại, giữ cơ chế hủy request và dispose player.
- Giữ URL tạo thiệp, phiên bản mẫu, quyền truy cập và runtime hiện có; không thêm dependency hoặc migration.

## Unreleased — Phase 4.5C Catalog Card Motion (2026-11-27)

- Hiệu ứng nghiêng CSS 3D chỉ trên artwork khi dùng chuột, giữ nguyên vị trí nút yêu thích, vùng xem mẫu và metadata.
- Nhãn xem mẫu luôn hiện; tăng vùng chạm yêu thích, giữ focus và tắt chuyển động trên thiết bị cảm ứng hoặc khi giảm chuyển động.
- Đăng ký CSS trong cả gói đầy đủ và gói Catalog; bổ sung kiểm thử hợp đồng và hồi quy trình duyệt. Không thêm dependency hoặc migration.

## Unreleased — Phase 4.5B Catalog Active Filters (2026-11-27)

- Hiển thị điều kiện đang áp dụng, xóa từng chip và giữ các điều kiện còn lại; đồng bộ control, URL, focus và phân trang.
- Dùng nhãn VI/EN và token giao diện hiện có, escape dữ liệu; giữ API, giá, quyền và thuật toán lọc.
- Bổ sung sáu kiểm thử hồi quy, không thêm dependency hoặc migration.

## Unreleased — Phase 4.5A Catalog Layout (2026-11-27)

- Làm mới bố cục Catalog bằng token màu, spacing, radius và elevation hiện có.
- Chuẩn hóa lưới ba, hai và một cột; giữ focus, reduced motion và giao diện VI/EN.
- Giữ renderer, bộ lọc, phân trang, artwork, giá và quyền sử dụng mẫu. Không thêm dependency hoặc migration.
- Bổ sung năm kiểm thử hợp đồng CSS và cập nhật phiên bản stylesheet.

## Unreleased — Phase 4.4H.2 Marketing Performance Gate (2026-11-27)

- Bổ sung nghiệm thu báo cáo local-lab v2 theo ngân sách p75, kiểm tra đủ dữ liệu VI/EN và viewport.
- Phát hiện lỗi JavaScript, tràn ngang và cảnh báo suy giảm so với baseline; không thay đổi runtime hoặc database.
- Bổ sung 13 Unit Test; chưa đo INP và không suy diễn kết quả production từ lab.

## Unreleased — Phase 4.4H.1 Landing Performance (2026-11-27)

- Tạm ẩn Floating CTA khi nhập liệu trên thiết bị cảm ứng.
- Hạn chế đo DOM khi không cần kiểm tra va chạm.
- Bảo toàn Home Construction, Hero Carousel và reduced motion.

## Unreleased — Phase 4.4G.2 Carousel Accessibility (2026-11-27)

- Thêm điều khiển tạm dừng và tiếp tục Hero Carousel trên desktop; giữ chọn mẫu thủ công trên mobile và hỗ trợ bàn phím, VI/EN, reduced motion.
- CTA nổi nhường chỗ cho CTA sau khi mở quà và trong hiệu ứng dựng trang chủ. Giữ cơ chế animation, phân quyền và nghiệp vụ hiện có.
- Cập nhật kiểm thử Hero Carousel và CTA; không thêm dependency hoặc migration.

## Unreleased — Kiểm định thiết kế Canvas và thư viện thiệp (2026-11-27)

- Sửa bản xuất PNG trong Fabric Studio để giữ chú thích, mặt nạ ảnh, chữ cái mở đoạn và thứ tự các lớp hình. Hoàn tác, làm lại và nhân bản giữ đúng nội dung và kiểu dáng đã chỉnh.
- Cho nền giấy giãn theo lời chúc dài, chỉnh khoảng cách và độ tương phản trên thiệp. Bìa Catalog, bìa theo mùa và ảnh thu nhỏ tiếng Việt, tiếng Anh dùng cùng phiên bản thư viện.
- Cập nhật hình minh họa, biểu tượng, nhãn thư viện và bộ chọn màu nét để chi tiết dễ nhìn trên cả nền sáng lẫn nền tối.

## Unreleased — Nhóm khối trên canvas (2026-11-27)

- Khi thêm một khối nhiều lớp từ thư viện, người gửi có thể di chuyển, xoay, đổi kích thước hoặc nhân bản cả khối và vẫn chỉnh được từng ảnh, đoạn chữ. Các lớp rời trong nháp cũ có thể nhóm lại bằng thao tác chọn nhiều lớp.


## Unreleased — Phase 4.4F CTA Conversion (2026-11-27)

- Bổ sung CTA tạo thiệp sau khi mở quà mẫu, dùng chung hộp thoại chọn loại thiệp với Hero; chuyển replay thành hành động phụ, giữ focus, giao diện VI/EN và reduced motion. Không phát sinh giao dịch hoặc dữ liệu nghiệp vụ.

## Unreleased — Phase 4.4E Interactive Product Showcase (2026-11-27)

- Bổ sung mở/đóng quà mẫu tại bước Open của Interactive Journey, đồng bộ trạng thái ARIA và VI/EN; không gọi API, giữ chức năng vuốt và reduced motion.

## Unreleased — Phase 4.4D Interactive Bento (2026-11-27)

- Chuyển nhóm điều khiển hành trình thành Bento hai cột trên desktop, làm nổi bật bước tạo thiệp; giữ rail vuốt trên mobile, cảnh 3D, nội dung VI/EN và nghiệp vụ hiện có. Bổ sung liên kết ARIA, hướng dẫn bàn phím và kiểm thử bố cục.

## Unreleased — Phase 4.4C Scroll Reveal (2026-11-27)

- Thay reveal ẩn toàn section bằng hiệu ứng tiêu đề và chi tiết theo viewport, giới hạn stagger trên desktop; giữ nội dung luôn đọc được, bỏ chuyển động khi tab ẩn hoặc chế độ tĩnh, không dịch chuyển bố cục và CTA.

## Unreleased — Phase 4.4B Hero Mesh (2026-11-27)

- Bổ sung nền mesh gradient sau thiệp Hero, một lượt chuyển động 4,4 giây trên desktop; dùng chung vòng đời ambient, giữ nền tĩnh trên mobile và reduced motion, không thay đổi bố cục hoặc nghiệp vụ.

## Unreleased — Phase 4.4A.1 Featured Spacing Hotfix (2026-11-27)

- Dùng token khoảng đệm 24px cho mục mẫu thiệp từ 681px, đồng nhất VI/EN và giữ ngưỡng kiểm thử khoảng cách Hero–Featured hiện tại.

## Unreleased — Phase 4.4A Hero Visual Depth (2026-11-27)

- Làm mới sân khấu thiệp với phong bì CSS 3D, ánh sáng và màu nhận diện; giới hạn lớp trang trí trên màn hình hẹp, tôn trọng reduced motion và giữ preview, CTA, VI/EN, Canvas cùng nghiệp vụ hiện tại.

## Unreleased — Phase 4.3E.1 Accessibility Hotfix (2026-11-27)

- Phối hợp khóa inert giữa modal và animation CTA; giữ khóa còn hiệu lực khi animation dừng hoặc hoàn tất. Bổ sung regression, không bỏ assertion browser smoke.

## Unreleased — Phase 4.3E Accessibility (2026-11-27)

- Củng cố skip link, focus và cô lập vùng nền modal, tắt cuộn mượt khi giảm chuyển động; bổ sung regression VI/EN, giữ nguyên nghiệp vụ và Canvas.

## Unreleased — Phase 4.3D Typography Scale (2026-11-27)

- Chuẩn hóa cỡ chữ responsive cho Hero, Catalog và Pricing bằng token rem/clamp, đồng bộ cascade và chiều cao dòng; giữ typography Canvas, Auth và Workspace.

## Unreleased — Phase 4.3C Card & Feedback (2026-11-27)

- Đồng bộ thẻ mẫu, nhãn giá và trạng thái rỗng Catalog; tách điều khiển focus hộp thoại app shell và thông báo toast, giữ binding VI/EN, hỗ trợ reduced motion và bảo toàn nghiệp vụ giá, Canvas, database.

## Unreleased — Phase 4.3B.1 Browser Test Hotfix (2026-11-27)

- Sửa kiểm thử focus của ô tìm kiếm Catalog bằng ownerDocument của phần tử để tương thích ESLint no-undef trong Node.js, giữ nguyên điều kiện kiểm thử và hành vi ứng dụng.

## Unreleased — Phase 4.3B Interactive Controls (2026-11-27)

- Chuẩn hóa nút marketing, trường tìm kiếm và bộ lọc danh mục bằng token chung; bổ sung nút xóa riêng từ khóa có nhãn VI/EN, giữ bộ lọc và focus. Giữ nguyên Auth, Canvas, thanh toán và database.

## Unreleased — Phase 4.3A Layout Foundation (2026-11-27)

- Chuẩn hóa thang khoảng cách, container responsive, độ bo góc và bóng đổ marketing; giữ breakpoint, hình học Canvas và bố cục Auth hiện tại. Đồng bộ Hero, carousel, hành trình và hộp thoại tạo thiệp qua token chung.

## Unreleased — Phase 4.2 Hệ màu nhận diện (2026-11-27)

- Chuẩn hóa token màu thương hiệu, trạng thái, gradient và CTA marketing; tăng tương phản viền điều khiển và khoảng cách dòng tiêu đề. Giữ màu Auth, Workspace và Canvas cũ. Bổ sung kiểm thử tương phản và nghiệm thu VI/EN.

## Unreleased — Phase 4.1.1 Bảo toàn giấy phép font (2026-11-26)

- Giữ nguyên byte ba giấy phép OFL mới, miễn kiểm tra khoảng trắng cuối dòng riêng ba file license; cập nhật tài liệu nguồn font self-hosted. Không đổi font, CSS, nghiệp vụ hoặc database.

## Unreleased — Phase 4.1 Typography (2026-11-26)

- Đổi token nhận diện sang Bricolage Grotesque, Be Vietnam Pro và Fraunces; giữ bộ font nội dung Canvas cũ, sửa phân cấp tiêu đề marketing. Thêm công cụ tải WOFF2 và OFL thủ công, xác minh checksum trước build; không tải font từ bên ngoài khi chạy website.

## Unreleased — Phase 3.8 Nghiệm thu kỹ thuật (2026-11-26)

- Tổng hợp audit kiến trúc, CSS, font, migration và nợ kỹ thuật; chặn import tương đối chưa rà soát, yêu cầu vendor đã build trong Quality Gate. Phân biệt nghiệm thu source và production readiness; không đổi runtime, dữ liệu hoặc giao diện.

## Unreleased — Phase 3.7C Chuẩn hóa CSS và kiểm kê tài nguyên (2026-11-26)

- Mở rộng kiểm tra toàn bộ stylesheet nguồn, bao gồm @font-face; tách các rule viết dồn dòng và giữ nguyên thứ tự cascade. Thêm audit tài nguyên chỉ đọc, thống kê dung lượng, bản sao byte và kiểm tra manifest font; không xóa tài nguyên hoặc đổi dependency.

## Unreleased — Phase 3.7B Chuẩn hóa thời gian MySQL (2026-11-26)

- Gom chuyển đổi thời gian UTC vào tầng Infrastructure, giảm phụ thuộc Repository vào Identity; giữ export tương thích, hành vi null và lỗi hiện tại. Không đổi SQL, schema, API hoặc giao diện.

## Unreleased — Tách và hợp con trỏ dựng trang chủ (2026-11-27)

- Các con trỏ ảo tách ra từ vị trí chuột khi bắt đầu dựng trang; sau khi hết phần tử và nội dung đang tải, trang cuộn lên đầu rồi các con trỏ hội tụ về vị trí chuột hiện tại.
- Giữ cơ chế chia việc cho 15 con trỏ, hủy hiệu ứng theo vòng đời trang và tùy chọn giảm chuyển động; kiểm thử hội tụ khi chuột di chuyển và hủy giữa chừng.

## Unreleased — Hiệu ứng con trỏ dựng trang chủ (2026-11-26)

- Thêm 15 con trỏ dựng từng phần tử trên trang chủ, nhận việc từ hàng đợi chung theo vùng hiển thị và cập nhật khi đổi kích thước cửa sổ hoặc tải xong danh mục.
- Giữ chuyển động liên tục giữa các phần tử và khu vực; tự cuộn để mở thêm nội dung rồi quay lại đầu trang khi hoàn tất. Tạm dừng vòng quay thiệp và carousel trong lượt dựng.
- Hỗ trợ giảm chuyển động, tiết kiệm dữ liệu và dọn animation khi rời trang; bổ sung kiểm thử phân việc, phụ thuộc khung cha, nhiều khu vực cùng hiển thị, resize và hủy route.


## Unreleased — Khôi phục giao diện Auth tối từ d36c664 (2026-11-26)

- Khôi phục nguyên stylesheet Auth tại `d36c664` cho nền tím–mận có lưới, thẻ kính, chữ sáng và nút gradient hồng–tím của Login/Register, gồm logo Zalo nội bộ đã có.
- Giới hạn lớp màu sáng dùng chung để không ghi đè Auth; giữ nền sáng cho các trang khác và recovery. Đổi phiên bản URL CSS để tránh cache cũ.
- Bổ sung kiểm tra Chrome trên 24 màn VI/EN từ 320–1920 px, xác nhận màu sau cascade, responsive, toggle mật khẩu, ngôn ngữ, đăng ký và đăng nhập email. Không đổi logic xác thực, OAuth, mật khẩu hoặc dữ liệu.

## Unreleased — Tiếp tục bàn giao UI/UX B1a, B2 và XLSX (2026-11-26)

- Trang chia sẻ ghi rõ nút sao chép link mời/link thường theo VI/EN; giữ thứ tự theo quyền mở, URL, chia sẻ, QR và mô tả quyền.
- Chi tiết mẫu trên mobile theo thứ tự tên, giá, bìa, hành động; desktop giữ hai cột. Gom toolbar preview, giữ phát lại, dùng mẫu, đóng và ngôn ngữ; nút nổi nhường chỗ khi CTA trong nội dung còn nhìn thấy.
- Nút tải danh sách XLSX giới hạn theo vùng chứa và xuống dòng ở màn nhỏ. Bổ sung kiểm tra Chrome VI/EN, chữ lớn, đúng phiên bản, retry, focus và quay lại bộ lọc; không đổi API, giá, dữ liệu hoặc dependency.

## Unreleased — Phase 3.7A Rà soát mã dư thừa (2026-11-26)

- Bổ sung audit AST chỉ đọc cho export và module chưa thấy consumer; phân biệt test/tool, giữ module tương thích, thu hẹp hai hằng nội bộ. Không xóa tính năng, đổi API HTTP hoặc schema.

## Unreleased — Phase 3.6E Đo tải Backend local (2026-11-26)

- Bổ sung benchmark GET loopback opt-in cho Catalog VI/EN và thumbnail 200/304, giới hạn tải, timeout, báo cáo tổng hợp và quy trình đánh giá chi phí Railway. Không đổi runtime, dữ liệu hoặc schema.

## Unreleased — Phase 3.6D Tối ưu tải ảnh Frontend (2026-11-26)

- Chặn callback lazy loading cũ và giữ ưu tiên tải ảnh Carousel; không preload dự đoán Catalog khi bật tiết kiệm dữ liệu. Giữ giao diện, bản dịch, font, API và schema hiện tại.

## Unreleased — Phase 3.6C Cache và luồng tài nguyên (2026-11-26)

- Bổ sung ETag/HTTP 304 cho thumbnail mẫu tĩnh công khai, luôn xác thực lại; giữ no-store cho cover động và tài nguyên riêng tư. Dùng pipeline để đóng file stream khi client ngắt kết nối, không đổi quyền truy cập hoặc schema.

## Unreleased — Phase 3.6B Giới hạn tài nguyên thumbnail (2026-11-26)

- Giới hạn render thumbnail đồng thời, tách tác vụ đang xử lý khỏi LRU, giới hạn số tác vụ và dung lượng input/cache; từ chối quá tải rõ ràng và giải phóng slot khi lỗi. Giữ định dạng ảnh và schema.

## Unreleased — Phase 3.6A Giám sát hiệu năng Backend (2026-11-26)

- Bổ sung log hiệu năng tổng hợp opt-in theo cửa sổ, histogram cố định cho HTTP và MySQL, CPU/RAM và event loop; không ghi URL, SQL hoặc dữ liệu khách hàng. Không thay đổi schema hay API.

## Unreleased — Phase 3.5D Kiểm tra toàn vẹn dữ liệu (2026-11-26)

- Bổ sung audit 11 invariant liên bảng chỉ đọc theo opt-in, trả số lượng bất thường và không xuất ID khách hàng; kiểm thử rollback và phát hiện sai chủ/quyền, sai bằng chứng biên nhận. Không đổi schema hoặc dữ liệu.

## Unreleased — Phase 3.5C Quản lý kết nối MySQL (2026-11-26)

- Dùng chung MySqlClient tại Composition Root, giữ client riêng cho service độc lập; đóng pool một lần sau khi dừng module, kể cả startup lỗi. Chờ thao tác SQL đang chạy, hủy kết nối nếu rollback lỗi và chặn transaction đã kết thúc. Không thay đổi migration hoặc cấu hình kết nối.

## Unreleased — Phase 3.5B Tối ưu truy vấn và audit index (2026-11-26)

- Gom INSERT liên kết tài sản Canvas thành batch tối đa 100 dòng, giữ transaction và quyền sở hữu; bổ sung kiểm tra prefix index MySQL chỉ đọc và kiểm thử rollback. Không thay đổi migration.

## Unreleased — Phase 3.5A Sửa đóng gói release (2026-11-26)

- Đưa migration baseline vào allowlist release và kiểm thử nội dung, checksum manifest; tiếp tục loại dữ liệu xuất riêng tư. Không thay đổi SQL hoặc schema.

## Unreleased — Phase 3.5A Kiểm tra schema và migration (2026-11-26)

- Bổ sung audit migration offline, checksum lịch sử và kiểm tra metadata MySQL chỉ đọc theo prefix đã áp dụng. Không thay đổi migration, schema hoặc dữ liệu.

## Unreleased — Phase 3.4E Hồi quy kiến trúc Frontend (2026-11-26)

- Bổ sung kiểm thử vòng đời Featured Carousel sau PR #29, bao gồm focus, visibility, tiết kiệm dữ liệu, dispose và mount lại.
- Không tải trước ảnh ngoài cửa sổ khi carousel dừng; chặn observer trễ và cleanup lặp. Giữ API, schema, giá, giao diện và dependency hiện tại.

## Unreleased — Phase 3.4D Vòng đời Canvas Editor (2026-11-26)

- Cô lập listener theo dialog; giải phóng khi đóng, Escape hoặc hủy route, không giữ callback cũ. Chặn mở Fabric/Sound Editor muộn; hủy fetch âm thanh khi đóng.
- Dọn Clipboard, cache và Stage an toàn, giữ luồng lưu nháp và recovery. Bổ sung tám ca hồi quy; không đổi API, schema, CSS hoặc dependency.

## Unreleased — Phase 3.4C Tách xử lý sự kiện và Clipboard Canvas (2026-11-25)

- Tách keyboard handler, helper selection và clipboard action theo từng lần mount; giữ Store, commit, history, session, Fabric và API hiện có.
- Chặn phím đổi thứ tự layer rơi vào nhánh xóa khi bị khóa; xóa selection cũ khi chuyển cảnh trực tiếp hoặc khởi tạo lại. Mở rộng audit i18n và thêm kiểm thử hồi quy; không đổi CSS, schema hay dependency.

## Unreleased — Phase 3.4B Tách panel Canvas Designer (2026-11-25)

- Tách Inspector và bảng tài sản khỏi Designer; dùng getter lấy document, quyền, selection và clipboard hiện hành, giữ commit và event handler tại controller.
- Giữ cấu trúc control, focus, cache thumbnail và cơ chế khóa mẫu; mở rộng kiểm tra i18n sang hai file mới và bổ sung kiểm thử panel. Không đổi API, schema, CSS hoặc dependency.

## Unreleased — Phase 3.4A Điều phối hành động frontend (2026-11-25)

- Tách 56 action thành năm nhóm chuyên biệt, giữ listener và trạng thái hiện hành tại Application Controller; bổ sung dispatcher chống đăng ký trùng.
- Giữ API, guard bất đồng bộ và lazy loading; mở rộng kiểm tra i18n và thêm tám ca hồi quy. Không thay đổi UI, schema hay dependency.

## Unreleased — Phase 3.3 Chuẩn hóa Designs Repository (2026-11-25)

- Tách mapping SQL, helper transaction, tài sản và checkout context khỏi MySqlDesignsRepository; giữ class, export cũ, SQL và phạm vi transaction.
- JSON Repository chờ callback validation bất đồng bộ trước khi lưu, đồng nhất với MySQL; bổ sung kiểm thử contract và MySQL QA. Không đổi API, schema, dependency hoặc giao diện.

## Unreleased — Phase 3.2B Tách trách nhiệm thiết kế (2026-11-25)

- Tách hash, projection, chính sách khóa chỉnh sửa và preflight khỏi DesignsService; giữ constructor, method, export và callback transaction cũ.
- Bổ sung sáu ca hồi quy về quyền xuất bản, tài sản, projection và khóa mẫu; không đổi API, schema, GUI hoặc chính sách production.

## Unreleased — Phase 3.2A Tách phụ thuộc cấu hình (2026-11-25)

- Đưa policy cấu hình quota, gia hạn và validation thông tin đăng nhập về shared, giữ method và đường import cũ; sửa thông báo mật khẩu tài khoản test cho khớp giới hạn hiện hành.
- Loại bỏ vòng import tĩnh và ba cạnh phụ thuộc ngược đã ghi nhận; thu hẹp architecture baseline về rỗng, bổ sung sáu ca kiểm thử. Không đổi API, schema, frontend hoặc chính sách production.

## Unreleased — Phase 3.1 Kiểm tra kiến trúc (2026-11-25)

- Bổ sung audit AST, baseline cạnh phụ thuộc hiện hữu và quality gate chống phát sinh vòng import tĩnh/phụ thuộc ngược.
- Ghi nhận hotspot OOP, frontend, repository và pool MySQL; bổ sung sáu ca kiểm thử, không thay đổi runtime hoặc GUI.

## Unreleased — Phase 2.8 Nghiệm thu hồi quy nghiệp vụ (2026-11-25)

- Bổ sung năm ca liên kết service/repository JSON: duyệt mẫu, Free, Premium, RSVP/gia hạn/lưu trữ, hạ quyền Creator. Tất cả fixture dùng thư mục tạm và không gọi nhà cung cấp thanh toán.
- Bổ sung ma trận quyền Guest/Sender/Creator/Admin trên HTTP fixture hiện có; kiểm tra từ chối sai role trước khi xử lý báo cáo tài chính MySQL.
- Tài liệu nghiệm thu phân biệt kết quả CI, QA mô phỏng và điều kiện release production. Không thay đổi nghiệp vụ, schema, cấu hình triển khai hoặc GUI.

## Unreleased — Phase 2.7B Mô phỏng nhất quán hoàn tiền (2026-11-25)

- Bổ sung module nội bộ chỉ dành cho MySQL QA cô lập; mặc định tắt, không đăng ký API hoàn tiền hoặc gọi provider.
- Mô phỏng hoàn toàn phần cho đơn Sandbox có credit chưa tiêu hao, đối soát giao dịch gốc và đảo đúng bút toán Creator trong cùng transaction; giữ biên nhận gốc, khóa checkout và hồ sơ chờ provider.
- Bổ sung kiểm thử replay, rollback, dữ liệu sai, credit đã dùng và cạnh tranh hai kết nối. Không migration hoặc thay đổi production.

## Unreleased — Phase 2.7A Rà soát hoàn tiền (2026-11-25)

- Dùng chung chính sách biên nhận với yêu cầu hoàn tiền; từ chối hồ sơ mới khi đơn và bằng chứng nội bộ không nhất quán.
- Admin xem dữ liệu đối soát quyền, credit và số bút toán Creator; chưa có migration 018 thì báo chưa có dữ liệu credit. Không trả thêm dữ liệu giao dịch cho Buyer.
- Không thực hiện hoàn tiền, sửa ledger, thu hồi quyền hoặc kích hoạt quota; bổ sung unit và MySQL QA regression, VI/EN.

## Unreleased — Bộ bố cục thiệp Open Me (2026-11-26)

- Thêm ba tài liệu canvas VI/EN chỉnh sửa được với ID ổn định: club-22-invitation, cozy-christmas-invitation, tet-phong-thu; sinh bìa qua pipeline hiện hữu.
- Giữ binding, ngày/nơi hẹn, tương tác bàn phím, hồi đáp và nhạc chủ động. Nhận đúng slot sự kiện và focus RSVP của bố cục mới.
- Không thêm sản phẩm vào Catalog/seed, không gán giá, không migration hoặc cập nhật đè nháp/quà cũ. Đã loại đăng ký dữ liệu thử/cờ QA khỏi luồng sản phẩm.

## Unreleased — Điều khiển tên người nhận canvas (2026-11-26)

- Thêm vị trí gắn bộ chọn ngôn ngữ/đổi tên cho quà canvas ở chế độ người nhận tự điền tên.
- Giữ giao diện nhập tên và hồi đáp theo mã nhận riêng; kiểm thử đi qua hành động thật của thiệp, không dùng thanh cảnh của preview.

## Unreleased — Bố cục trình sửa canvas (2026-11-26)

- Tách rail công cụ/thư viện khối, tên cảnh hiện hành, canvas/thuộc tính và thumbnail cảnh; giữ hành động chính trên mobile.
- Giữ vị trí cuộn lớp khi chọn/đổi tên; quick mode không lộ công cụ layout. Hướng dẫn RSVP theo cấu hình sự kiện, không đổi quyền/lưu/Fabric.

## Unreleased — Không gian quản lý thiệp (2026-11-26)

- Gom phần giới thiệu Studio, giữ liên kết đến đúng mục nháp/quà/biên nhận và bộ lọc hiện có.
- Thẻ quà đã gửi dùng bố cục riêng để nhiều hành động không ép cột tên/nội dung quá hẹp. Không đổi API hay dữ liệu.

## Unreleased — Khám phá và mẫu nổi bật chuyển động (2026-11-26)

- Hero xoay vòng năm mẫu, mẫu tiếp theo hé sau; giữ hai tab nổi, góc 5° và khung gọn. Tạo thiệp chọn đúng loại và preview giữ nguồn/phiên bản.
- Mẫu nổi bật chọn tối đa 15 bản ghi Catalog, trượt trái từng thẻ mỗi 5 giây; giữ giá, yêu thích, Tab và vòng đời. Thu gọn bộ lọc và sửa wrap/focus toolbar preview ở cỡ chữ lớn.

## Unreleased — Đồng bộ hệ màu giao diện (2026-11-26)

- Dùng token chung cho nền giấy, bảng trắng, chữ, nút, trạng thái chọn và focus trên website, tài khoản và các vai trò.
- Giữ màu của canvas/thiệp và các animation; bổ sung stylesheet vào bundle đầy đủ và Catalog. Bỏ qua profile/đầu ra đánh giá giao diện cục bộ trong Git.

## Unreleased — Bố cục trải nghiệm và CTA responsive (2026-11-25)

- Gom tiêu đề, các bước và nút khám phá của phần trải nghiệm trang chủ vào cùng bố cục; xếp dọc trên tablet/điện thoại và giữ bước đang chọn trong thanh cuộn ngang.
- CTA nổi chuyển từ hàng ngang sang hai nút xếp dọc ở màn hình tối đa 600 px; giữ cỡ chữ, icon và vùng chạm trên điện thoại, căn cụm công cụ phía trên CTA.
- CTA trang Bảng giá hiện ổn định sau phần giới thiệu; giữ logic ẩn ở footer, hiện lại khi cuộn lên và nhường chỗ cho hộp thoại. Bổ sung kiểm thử hồi quy điều kiện hiển thị.


## Unreleased — Phase 2.6B Bằng chứng thanh toán (2026-11-25)

- Chuẩn hóa reference của payOS giữa inquiry và webhook; kiểm tra ID link, không tự xác nhận khoản chuyển nhiều lần.
- Chặn dữ liệu MoMo bị ép kiểu thành thành công; replay khác reference bị từ chối trước khi ghi. Hỗ trợ đối soát đơn bị mất ACK tạo link.
- Không migration, không mở khóa checkout hoặc kích hoạt quota production; thêm unit và MySQL QA regression.

## Unreleased — Phase 2.6A Đối soát biên nhận (2026-11-25)

- Kiểm tra biên nhận khớp đơn đã thanh toán, intent, nhà cung cấp, số tiền và mã tham chiếu; dùng chung điều kiện với báo cáo ngoại lệ Admin.
- Hiển thị mã đơn, ngày xác nhận UTC, nhãn thử nghiệm và lưu ý không phải hóa đơn VAT; giữ giao diện VI/EN và nút in hiện tại.
- Không migration, không sửa dữ liệu lịch sử hoặc thay đổi chính sách thanh toán; bổ sung kiểm thử unit, MySQL QA và browser.

## Unreleased — Sửa kiểm thử trình duyệt CI của PR #28 (2026-11-25)

- Giữ nhãn và bộ chọn bộ lọc trên cùng hàng ở màn hình hẹp để thẻ mẫu đầu tiên vẫn xuất hiện trong màn hình 390 px ở cả VI/EN.
- Khôi phục vùng chạm tối thiểu 44 px cho Undo/Redo của Editor trên màn hình nhỏ.
- Kiểm thử Editor mở menu Công cụ qua summary trước khi đổi ngôn ngữ, chuyển chế độ hoặc mở Fabric; giữ các kiểm tra nội dung, lưu nháp và quyền truy cập hiện có.
- Kiểm thử nhận quà Canvas dùng nút trong thiệp, xác minh không có thanh chuyển cảnh/CTA bên ngoài và giữ kiểm tra điều hướng, tải dữ liệu, hồi đáp độc lập với Auth/Catalog.


## Unreleased — Phase 2.5B Cảnh báo hết hạn và gia hạn (2026-11-25)

- Cảnh báo Sender khi thiệp còn tối đa 7 ngày; gia hạn một lần theo cấu hình 0–30 ngày, mặc định tắt.
- Kiểm tra chủ thiệp, trạng thái và hạn hiện tại trong thao tác ghi; giữ link, RSVP và quyền truy cập. MySQL cập nhật cột thời hạn cùng payload.
- Không mở lại thiệp đã đóng, không thay đổi giá hoặc quyền Premium, không migration.

## Unreleased — Phase 2.5A Vòng đời và kho thiệp (2026-11-25)

- Sender có thể lưu trữ/đưa về danh sách thiệp hết hạn hoặc thu hồi, giữ nội dung, lời đáp, RSVP và trạng thái đóng.
- Backend từ chối thời hạn không hợp lệ; kiểm tra lại thu hồi khi đọc tài nguyên Canvas MySQL. Kiểm tra chủ thiệp và trạng thái trong thao tác ghi.
- Không migration, không tự gia hạn hoặc hoàn lượt; chưa thay đổi điều khoản Free/Premium. Thêm kiểm thử JSON, MySQL và giao diện VI/EN.

## Unreleased — Gộp tài liệu frontend hiện hành (2026-11-25)

- Thay 25 ghi chú UI/kiểm kê theo phase hoặc phiên bản cũ bằng một hướng dẫn bảo trì frontend, liên kết với Canvas, API, icon và vận hành hiện hành.
- Giữ các hợp đồng về tài liệu Canvas, snapshot, media bất biến, quyền, CAS, thao tác lớp và khả năng tiếp cận; lịch sử chi tiết tiếp tục nằm trong Git.

## Unreleased — Dọn đầu ra build web không còn dùng (2026-11-25)

- Build ghi đủ manifest JS/CSS và dọn tệp sinh ra không thuộc bản hiện tại hoặc bản liền trước, gồm các bản nén; giữ nguyên URL còn được tham chiếu.
- Bỏ qua dọn khi manifest cũ thiếu/hỏng; không đi theo liên kết thư mục/tệp và kiểm đường dẫn trước khi xóa. Bổ sung kiểm thử bảo toàn đầu ra và giới hạn phạm vi dọn.

## Unreleased — Loại tài nguyên QA và dữ liệu công cụ đã cũ (2026-11-25)

- Bỏ 64 tệp minh chứng trong tài nguyên web, gói xuất 50 icon không còn được đọc và script chèn changelog một lần đã hoàn tất.
- Chặn thư mục tài nguyên QA trong Git và gói nguồn; giữ media sản phẩm, fixture hồi quy, dữ liệu và các gói nâng cấp còn được dùng.

## Unreleased — Kiểm thử chuyển động có thể chạy lại (2026-11-25)

- Giữ kiểm thử hợp đồng, tương thích bản cũ, tài nguyên ảnh và xung đột gói cập nhật cho 56 icon.
- Thêm lệnh kiểm hình học trên renderer thật bằng Chrome/Chromium hoặc WebKit; tự mở cổng trống, không dùng DB/tài khoản/phiên QA đã lưu và không sinh minh chứng vào repo. Bổ sung hướng dẫn bảo trì ngắn thay các báo cáo theo đợt.

## Unreleased — Gói cập nhật thư viện 56 icon có kiểm phiên bản (2026-11-25)

- Tạo gói cập nhật cho đúng 56 ID hiện hữu, giữ trạng thái và thứ tự thư viện; yêu cầu revision và fingerprint của dữ liệu trước sửa.
- Bộ áp dụng kiểm toàn bộ ID, số lượng, phụ thuộc và xung đột; giữ cơ chế chạy lại và hoàn tác theo lịch sử. Không kèm gói dữ liệu hoặc cấu hình chỉ dành cho một máy cục bộ.

## Unreleased — Chỉnh chuyển động 56 icon Studio (2026-11-25)

- Dựng lại hoặc tinh chỉnh 50 vector và 6 mẫu ảnh theo điểm gắn, vùng che, lớp trước/sau và nhịp vật liệu; giữ ID, khả năng chọn một vật thể và hai dòng điều khiển của vector.
- Đổi nhãn mặt dây chuyền, bồ câu và sao, giữ từ khóa cũ; tim mới mặc định tắt xoay, quà/giấy chạy một lượt và tia cát kết thúc cùng lượng cát.

## Unreleased — Cấu trúc icon chuyển động có phiên bản (2026-11-25)

- Thêm tư thế đường nét đồng cấu, vùng che theo biên, tư thế nghỉ và lớp ảnh nội bộ đã duyệt; giữ bộ đọc cấu hình cũ và các giới hạn dữ liệu hiện hành.
- Ngòi đi theo chính chiều dài đường mực; dựng hình, ảnh bìa và chế độ giảm chuyển động dùng cùng cấu trúc bộ phận. Bổ sung cách cập nhật đường nét cho trình duyệt chưa hỗ trợ nội suy trực tiếp, có dừng và giải phóng theo cảnh.

## Unreleased — Dọn repo và tách tệp phát sinh (2026-11-25)

- Loại các gallery/mẫu thử, ảnh/video, báo cáo và script QA theo đợt; giữ tài nguyên sản phẩm, giấy phép và fixture hồi quy đang dùng.
- Chặn thư mục bằng chứng phát sinh trong Git và gói nguồn, chuyển báo cáo dựng artwork vào local; cập nhật liên kết tài liệu và bỏ mục đóng gói trùng.

## Unreleased — Thiệp nhận quà sát mép trên điện thoại (2026-11-25)

- Điện thoại và màn hình dọc dùng toàn bộ chiều rộng, bỏ khoảng đệm và góc bo tạo viền trắng. Nền thiệp kéo hết chiều cao màn hình khi nội dung ngắn, đổi theo màu cảnh đang mở.
- Chỉ căn giữa/giới hạn chiều cao trên màn hình rộng từ 1025 px và tỷ lệ ngang/dọc từ 3:2; điện thoại xoay ngang vẫn ưu tiên sát mép. Giữ đúng tỷ lệ nội dung, cuộn dọc và responsive của chữ/form, không cắt thiệp hoặc sửa snapshot.

## Unreleased — Link nhận quà không hiển thị điều hướng cảnh (2026-11-25)

- Không dựng thanh tiến trình, các nút chọn cảnh và nhãn số cảnh trên link nhận quà; người nhận chuyển cảnh bằng các tương tác nằm trong thiệp.
- Bỏ bộ chọn ngôn ngữ, thông báo chuyển tiếp, nút báo cáo và khối gợi ý/tạo quà nằm ngoài thiệp ở trang Canvas nhận quà. Giữ tương tác trong thiệp, âm thanh/chuyển động khi có cấu hình và RSVP của thiệp mời.
- Giữ điều hướng cảnh trong chế độ xem thử, các hiệu ứng chuyển cảnh, phản hồi lỗi cần thiết và luồng hồi đáp hiện có.

## Unreleased — Ô cảnh nhỏ gọn và bố cục link nhận quà (2026-11-25)

- Giảm ô cảnh xuống khoảng 128 × 64 px, thumbnail nhỏ hơn, tên tối đa hai dòng và có tooltip; giữ nút ba chấm trong ô và vùng chạm 44 px trên màn hình nhỏ.
- Canvas gửi qua link vốn co giãn theo chiều rộng, chữ tối thiểu 16 px và tự nới chiều cao khi nội dung dài. Bổ sung khung nhận quà theo tỷ lệ thiệp, chiều cao màn hình và giới hạn tác giả; giảm khoảng đệm đầu trang để nút mở không bị đẩy quá xa trên máy tính.
- Giữ cuộn dọc, thứ tự lớp, nội dung/snapshot và quyền mở/hồi đáp; preview và Editor không thay đổi tỷ lệ thiết kế. Không thay đổi dữ liệu thiệp hoặc cơ chế gửi link.

## Unreleased — Menu cảnh gọn và chuyển cảnh trong Editor (2026-11-25)

- Đặt nút ba chấm dọc bên trong từng ô cảnh; menu mở nổi phía trên/cạnh nút, không kéo dài dải cảnh hoặc làm vùng thiệp co lại. Đóng khi bấm ngoài, Escape, cuộn hay đổi kích thước màn hình.
- Chọn cảnh khác trong Editor có hiệu ứng hiện nhẹ 180 ms; không chạy lại khi chỉ chọn/chỉnh một lớp, không thay đổi mức thu phóng, hủy đúng khi đổi nhanh hoặc yêu cầu giảm chuyển động. Xem thử/nhận quà tiếp tục dùng hiệu ứng từng cảnh đã cấu hình.

## Unreleased — Không gian chỉnh sửa thích ứng màn hình (2026-11-25)

- Gọn thanh thao tác: giữ Lưu/Xem trước/Xuất bản, chuyển chế độ và các công cụ mở rộng vào menu Công cụ; bỏ tiêu đề/hướng dẫn lặp quanh Canvas và chỉ hiện mô tả lưu khi cần chú ý.
- Bố cục chỉnh sửa vừa chiều cao màn hình, các bảng cuộn riêng, thiệp tự vừa khung; dưới 1024 px dùng các bảng mở theo mục, có khóa focus và đóng bằng Escape. Cá nhân hóa nhanh vẫn giữ bảng nhập nội dung.
- Thu gọn phần hiệu ứng và hướng dẫn biến tên, bỏ mô tả nhạc/hiệu ứng thừa; giữ thông tin lỗi, giới hạn tải ảnh, quyền chỉnh sửa, nhập danh sách và trạng thái lưu. Không thay đổi dữ liệu thiệp, API hay quyền.

## Unreleased — CTA ở chi tiết mẫu (2026-11-25)

- Trang chi tiết mẫu dùng một popup “Tạo thiệp ngay” màu tím, không khung nền, cùng nhịp đập/gợn sóng và chuyển động vào/ra của thư viện.
- Popup dùng đúng mẫu, chế độ nhanh và phiên bản đang xem; ẩn trong lúc tải/lỗi, khi footer xuất hiện hoặc mở xem thử, hiện lại khi rời footer/đóng xem thử. Rời trang chi tiết trả lại đích tạo thiệp mới.

## Unreleased — Menu và chuyển trang nhẹ (2026-11-25)

- Bỏ mục “Cách hoạt động” ở menu desktop và menu thu gọn; giữ phần hướng dẫn trong trang chủ.
- Khi đi giữa các trang công khai, giữ nội dung hiện tại trong lúc tải và chỉ đổi bố cục/cuộn khi trang mới sẵn sàng, kèm hiệu ứng hiện nhẹ 220 ms và thanh báo tải nhỏ nếu phải chờ.
- Hủy hiệu ứng cũ khi chuyển nhanh, tôn trọng tùy chọn giảm chuyển động; liên kết cùng trang không dựng lại toàn bộ nội dung, giữ cảnh báo rời trình chỉnh sửa và vị trí quay lại thư viện.

## Unreleased — CTA tạo thiệp trong thư viện (2026-11-25)

- Thêm nút “Tạo thiệp ngay” ở đầu thư viện, dẫn đến trình tạo thiệp. Popup chỉ hiện khi nút đầu trang bị khuất từ 50% trở lên, tính cả phần bị header cố định che; cuộn lên thì ẩn popup.
- Thư viện dùng một CTA nổi tạo thiệp, giữ hiệu ứng vào/ra, nhịp chậm và điều kiện ẩn tại footer/modal. Đổi nhãn “Tạo mẫu ngay” thành “Tạo thiệp ngay”, đồng bộ VI/EN.
- CTA nổi là nút tím chữ trắng, không có khung nền bên ngoài, kèm nhịp đập và vòng sóng tím chậm; nền thư viện trung tính và từng thẻ mẫu có viền riêng, chữ/giá rõ hơn.

## Unreleased — Chuyển động CTA từ banner xuống cụm nổi (2026-11-25)

- Thêm nhịp đập và vòng sóng lan ngắn cho hai CTA, giữ vùng bấm cố định; khi cần ẩn, cả cụm trượt phải rồi mới biến mất. Hủy đúng chuyển động khi cuộn ngược nhanh và hỗ trợ reduced motion.
- Khi hiện lại, CTA trượt từ mép phải vào; đảo chiều liên tục dùng vị trí hiện tại để không giật. Lần rời banner đầu tiên vẫn dùng chuyển động từ banner.
- Trên trang chủ, CTA giữ hiển thị qua phần nội dung và FAQ, chỉ ẩn khi footer logo/liên kết thực sự vào màn hình hoặc mở modal; theo dõi lại đúng footer khi giao diện được dựng lại.
- Hai nút nổi trượt từ vị trí CTA trong banner về góc dưới khi cuộn qua banner; chỉ chạy một lần cho mỗi lượt rời banner, sẵn sàng lại khi cuộn lên.
- Giữ đích và chức năng các nút hiện có; trang khác tiếp tục tránh che nội dung, trang chủ chỉ ẩn ở footer thật/modal, không thêm khoảng đệm hoặc dịch chuyển bố cục trang.
- Tạm ngăn tương tác trong lúc nút đang di chuyển, bỏ hiệu ứng khi người dùng yêu cầu giảm chuyển động; hủy sạch chuyển động khi đổi trang hoặc ẩn cụm nút.

## Unreleased — Creator, bố cục trang và ảnh thư viện (2026-11-25)

- Đồng bộ trang Creator với màu/font Momevia, thêm hướng dẫn tạo mẫu, trạng thái bộ sưu tập và phản hồi thao tác; giữ nội dung form khi chuyển khu vực và quay về Creator sau đăng nhập.
- Bỏ khoảng đệm thừa dưới trang; nút nổi nhường chỗ cho nội dung, footer, modal và các luồng tài khoản/quản lý/thiết kế/nhận quà. Chỉ giữ chiều cao dự phòng khi nội dung đang tải.
- Thêm ảnh bìa WebP theo kích thước và mật độ màn hình, giữ lazy loading khi cuộn, tái sử dụng ảnh khi lọc/phân trang và đổi đúng VI/EN. Ảnh nhúng WebP được chuẩn hóa trong bộ nhớ trước khi dựng; ảnh SVG gốc và nội dung quà được giữ nguyên.
- Rà soát 22 trang/luồng tại 130 vị trí; kiểm 28 ảnh bìa và bổ sung kiểm thử tải ảnh, cache, focus và trạng thái mẫu. Phép đo thư viện 1440/390 px đạt 0 lỗi, 0 cảnh báo; ảnh tải trên mobile giảm khoảng 96%. Không có migration hoặc thay đổi dữ liệu người dùng; chưa kiểm tra thiết bị vật lý/Safari.

## Unreleased — Phase 2.4B4 Mua thêm lượt xuất bản QA (2026-11-24)

- Migration 019 lưu liên kết đơn đã tiêu hao với intent mua tiếp; khóa chủ tài khoản, giữ khóa cũ và chống tạo đơn mới khi retry.
- Checkout Canvas/Legacy lấy đề xuất mua thêm từ backend, đồng bộ VI/EN, chỉ mở trên MySQL QA với quota, khóa scope và MoMo Sandbox.
- Giữ quyền lịch sử, dữ liệu thiệp, Motion Stack và Floating CTA; chưa kích hoạt trên production, chưa hỗ trợ mua lại demo hay giải phóng đơn pending.

## Unreleased — Phase 2.4B3 Quota xuất bản QA (2026-11-24)

- Migration 018 tạo credit theo entitlement, cấp và tiêu hao cùng transaction ở MySQL Canvas/Legacy.
- Chỉ bật trên profile MySQL QA cô lập; bảo toàn quyền cũ không có credit, không backfill hoặc thay đổi production.
- Chưa mở mua thêm lượt, chưa kích hoạt quota production; bổ sung test cạnh tranh, retry và rollback.

## Unreleased — Phase 2.4B2 Khóa checkout theo môi trường (2026-11-24)

- Thêm khóa checkout theo user/mẫu/sandbox-live, giữ khóa cũ và truy vấn lại đơn cũ đúng scope.
- Migration 017 bổ sung bảng, không sửa dữ liệu cũ; chỉ bật chính sách sau nghiệm thu và kiểm tra production.
- Không thay đổi entitlement lịch sử, giá hoặc hạn mức xuất bản.

## Unreleased — Phase 2.4B1 Ranh giới xác nhận thanh toán (2026-11-24)

- Ghim scope sandbox/live do server xác định vào webhook và đối soát; kiểm tra đơn trong transaction trước ghi dữ liệu hoặc replay.
- Chỉ trả đường dẫn thanh toán pending đúng scope; giữ lịch sử đơn, quyền cũ và khóa checkout.
- Chưa đổi schema hoặc tiêu hao lượt Premium; ghi rõ điều kiện migration và chính sách quyền lịch sử trước khi triển khai quota.

## Unreleased — Hai CTA nổi tạo mới và khám phá mẫu (2026-11-24)

- Giữ nút ổn định trong lúc bấm chuột/touch để form gửi ngay ở lần bấm đầu; focus bằng bàn phím hoặc sau thao tác bấm vẫn đưa control ra khỏi dock khi cần.
- Thêm ô nổi góc dưới phải với “Tạo mẫu ngay” mở Studio và “Khám phá mẫu ngay” mở thư viện. Luôn hiện khi duyệt trang, ẩn ngay trong các route editor và hiện lại khi rời đi; không tự lấy focus hoặc chuyển thông tin riêng của quà vào đích.
- Trên điện thoại dùng hai nút cạnh nhau, có safe-area, vùng chạm tối thiểu 44 px, khoảng cuối trang và tránh che control đang focus. Giữ màu/font Momevia; CSS có trong cả bundle đầy đủ và bundle catalog; đủ VI/EN và reduced motion.
- Bấm thật hai đích, đăng nhập/quay lại tạo mới, canvas thật, năm kích cỡ 320–1440 px và nhận quà/mở hộp/hồi đáp ẩn danh trên MySQL chính đạt. Build/check và 769 unit tests đạt; ảnh và bằng chứng tại `docs/FLOATING_CREATION_CTA.md`.

## Unreleased — Đưa 50 element động vào MySQL cục bộ (2026-11-24)

- Cập nhật đúng thư viện `momevia_dev` đang phục vụ Studio 4100: 50 ID mới và tim; API có 293 element / 56 mục Chuyển động. Dùng gói baseline thật với revision/fingerprint, nối thứ tự mới và giữ các hàng thư viện khác.
- Sao lưu SQL đầy đủ và 14 media, khôi phục thử 36 bảng trên schema riêng và so hash dữ liệu trước khi áp dụng. Lệnh live mới có xác nhận target cụ thể, kiểm checksum, dry-run/áp dụng/rollback; giữ nguyên guard của các lệnh QA cũ. Chạy lại ghi 0, rollback chỉ xem trước.
- Kiểm đủ 50 mẫu qua Studio, lưu/reload, preview và link quà trên DB chính bằng tài khoản tổng hợp riêng; giữ hash tất cả hàng nghiệp vụ đã có. SQL, tài khoản và cookie giữ trong thư mục private/local được gitignore.

## Unreleased — 50 vật thể động và chuyển động nhiều dòng (2026-11-24)

- Thêm đúng 50 thiết kế vector nội bộ, năm nhóm × mười ID; tìm VI có dấu/không dấu và EN trong Thêm → Chuyển động, thumbnail tĩnh, phát thử riêng và chỉnh màu trong cùng mục.
- Canvas 4 giữ danh sách chuyển động có ID, tối đa ba dòng chính kể cả emphasis cũ; lớp vị trí/vùng bấm tách khỏi chuyển động, xuất hiện và phản hồi. Studio giữ pha từng dòng, hỗ trợ bật/tắt, tham số, phát thử/xóa, lịch sử, lưu/clone và snapshot.
- Tim mới đập hai đỉnh trong 1,8 giây và tự xoay độc lập 360°/8 giây. Giữ reader 1/2/3, sáu fixture vòng lặp cũ, A05 một lượt và snapshot đã phát hành.
- Gói riêng 51 mục có preview, revision/fingerprint, gián đoạn/chạy tiếp, chạy lại và rollback; chỉ cho phép CLI ghi MySQL QA loopback có opt-in. Seed DB mới và gói cập nhật dùng chung định nghĩa.
- Đối chiếu SHA nguồn QA với toàn bộ thay đổi từ baseline, kể cả file đã stage/commit và các contract giữ nguyên. Kiểm 50/50 Studio/preview/player, API MySQL và Admin; đo ma trận tim, kết hợp góc/opacity, reduced motion, thao tác di động, frame pacing và chi phí mở lạnh. Build/check, 767 unit và Canvas browser regression đạt; phạm vi và giới hạn thiết bị/trình duyệt được ghi trong `docs/ANIMATED_ELEMENTS_50.md`. Chưa phát hành ra môi trường người dùng thật.

## Unreleased — Phase 2.4A Đối soát xuất bản (2026-11-24)

- API chỉ đọc số thiệp đã lưu theo mẫu và chủ thiệp trên MySQL, tách legacy và Canvas; không suy ra số lượt còn lại.
- Chặn trả lại checkout sandbox/live khác môi trường, giữ nguyên khóa giao dịch để đối soát.
- Không tiêu hao entitlement, không thay đổi dữ liệu hoặc schema; bổ sung kiểm thử trước khi áp dụng hạn mức.

## Unreleased — Phase 2.3B Vòng đời quyền sử dụng (2026-11-24)

- Thống kê quyền live, sandbox, demo và chưa xác định; phân biệt active, revoked và inactive, với API chỉ đọc theo chủ quyền hoặc Admin.
- Dùng chung điều kiện entitlement cho kiểm tra quyền và transaction xuất bản; không cấp lại đơn demo đã thu hồi khi retry.
- Không đổi quyền lịch sử, schema, giá hoặc khóa thanh toán; cần đối soát trước khi áp dụng chính sách loại quyền thử nghiệm trong production.

## Unreleased — Phase 2.3A Quyền sử dụng mẫu (2026-11-24)

- Tách fixture browser cho phản hồi methods rỗng/không cấp demo khỏi quyền demo được bật rõ ràng để kiểm tra cấp license về sau trong cùng luồng.
- Chỉ cấp giao dịch demo mới khi cả hai cờ demo bật, production và thanh toán đều tắt.
- API kiểm tra quyền mẫu theo người dùng đã xác thực; form legacy không suy quyền từ trạng thái đơn hàng và không quảng cáo mua thử khi chưa bật.
- Không đổi quyền đã mua, giá, số lượt xuất bản, dữ liệu thiệp hay schema MySQL. Tách kiểm soát quyền demo lịch sử và lượt xuất bản sang bước riêng.

## Unreleased — Phase 2.2 RSVP (2026-11-24)

- Thêm xác nhận tham dự cho thiệp mời có thông tin sự kiện và mã nhận riêng hoặc tự điền tên.
- Lưu một trạng thái theo lượt nhận, kiểm tra quyền và hạn sự kiện phía server; chủ thiệp xem thống kê riêng.
- Không đổi schema MySQL, không mở RSVP trên thiệp cũ hoặc link chung không định danh.

## Unreleased — Phase 2.1B Thông tin sự kiện (2026-11-24)

- Bổ sung nhập ngày giờ, múi giờ và địa điểm có cấu trúc cho thiệp mời hỗ trợ; không ép chuyển đổi nháp/thiệp cũ.
- Kiểm tra ngày giờ, vùng nội dung, thời hạn và chiếu dữ liệu công khai riêng, giữ tương thích trình xem cũ.
- Bảo toàn dữ liệu khi nhân bản nháp và loại thông tin sự kiện riêng khi tặng lại; RSVP sẽ triển khai sau.

## Unreleased — Phase 2.1A Phân loại thiệp (2026-11-24)

- Phân biệt loại thiệp và dịp sử dụng; API và danh mục VI/EN có bộ lọc loại thiệp, giữ tương thích với API cũ.
- Mẫu Creator chưa xác định giữ trạng thái chưa phân loại; không đổi giá, quyền, dữ liệu thiệp hoặc snapshot đã phát hành.
- Bổ sung kiểm thử phân loại và lọc; nhập thông tin sự kiện và RSVP triển khai ở các bản tiếp theo.

## Unreleased — Phase 1 Security & Production Stability (2026-11-24)

- Bổ sung preflight production và startup strict opt-in; giữ nguyên dữ liệu, secret và storage hiện có.
- Mặc định bảo vệ lời đáp thiệp mới, giữ quyền thiệp cũ; kiểm tra Origin, JSON MIME, URL và bảo vệ cache/index của trang thiệp Node.
- Xử lý lỗi stream ảnh, cấu hình giới hạn pool MySQL; bổ sung test và hướng dẫn Hostinger/Railway tại `docs/PHASE01_SECURITY.md`.
- 20 test mục tiêu đạt; bộ unit rộng chưa hoàn tất do dependency thiếu. Chưa nghiệm thu production.

## Unreleased — Sửa hồi quy CI PR #26 (2026-11-24)

- Cập nhật dữ liệu kỳ vọng của test vòng đời 28 mẫu theo cấu hình người nhận mặc định của nháp Sender mới; giữ so sánh đầy đủ document, ảnh riêng, lưu/tải lại và snapshot xuất bản.
- Giữ các ca tương thích template cũ và kiểm tra retry mất ACK độc lập với phần đánh dấu cá nhân hóa mới.

## Unreleased — Đổi dấu phân cách giao diện sang gạch ngang (2026-11-24)

- Thay dấu chấm nổi phân cách bằng `-` trong giao diện VI/EN, Studio, quyền/trạng thái, thư viện, âm thanh và các lựa chọn tương tác. Nhãn lấy từ phiên bản thư viện cũ cũng hiển thị theo quy tắc mới.
- Định dạng mẫu câu trước khi ghép tham số; giữ nguyên tên, lời nhắn, nội dung thiệp đã lưu, dữ liệu thư viện gốc, gói cập nhật có hash và các hạt chấm trang trí. Không thay ký tự `*` trong mã/công thức.
- Build/check, 757 unit tests và trình duyệt cho thiệp tương tác/lượt nhận đạt; đối chiếu 245 mẫu câu VI/EN, tên chứa dấu chấm vẫn được bảo toàn.

## Unreleased — Ba cách ghi tên người nhận (2026-11-24)

- Lưu chế độ thủ công/danh sách/tự điền theo nháp; nhập XLSX/CSV có xem trước và lỗi dòng gốc; xuất bản một nội dung cho các link cá nhân hoặc một link chung.
- Thêm biến `{người nhận}`, ô xác nhận tên, khôi phục lượt khi thử lại, quyền theo lượt và kết quả trong Studio. Bảo toàn snapshot cũ, quyền Creator và số chưa đọc.
- Xuất bảng XLSX an toàn với tên giống công thức, link/QR và danh sách chỉ dành cho chủ. Migration 016 tương thích dữ liệu cũ; cờ bật theo chủ và dừng writer riêng với reader.
- Build/check, 757 unit, JSON/MySQL + browser và bộ Canvas regression đạt. Có ảnh, số đo trước/sau, backup/migration cục bộ và hướng quay lui tại `docs/RECIPIENT_NAMING.md`.

## Unreleased — Sửa browser regression của CI PR #25 (2026-11-23)

- Cập nhật kiểm tra bìa Hero VI/EN theo biến thể `-catalog.svg` đang dùng, giữ kiểm tra chính xác template và thư mục ngôn ngữ.
- Ca bìa lỗi chặn đúng URL catalog và xác minh yêu cầu đã bị chặn trước khi kiểm tra giữ bìa/player hiện tại.

## Unreleased — Chốt xác minh chuyển động và bàn phím trên bản chạy (2026-11-23)

- Xác minh 6 mục vòng lặp vô hạn revision 2 trên DB đang dùng; bảo toàn 34 bảng nghiệp vụ và 11 ảnh hiện có. Bổ sung ảnh bìa DB VI/EN đúng biến thể.
- Kiểm phím nhanh liên tiếp trong Fabric; giữ vai trò giấy hồi đáp khi sao chép, nguồn/quyền, media và lớp khóa. Build/check và 754 unit đạt; bộ kiểm kéo-thả, vòng lặp, bàn phím, lưu/tải lại và hồi quy Canvas đạt.
- Ghi nhận tổng 12 commit, backup riêng ngoài Git và bản chạy tại 4100.

## Unreleased — Chuyển động trực tiếp và phím tắt Canvas (2026-11-23)

- Sáu element Chuyển động mặc định lặp vô hạn bằng dữ liệu keyframe; kéo-thả hoặc chèn là chạy ngay trong Studio. Tạm dừng lúc kéo, nhập chữ hoặc ẩn trang; tôn trọng giảm chuyển động, không ghi lại document theo từng khung hình.
- Có điều khiển lặp và nâng cấp rõ ràng cho element cũ; giữ nguyên snapshot quà đã phát. Gói riêng cập nhật sáu mục theo revision, giữ nguyên gói Natural v2 đã áp dụng.
- Bổ sung Delete/Backspace, Ctrl/Cmd X/C/V/D/A, di chuyển bằng mũi tên/Shift, undo/redo và lưu; có nút sao chép/cắt/dán. Không chiếm phím khi đang nhập chữ, không sửa lớp khóa hoặc vượt quyền Creator.
- Fabric nhận bàn phím trên vùng vẽ, hỗ trợ nhân bản/cắt/sao chép/dán/xóa/chọn nhiều và undo/redo tạm; chỉ chuyển thành document khi Áp dụng. Giữ ảnh riêng, artwork, binding, nguồn và policy.

## Unreleased — Giữ đúng biến thể bìa từ DB khi đổi ngôn ngữ (2026-11-23)

- Gắn variant vào URL ảnh trước khi tạo thuộc tính dịch, giữ metadata i18n hợp lệ. Danh mục lấy đúng khung ngang và kệ mùa lấy đúng khung mùa từ cùng phiên bản DB.
- Kiểm hồi quy cả nguồn revision công khai và snapshot thư viện; thêm lượt kiểm chỉ đọc URL ảnh VI/EN và ảnh 4100 sau tải đầy đủ.

## Unreleased — Bằng chứng bản chạy 4100 đầy đủ (2026-11-23)

- Lưu kiểm tra chỉ đọc 21 mẫu từ DB thật, VI/EN, bìa và ba cảnh; ảnh danh mục được chụp sau khi các thẻ và ảnh tải đầy đủ. Không tạo hay sửa bản ghi người dùng.

## Unreleased — Áp dụng mẫu vào DB đang dùng và kiểm 4100 (2026-11-23)

- Cập nhật 87 mục thư viện trong momevia_dev theo snapshot/revision đã rà; backup đủ 36 bảng và 4 ảnh trước ghi. Giữ thứ tự thật, 34 bảng nghiệp vụ và byte ảnh cũ; chạy lại ghi thêm 0 mục.
- Kiểm 21 mẫu từ DB thật, VI/EN và ba cảnh bằng bàn phím trên 4100. Lưu ảnh và báo cáo; unit bổ sung đạt 746/746.
- Quy định LF cả SVG EN để build không tạo thay đổi giả trên Windows; giữ bí mật và backup riêng ngoài Git.

## Unreleased — Mẫu quà tự nhiên · 8/8 (2026-11-23)

- Lưu bằng chứng trực quan, sổ nguồn và kết quả áp dụng trên DB đang dùng; không đưa backup riêng hoặc bí mật vào Git.

## Unreleased — Mẫu quà tự nhiên · 7/8 (2026-11-23)

- Bổ sung kiểm hồi quy cho 21 mẫu, 243 element, ảnh tùy chọn, quyền, DB và tải trang.

## Unreleased — Mẫu quà tự nhiên · 6/8 (2026-11-23)

- Thêm gói cập nhật theo revision, backup toàn DB, đối chiếu nội dung Admin và bảo toàn thứ tự thật.

## Unreleased — Mẫu quà tự nhiên · 5/8 (2026-11-23)

- Giữ ảnh người gửi, nguồn/quyền qua initializer/restyle; chỉ tải dữ liệu preview khi mở.

## Unreleased — Mẫu quà tự nhiên · 4/8 (2026-11-23)

- Giữ artwork/effect, ảnh contain, tọa độ lẻ và kiểu hồi đáp trong Studio/Fabric/trình nhận.

## Unreleased — Mẫu quà tự nhiên · 3/8 (2026-11-23)

- Thêm bộ lọc element và đưa ảnh thư viện qua upload riêng của chủ nháp, kiểm hash và chống lặp.

## Unreleased — Mẫu quà tự nhiên · 2/8 (2026-11-23)

- Dựng lại 21 mẫu ba cảnh và bìa danh mục/theo mùa từ cùng document.

## Unreleased — Mẫu quà tự nhiên · 1/8 (2026-11-23)

- Bổ sung ảnh, hoa lá, chất liệu và đồ họa có nguồn/giấy phép; giữ tệp hash cũ.

## Unreleased — Bỏ nút tạm dừng chuyển mẫu ở trang chủ (2026-11-23)

- Chỉ bỏ nút Tạm dừng/Tiếp tục dưới hình mẫu; giữ nguyên hiệu ứng, tự chuyển mẫu và ba nút chọn mẫu. Cập nhật kiểm thử theo giao diện này.

## Unreleased — Chuyển tiếp cuộn ở biên các cột thư viện (2026-11-23)

- Cả danh sách, biểu mẫu và xem trước của Thư viện canvas/Âm thanh cho phép cuộn tiếp toàn trang khi cột đã đến đầu hoặc cuối. Khi cột còn khoảng cuộn, trang và các cột khác đứng yên.
- Kiểm bằng wheel hai hướng trên cả sáu vùng cuộn trong MySQL QA; xác minh thêm ba vùng Âm thanh trên ứng dụng local 4100, không sửa metadata Admin.

## Unreleased — Đồng bộ riêng giao diện Âm thanh (2026-11-23)

- Dùng cùng bố cục và thành phần ba cột như các tab Canvas khác: danh sách, thông tin mục và nghe thử; thanh Lưu/Tắt hoặc Bật/Bỏ thay đổi/Nghe thử theo cùng phương pháp thao tác.
- Bỏ mã nội bộ, phiên bản và mã băm khỏi phần hiển thị âm thanh. API, bằng chứng nguồn, quyền Admin, revision và media giữ nguyên.
- Vùng thông tin và nghe thử chuyển tiếp cuộn xuống trang tại biên; danh sách vẫn giữ vùng cuộn riêng. Các quy tắc thay đổi chỉ nằm trong phạm vi tab Âm thanh.
- Nghe thử dùng bộ phát hiện có, bổ sung âm lượng và tiến độ xem thử; mở tab vẫn im lặng và chọn sẵn thông tin bài đầu tiên.
- Bỏ danh sách dịch vụ tham khảo khỏi giao diện nghe thử; chỉ giữ nguồn và giấy phép của mục đang chọn. Hai bộ lọc Loại âm thanh/Trạng thái nằm cùng hàng, giữ kích thước chạm trên mobile.

## Unreleased — Cuộn và bố cục thư viện Admin (2026-11-23)

- Giữ các nút danh sách Canvas/Âm thanh khi chỉ đổi lựa chọn; các cột desktop cuộn độc lập và giữ bản nháp, bộ lọc, vị trí cuộn khi đổi tab.
- Giữ nhóm thông tin mở, tiêu điểm và vị trí con trỏ qua cập nhật/lưu Ctrl+S; khóa ô âm thanh trong lúc chờ phản hồi lưu để không mất chỉnh sửa mới.
- Thu gọn tab Âm thanh: chọn sẵn bài đầu tiên để hiển thị thông tin, hàng chọn gọn, biểu mẫu hai cột, bộ lọc phụ và nguồn bản quyền có thể mở rộng. Mở tab không phát/tải tệp âm và không ghi metadata.
- Sửa cùng nguyên nhân dựng lại nút trong danh sách lớp Studio; ca browser kiểm trực tiếp DOM và cuộn với hơn 30 lớp.
- Ca kiểm tra panel dùng schema MySQL QA riêng có thư viện hợp lệ, kiểm API trước UI; giữ nguyên các assertion. Kiểm JSON cũ tiếp tục chạy riêng. Không chạy migration trên DB vận hành để phục vụ ca này.

## Unreleased — SFX và nhạc nguồn tác giả (2026-11-23)

- Bộ chọn SFX dùng 50 tệp v2 nhập từ tác giả bên ngoài, có bản thu vật thật/thiên nhiên, hiệu ứng giao diện và nhạc hiệu; giữ nguyên âm v1 đã ghim trong quà cũ.
- Thêm 50 bản nhạc theo chủ đề: 44 CC0 từ Alex McCulloch / Pro Sensory và Emma_MA, 6 bản Hàn từ Korea Copyright Commission với ghi công, có cả nhạc có lời; bộ chọn mới không dùng các vòng nhạc tự tổng hợp. Mười ID nhạc cũ vẫn đọc/phát được để không đổi quà đã gửi.
- Giữ nguồn, giấy phép, hash nguồn/đích, thời lượng đo, chỉnh sửa và credit tác giả trong repo; trình nhập chỉ tải/giải mã/cắt/chuẩn hóa, không sinh âm thay thế. Kho lưu generator tổng hợp cũ để bảo vệ các tệp đã ghim.
- Bổ sung tab Âm thanh trong thư viện Admin (`/admin/library`), giữ `/admin/music-library` để mở thẳng tab này: quản lý nhạc/SFX, tên VI/EN, chủ đề, từ khóa và ngừng chọn mới; CAS/lịch sử trên JSON và MySQL qua migration 015; giữ âm đã ghim. Các dịch vụ nhạc trả phí chưa kết nối.
- Sửa danh sách nhạc 50 mục trong cột Studio hẹp: mỗi mục một hàng, chiều cao theo nội dung và vùng cuộn riêng, tránh chữ chồng nhau.
- Hiện nguồn nhạc trong Studio và player; hiển thị đúng phút/giây cho bản dài, bảo toàn lựa chọn cũ khi mở nháp, sửa tràn ngang thanh nhạc/credit trên mobile.
- Kiểm chứng và danh mục được gom tại `docs/SYSTEM_CONTENT_INVENTORY_20261122.md`; raw downloads và công cụ QA nằm trong `local/`, không đóng gói. Chưa nghe duyệt bởi người hoặc kiểm trên thiết bị di động thật.

## Unreleased — Canvas Mobile History V16 (2026-11-23)

- Đặt hai nút Hoàn tác/Làm lại bên cạnh vùng Canvas khi chỉnh bố cục trên mobile (320–800px), vùng chạm 48px; không làm chật header. Desktop và chế độ điền nhanh giữ nguyên bố cục.
- Đồng bộ trạng thái disabled của toàn bộ nút Undo/Redo từ cùng Canvas store, tránh tình trạng nút mobile không phản ánh lịch sử thực.
- Bổ sung nhãn VI/EN ngắn gọn, focus-visible rõ ràng và regression test cho responsive, touch target và trạng thái history.
- Không thay đổi cấu trúc tài liệu, API lưu nháp, phân quyền, thanh toán, nhạc hoặc hệ thống undo/redo hiện tại.

## Unreleased — V15: Canvas mobile bottom sheet và keyboard accessibility (2026-11-23)

- Nâng cấp các bảng Thêm, Lớp, Thuộc tính và Cảnh trên mobile thành bottom sheet có nền che, chạm nền để đóng, tránh chạm nhầm vùng Canvas phía sau.
- Chuẩn hóa vòng focus bằng Tab/Shift+Tab; khi mở ưu tiên nút Đóng, khi đóng trả focus về nút đã mở, đóng khi đổi breakpoint và hoàn nguyên `inert` nếu rời Designer.
- Trong lúc sheet mở, chặn shortcut Undo/Redo/chỉnh lớp đi xuyên xuống Canvas; Escape đóng sheet trước thay vì huỷ thao tác nền.
- Tách logic điều hướng focus sang `mobile-sheet.js`, thêm 10 unit regression test và mở rộng browser regression ở 320/390/768px. Không thay đổi API, dữ liệu thiệp, thanh toán hoặc OAuth.

## Unreleased — V14.1: Khắc phục browser regression Preview (2026-11-23)

- Sửa thứ tự thao tác trong `tests/browser/home.mjs`: mở hộp thoại Preview trước, đợi hiển thị rồi mới đọc CTA “Dùng mẫu”; tránh Playwright chờ 30 giây vì dialog chưa mở.
- Thêm unit guard kiểm tra thứ tự `Enter → dialog visible → CTA href` để hạn chế tái diễn lỗi trong CI. Giữ nguyên code ứng dụng, API, Canvas và dữ liệu người dùng.

## Unreleased — V14: Xem trước và tạo thiệp liền mạch (2026-11-23)

- Bổ sung CTA “Dùng mẫu” ngay trong hộp thoại xem trước thiệp ở trang chủ và trang chi tiết, giảm thao tác đóng modal rồi tìm lại nút tạo.
- Đồng bộ URL tạo nhanh trong `template-create-url.js`, giữ `versionId` của mẫu Creator, mã hóa ID và đồng bộ lại CTA mỗi khi hero đổi slide.
- Cải thiện kích thước thao tác và responsive của toolbar xem trước; bổ sung unit test và browser regression cho ba slide. Không đổi API, dữ liệu Canvas, Auth/Zalo hay hệ thống thanh toán.

## Unreleased — Marketing Occasion Discovery V13 (2026-11-23)

- Bổ sung bộ liên kết **Khám phá theo dịp** trên trang chủ, lấy số mẫu từ Catalog thật, ưu tiên dịp đang diễn ra và mở đúng bộ lọc `/explore?occasion=...` mà không thêm API hoặc migration.
- Tối đa 6 chip có tên và nhãn trợ năng VI/EN, vùng bấm từ 46px và cuộn ngang nội bộ trên mobile; không hiển thị số liệu giả lúc tải/lỗi và không dùng emoji.
- Tách logic chọn dịp ra module thuần, bổ sung 7 unit test và browser regression cho đường dẫn qua Explore trên nhiều kích thước màn hình. Giữ nguyên Auth, Canvas, SFX, Payment, Creator/Admin và các hiệu ứng 3D hiện hữu.

## Unreleased — Marketing Performance V12: Data Saver & Motion (2026-11-23)

- Marketing Hero tạm dừng slideshow/teaser và chuyển nhãn điều khiển sang “Tiếp tục trình chiếu” khi trình duyệt bật `saveData` hoặc `prefers-reduced-data`; vẫn cho phép người dùng chủ động phát, nhưng không bỏ qua `prefers-reduced-motion`.
- Ngừng tilt/ánh sáng 3D và hủy animation frame khi bật tiết kiệm dữ liệu. Reveal chuyển sang hiển thị ngay, tránh nội dung bị ẩn sau khi tắt motion.
- Gom kiểm tra ưu tiên chuyển động vào `marketing/motion-preferences.js`, bổ sung test bật/tắt trong phiên và bảo toàn listener lifecycle. Không thay đổi Canvas, API, tài chính, OAuth, giao diện VI/EN hoặc nguồn ảnh/nhạc.

## Unreleased — Sửa logo Zalo Social Login (2026-11-23)

- Thay biểu tượng Zalo giả (chữ Z) trên `/login` bằng SVG Zalo nhận diện bong bóng thoại và chữ “Zalo” được lưu nội bộ tại `web/assets/brand/zalo.svg`.
- Giữ nguyên Google, phân quyền OAuth đã cấu hình/chưa cấu hình, trang Đăng ký không có social login; bổ sung CSS và regression test, tài liệu nguồn logo.

## Unreleased — Sửa release smoke-test thiếu bundle Interactive Cards (2026-11-22)

- Đóng gói duy nhất `database/updates/interactive-cards-20261122-v1.json` theo allowlist để bài test library rollout chạy được trong bản release độc lập; không đóng gói toàn bộ thư mục updates hoặc dữ liệu vận hành.
- Bổ sung regression test xác minh bundle có trong release manifest và từ chối đưa tệp update ngoài allowlist vào bản phát hành. Không thay đổi UI, Auth V10, database schema, dữ liệu hay logic rollout.

## Unreleased — Auth Experience V10: tinh chỉnh social login, copy và mật khẩu (2026-11-22)

- Rút gọn phần mô tả ở `/login` để hiển thị gọn hơn trên desktop; giữ cấu trúc dark split layout và CTA chính của Momevia.
- Chỉ giữ Google/Zalo ở trang đăng nhập; bỏ hẳn khối social ở trang đăng ký để người dùng tập trung tạo tài khoản bằng email.
- Thay ký hiệu chữ cái tạm bằng inline SVG gần với nhận diện Google và Zalo, tinh gọn lại khu social login để bớt nặng giao diện.
- Giảm yêu cầu mật khẩu tối thiểu từ 10 xuống 8 ký tự ở UI, i18n, recovery flow và kiểm tra phía server; cập nhật regression test + cache-bust CSS V10. Không đổi API OAuth, session, database hay phân quyền.

## Unreleased — Auth Experience V9: bố cục tối hai cột theo ảnh tham khảo (2026-11-22)

- Khi hợp nhất PR #22, cập nhật browser regression cho header/footer Auth V9: kiểm tra hai link điều khoản ngay trong form, đổi VI/EN ở header và kiểm tra menu mobile trên trang danh mục.
- Thiết kế lại `/login` và `/register` theo bố cục tham chiếu: nền tối tím–mận có lưới mờ, thẻ giới thiệu bên trái, form glass-card bên phải; giữ nhận diện Momevia, font Plus Jakarta Sans/Inter/Lora và chuyển động nhẹ có tùy chọn reduced motion.
- Trên trang xác thực, thu gọn site header còn logo và bộ chọn VI/EN chung, ẩn navigation/footer dài để form xuất hiện sớm hơn; các route khôi phục mật khẩu và phần còn lại của website không bị thay đổi.
- Chuyển Google/Zalo xuống sau form như bố cục tham khảo, giữ nguyên OAuth allowlist và trạng thái vô hiệu hóa khi backend chưa cấu hình; giữ link Đăng ký ngay, quên mật khẩu, điều khoản và form hỗ trợ.
- Tạo regression test V9 về layout, i18n, OAuth, responsiveness, reduced motion và cache CSS; cập nhật bài test V8 theo thứ tự UI mới. Không thay đổi API, database, mật khẩu, session hoặc quyền truy cập.

## Unreleased — Sửa hồi quy catalog trong CI PR #22 (2026-11-22)

- Giữ DOM thiệp và ảnh bìa đã tải khi bộ lọc trả cùng nội dung, tránh thay ảnh khi chỉ đổi chữ hoa/thường của từ khóa. Bìa, bản dịch và nội dung thay đổi vẫn được cập nhật.
- Kiểm tra trình duyệt đợi bìa thực sự tải rồi xác minh cả thiệp và ảnh được giữ nguyên qua lần lọc tương đương.
- Ca lỗi/retry catalog loại bootstrap công khai khỏi HTML fixture để đi qua API thật; vẫn xác minh yêu cầu 503 và tải lại thành công.

## Unreleased — Auth Experience V8: cải thiện form và khôi phục Google/Zalo (2026-11-22)

- Thiết kế lại Login/Register theo layout sáng, tập trung vào form một cột trên desktop và mobile, input 16px, nút 52–54px, khoảng cách/typography đồng bộ, giữ hình 3D hiện có và hỗ trợ reduced motion.
- Đưa hai lựa chọn Google/Zalo lên trước form email ở cả hai trang. Chỉ tạo liên kết `/api/auth/{provider}` khi backend xác nhận phương thức đã cấu hình; nếu chưa, hiển thị rõ trạng thái vô hiệu hóa thay vì ẩn hoàn toàn.
- Thêm nhãn VI/EN cho trạng thái OAuth và bộ chia email, loại bỏ logo phụ thuộc vào nguồn ảnh ngoài và các selector `.auth-page` legacy trùng trong `gift.css`; giữ CTA Đăng ký/Đăng nhập ngay, quên mật khẩu và quy trình xác thực phía server.
- Cập nhật regression test V7 theo contract V8 và thêm kiểm thử OAuth, accessibility, responsive và i18n. Không sửa cookie/session, database, Canvas, Payment hoặc Support API.

## Unreleased — Hợp nhất Canvas/SFX và main cho PR #21 (2026-11-22)

- Giữ nhạc nền, SFX và dữ liệu Canvas v3 trong cùng thiết kế/quà; giữ Inspector đã tách module, bản dịch VI/EN và CSS thiệp sau khi hợp nhất hai nhánh.
- Bổ sung hồi quy cho snapshot có cả nhạc nền và âm tương tác, quyền khóa mẫu Creator, cùng các nút phát/âm lượng độc lập trên trình duyệt.

## Unreleased — Âm thanh Canvas local (2026-11-22)

- Thêm nút âm thanh, âm khi nhấn độc lập với điều hướng, thư viện 40 WAV gốc CC0 có phiên bản/hồ sơ nguồn/hash và bộ chọn VI/EN.
- Thêm tải nguồn/tỉa trên thiết bị, waveform, mốc nhập giây, volume, xuất đoạn PCM16 mono 44,1 kHz, undo/autosave và replay upload an toàn.
- Canvas v3, migration 014, pin/quyền media cá nhân, Creator cover chỉ xử lý ảnh, làm sạch âm cá nhân khi tặng lại, backup/import/restore và công cụ kiểm kê orphan.
- Player preview/public chung mở im lặng, bật âm chủ động, một voice, chuẩn bị âm sau opt-in và hủy yêu cầu cũ. Các quà đã gửi còn đọc/phát khi tạm tắt tạo SFX mới.
- Bằng chứng, 40 âm, giới hạn trình duyệt/thiết bị và cách chạy tại `docs/SFX_LOCAL_HANDOFF_20261122.md`. Chỉ local, chưa push/deploy.

## Unreleased — Tối ưu tải thiệp local (2026-11-22)

- Đóng gói ESM/CSS có hash, tải phần chỉnh sửa/QR/Creator/Admin theo nhu cầu, dùng metadata Catalog công khai trong HTML và tải bìa đúng viewport.
- Preview đọc riêng tài liệu VI/EN của một mẫu từ server, giữ nguồn DB, definition đã ghim và cùng player; từ chối mẫu chưa công khai.
- Giữ nguyên artwork và motion; phục vụ đúng font gốc từ local cùng giấy phép, tránh tải thừa latin-ext cho chữ Việt; nén Brotli công khai với gzip fallback.
- Sửa CSS modal/toast dùng chung và thông báo lỗi tải style có bản dịch. Kiểm thử 567 unit, Chrome đầy đủ, 96 tổ hợp, 56 ca đồng nhất CSS và 21 ca MySQL fixture.
- Ngưỡng LCP chốt theo yêu cầu là dưới 2,6 giây. Số đo, giới hạn lab và bằng chứng tại `docs/INTERACTIVE_CARDS_LCP.md`; chỉ local, không push/deploy.

## Unreleased — Thiệp tương tác G0–G5 local (2026-11-22)

- Cải tiến Hai phong bì, Birthday Radiance và Proud of You cho thiết kế mới; thêm Lời mời bên hiên, Cuộn phim ngày ấy và Bản đồ ngày ra trường với nội dung VI/EN, artwork nguyên bản, album tùy chọn và điều hướng đọc được khi giảm chuyển động.
- Thêm tám recipe ghim phiên bản và chín cụm element trong thư viện hiện hữu; giữ một player cho Studio/preview/public, 10 loại element và các snapshot cũ.
- Bổ sung tám ảnh phong cách chụp thật nguyên bản, bóng đổ theo silhouette/bóng tiếp xúc, grain giấy, lớp lửa riêng, tua đu đưa, ảnh hạ nhẹ và thư gấp; giảm chuyển động vào trạng thái cuối, hủy motion khi rời cảnh.
- Catalog lọc dịp/bảng màu; thử Sunny Wishes ↔ Confetti trước khi tạo, hoặc tạo nháp độc lập từ draft với mapping semantic, quyền/asset, CAS và idempotency phía server.
- Gói đồng bộ thư viện 387 → 415 mục có preview, dependency, conflict theo revision, history, chạy lại và rollback; CLI chỉ cho schema QA loopback.
- Giảm tải tệp tĩnh bằng gzip, trì hoãn module thử đổi mẫu, ổn định vị trí footer khi tải và sửa reflow/vùng chạm. Album tùy chọn reset crop đúng ô khi thay ảnh, giữ quy ước ảnh/album cũ và policy Creator.
- Bàn giao local và bằng chứng tại `docs/INTERACTIVE_CARDS_G0_G5.md`. Giá ba mẫu mới là fixture 0đ, chờ quyết định sản phẩm. LCP lab còn vượt 2,5 giây; thử năm người và thiết bị thật chưa chạy. Không deploy/push/ghi production.

## Unreleased — Auth Experience V7: thống nhất bố cục Login/Register (2026-11-22)

- Thiết kế lại Login/Register bằng layout hai cột thoáng trên desktop và form một cột khi tablet/mobile: font nhập liệu 16px, nhãn 14px, nút 54px, focus rõ, có thương hiệu Momevia trên mobile và ảnh 3D hiện có chuyển động nhẹ (tôn trọng reduced-motion).
- Giữ CTA “Đăng ký ngay”, liên kết “Đăng nhập ngay” và Quên mật khẩu. Chỉ hiển thị Google/Zalo khi thực sự được cấu hình; không đặt nút OAuth vô hiệu gây nhầm lẫn.
- Tập trung toàn bộ CSS Auth tại `auth-pages.css`, loại bỏ lớp override Auth tại `ui-polish.css`, chuẩn hóa CSS còn lại để tránh viết dồn dòng; đưa hai stylesheet vào quality gate, bổ sung kiểm thử layout, accessibility, provider và VI/EN.
- Không sửa session, xử lý mật khẩu, database, Canvas, Music Library, payment hoặc support workflow.

## Unreleased — Auth Signup CTA & Support Locale UX (2026-11-22)

- Khôi phục liên kết “Đăng ký ngay” trên trang đăng nhập: sửa selector CSS ẩn nhầm link và đặt CTA đăng ký ngay dưới form, vẫn giữ liên kết quên mật khẩu và đăng nhập ở trang đăng ký.
- Bỏ bộ chuyển ngôn ngữ riêng trong form hỗ trợ và thông báo gửi yêu cầu thành công; nội dung vẫn dùng ngôn ngữ VI/EN của hệ thống, những hộp thoại khác không đổi.
- Bổ sung kiểm thử hồi quy markup/CSS, hành vi modal và chuyển ngôn ngữ; không sửa API, dữ liệu đăng ký hay phân quyền.

## Unreleased — Visual System & CSS Quality V5 (2026-11-22)

- Chuẩn hóa 7 stylesheet trọng điểm (Admin Library, Template Preview, Gift Runtime, Canvas Editor, Recovery, Conflict Review và Upgrade): một khai báo CSS mỗi dòng, giữ thứ tự selector/media/keyframe và nội dung thiết kế hiện có.
- Cải thiện mức đọc ở mobile: nút Preview 14px, badge/trạng thái Admin 13px, tab Admin 14px, nút Recovery tối thiểu 44px và thanh lưu tính safe-area; không tạo thêm lớp CSS override.
- Thêm `scripts/quality/check-css-style.mjs` vào `npm run check` và 7 unit test kiểm tra mã viết dồn, thuộc tính lặp trong cùng rule, parser với string/comment, breakpoint có chủ ý và mobile typography.
- Không sửa cấu trúc Canvas, API, MySQL, payment, nhạc theo dịp, bản dịch VI/EN, font hay 3D marketing. Kiểm toán CSS theo từng nhóm để tránh hồi quy diện rộng.

## Unreleased — Music Occasion V4: nhạc theo sự kiện và lọc song ngữ (2026-11-22)

- Bổ sung 6 bản nhạc nội bộ (sinh nhật, đám cưới, Giáng sinh, Tết dương lịch, Tết Nguyên đán, Valentine); lưu script tổng hợp sóng để tái tạo và ghi nguồn gốc tài nguyên.
- Sender lọc thư viện nhạc theo dịp, cảm xúc và từ khóa; hiển thị nhãn VI/EN cùng layout, bổ sung CSS music-occasion rõ ràng, hỗ trợ bàn phím, reduced-motion và hiệu ứng chiều sâu nhẹ.
- Giữ 4 bài nhạc cũ, cơ chế nghe thử/chỉnh âm lượng/Undo/Redo và Recipient opt-in; Canvas vẫn chỉ lưu `{ id, volume }`, không sửa schema, API, quyền Creator hoặc database.
- Thêm unit test cho audio asset, bộ lọc, i18n, giới hạn ID/URL và bản sao Canvas; cập nhật hướng dẫn kiểm thử và đánh giá source mới.

## Unreleased — Sửa ESLint Canvas Inspector sau refactor (2026-11-22)

- Xóa biến `layout` không sử dụng trong `renderInspector()` của `designer.js` sau khi tách Inspector; giữ nguyên `props` và các kiểm tra chức năng.
- Không thay đổi schema Canvas, API, phân quyền hoặc dữ liệu thiệp.
## Unreleased — Tách trường thuộc tính và khóa UI Canvas Inspector (2026-11-22)

- Tách dựng trường hình/sticker, tọa độ/kích thước/opacity và nút Layer khỏi `designer.js` sang `canvas-editor/inspector-fields.js` để dễ kiểm thử và bảo trì.
- Giữ nguyên `data-editor-field`, `data-editor-action`, giới hạn giá trị, VI/EN và trạng thái mở Geometry; tách quyết định khóa UI của mẫu Creator thành hàm thuần, mặc định từ chối thao tác không được cấp quyền.
- Thêm 9 unit test cho field theo loại, cảnh báo ngoài artboard, khóa quyền, thao tác Layer và tích hợp Designer. Không đổi Canvas JSON, API, thanh toán, nhạc nền hoặc quyền kiểm tra phía server.

## Unreleased — Tách Scene/Layer Panel khỏi Canvas Designer (2026-11-22)

- Tách dựng danh sách Scene/Layers và cache thumbnail sang `features/canvas-editor/scene-layer-panel.js`, giảm trách nhiệm DOM trong `designer.js`.
- Tạo danh sách Layer từ một chỉ mục theo ID, giữ thứ tự xếp chồng, trạng thái chọn, khóa/ẩn và nhãn hỗ trợ truy cập; bỏ qua ID đã mất thay vì gây lỗi giao diện khi mở nháp cũ.
- Giữ nguyên menu thao tác Scene, focus sau đổi tên/sắp xếp, logic khóa mẫu Creator và cache thumbnail được xóa khi chuyển thiết kế.
- Bổ sung 9 unit test cho Scene/Layers; không sửa schema Canvas, dữ liệu người dùng, nhạc nền, API, MySQL, thanh toán, font hoặc VI/EN.

## Unreleased — Tách modal xem trước và quyền chia sẻ Canvas Designer (2026-11-22)

- Chuyển hộp thoại xem trước thiệp sang `canvas-editor/preview-dialog.js`, giữ nguyên Player/Preview và thao tác sửa, bắt đầu lại, gửi thiệp; giải phóng Player khi đóng hoặc chuyển trang.
- Tách lựa chọn quyền mở/gửi/đọc quà sang `canvas-editor/gift-access-dialog.js`, bổ sung kiểm tra tổ hợp lựa chọn, mô tả quyền bằng VI/EN thực sự (không chèn dấu phẩy vào giữa các câu) và đóng an toàn khi huỷ hoặc rời Editor. Không thay đổi kiểm tra phân quyền ở backend.
- Bổ sung kiểm thử thuần cho lựa chọn quyền, bản tóm tắt link và liên kết module; giữ nguyên Canvas JSON, nhạc nền, API, giao diện VI/EN và dữ liệu người dùng.

## Unreleased — Music Library 3.1: tìm kiếm và tách giao diện Editor (2026-11-22)

- Tách UI thẻ nhạc, bộ lọc, trạng thái chọn và âm lượng khỏi `designer.js` vào `features/canvas-editor/music-panel.js` để giảm phạm vi thay đổi khi nâng cấp Canvas.
- Sender tìm nhạc theo tên/mô tả ở VI và EN, không phân biệt dấu trong tiếng Việt, kết hợp bộ lọc cảm xúc; thông báo số kết quả hoặc trạng thái rỗng cho trình đọc màn hình.
- Giữ nguyên danh mục bốn bài, thao tác chọn, nghe thử, Undo/Redo, schema `{ id, volume }`, Recipient Player, quyền truy cập và API. Bổ sung kiểm thử i18n/metadata, xác minh CSS dễ đọc và tương thích với file cũ.

## Unreleased — Music Library 3.0: chọn giai điệu theo cảm xúc (2026-11-22)

- Thêm hai giai điệu gốc tổng hợp `dreamy-night` và `little-celebration`, có script tái tạo và hồ sơ nguồn gốc, không dùng tài nguyên âm thanh bên thứ ba.
- Sender chọn nhạc qua thẻ với bộ lọc cảm xúc Êm dịu/Tươi vui; giữ dropdown cũ, Undo/Redo, nghe thử, âm lượng và kiểm tra ID tại server. Hỗ trợ VI/EN, focus, aria-pressed, mobile và reduced motion.
- Canvas vẫn chỉ lưu `soundtrack: { id, volume }`; Recipient không autoplay, không thay đổi API, MySQL hoặc quyền truy cập. Thêm test thư viện, audio, schema và metadata song ngữ.

## Unreleased — Đồng bộ trạng thái phát nhạc khi thiết bị hoặc tab thay đổi (2026-11-22)

- Bộ phát nhạc cập nhật đúng nút Phát/Tạm dừng nếu audio lỗi sau khi `play()` thành công, bị dừng bằng media controls hoặc phát hết bất thường; không tự bật lại khi Promise phát đến muộn.
- Sender nghe thử trong Designer tự dừng khi tab bị ẩn; các sự kiện audio được gỡ khi huỷ trình phát, giữ nguyên chỉ phát nhạc khi người dùng chủ động chọn.
- Thêm test cho lỗi âm thanh muộn, sự kiện tạm dừng bên ngoài, retry, đóng Player và tích hợp listener theo vòng đời Editor. Không sửa schema Canvas, bản nhạc, API hoặc snapshot quà.

## Unreleased — Âm lượng nhạc nền Canvas và trải nghiệm người nhận (2026-11-22)

- Sender chỉnh âm lượng nhạc nền từ 0–100%, có số phần trăm và nghe thử ngay khi kéo; mỗi lần thả thanh tạo một mốc Undo/Redo và bảo toàn giá trị khi đổi nhạc.
- Recipient tự chỉnh âm lượng khi mở thiệp mà không sửa bản snapshot công khai, không yêu cầu API và không autoplay; kiểm tra đầu vào trước khi cập nhật HTMLAudioElement.
- Thêm nhãn VI/EN, responsive/focus và bài test cho giới hạn âm lượng, schema công khai, không phát tự động và nhãn giao diện. Giữ nguyên các SVG thuộc PR của Lộc và toàn bộ nghiệp vụ hiện có.

## Unreleased — Nhạc nền Canvas theo lựa chọn người dùng (2026-11-22)

- Sender có thể chọn 2 giai điệu nội bộ hoặc không dùng nhạc, nghe thử trong Designer và lưu lựa chọn vào Canvas V2; bản V1 cũ không bị sửa tự động.
- Recipient có nút Phát/Tạm dừng nhạc, không autoplay; xử lý trường hợp trình duyệt chặn âm thanh, dọn playback khi ẩn tab/đổi trang.
- Server chỉ nhận ID nhạc allowlist, không nhận URL ngoài; snapshot công khai giữ lựa chọn, tặng lại từ bố cục không sao chép nhạc cũ, policy Creator vẫn khóa các thành phần còn lại.
- Thêm MP3 tổng hợp gốc, giao diện VI/EN, `music-controls.css`, MIME audio/mpeg, kiểm thử schema/playback/HTTP và tài liệu đánh giá source mới.

## Unreleased — Sửa hồi quy CI Canvas và MySQL của PR #19 (2026-11-22)

- Chỉ tải thư viện chỉnh sửa khi mở các trang ngoài `/g/...`; người nhận mở quà trực tiếp không phụ thuộc API thư viện hoặc tải module editor. Điều hướng từ quà sang thư viện vẫn tải cấu hình Canvas.
- Kiểm tra catalog MySQL đối chiếu đầy đủ ID với seed hiện tại, thay cho số lượng 24 đã cũ; giữ kiểm tra tạo nháp, quyền xuất bản và dữ liệu catalog không bị thay đổi.
- Giữ nguyên các assertion về request của player công khai, module được tải và khả năng xem quà khi catalog hoặc xác thực gặp lỗi.

## Unreleased — Khôi phục ảnh bìa mẫu từ DB (2026-11-22)

- Dùng chung nguồn ảnh gốc đã kiểm hash và phông chữ nhúng cho ảnh bìa DB và ảnh bìa xuất tĩnh; khôi phục bánh sinh nhật, hai phong bì, mũ/bằng tốt nghiệp trên trang chủ và chi tiết mẫu.
- Giữ độ dày nét vector khi dựng từ cấu hình đã lưu trong thư viện, theo đúng cách dựng primitive ban đầu.
- Thêm kiểm tra ảnh bìa thực tế (ảnh nhúng, điểm ảnh và đối chiếu bản gốc VI/EN), hiệu ứng xem thử và toàn bộ tài liệu khi tạo/lưu/tải lại/xuất bản ba mẫu sự kiện.
- Không thay đổi định nghĩa mẫu, thiết kế hoặc quà đã lưu trong DB.

## Unreleased — Rà soát luồng Admin đến canvas (2026-11-22)

- Sửa thứ tự danh sách lớp theo thứ tự xếp chồng của cảnh, giữ đúng lớp đang chọn khi sắp xếp; giới hạn lại lựa chọn cảnh/lớp khi chuyển giữa VI/EN có số cảnh khác nhau.
- Giữ nguyên thứ tự biến đổi khi sửa từng thông số keyframe; bỏ mục mới chưa lưu trở về mục đã có, không báo nhầm đã lưu.
- Đối chiếu nội dung với DB khi thử lại sau mất phản hồi của lần lưu đã commit; không ghi thêm revision và vẫn bảo vệ thay đổi khác của người sửa đồng thời.
- Xem thử mục đã tắt cùng các phụ thuộc trong bản tạm chỉ đọc; thao tác bật/lưu thật vẫn kiểm tra đầy đủ trạng thái phụ thuộc.
- Bổ sung kiểm tra trình duyệt cho mất ACK lúc tạo/sửa, chuỗi bật/tắt, VI/EN khác số cảnh, sắp xếp lớp, phiên bản canvas cũ/mới và tạo bề mặt/hạt bằng Admin.

## Unreleased — Ngắt tunnel, HTTPS bằng chứng chỉ (2026-11-21)

- Ngắt Cloudflare theo yêu cầu; đổi `demo:https` sang chứng chỉ localhost trực tiếp trên 4110, không tạo kết nối Internet. Giữ profile/kho dữ liệu và cổng 4100.
- Server hỗ trợ `HTTPS_CERT_FILE` / `HTTPS_KEY_FILE`, kiểm tra cặp PEM trước khi mở kho dữ liệu, không hạ xuống HTTP khi sai cấu hình. Thêm kiểm thử handshake, cookie, origin và quà HTTPS.
- Chuẩn bị Caddyfile Let's Encrypt và service chạy trên VPS; chưa cấp chứng chỉ tên miền thật hay triển khai máy chủ khi chưa có thông tin đích. Chứng chỉ tự ký chỉ để thử và không được cài vào kho tin cậy.

## Unreleased — Quản lý thư viện trong Admin (2026-11-22)

- Thêm `/admin/library` và đường dẫn trong trang Admin/menu tài khoản: tìm/lọc, thêm/sửa/nhân bản, bật/tắt Element, Hiệu ứng, Chuyển động và Bố cục bằng biểu mẫu VI/EN.
- Trình chỉnh thành phần/cảnh, bảng mốc chuyển động, cấu hình bề mặt/hạt, chọn đối tượng áp dụng và bản xem thử trực tiếp dùng chung canvas runtime.
- Xem thử chỉ đọc, giữ bản đang nhập khi lỗi mạng/xung đột phiên bản, bảo vệ thay đổi chưa lưu; kiểm tra quyền Admin ở cả giao diện lẫn API.
- Thêm kiểm tra cho 266 bản xem thử và hành trình Admin qua MySQL đến designer, gồm phụ thuộc, hai ngôn ngữ, retry, xung đột và bốn kích thước màn hình.

## Unreleased — Thư viện canvas quản lý từ MySQL (2026-11-22)

- Lưu đầy đủ 172 element/cụm, 33 effect, 33 animation, 3 starter, 25 mẫu thiệp, 111 vector và 10 mô tả primitive trong thư viện có revision.
- Editor tải danh mục từ DB; hỗ trợ thêm mới cụm element, vector, preset, keyframe, bề mặt và hạt bằng dữ liệu, không đăng ký ID trong frontend.
- Cấu hình và đường nét được giữ kèm tài liệu; sửa/tắt thư viện không đổi nháp hoặc quà đã lưu. Có API Admin với kiểm tra revision/lịch sử và CLI quản lý tại máy.
- Kiểm thử MySQL thật qua SQL-only additions, Admin/CAS, editor, xuất bản, tải lại, đổi/tắt định nghĩa và giảm chuyển động; giữ các kiểm tra cũ của 172 element và 33 effect.

## Unreleased — Chuyển canvas JSON sang MySQL (2026-11-21)

- Thêm importer canvas offline vào DB rỗng, sao lưu dữ liệu/ảnh, transaction và đối chiếu đọc lại; giữ nguồn gốc và ánh xạ phiên bản trùng trong DB.
- Giữ chính xác tọa độ/hình ảnh và hash bằng chuỗi JSON có kiểm tra JSON_VALID; yêu cầu migration 012 khi chạy canvas trên MySQL.
- Profile demo giữ cấu hình MySQL qua restart; backup hỗ trợ các asset Creator dùng chung tệp đã xác minh hash.
- Bổ sung kiểm tra thực trên MySQL cho 172 mẫu element, 33 effect, 18 tổ hợp hiệu ứng lặp, snapshot quà, ảnh/crop, restart và lưu/tải lại bằng trình duyệt.

## Unreleased — HTTPS cho demo hiện có (2026-11-21)

- Thêm `npm run demo:https`, dùng lại backend 4110 và tự nhận diện profile demo cũ, giữ khóa phiên/tài khoản/nháp/quà. Link và QR lấy đúng địa chỉ HTTPS; origin kiểm tra chính xác, cookie có Secure.
- Thêm `--public-base-url` và `--profile` cho web demo; tải cloudflared chính thức có kiểm SHA-256. Khởi động lặp lại giữ URL đang chạy; dừng không xóa dữ liệu.
- Chuẩn bị quà Minh–An trên 4110/HTTPS và dừng bản thử 4116. Kiểm tra trình duyệt qua HTTPS, QR, hai nhánh và hồi quy launcher.

## Unreleased — Tớ đoán cậu sẽ chọn… (2026-11-21)

- Thêm mẫu sinh nhật miễn phí, biểu mẫu cá nhân hóa với dự đoán A/B ổn định và hai lời kết, lưu nháp dở và kiểm tra trước khi gửi.
- Thẻ Canvas V2 cùng cảnh chỉ dựng kết quả sau lựa chọn; dùng chung cho preview/link thật, có Chơi lại, khóa chạm liên tiếp, trợ năng, giảm chuyển động và VI/EN. Snapshot giữ dự đoán khi sửa nháp; tặng lại xóa câu chuyện cũ.
- Bổ sung unit và browser qua thư viện đến xuất bản, đủ bốn nhánh. Bàn giao demo Minh–An cổng 4116 và kịch bản quay trong `docs/TO_DOAN_CAU_SE_CHON_BAN_DAU.md`; chưa triển khai production hoặc kiểm thử điện thoại vật lý/MySQL thật.

## Unreleased — Marketing Journey mobile swipe & readable steps (2026-11-22)

- Trải nghiệm Create → Share → Open → Reply → Keep trên mobile: năm nút chuyển sang danh sách cuộn ngang với cỡ chữ 13px thay vì ép chữ 11px vào một hàng; không gây tràn ngang trang.
- Vuốt ngang trên artwork đổi bước khi vượt ngưỡng 48px và rõ ràng theo phương ngang; không chiếm cuộn dọc, không xử lý đa chạm và không tự quay vòng ở đầu/cuối hành trình.
- Đảm bảo chỉ một nút được Tab tới trong nhóm; vẫn hỗ trợ Arrow, Home, End. Thêm hướng dẫn thao tác song ngữ VI/EN.
- Bổ sung kiểm thử unit và browser cho vuốt, phím, responsive. Không thay đổi API, Canvas, database, thanh toán hoặc nội dung thiệp.

## Unreleased — Sửa bố cục chỉ báo Hero mobile (2026-11-22)

- Điều chỉnh hàng grid của `.mkt-hero__artwork` bảo toàn chiều cao tối thiểu, tránh chỉ báo chọn thiệp lấn lên khung artwork khi không gian mobile bị giới hạn.
- Browser regression tiếp tục bắt buộc điều khiển nằm dưới khung; bổ sung số đo và `gridTemplateRows` vào lỗi để hỗ trợ chẩn đoán CI.
- Thêm kiểm thử cấu trúc CSS và assertion. Không thay đổi animation, chức năng Marketing Lab, API hoặc dữ liệu người dùng.

## Unreleased — Marketing lab đo lặp và so sánh before/after (2026-11-22)

- Nâng `npm run perf:marketing` từ một lượt sang ba lượt cho từng tổ hợp viewport/VI/EN, có thể cấu hình 1–5 lượt bằng `MOMEVIA_PERF_RUNS`.
- Ghi báo cáo v2 gồm mẫu gốc, median/p75, số lỗi JavaScript và số lượt tràn ngang; không biến LCP/FCP thiếu thành 0.
- Thêm thẻ báo cáo `MOMEVIA_PERF_TAG` và lệnh `npm run perf:marketing:compare` để đối chiếu trước/sau cùng cấu hình, không gửi dữ liệu người dùng hoặc số liệu ra ngoài.
- Bổ sung unit test thống kê, xử lý dữ liệu thiếu và so sánh; không thay đổi frontend production/API/Canvas/database/payment. Các số đo vẫn là lab, không thay thế Core Web Vitals thực tế.

## Unreleased — Fix browser test for desktop navigation breakpoint (2026-11-22)

- Sua race condition trong `tests/browser/home.mjs`: sau khi doi viewport tu 1024px sang 1200px, Playwright cho menu `hidden` trong DOM va `aria-expanded=false`, khong chi cho CSS an menu.
- Giu nguyen assertion va timeout 5 giay: neu listener `matchMedia` khong dong menu, bai kiem thu van fail. Khong thay doi giao dien, JavaScript production, API, Canvas hoac thanh toan.
- CI run 44931895318 da PASS build, check, npm audit, 509 unit tests; browser regression fail tai dong 67. Can chay lai CI tren GitHub.

## Unreleased — Marketing ambient visibility & local performance lab (2026-11-22)

- Đồng bộ hai quầng sáng CSS với trạng thái Hero: dừng khi người dùng pause, preview mở, hero ngoài viewport hoặc tab ẩn; tiếp tục khi tương tác trở lại. Không sửa mẫu thiệp hoặc logic chuyển cảnh.
- Bổ sung `npm run perf:marketing` để đo TTFB, FCP, LCP, CLS, long task và tràn ngang tại máy local ở ba viewport, hai ngôn ngữ; lưu JSON vào `dist/reports`, không gửi analytics ra ngoài.
- Thêm unit test và browser regression cho trạng thái animation, số liệu thiếu, overflow; ghi rõ kết quả lab không thay thế Core Web Vitals người dùng thật. Cần xác minh Playwright/CI trên main.

## Unreleased — Marketing pointer performance (2026-11-22)

- Gom nhiều sự kiện `pointermove` của khung 3D thành tối đa một lần tính toán theo `requestAnimationFrame`; chỉ lấy tọa độ chuột cuối cùng và đo `getBoundingClientRect()` trong frame thay vì từng sự kiện.
- Khi rời khung, ẩn tab, giảm chuyển động hoặc tháo module, hủy frame chờ và bỏ qua callback đến trễ. Giữ nguyên độ nghiêng 3D, font và VI/EN.
- Tách `latest-frame.js` dễ kiểm thử, bổ sung unit test, tài liệu hiệu năng và cơ chế hợp nhất an toàn. Chưa có số đo FPS/Core Web Vitals trên thiết bị thực tế.

## Unreleased — Điều khiển chuyển mẫu Hero dành cho accessibility (2026-11-22)

- Bổ sung nút Tạm dừng/Tiếp tục dễ chạm cho vòng thiệp 3D ở trang chủ; dừng đồng thời progress, thiệp hé và các note nổi, giữ nguyên mẫu và khả năng chọn/xem thử thủ công.
- Nút đổi nhãn VI/EN theo ngôn ngữ đang chọn và giữ trạng thái khi người dùng chuyển ngôn ngữ. Khi hệ điều hành bật giảm chuyển động, autoplay đã tắt nên ẩn điều khiển không cần thiết.
- Bổ sung unit test và browser regression; không sửa API, lưu trữ, quyền truy cập, JSON Canvas hoặc giao dịch. Cần xác minh build/CI sau khi áp dụng.

## Unreleased — Header responsive dễ đọc trên laptop (2026-11-21)

- Ở 901–1150px, chuyển các link dài của header sang menu thu gọn có chữ 15px thay cho ép liên kết 12px; giữ viewport không tràn ngang, gồm trường hợp 1024px.
- Bổ sung navigation landmark có nhãn i18n, focus-visible và 48px vùng chạm; có chuyển động mở ngắn, tắt khi người dùng chọn giảm chuyển động.
- Tự đóng menu khi cửa sổ trở lại desktop rộng, bảo toàn trạng thái `aria-expanded` và focus hợp lệ.
- Bổ sung browser regression cho hai ngôn ngữ, mở/đóng bằng Escape, typography và resize. Không chỉnh API, dữ liệu quà, Canvas, thanh toán.

## Unreleased — Fix brand navigation overflow (2026-11-21)

- Sửa xung đột độ ưu tiên CSS của menu laptop 901–1150px: giữ cỡ chữ responsive 12px thay vì bị `brand-system.css` đặt lại thành 14px.
- Giữ nguyên bài kiểm thử `tests/browser/home.mjs` yêu cầu không tràn ngang ở viewport 1024px. Không ẩn overflow của trang và không thay đổi Canvas, API, dữ liệu hay logic thanh toán.
- Build và browser regression trên GitHub CI/CD cần được xác nhận sau khi áp dụng.

## Unreleased — Brand typography, responsive UI và đánh giá bảo mật (2026-11-21)

- Chuẩn hóa font hệ thống theo Plus Jakarta Sans (display), Inter (body, navigation), Lora (serif); tải stylesheet Inter/Plus Jakarta Sans ở `web/index.html` cho cả trang chủ và các route, thay vì chỉ nạp trễ ở các route khác. Lora dùng `@font-face` từ tài nguyên có sẵn trong project.
- Thêm `web/css/brand-system.css`: typography dễ đọc, màu tương phản, thẻ điều hành, CTA người nhận, focus và chuyển động 3D nhẹ chỉ trên thiết bị hỗ trợ hover. Tôn trọng `prefers-reduced-motion` và không áp dụng quy tắc mới lên nội dung thiệp Canvas do người dùng tự thiết kế.
- Bổ sung unit test kiểm tra font, CSP cho nguồn font, cấu trúc CSS và bảo toàn giao diện song ngữ. Không thay đổi API, dữ liệu, thanh toán, role hoặc schema Canvas.
- Đánh giá source/kiến trúc/bảo mật được ghi trong tài liệu `docs/CODE_REVIEW_20261121.md`. Kiểm thử sản phẩm, Core Web Vitals và browser thực tế vẫn phải chạy ở môi trường có đủ dependency.

## Unreleased — Tích hợp main vào mẫu sự kiện (2026-11-21)

- Giữ đầy đủ nhật ký của cả hai nhánh khi giải quyết conflict PR #17.
- Cập nhật browser regression Creator theo bố cục mẫu sự kiện đứng trước; kiểm tra đúng ba mẫu đầu, vị trí bộ sưu tập mùa lễ phía sau và khả năng cuộn tới/mở bộ sưu tập trên mobile.

## Unreleased — Hai note lệch nhịp nhẹ (2026-11-21)

- Note bên phải bắt đầu mỗi nhịp muộn hơn bên trái khoảng 300ms, vẫn dịch/nghiêng nhẹ và kết thúc cùng vị trí trong chu kỳ 5 giây để không giật khi lặp.
- Giữ lớp nổi phía trước, một phần trong/ngoài viền, chọn mẫu và pause/reduced motion.
- Build, check và browser trang chủ VI/EN ở 7 kích thước đạt; kiểm tra vị trí thực của hai note ở cùng mốc thời gian xác nhận lệch nhịp, vẫn nhỏ và giữ chu kỳ 5 giây.

## Unreleased — Làm mềm chuyển động hai note (2026-11-21)

- Bỏ nhịp nhích nhanh ban đầu: note trôi về trong 2 giây, nghỉ nhẹ rồi trôi ra trong 2 giây cuối. Giảm biên độ còn 1–3px và tối đa 0,6 độ.
- Giữ chu kỳ 5 giây, lớp nổi phía trước, vị trí vắt qua viền và các cơ chế chọn mẫu/pause/reduced motion.
- Build, check và browser trang chủ VI/EN ở 7 kích thước đạt; kiểm tra chuyển động note, lớp phía trước, pause/resume và giảm chuyển động.

## Unreleased — Note chuyển động theo nhịp thiệp (2026-11-21)

- Hai note nghiêng tối đa 1 độ và dịch nhẹ 2–4px theo đồng hồ 5 giây của thiệp, dừng/tiếp tục cùng preview và hỗ trợ giảm chuyển động.
- Giữ note vắt qua viền và nổi phía trước thiệp chính theo lựa chọn cuối; không thay đổi vị trí nghỉ, lớp cắt thiệp hoặc thanh chọn mẫu.
- Build, check, 459 unit tests và test:browser đạt; browser kiểm chứng độ dịch nhỏ, chu kỳ chung 5 giây, pause/resume, lớp hiển thị phía trước và chế độ giảm chuyển động.

## Unreleased — Giữ note ngoài khung, chỉ cắt thiệp (2026-11-21)

- Tách lớp cắt viền dành riêng cho các thiệp; hai note trở lại vị trí vắt qua mép khung. Trên điện thoại chỉ nhô nhẹ để chữ vẫn nằm trong màn hình.
- Thêm nhòe nhẹ 1–2px vào lúc hé/chuyển thiệp, về nét hoàn toàn khi dừng; giữ chu kỳ 5 giây, hai giây hé mẫu và xoay 1,2 giây. Giảm chuyển động không dùng nhòe.
- Build, check, 459 unit tests và test:browser đạt; có kiểm tra hai note vắt qua viền, lớp cắt riêng, mức nhòe và trở về nét. Đã rà ảnh desktop/320px trong `local/hero-templates/floating-notes-*.png`.

## Unreleased — Hé thiệp trong hai giây cuối (2026-11-21)

- Giữ chu kỳ mỗi mẫu đúng 5 giây; từ giây thứ 3, mẫu tiếp theo hé dần ở phía sau bên phải theo cùng đồng hồ với thanh tiến trình.
- Chuyển xoay chậm lại thành 1,2 giây với nhịp ease-in-out, tiếp nối ngay vị trí đang hé thay vì quay về điểm xuất phát. Giữ chọn mẫu bằng thanh, pause/resume khi xem preview và giảm chuyển động.
- Cắt toàn bộ thiệp, bóng và họa tiết vượt viền bo góc của khung; đưa hai nhãn nổi vào trong viền để giữ nội dung dễ đọc.
- Đã kiểm tra nhịp 3+2 giây, nối tiếp góc đang hé, xoay 1,2 giây, VI/EN, chọn mẫu và pause/resume bằng browser; build, check, 459 unit tests và test:browser đạt. Rà thêm khung cắt viền ở 7 kích thước 320–1614px; ảnh soát ở `local/hero-templates/peek-clipped-*.png`.

## Unreleased — Chuyển thiệp theo cung tròn (2026-11-21)

- Giữ nguyên khung xem ở trang chủ: thiệp cũ xoay ra bên trái, thiệp mới đi theo cung tròn từ góc phải phía dưới lên vị trí hiện tại. Cả viền giấy và bóng thiệp chuyển cùng ảnh trong 600ms, chỉ dùng transform/opacity.
- Giữ tiến trình 5 giây, chọn mẫu bằng thanh, preview đúng mẫu, giảm chuyển động và khả năng ngắt chuyển cảnh khi chọn liên tiếp.
- Build, check, 459 unit tests và test:browser đều đạt; browser xác nhận hướng xoay, vị trí thiệp mới phía trước khi lặp cuối → đầu và đường đi trên khung điện thoại. Ảnh soát giữa/cuối chuyển động nằm trong `local/hero-templates/`.

## Unreleased — Tiến trình chuyển mẫu ở trang chủ (2026-11-21)

- Thanh đang chọn chạy từ trái sang phải trong 5 giây; chính thao tác hoàn tất tiến trình kích hoạt mẫu kế tiếp, không dùng hai bộ đếm riêng.
- Bấm thanh bất kỳ để chọn mẫu và đếm lại từ đầu; dừng/tiếp tục cùng tiến trình khi mở preview, ẩn tab hoặc rời vùng hiển thị. Chế độ giảm chuyển động vẫn cho chọn mẫu thủ công.
- Kiểm chứng build, check, 459 unit tests và bộ test:browser; có kiểm tra tiến trình chạy thật trên khung điện thoại, nửa thanh, tự chuyển đủ vòng, chọn lại thanh và tiếp tục sau preview/rời màn hình.

## Unreleased — Thanh chọn mẫu và demo cập nhật theo file (2026-11-21)

- Đưa ba vạch chọn mẫu ra dưới khung thiệp, bỏ nút tạm dừng; bìa tự chuyển kể cả khi đang rê chuột hoặc giữ focus. Giữ preview đúng mẫu và hỗ trợ giảm chuyển động.
- Demo lấy mã mới mỗi lần khởi động và mặc định theo dõi file; tự tải lại trang giới thiệu/thư viện khi an toàn và khởi động lại backend thử khi mã backend đổi. Giữ tài khoản, phiên, ảnh, nháp và quà demo; không tự tải lại trang đang chỉnh thiệp.
- Đã kiểm chứng build, check, 459 unit tests, test:templates, test:browser và test:demo:browser. Kịch bản demo dùng dữ liệu cô lập, xác nhận cập nhật trình duyệt, giữ preview/Canvas đang mở và giữ snapshot/nháp sau restart.

## Unreleased — Ba mẫu thiệp luân phiên ở trang chủ (2026-11-21)

- Khung xem thử đầu trang luân phiên thiệp cưới, sinh nhật và tốt nghiệp mỗi 5 giây; chuyển bìa bằng opacity/transform, giữ nguyên kích thước khung.
- Thêm nút chọn mẫu, dừng/tiếp tục và nhãn VI/EN; mở preview đúng mẫu đang hiển thị. Dừng tự động khi đang xem preview, rê chuột, dùng bàn phím, rời vùng hiển thị hoặc ẩn tab; tôn trọng giảm chuyển động.
- Kiểm chứng build, check, 455 unit tests, test:templates và test:browser trên dữ liệu cô lập; kiểm tra trang chủ VI/EN ở 7 kích thước 320–1614px. Kiểm tra chuyển ảnh, chọn mẫu, preview, pause/resume và ảnh lỗi bằng Chrome; chưa đo trên điện thoại thật.

## Unreleased — Recipient Image Loading & Resilience (2026-11-21)

- Tách vòng đời tải ảnh của Canvas Player vào `image-state.js`, gắn listener trước `src` để bắt cả lỗi ảnh từ cache; không thay đổi allowlist URL hoặc API.
- Có trạng thái loading/ready/error và placeholder dịch VI/EN; `AbortSignal` ngăn phản hồi ảnh thuộc cảnh đã rời đi làm thay đổi DOM.
- Ưu tiên ảnh nội dung đầu tiên của cảnh, giữ ảnh còn lại ở chế độ lazy; giảm chuyển động shimmer theo `prefers-reduced-motion`.
- Bổ sung 5 unit test cho ảnh cache, lỗi sớm, ưu tiên tải, abort và DOM đã tháo; tài liệu `docs/RECIPIENT_IMAGE_RESILIENCE.md`.
- Không thay đổi dữ liệu Canvas, quyền truy cập, thanh toán hay metadata của quà; phải kiểm thử browser/mobile và CI trên môi trường triển khai.

## Unreleased — Recipient Canvas Player Navigation & Mobile UX (2026-11-21)

- Sửa browser regression Canvas: xác minh focus qua `node.ownerDocument.activeElement` trong callback Playwright, không tham chiếu biến DOM toàn cục từ Node.js.

- Tách điều hướng cảnh công khai và bản preview sang `scene-navigation.js`; giữ nút DOM qua các lần chuyển cảnh để không tái tạo listener/focus không cần thiết.
- Bổ sung thanh tiến trình cảnh có ngữ nghĩa native `progress`, nhãn Việt–Anh và trạng thái cập nhật theo cảnh hiện tại; với thiệp một cảnh, thanh tiến trình được ẩn.
- Hỗ trợ điều hướng focus bằng ArrowLeft/ArrowRight, Home/End mà không tự mở hoặc bỏ qua cảnh; các nút vẫn hoạt động khi bấm/chạm như trước.
- Tối ưu danh sách cảnh dạng cuộn ngang/snap trên mobile, highlight cảnh hiện tại, nút tối thiểu 44px và giảm chuyển động khi người dùng yêu cầu.
- Thêm unit test cho điều hướng, bàn phím, tên cảnh, i18n và browser regression cho tiến trình cảnh trong `canvas-expanded.mjs`.
- Không thay đổi Canvas JSON, quyền truy cập, nội dung người dùng, hiệu ứng 3D hiện có, thanh toán hoặc API. CI/browser thực tế cần xác minh sau khi áp dụng.

## Unreleased — Sender Sharing & Recipient Journey UX (2026-11-21)

- Dashboard Sender có điều hướng nhanh tới bản nháp, quà và đơn hàng, tái sử dụng `roleQuickLinks` và ngữ nghĩa khu vực thống nhất với Admin/Creator.
- Trang chia sẻ của Sender có hướng dẫn 3 bước, nhấn mạnh liên kết lời mời khi quà giới hạn truy cập; vẫn dùng quyền và URL từ API hiện có.
- Trình xem thiệp legacy bổ sung tiến trình mở 3 bước, cập nhật ARIA và focus bằng module `recipient-journey.js`; không đổi Canvas JSON, quyền truy cập, nội dung lời chúc hoặc cơ chế gửi phản hồi.
- Bổ sung nhãn VI/EN, giao diện responsive, hiệu ứng nhẹ có `prefers-reduced-motion` và kiểm thử cho luồng mở quà.
- Không thay đổi API, database, thanh toán; Canvas public player mới không bị sửa trong đợt này.

## Unreleased — Creator review feedback visibility & CI regression (2026-11-21)

- Hiển thị phản hồi yêu cầu sửa mẫu của Admin ở khu vực thông báo độc lập trên trang Creator, liên kết tới danh sách mẫu; chỉ lấy phiên bản mới nhất để tránh hiển thị yêu cầu đã xử lý.
- Giữ nguyên thông tin gốc và escape an toàn lý do duyệt; tái sử dụng khóa VI/EN có sẵn, không làm thay đổi trạng thái mẫu hoặc API.
- Cập nhật Canvas/MySQL browser regression để kiểm tra lý do sửa mẫu thực sự hiển thị, thay vì chỉ tồn tại trong DOM; thêm unit test về phiên bản và XSS.
- Không sửa dữ liệu, Canvas JSON, thanh toán hoặc migration; CI trên GitHub cần được xác nhận sau khi áp dụng.

## Unreleased — Role Workspace Navigation & Dashboard Accessibility (2026-11-21)

- Thêm module dùng chung `role-workspace.js` cho điều hướng nhanh và số lượng bản ghi đã tải của Admin/Creator; không hiển thị số lượng tải được như tổng toàn hệ thống.
- Cải thiện trang Admin: phân chia rõ khu kiểm duyệt và yêu cầu hỗ trợ, liên kết nhanh sang giám sát thanh toán, tiêu đề có `aria-labelledby` và trạng thái tải thiếu minh bạch.
- Bổ sung liên kết nhanh Creator tới tạo mẫu, thư viện và báo cáo doanh thu; không hiển thị quyền Creator với tài khoản Sender.
- Thêm `role-workspace.css` theo token chung, giao diện responsive, focus-visible, vùng bấm 44px và hỗ trợ reduced motion; UI VI/EN dùng cùng layout.
- Thêm 14 khóa từ điển và 8 bài kiểm thử UI, phân quyền, đường dẫn nội bộ và dữ liệu không đầy đủ. Không thay đổi API, migration, Canvas JSON, thanh toán hoặc Refund Review.

## Unreleased — Global Shell UX & Refund Queue Resilience (2026-11-21)

- Sửa hai chuỗi tiếng Việt cố định trong giao diện App Shell: thông báo đối soát thanh toán và alt ảnh xem trước; chuyển VI/EN ngay tại trang bằng hệ thống i18n.
- Bổ sung cơ chế yêu cầu chỉ đọc mới nhất cho hàng đợi Refund Admin, chống phản hồi API cũ ghi đè bộ lọc mới; hiển thị trạng thái tải/lỗi không xóa danh sách đang xem.
- Chuẩn hóa nhãn trạng thái, vùng bấm 44px, focus-visible và reduced motion cho Refund Queue; mở rộng `npm run i18n:audit` và kiểm tra chặn chuỗi tiếng Việt hardcode trong `app/main.js`.
- Thêm kiểm thử unit và tài liệu `docs/GLOBAL_SHELL_UX_I18N.md`. Không thay đổi database, API, quyền, giao dịch hoặc dữ liệu Canvas.

## Unreleased — Designer History i18n & Fabric UI Tokens (2026-11-21)

- Chuẩn hóa 28 khóa VI/EN cho nhãn và lịch sử thao tác Canvas Designer; tên thành phần trong thông báo thêm element lấy từ từ điển nhưng không sửa dữ liệu mẫu đã lưu.
- Thêm `npm run i18n:audit` để lập danh sách ứng viên chuỗi tiếng Việt trên các trang và Canvas; `npm run check` chặn chuỗi UI tiếng Việt mới trong `designer.js` ngoài sáu giá trị nguồn được giải thích.
- Chuẩn hóa token focus, biên panel, thời gian tương tác và vùng bấm tối thiểu 44px cho Fabric Quickbar, Inspector và Style Properties; giữ `prefers-reduced-motion`.
- Thêm 5 bài kiểm thử chuyên biệt và `docs/I18N_AUDIT.md` nêu rõ phần đã kiểm chứng và giới hạn. Không đổi Canvas schema, dữ liệu người dùng, API, database, thanh toán hay quà đã phát hành.

## Unreleased — Fabric Quickbar & Style Properties i18n (2026-11-21)

- Chuyển nhãn nút, tooltip, `aria-label`, trạng thái và thông báo lỗi của Quickbar/Style Properties sang VI/EN theo cùng giao diện, đổi ngôn ngữ ngay trong Fabric Studio.
- Giữ nguyên ID action/field, tên lớp do người dùng tạo, giới hạn geometry, quyền chỉnh sửa và thao tác Áp dụng/Hủy; không thay đổi database, thanh toán hay định dạng Canvas.
- Củng cố responsive cho nhãn tiếng Anh dài, bổ sung kiểm thử khóa dịch, thao tác và trạng thái panel; ghi chú phạm vi kiểm tra vẫn cần browser CI.

## Unreleased — Fabric Inspector i18n và quy trình CHANGELOG (2026-11-21)

- Chuyển nhãn, thông báo và lỗi hiển thị của bảng thuộc tính Fabric Studio sang hệ thống VI/EN dùng chung; đổi ngôn ngữ ngay trong dialog mà không sửa bản nháp, geometry hoặc Undo/Redo.
- Giữ nguyên tên lớp và nội dung do người dùng nhập, escape an toàn qua DOM `textContent`; cải thiện nhãn dài trên điện thoại.
- Thêm `npm run changelog:check` để phát hiện commit có sửa source nhưng quên đưa `CHANGELOG.md` vào staging; quy trình áp dụng chung khi phát triển song song trên `main`.
- Bổ sung unit test cho bản dịch Fabric Inspector, kiểm soát lỗi UI và quy tắc changelog; không thay đổi API, database hay thanh toán.

## Unreleased — Tổng hợp các đợt phát triển đã tích hợp (2026-11-21)

- Bổ sung quản lý doanh thu Creator/Admin, đối soát ngoại lệ, xuất CSV theo quyền và kiểm soát công thức khi mở CSV.
- Bổ sung Refund Review: hồ sơ yêu cầu, lịch sử xử lý Admin, kiểm tra gửi lại khác nội dung và hàng đợi có lọc/phân trang; không tự hoàn tiền hoặc chi trả Creator.
- Nâng cấp hành trình marketing và bản dịch Canvas Designer/Recovery Center, bao gồm thư viện 172 phần tử; tách module hiển thị và tìm kiếm thư viện.
- Cập nhật kiểm thử trình duyệt cho Journey 3D, Fabric image load và route mock Refund; các bản cập nhật trước đã có lần CI/CD PASS trên `main`.

## Unreleased — Phase 6.3b: Read-only Conflict Review (2026-11-20)

- So sánh song song bản Canvas đang mở và bản được tải từ máy chủ ở chế độ chỉ đọc: phiên bản, tên, cảnh, layer, ảnh, bindings và thiết lập khác.
- Nhận biết thay đổi nội dung layer ngay cả khi tổng số layer không đổi; khu vực cá nhân hóa chỉ hiển thị tối đa 8 mục để không tràn giao diện.
- Tiếp tục dùng API GET, quyền owner, CAS và hộp xác nhận tải bản máy chủ hiện có; không thêm chức năng merge hoặc ghi đè mới.
- UI responsive, bàn phím/ARIA, từ điển tiếng Việt/tiếng Anh và unit tests; không chỉnh sửa session.js hoặc repository.

## Unreleased — Phase 6.1a: Designer Modularity & Release Safety

- Tách cấu hình thanh công cụ, tiện ích hiển thị/zoom và bộ chọn ảnh từ `designer.js` thành module độc lập `designer-helpers.js`, không thay đổi API hoặc state.
- Củng cố chính sách loại trừ source/release cho chứng chỉ, private key, file credentials, cấu hình riêng và bản sao dữ liệu; giữ migration SQL cùng license hợp lệ.
- Bổ sung kiểm thử hồi quy hành vi UI và release-safety; verifier từ chối thư mục `node_modules`/`data` lạ trong gói, kể cả thư mục rỗng. Không thay đổi API hoặc quyền nghiệp vụ.
- Đây là đợt 6.1a; chưa refactor toàn bộ file Designer, chưa tuyên bố đạt pentest/production.

## Unreleased — Phase 6.0b: Contextual Style Properties (2026-11-19)

- Bổ sung panel kiểu dáng theo loại đối tượng trong Fabric Studio và Inline Canvas.
- Văn bản: màu chữ, font token, cỡ chữ, căn lề, giãn dòng; hình khối: màu nền/viền, độ dày viền, bo góc; ảnh: opacity.
- Chỉ cập nhật bản nháp sau khi Áp dụng, kiểm tra allowlist, schema V1/V2, quyền Creator, lớp bị khóa, scene ID và thông số không hợp lệ.
- Mobile: panel thu gọn, nút tối thiểu 44px, CSS tách module, không emoji, không thay đổi API/DB.
- Bốn file local modified từ source gửi ngày 19/11 chỉ khác định dạng; cung cấp công cụ hoàn nguyên riêng có checksum, không tự động ghi đè.

## Unreleased — Phase 6.0a: Contextual Canvas Quickbar

- Thêm công cụ chỉnh nhanh theo lớp đang chọn: di chuyển, xoay 15°, căn giữa ngang/dọc.
- Phím mũi tên 1px, Shift + mũi tên 10px; không can thiệp khi nhập nội dung.
- Giữ quyền lớp, chính sách Creator, document Momevia, khả năng Hủy/Áp dụng và giao diện mobile.
- Không chỉnh sửa các file main.js, api.js, library.js, session.js đang modified ngoài phạm vi.
## Unreleased — Phase 5.9: Fabric Contextual Inspector

- Chọn layer Fabric và chỉnh X/Y, chiều rộng, chiều cao, góc xoay; căn giữa ngang/dọc.
- Inspector chỉ đổi đối tượng tạm, không sửa bản nháp trước khi chọn Áp dụng.
- Giữ khóa lớp, quyền Creator, kiểm soát dữ liệu và cơ chế Undo/Redo hiện tại.
- Không thay đổi API, schema, source ảnh hoặc 4 module có chỉnh sửa local ngoài phạm vi.
## Unreleased — Phase 5.8: Inline Fabric Workspace

- Chỉnh sửa trực tiếp trong Canvas Designer bằng Fabric.js, vẫn giữ Fabric modal cũ.
- Chọn layer, kéo, xoay, resize, sắp thứ tự, căn chỉnh; Áp dụng/Hủy theo document gốc.
- Chặn thay đổi chéo khi session đang mở; kiểm tra revision và quyền Creator trước khi ghi.
- Giữ schema Momevia, Undo/Redo, không lưu Fabric JSON; CSS và kiểm thử tách module.
## Unreleased — Phase 5.5: Expanded Elements & Canvas Discovery (2026-11-19)

- Thêm 48 hình vector nội bộ thuộc sáu chủ đề; Canvas Library tăng từ 124 lên 172 elements, bảo toàn 100 mục gốc và 24 hình Phase 5.4.
- Bộ lọc Tất cả / Theo dịp / Mới thêm / Vừa dùng, tìm kiếm không dấu, thống kê kết quả và thông báo khi không tìm thấy hình.
- 12 element dùng gần nhất chỉ lưu ID vào localStorage nếu trình duyệt cho phép, không lưu dữ liệu cá nhân hoặc nội dung thiệp.
- Tối ưu Canvas library trên desktop/mobile bằng CSS độc lập, focus-visible và prefers-reduced-motion; không thêm dependency, không sử dụng emoji.
- Cập nhật test API/UI và kiểm thử schema, quyền Creator, preview SVG, Undo/Redo, giữ tương thích thiệp V1/V2.

## Unreleased — Canvas 100: Crop Quick Focus (Phase 5.3 integration)

- Giữ nguyên 100 Elements, 24 hiệu ứng và schema V1/V2 sau khi hợp nhất cập nhật Canvas mới.
- Bổ sung bảng chín vị trí trọng tâm trong crop Inspector cho ảnh thường và ảnh nằm trong khối tương tác; không lưu lại ảnh gốc.
- Bảo toàn quyền chỉnh sửa Creator, Undo/Redo, autosave; nút crop có tên truy cập và điều khiển bàn phím.

## Unreleased — Fabric Precision Align (Phase 5.2)

- Chọn nhiều layer bằng checkbox, căn trái/giữa/phải/trên/dưới và chia đều khoảng cách.
- Chỉ tịnh tiến bounding box Fabric, bảo toàn góc xoay, hành động và quyền Creator.
- CSS độc lập, ARIA và unit tests; không migration hoặc thư viện mới.

## Unreleased — Fabric Workspace (Phase 5.1)

- Thêm Layer Panel trên Fabric Studio, đổi thứ tự/ẩn hiện có lưu, khóa thao tác tạm và snap tâm/biên.
- Giữ nguyên schema v1, quyền Creator và renderer người nhận; kiểm tra patch hợp lệ bằng unit tests.
- CSS riêng cho workspace, hỗ trợ mobile, ARIA và prefers-reduced-motion.

## Unreleased — Fabric Studio nâng cao (Phase 5 beta)

- Tích hợp Fabric.js (MIT) dưới dạng công cụ thiết kế nâng cao tùy chọn: di chuyển, xoay, thay kích thước và căn chỉnh lớp chữ/hình/ảnh.
- Mọi thay đổi được chuyển về Canvas schema gốc và đi qua kiểm tra quyền sửa cùng cơ chế Undo/Redo/autosave; không ảnh hưởng trình phát quà.
- Tách CSS, giữ vendor JavaScript cục bộ và kèm license trong release; bổ sung kiểm thử adapter.

## Unreleased — Phase 4: Viral Templates & Recipient Conversion (2026-11-19)

- Thêm 10 mẫu vector Momevia Originals miễn phí trong đợt marketing (4 mùa lễ 2026–2027, 6 mẫu cảm xúc), thành 24 mẫu tích hợp. Mỗi mẫu có 3 cảnh Canvas, tùy chỉnh tên người nhận/người gửi/lời nhắn; không dùng emoji hoặc ảnh stock.
- Chèn các ID mẫu còn thiếu vào Catalog JSON/MySQL, không ghi đè mẫu đã tồn tại hoặc snapshot quà đã gửi. Không yêu cầu migration mới.
- Thêm khu vực mẫu theo mùa trên /explore; mẫu vẫn tìm được quanh năm.
- Gắn CTA “Tạo thiệp của riêng bạn”, “Khám phá thêm mẫu” và “Tạo bằng Momevia” trên cả Legacy Gift và Canvas Gift. Link không mang invite token.
- Tách CSS thành seasonal-catalog.css và recipient-viral.css, thêm SVG preview và regression tests.

## Unreleased — Marketing UI & Payment Status (2026-11-18)

- Nâng cấp trang chủ phục vụ marketing: lợi ích thật, mô tả tương tác, FAQ và CTA rõ ràng.
- Tách CSS mới theo thành phần, breakpoint và màn hình thanh toán; SVG Lucide (ISC/MIT), không dùng emoji.
- Trình bày trạng thái đơn hàng pending/paid và cảnh báo không thanh toán lại khi chưa được provider xác nhận.
- Bổ sung kiểm thử nội dung, chống tràn mobile, giảm chuyển động và tài liệu giấy phép open source.
- Chưa mở API hủy/retry/refund tự động; yêu cầu kiểm thử merchant sandbox và quy trình đối soát tiền chuyển muộn.

## Unreleased — Identity Recovery & Admin Payment Operations (2026-11-18)

- Cho phép tài khoản email chưa xác minh yêu cầu đặt lại mật khẩu bằng mã 8 chữ số gửi đến chính hộp thư đăng ký; khi xác nhận hợp lệ, xác minh email, thay mật khẩu và vô hiệu hóa phiên cũ qua `credentialVersion`.
- Giữ mã một lần, hạn 15 phút, giới hạn thử nhập sai, giới hạn gửi lại và thông báo yêu cầu reset không tiết lộ sự tồn tại tài khoản.
- Thêm màn hình `/admin/payments` cho Admin để xem tối đa 100 đơn pending trên 30 phút, lọc/tìm mã đơn, xem nhật ký đối soát. Dùng các API read-only của Phase 2A; không thêm endpoint hủy/hoàn tiền/tự đánh dấu đã thanh toán.
- Bổ sung các unit test và mở rộng recovery integration journey cho tài khoản chưa xác minh; không yêu cầu migration mới.

## Unreleased — Payment Lifecycle Phase 2: Admin reconciliation review (2026-11-18)

- Thêm migration `009_payment_reconciliation_audit` để lưu metadata lần truy vấn provider (không lưu token/chữ ký/response body).
- Admin có API **chỉ đọc** để xem giao dịch chờ trên 30 phút và lịch sử đối soát; không có API tự đánh dấu paid hoặc mở khóa retry.
- Ghi nhận kết quả đối soát pending/paid/terminal/invalid/provider error; tăng regression tests xác thực quyền Admin và truy vấn có giới hạn.
- Chưa bật cancellation/retry tự động hoặc hoàn tiền. Phải kiểm thử MySQL thực tế và sandbox trước triển khai thanh toán thật.

## Unreleased — Payment reconciliation phase 1 (2026-11-18)

- Bổ sung server-side payment status inquiry cho MoMo và payOS; không tin return URL.
- Chỉ chuyển `paid` khi provider xác nhận đúng mã, số tiền và môi trường; tái sử dụng transaction cấp quyền/biên nhận hiện có.
- Giao diện payment-result có nút đối soát và giới hạn truy vấn; không tự mở khóa pending hoặc cho retry khi chưa có quy trình kiểm tra giao dịch muộn.
- Thêm regression tests và tài liệu `docs/PAYMENT_RECONCILIATION_20261118.md`.

# Unreleased — Sender, Creator và web demo

- Thiết kế 12 built-in template theo chủ đề riêng, thumbnail SVG và preview tương tác; khung polaroid nhận ảnh ready, giữ crop khi thay ảnh/nhân bản. Khởi tạo layout mới qua CAS khi client mới hơn cached server; giữ draft/gift/quyền và giá cũ.

- DOM editor cho blank/template: draft CAS, save/reload/edit, asset IDs/crop, history/scenes/layers, preview dùng chung player.
- Source/policy/provenance server-owned, registry/schema v1 strict, immutable publication/revision/hash/idempotency, link/QR và recipient anonymous/reply.
- JSON authoritative aggregate/recovery; MySQL migration006 + cùng-connection UnitOfWork, asset pins, entitlement/revoke và many-context checkout resume.
- Giữ payment/webhook/receipt v1.1; methods/pending/receipt-error riêng, không tự publish/thu lại khi retry.
- Cá nhân hóa nhanh, chia sẻ qua thiết bị, QR tải xuống, quyền link mời, hộp thư hồi đáp và thu hồi quà.
- Creator Studio thiết kế canvas, submit/duyệt phiên bản cố định, cấp ảnh demo, giữ nguồn cho nháp Sender và snapshot cho quà.
- Backup JSON và khôi phục MySQL/ảnh trong QA. Báo cáo Support theo đối tượng, người xử lý và kết quả. [Vận hành](docs/OPERATIONS.md)
- Bộ khởi tạo demo nhiều vai trò, hướng dẫn pilot ghi tay và GitHub Release theo tag sau các gate kiểm thử. [Web demo](docs/DEMO_WEB.md)

# 1.1.0 — Payment Gateway & Receipt Foundation

- Credential-gated payOS VietQR (chuyển khoản ngân hàng) và MoMo sandbox/live.
- Webhook được xác thực chữ ký SDK/IPN, đối chiếu amount/provider/order, replay-safe MySQL transaction.
- Chỉ cấp quyền khi webhook hợp lệ; không tin redirect/click client hoặc ảnh chụp chuyển khoản.
- Biên nhận thanh toán có quyền truy cập theo người mua, không tự nhận là hóa đơn VAT.
- Bật bằng PAYMENT_ENABLED; mặc định tắt. Cần merchant account, HTTPS và kiểm thử provider thật.

# Changelog

## 1.0.0 (MySQL Gifts & Checkout demo)

- MySQL adapters cho quà, phản hồi, đơn hàng demo và quyền sử dụng mẫu.
- Migration 004 tạo khóa duy nhất demo purchases và FK; transaction cấp entitlement không lặp, rollback khi lỗi.
- Reply SQL transaction ghi phản hồi và tăng `reply_count` nguyên tử; bảo toàn API public.
- Công cụ dry-run/import JSON Gifts & Checkout theo transaction và từ chối overwrite.
- Hai cờ `GIFTS_STORAGE` / `CHECKOUT_STORAGE` mặc định JSON để bảo toàn dữ liệu; ảnh vẫn local.
- Đây KHÔNG phải tích hợp thanh toán thật, không ghi nhận doanh thu/payout Creator.

## 0.9.0 — MySQL Identity & Catalog (candidate)

- MySQL repositories cho Users, Sessions, Templates và Favorites; async HTTP routing, JWT jti được tra từ MySQL, role lấy từ database.
- Migration 003 đặt provider_id case-sensitive, giảm xung đột ID demo/OAuth.
- Công cụ import JSON Identity/Catalog theo transaction: dry-run mặc định, từ chối ghi đè bảng có dữ liệu, bảo toàn JSON.
- Giữ nguyên API, tiếp tục hỗ trợ JSON qua IDENTITY_STORAGE và CATALOG_STORAGE.
- Lưu ý chưa xác minh E2E trên MySQL server trong môi trường phát triển patch; chạy checklist local trước khi deploy.

## v0.8.0 — MySQL 8.4 LTS foundation + Support adapter

- Thay migration/schema PostgreSQL bằng MySQL 8.4 LTS sử dụng InnoDB và utf8mb4.
- Bổ sung Docker Compose, công cụ chuẩn bị SQL snapshot JSON cho MySQL và bước xác minh schema/migrations.
- Thêm MySqlClient kết nối pool/transaction bằng mysql2/promise và adapter Support tùy chọn qua `SUPPORT_STORAGE=mysql`.
- Giữ JSON mặc định, thêm bridge ID Identity để không mất tham chiếu khi chuyển riêng Support.
- Chưa có MySQL runtime cho các module khác; chưa bật thanh toán thật.
- Cần chạy `npm install mysql2@3 --save-exact` để cập nhật lockfile trước khi commit và kiểm thử MySQL thực tế.

## v0.7.0 — PostgreSQL foundation (chưa chuyển runtime)

- Bổ sung lược đồ PostgreSQL cho Identity, Catalog, Gifts, Checkout, Support.
- Thêm constraints, index, bảng dự kiến payment events, entitlements, ledger và outbox.
- Thêm công cụ kiểm tra JSON và chuẩn bị snapshot SQL an toàn theo transaction (không tự import).
- Thêm Docker Compose cho DB thử nghiệm và hướng dẫn cài đặt trên Windows.
- Giữ nguyên ứng dụng chạy JSON Storage; chưa kích hoạt thanh toán hoặc PostgreSQL runtime.

## v0.6.0 — Modular Monolith (kiến trúc, chưa migrate DB)

- Gộp Gateway và năm module vào **một backend Node.js process**; vẫn dùng cổng public 4100.
- Giữ đường dẫn API và cấu trúc OOP, thay HTTP service-to-service bằng giao tiếp module qua dependency injection.
- Kiểm tra phiên/role bằng Identity module trong process; logout và thay đổi role có hiệu lực ngay.
- Duy trì proxy/service cũ dưới `dev:legacy` phục vụ so sánh hồi quy.
- Đổi `test:architecture` sang fixture một process; giữ bài test topology cũ riêng.
- Chưa thay JSON Storage, chưa tích hợp thanh toán thật/worker.

## Chưa phát hành — Sửa lỗi sau đối chiếu kiến trúc (16/11/2026)

- Chuyển nguyên bản ba tài liệu lịch sử về local, gỡ khỏi cây Git hiện hành; cập nhật ignore cho output/cache và đồng bộ chính sách loại trừ khi đóng gói/xác minh release.
- Tổ chức mã backend trong `src/modules`, tách app/route/service/repository/client; tách Gateway khỏi bootstrap và phần dùng chung. Giữ entrypoint cũ, cổng/API và vị trí dữ liệu local.
- Tách frontend thành app/core/pages/ui/features; phân nhóm unit/integration/browser/smoke và script build/quality/release/dev. Bổ sung ESLint kiểm tra định danh và import, kiểm thử view/OAuth state và browser fixture.
- Bổ sung đánh giá JSON storage, modular monolith và PostgreSQL/SQLite; chưa gộp process, migrate DB hoặc thay dữ liệu nghiệp vụ.
- Chặn Sender/Creator tự đổi role; thêm API Admin đổi role cho tài khoản đích mà không cấp nhầm phiên. Bỏ nút tự mở quyền Creator, kiểm tra lại quyền sau hạ role kể cả JWT cũ và cấu hình production.
- Sửa mô tả Redis/introspection theo kiểm thử thực tế; đánh dấu mẫu cá nhân, TTL theo mẫu và license theo lượt là backlog chưa triển khai, giữ dữ liệu/quyền cũ.
- Kiểm tra hai secret tại mọi service; production từ chối khóa mẫu và không phụ thuộc riêng launcher.
- Giới hạn login/register/demo-admin, giới hạn số scrypt đồng thời, bộ nhớ limiter cố định theo shard hash có khóa và quota tổng cho Support/replies.
- Ghi nhận phiên tại Identity, thu hồi phiên hiện tại khi logout và kiểm tra ở mọi service; JWT cũ yêu cầu đăng nhập lại.
- Đặt HTTP/upstream timeout rõ ràng, giảm giới hạn body ở endpoint nhỏ.
- Encode lại ảnh mới bằng sharp để bỏ EXIF, kiểm tra định dạng thực và giới hạn pixel; không sửa ảnh cũ.
- Tạo QR tại trình duyệt bằng module tự host, bỏ phụ thuộc QR Server API và cập nhật nội dung quyền riêng tư.
- CI Node 22/24 trên Windows/Linux; tạo gói có manifest SHA-256 và kiểm thử lại gói trước khi upload artifact. Chưa deploy hosting.
- Chặn đăng ký đồng thời trùng email trong tiến trình Identity hiện tại.
- Sửa URL ảnh thiệp trong dữ liệu public và danh sách quà của người gửi.
- Chặn namespace API nội bộ qua Gateway và bỏ header khóa nội bộ do client gửi.
- Xác lập IP tại Gateway, sửa hạn mức phản hồi bị dùng chung và chống giả IP ở Support.
- Thêm limiter có thu hồi key hết hạn và giới hạn số bucket theo tiến trình.
- Bổ sung kiểm thử HTTP trên bản sao cô lập, đưa vào CI và cập nhật báo cáo kiến trúc.

## v0.5.0 — Cải thiện trải nghiệm xác thực và phân trang

- Thiết kế lại hoàn toàn `/login` và `/register` với bố cục riêng biệt, tương thích desktop/mobile, không có cuộn lồng nhau.
- Xử lý xung đột CSS `.auth-page` cũ gây giới hạn 500px.
- Bổ sung thông báo lỗi ngay trong form, giữ biểu tượng email/khóa/mắt và nút Google/Zalo cân đối.
- Thư viện mẫu và Mẫu yêu thích được phân trang 9 mẫu/trang; trang tự điều chỉnh khi dữ liệu thay đổi.
- Khi tìm kiếm, đổi phong cách, chọn mẫu miễn phí hoặc đặt lại lọc: về trang 1 và cập nhật tổng kết quả.
- Thêm unit tests cho phân trang và tài liệu triển khai phiên bản cập nhật.

# Changelog

## v0.4.0 — 2026-11-16

- Chuyển xác thực email từ modal sang hai route `/login` và `/register` riêng.
- Cải thiện giao diện xác thực: logo, icon email/khóa/mắt, nút Google/Zalo chia hai cột bằng nhau, liên kết qua lại giữa hai form.
- Thay chip phong cách bằng dropdown tự xây từ dữ liệu mẫu, thêm lọc miễn phí riêng và cập nhật số mẫu phù hợp đúng với kết quả lọc.
- Bổ sung trang Quy định chung, Thanh toán, Bảo mật, Nội dung & Bản quyền; đưa liên kết vào footer. Nội dung hiện ở dạng dự thảo.
- Thêm script phát sinh tài khoản QA ngẫu nhiên (không hardcode tài khoản trong repository).
- Thêm unit tests cho filter, chính sách và smoke HTTP kiểm tra route.
- Giữ nguyên các microservices, API đăng ký/đăng nhập, OAuth và dữ liệu tài khoản hiện có.

---

## 0.3.0 — Đổi thương hiệu và cải thiện trải nghiệm

- Đổi Mira thành Momevia, logo 3D bản gốc.
- Header có Trang chủ, active navigation; chỉ giữ nút đăng nhập ở khách.
- Yêu thích lưu theo tài khoản, trang `/favorites`.
- Biểu mẫu liên hệ và Support Service; Back-to-top.
- Icon trong đăng ký/đăng nhập, ẩn scrollbar (vẫn cuộn được).
- Bỏ nhãn local/demo khỏi giao diện người dùng; mô tả minh bạch trạng thái thanh toán.
- Đã bổ sung kiểm thử yêu thích và hỗ trợ.

# Momevia MVP — Nhật ký cập nhật

## v0.2.0 — 15/11/2026

- Đổi toàn bộ thiết kế chữ sang Plus Jakarta Sans, Inter và Lora theo ba biến CSS được yêu cầu; không đóng gói font.
- Nâng độ tương phản và sắc độ của CTA, hero, card, header và section; bố cục responsive.
- Bổ sung tab Đăng ký và Đăng nhập bằng email/mật khẩu, lưu hash scrypt có salt trên backend.
- Thêm nút hiện/ẩn mật khẩu, xác nhận mật khẩu và thông báo lỗi đăng ký.
- Dùng logo thương hiệu Google/Zalo thực tế trên các nút OAuth; cần Internet và cấu hình để kích hoạt đăng nhập thật.
- Thêm Về chúng tôi trong header và menu mobile; mở rộng nội dung trang giới thiệu.
- Phân chia CSS theo auth.css, about.css và các tệp chức năng sẵn có, khai báo theo từng dòng.
- Thêm unit tests cho CredentialsService và smoke test đăng ký API.

**Chưa có:** xác minh email, quên mật khẩu, CAPTCHA, giới hạn login, liên kết tài khoản OAuth/email, backend database production, kiểm thử trình duyệt đầy đủ.

## 2026-11-21 — Finance CSV exports (Beta, read-only)

- Creator: xuất tối đa 100 giao dịch sale đã xác nhận gần nhất; dùng lại endpoint kiểm tra quyền hiện có.
- Admin: xuất tối đa 100 đơn ngoại lệ đối soát gần nhất, giữ nguyên mã lỗi và phân tách live/sandbox.
- CSV chỉ bao gồm cột cho phép, escape dấu nháy kép và phòng tránh CSV formula injection; không có tên, email, token hay reference nhà cung cấp.
- Không thay đổi schema, thanh toán, webhook, ledger, hoàn tiền hoặc chi trả Creator.
- Unit tests bổ sung cho phân quyền nguồn API, định dạng dữ liệu, UI hiển thị nút và lọc dữ liệu nhạy cảm.
