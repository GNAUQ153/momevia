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
