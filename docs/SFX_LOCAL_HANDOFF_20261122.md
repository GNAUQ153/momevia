# Bàn giao âm thanh Momevia — local, 22/11/2026

Phạm vi: triển khai và kiểm chứng local. Không push, không deploy production, không chạy migration trên database hiện có của người dùng. Phần tối ưu trước đó được giữ nguyên trên nhánh `perf/interactive-cards-lcp`.

## Điểm xuất phát và cách cô lập

- Xác minh repo tại `P:\entrepreneuer\project\momevia`: HEAD `34f4e52930231dfbff9e2d9dda9f65b99cbb11ed`, nhánh `perf/interactive-cards-lcp`, cây làm việc sạch khi bắt đầu. Mốc khảo sát `7b684e1` đã được thay thế bởi commit tối ưu hoàn tất.
- Theo yêu cầu sau đó, làm trực tiếp trên nhánh hiện hành. Nhánh tạm đã được xóa; không chuyển công việc tối ưu sang nhánh khác.
- Không tìm thấy `AGENTS.md` áp dụng ở các thư mục cha hoặc trong cây mã sửa đổi. Đã đọc registry, schema, `assetIds`, public projection, thư viện mặc định/SQL, Studio, player, upload, xuất bản, media của quà, Creator cover, backup/import và tặng lại. Graph hiện hữu được tham khảo, sau đó đối chiếu mã đang sở hữu hành vi.
- JSON/media: các bản sao mã và dữ liệu mới trong `local/sfx-qa/`. MySQL: Docker `mysql:8.4`, chỉ loopback, cổng ngẫu nhiên, schema mới `momevia_canvas_qa_*`; không đọc mật khẩu hay dữ liệu ứng dụng đang dùng.
- Kiểm thử nền: `npm run check` đạt; unit 566/567, một lỗi do `.env` hiện tại bật tài khoản thử trong ca production. Các lượt chạy sau đặt rõ `TEST_ACCOUNT_ENABLED=false`; không sửa `.env` thực hoặc nới kiểm tra production.

## Cách chạy và dùng

```powershell
npm run demo:sfx
```

Demo mặc định tại `http://127.0.0.1:4122`; có thể đặt `SFX_DEMO_PORT` nếu cổng đang dùng. Mỗi lần khởi động tạo thư mục dữ liệu mới, không dùng bản nháp/tài khoản/media thật. Đường dẫn link người nhận và tệp đăng nhập local được in lúc khởi động. Demo tạo một nháp có phong bì, hộp quà, nút âm thư viện và nút âm cá nhân; đồng thời tạo một quà không có SFX để đối chiếu mạng.

Trong Studio, mở **Âm thanh** để thêm nút âm thanh; chọn phong bì, hộp quà hoặc nút có sẵn rồi mở **Âm khi nhấn** để gắn âm. Danh mục có nhóm, tìm VI/EN có hoặc không dấu, nghe thử, dừng, chọn, thay, tỉa, âm lượng và gỡ. Nghe thử chỉ đổi trạng thái của bộ chọn. Chỉ thao tác Áp dụng cuối cùng mới tạo một bước undo, rồi đi qua autosave/revision hiện hữu.

Với đoạn cá nhân: chọn tệp, chỉnh hai thanh mốc hoặc hai ô giây, nghe đoạn chọn rồi Áp dụng để tải đúng đoạn và gắn vào phần tử trong một bước undo. Hủy không sửa tài liệu. Sau khi đã lưu đoạn cắt, muốn mở rộng ra ngoài đoạn đó phải chọn lại tệp nguồn trên thiết bị; hướng dẫn này có ngay trong bộ tỉa.

## Hợp đồng và quyền

- Canvas v1/v2 tiếp tục đọc được. Chỉ nâng tài liệu lên schema/registry/runtime **3** khi dùng `sound-button`, thuộc tính `sound`, hoặc asset âm thanh. Không đổi version của thiết kế cũ chỉ vì mở Studio.
- `sound` nằm riêng trên phần tử, không trộn vào danh sách action. Button/envelope/gift-box giữ hành động điều hướng; nút âm thanh dùng click native, hỗ trợ Enter/Space và touch.
- Thư viện lưu `{kind:'library', id, version, startMs, endMs, volume}`. Cá nhân lưu `{kind:'audio', assetId, volume}`; không lưu lại mốc cắt vì WAV đã chứa đúng đoạn. Gain không được ghi vào PCM: nghe thử và phát thật chỉ áp dụng volume một lần.
- `assets[].kind` phân biệt `image` và `audio`. `assetIds` bao gồm âm cá nhân trên cả nút lẫn phong bì/hộp; `imageAssetIds` chỉ lấy ảnh cho Sharp/cover.
- Quyền sở hữu, revision CAS, policy khóa và Creator/Sender vẫn do server quyết định. Âm của Creator được ghim theo phiên bản; khi tạo nháp Sender, ID tài sản âm cũng được remap như ảnh. Sender không được sửa âm khóa.
- Snapshot quà chỉ ghim tài sản thực sự dùng. Media cá nhân được đọc qua đường quà và kiểm quyền mở, lời mời, hết hạn, thu hồi, pin của đúng quà. Không phục vụ media người dùng qua đường static.
- Tặng lại bố cục giữ âm thư viện, loại mọi `sound.kind='audio'` của người gửi trước, kể cả âm gắn vào phong bì. Chữ cá nhân/nhãn cũ được xử lý theo cơ chế làm sạch bố cục sẵn có.

## Migration, upload và bảo trì

Migration mới: `database/migrations/014_canvas_audio.sql`. Thêm `media_kind` (ảnh cũ mặc định image), `duration_ms`, `sample_count`, `sample_rate`, `channels`; thay constraint chỉ-ảnh bằng constraint ảnh/PCM. Audio phải mono, PCM16, 44.100 Hz, 4.410–441.000 mẫu; số byte phải đúng `44 + sample_count * 2`. Thời lượng DB được kiểm với số mẫu, còn giá trị API được dựng lại từ số mẫu để giữ độ chính xác qua import.

Server chỉ nhận đoạn WAV chuẩn từ bộ tỉa: kiểm RIFF/WAVE/fmt/data, PCM, số kênh, sample rate, byte rate, block align, bit depth, số mẫu, kích thước RIFF/data, kích thước HTTP khai báo/thực tế, độ dài 100–10.000 ms và giới hạn 882.044 byte. Tệp nguồn đầy đủ không đi qua API.

Hạn mức tích lũy 50 MiB tính tài sản sẵn có của chủ sở hữu. Upload mới được kiểm trong vùng ghi tuần tự JSON hoặc transaction MySQL có khóa chủ sở hữu. Tệp stage chỉ được chuyển thành tệp sẵn sàng sau khi đủ hạn mức. Cùng mutation và cùng bytes cho cùng ID; đổi bytes với mutation cũ trả 409. Tệp sẵn sàng không bị ghi đè; lỗi metadata sau khi ghi tệp có thể sửa bằng thử lại cùng mutation.

`scripts/dev/audio-media-audit.mjs` mặc định chỉ kiểm kê. Công cụ bảo toàn mọi tệp có metadata/tham chiếu, kể cả nháp lưu trữ, version cũ, quà hết hạn hoặc thu hồi. Chỉ WAV không có metadata, không có tham chiếu và đã quá 7 ngày mới có thể được chuyển vào thư mục cách ly khi chỉ định cả `--offline --quarantine`. Không tự động xóa tài sản đã lưu. Những tài sản đã gỡ khỏi nháp vẫn được giữ để phục vụ undo, quà và phục hồi; chúng vẫn tính hạn mức.

```powershell
node scripts/dev/audio-media-audit.mjs --source <thu-muc-designs-data-cua-fixture>
```

Với MySQL thêm `--mysql` và truyền rõ cấu hình database kiểm thử qua biến môi trường. Không chạy dọn khi còn writer. Công cụ cách ly không nằm trong đường upload/publish của sản phẩm.

Backup JSON, dump/restore MySQL, import JSON→MySQL, MIME static và gói release đã được mở rộng cho WAV. Các tệp âm thư viện có phiên bản nằm trong gói Momevia; phải giữ thư mục phiên bản cũ cùng index/manifest. Bộ sinh từ chối thay bytes của bản ghi v1 đã tồn tại.

Thư viện MySQL đã có dữ liệu chỉ được bổ sung hai dòng SFX còn thiếu; không ghi đè definition, trạng thái disabled, thứ tự hoặc revision do Admin sửa. Bộ chọn dùng duy nhất danh mục 40 âm ở `/api/designs/sfx` cho cả profile JSON và MySQL.

## Phát âm và tốc độ

- Mở quà luôn im lặng. **Nghe** là yêu cầu nghe chủ động; **Bật âm thanh** bật âm đi kèm tương tác. Tắt tiếng giữ trạng thái tắt cho các tương tác tiếp theo trong player đang xem. Giảm chuyển động là lựa chọn độc lập.
- Sau khi người nhận bật âm, chuẩn bị âm đi kèm các phần tử đang hiện (tối đa 4 tác vụ đồng thời), không tự phát. Cache tối đa 8 buffer. Nếu buffer đã sẵn sàng, phát bắt đầu ngay trong thao tác và điều hướng không phải chờ tệp.
- Mỗi player có tối đa một voice. Thao tác mới dừng voice/yêu cầu cũ. Chuyển cảnh hủy ý định chờ tải; tệp chậm không tự phát ở cảnh sau. Ẩn tab dừng tiếng và tạm dừng AudioContext; đóng preview/rời quà giải phóng context, cache và node.
- Không tải tệp âm khi chỉ mở catalog, mở bộ chọn (chỉ tải metadata), hoặc mở quà chưa bật/nghe. Công cụ waveform/decode/tỉa nằm trong module tải động riêng.
- Âm lỗi hoặc bị trình duyệt từ chối không chặn mở thư, chuyển cảnh, đọc hay hồi đáp. Với lời nói quan trọng, bộ chọn nhắc gửi kèm chữ hoặc nhãn có ý nghĩa.

## Giới hạn bộ tỉa đã biết

- Mặc định nguồn tối đa **10 MiB, 60 giây**; đoạn kết quả **100–10.000 ms**; xuất **WAV PCM16 mono 44,1 kHz**. Nhiều kênh được trộn mono. Mốc nhập có bước 0,001 giây, được quy đổi về biên mẫu.
- Ngân sách buffer giải mã giữ lại 64 MiB; WAV được kiểm ước lượng trước giải mã, mọi buffer được kiểm lại sau giải mã. Chưa đo đỉnh cấp phát bên trong bộ giải mã của từng hệ điều hành, đặc biệt thiết bị iPhone thật.
- Đã kiểm trên Chrome 157 Windows với WAV PCM, MP3 128 kbit/s và M4A chứa AAC 128 kbit/s tự tạo từ cùng tệp thử. Không suy rộng cho mọi profile AAC, tệp DRM, raw ADTS `.aac`, hoặc mọi file do ứng dụng điện thoại sinh ra.
- Đây là bộ tỉa đoạn đơn, không có fade/crossfade, ghép nhiều tệp, cân bằng âm hoặc xử lý giọng nói. Lần tỉa lại đoạn đã lưu tạo asset mới, không thay asset đã gửi.

## Bằng chứng kiểm chứng

Các kết quả dưới đây là tự động từ lần triển khai này, không phải duyệt âm bằng tai người.

| Nhóm | Kết quả và bằng chứng |
|---|---|
| Unit/kiểm tra mã/build | 574/574 unit ở lượt `unit-delivery.log`; `check-delivery.log` và build đạt. Có 7 unit SFX mới cho 40 tệp, hợp đồng v3, cắt PCM, player, HTTP binary, lỗi metadata và cách ly orphan. |
| 40 tệp | Đủ 8 nhóm × 5; giải mã WAV/header, số mẫu, duration, peak, SHA-256 riêng biệt và hồ sơ CC0; cả 40 được phát thử/dừng tự động trong Chrome. Chưa có người nghe duyệt. |
| Studio JSON | Tạo từ giao diện, gắn âm phong bì/hộp/nút, tìm có/không dấu, lọc, volume, Hủy, undo/redo, save/reload, preview, publish bằng giao diện và mở guest link: đạt. |
| Clip cá nhân | Nguồn 3 giây gồm 220/880/1760 Hz; chỉ POST 88.244 byte của đoạn giữa, không POST nguồn 264.644 byte. Cố ý làm mất phản hồi sau khi server commit, thử lại cùng bytes/mutation, chỉ tạo một asset. |
| Kiểm chứng qua người nhận | WAV 44.100 mẫu/1.000 ms; byte API bằng đúng phần giữa. Browser decode tương quan 880 Hz ≈ 0,1998; 220/1760 Hz ≈ 1,6×10⁻⁷. Hai đầu đã bị loại. Có kiểm đoạn sát đầu/cuối và tối thiểu 100 ms. |
| Quyền và tính bất biến | Hai tài khoản, sai chủ, giả mạo kiểu media, tài sản ngoài quà, CAS cũ, invite, hết hạn, revoke, sửa nháp sau khi gửi, cắt lại và audio trên phong bì khi tặng lại: đạt. |
| Hạn mức/lỗi | Hai upload đồng thời với chỗ trống chỉ đủ một đoạn: một 201, một 413, không có ready-file từ yêu cầu bị từ chối. Lỗi trước commit metadata, replay upload/publish và rollback import: đạt. |
| Creator v3 | Upload trong Creator, submit/approve, preview media, SVG cover không đưa WAV vào Sharp, remap asset khi tạo Sender và khóa âm không cho Sender sửa: đạt ở JSON/MySQL. |
| MySQL | 9 nhóm SFX API trên MySQL 8.4 đạt; adapter nền 13 ca, HTTP nền 21 ca đạt (provider giả lập, không merchant thật). |
| Lưu trữ/restore | JSON backup/verify/restore; import JSON→MySQL chính xác, lỗi giao dịch rồi retry; dump 14 migration, restore schema mới, đối chiếu toàn bộ bảng/hash media, fresh app trả đúng WAV qua link quà: đạt. |
| MySQL thư viện | 182 factories, 33 effect presets, 18 tổ hợp celebration, restart/reload, CRUD/CAS/history/preview Admin và 4 viewport: đạt. Hai dòng SFX không đè chỉnh sửa Admin. |
| Hồi quy Canvas | Suite JSON Canvas browser đầy đủ đạt, gồm quà v1/v2, Creator/Sender, ảnh, QR, hồi đáp, offline/recovery, revision, touch/bàn phím, nhiều viewport và reduced motion. |
| Player SFX | Im lặng khi mở; âm phong bì đã chuẩn bị phát bằng Enter cùng chuyển cảnh; bấm nhanh, đóng preview, tắt tiếng, ẩn tab mô phỏng, tệp lỗi và yêu cầu âm bị giữ chậm rồi chuyển cảnh: đạt trên Chrome. |
| Tạm dừng tạo | `SFX_CREATE_ENABLED=false`: upload và đổi âm mới bị chặn; sửa chữ với âm hiện hữu vẫn lưu; đường âm của quà đã gửi vẫn 200. |
| Thiết bị/trợ năng | Chrome desktop thật trên Windows; mobile viewport/touch là giả lập. Có keyboard và ARIA snapshot. Chưa thử Android/iPhone thật hoặc trình đọc màn hình thật. |
| WebKit | Playwright WebKit 27.2 Windows không cung cấp AudioContext/webkitAudioContext. Đã kiểm thông báo không hỗ trợ và vẫn mở/đọc quà; không đánh dấu phát/tỉa âm đạt trên engine này, không coi là Safari/iPhone thật. |
| Hiệu năng | 35/35 mẫu sau đạt LCP <2.600 ms và CLS ≤0,1. LCP cao nhất 2.344 ms. Không có request tệp âm trong các ca catalog/template. Demo độc lập cũng kiểm catalog và quà không dùng SFX có 0 request âm. |

Các log và kết quả máy nằm trong `local/sfx-qa/`. Bản ghi test có đường dẫn fixture và phiên bản browser; tệp `session-private.json` chứa tài khoản thử nên không đóng gói hoặc đưa vào Git.

## Các tệp mã chính

- Hợp đồng: `web/js/shared/canvas/{registry,schema,sound,sfx-index,audio-pcm,clean-layout,library-materialize,cover-svg}.js`.
- Studio: `web/js/pages/designer.js`, `features/canvas-editor/{sound-editor,audio-trimmer,library,designer-helpers}.js`, `web/css/sound-editor.css`, VI/EN locale.
- Player chung: `web/js/features/gift-runtime/{audio,index,renderer}.js`.
- Server/quyền: `src/modules/designs/{audio.service,assets.service,designs.service,routes,app,json.repository,mysql.repository,library.service}.mjs`, `src/modules/catalog/creator-routes.mjs`, `src/gateway/static.mjs`.
- Lưu trữ: migration 014, `database/scripts/{canvas-backup,import-canvas-json}.mjs`, `scripts/dev/{canvas-backup,audio-media-audit}.mjs`.
- Asset và nguồn: `web/assets/sfx/v1/`, `web/assets/sfx/LICENSE.txt`, `scripts/build/sfx.mjs`.
- Kiểm chứng/demo: `tests/unit/sfx.test.mjs`, `tests/integration/{sfx,sfx-fixture,sfx-storage}.mjs`, `tests/browser/sfx.mjs`, `scripts/qa/sfx-performance.mjs`, `scripts/dev/{sfx-local,sfx-demo-card}.mjs`.
- Các assertion đếm thư viện được cập nhật thêm đúng một element/một element type; không bỏ các kiểm tra 100 mục gốc. Smoke stylesheet và đổi ngôn ngữ Admin dùng giao diện/bundle thực để tương thích nền ESM đã tối ưu.

## Chạy lại

```powershell
$env:TEST_ACCOUNT_ENABLED='false'
npm run check
npm run build
npm test
npm run test:canvas:browser
npm run test:architecture
npm run test:sfx
npm run test:sfx:mysql
npm run test:sfx:storage
node scripts/qa/sfx-performance.mjs
```

Docker cần có image `mysql:8.4`. Chrome cần cài tại máy. Ca codec MP3/M4A trong suite browser chạy thêm khi đặt `SFX_QA_FFMPEG` tới FFmpeg cục bộ; công cụ QA này không phải phụ thuộc của tính năng và không đi vào bundle sản phẩm. Các kiểm tra MySQL tự tạo schema/container kiểm thử và không chuyển profile ứng dụng hiện tại.

## Danh mục 40 âm và nguồn

Tất cả là WAV thật được tổng hợp bằng các công thức Foley/giai điệu gốc, không phải placeholder hoặc âm tải lại của bên thứ ba. Foley ở đây là mô phỏng tổng hợp, chưa phải bản ghi hiện trường được người nghe duyệt. Tác giả ghi trong manifest: **Momevia procedural audio project**; giấy phép **CC0-1.0**; bằng chứng: mã sinh `scripts/build/sfx.mjs` và tuyên bố `web/assets/sfx/LICENSE.txt`. Không dùng bản ghi, sample hoặc giai điệu bên ngoài.

Mỗi hàng dưới có tệp nguồn `web/assets/sfx/v1/<ID>.wav`, phiên bản 1. SHA-256 đầy đủ, sample count/rate, byte count, từ khóa VI/EN và công thức nằm tại `web/assets/sfx/v1/catalog.json`; bộ kiểm chứng đọc chính 40 tệp này.

| # | Nhóm | ID | Tên VI | Tên EN | Thời lượng (ms) |
|---:|---|---|---|---|---:|
| 1 | Thư và giấy | seal-peel | Bóc niêm phong | Peeling a seal | 850 |
| 2 | Thư và giấy | letter-unfold | Mở nếp thư | Unfolding a letter | 1300 |
| 3 | Thư và giấy | page-turn | Lật trang | Turning a page | 700 |
| 4 | Thư và giấy | paper-rustle | Giấy xào xạc | Paper rustle | 1100 |
| 5 | Thư và giấy | pen-sign | Nét ký tên | Pen signature | 950 |
| 6 | Hộp và quà | ribbon-untie | Tháo nơ | Untying a ribbon | 1200 |
| 7 | Hộp và quà | box-pop | Bật nắp hộp | Box lid pop | 650 |
| 8 | Hộp và quà | gift-shake | Lắc hộp quà | Shaking a gift | 1500 |
| 9 | Hộp và quà | wood-lid | Mở hộp gỗ | Wooden lid | 900 |
| 10 | Hộp và quà | wrap-tear | Xé giấy gói | Tearing gift wrap | 1000 |
| 11 | Lấp lánh | tiny-spark | Tia sáng nhỏ | Tiny spark | 600 |
| 12 | Lấp lánh | fairy-dust | Bụi tiên | Fairy dust | 1700 |
| 13 | Lấp lánh | star-trail | Vệt sao | Star trail | 1500 |
| 14 | Lấp lánh | glass-twinkle | Leng keng pha lê | Crystal twinkle | 1300 |
| 15 | Lấp lánh | magic-reveal | Phép màu hiện ra | Magic reveal | 1900 |
| 16 | Sinh nhật | candle-blow | Thổi nến | Blowing a candle | 1200 |
| 17 | Sinh nhật | confetti-pop | Pháo giấy | Confetti pop | 1400 |
| 18 | Sinh nhật | balloon-pop | Bóng bay nổ | Balloon pop | 450 |
| 19 | Sinh nhật | birthday-chime | Chuông mừng tuổi | Birthday chime | 1800 |
| 20 | Sinh nhật | party-horn | Kèn tiệc vui | Party horn | 900 |
| 21 | Kỷ niệm | camera-shutter | Màn trập máy ảnh | Camera shutter | 450 |
| 22 | Kỷ niệm | projector-click | Máy chiếu ký ức | Memory projector | 1600 |
| 23 | Kỷ niệm | heartbeat | Nhịp tim | Heartbeat | 1500 |
| 24 | Kỷ niệm | music-box | Hộp nhạc xưa | Vintage music box | 2400 |
| 25 | Kỷ niệm | clock-tick | Tích tắc | Clock tick | 1300 |
| 26 | Tương tác | soft-tap | Chạm nhẹ | Soft tap | 200 |
| 27 | Tương tác | gentle-click | Bấm dịu | Gentle click | 240 |
| 28 | Tương tác | swipe-whoosh | Vuốt qua | Swipe whoosh | 550 |
| 29 | Tương tác | choice-ding | Đã chọn | Choice ding | 700 |
| 30 | Tương tác | success-pair | Hai nốt hoàn tất | Success pair | 950 |
| 31 | Thiên nhiên | water-drop | Giọt nước | Water drop | 600 |
| 32 | Thiên nhiên | rain-window | Mưa bên cửa | Rain at the window | 2600 |
| 33 | Thiên nhiên | bird-call | Chim gọi sáng | Morning bird | 1500 |
| 34 | Thiên nhiên | gentle-wind | Gió dịu | Gentle wind | 2400 |
| 35 | Thiên nhiên | shore-wave | Sóng ven bờ | Shore wave | 2800 |
| 36 | Giai điệu ngắn | warm-ending | Kết ấm áp | Warm ending | 2400 |
| 37 | Giai điệu ngắn | playful-ending | Kết tinh nghịch | Playful ending | 1800 |
| 38 | Giai điệu ngắn | tender-ending | Kết dịu dàng | Tender ending | 2800 |
| 39 | Giai điệu ngắn | bright-ending | Kết rạng rỡ | Bright ending | 2100 |
| 40 | Giai điệu ngắn | goodnight-ending | Khúc chúc ngủ ngon | Goodnight ending | 3000 |

## Số đo và link demo cuối

Bản demo đang chạy riêng trên loopback:

- Studio: http://127.0.0.1:4122/design/22942df6-57bd-487e-a4bf-47685b65ec1f
- Link người nhận: http://127.0.0.1:4122/g/MGatS3uiVk179f8xkLNktXf5xw28c3ST
- Quà không âm: http://127.0.0.1:4122/g/bpOeIcQRqbMOz-WDId42Dk4dDzYSyJDd
- Tài khoản đăng nhập thử: `local/sfx-qa/demo-1795346753370/session-private.json`. Đây là fixture mới, không phải tài khoản sản phẩm.

Phép đo: Chrome 157.0.8103.51; 390×844, DPR 1, CPU chậm 4 lần, RTT 100 ms, tải xuống 200.000 byte/s, tải lên 93.750 byte/s, tắt cache, 5 lượt/route, quan sát thêm 4.500 ms. Bản nền được dựng từ HEAD tối ưu 34f4e52. Lượt cuối tái sử dụng đúng 35 mẫu nền đã đo trong cùng lần triển khai, kiểm cùng cấu hình/browser, rồi đo mới 35 mẫu bản bàn giao. Đây là số đo lab local, không phải Core Web Vitals production.

| Route | Median trước (ms) | Median sau (ms) | Max sau (ms) | CLS max sau | Tăng byte median |
|---|---:|---:|---:|---:|---:|
| /explore | 1700 | 1656 | 2344 | 0.0002 | 1472 |
| /template/hai-phong-bi | 2060 | 2024 | 2060 | 0.0384 | 1424 |
| /template/birthday-radiance | 1172 | 1192 | 1208 | 0.0384 | 1424 |
| /template/proud-of-you | 1716 | 1708 | 1824 | 0.0384 | 1424 |
| /template/loi-moi-ben-hien | 2092 | 2104 | 2192 | 0.0384 | 1450 |
| /template/cuon-phim-ngay-ay | 2160 | 2160 | 2192 | 0.0384 | 1449 |
| /template/ban-do-ngay-ra-truong | 1756 | 1776 | 1792 | 0.0286 | 1449 |

Bằng chứng đầy đủ:

- `local/sfx-qa/performance-1795345354617/performance.json`: phép đo nền và lượt đối chiếu đầu tiên.
- `local/sfx-qa/performance-1795346409146/performance.json`: 35 mẫu nền + 35 mẫu bản cuối, all-pass.
- `local/sfx-qa/json-1795346647655/`: SFX API/browser cuối, cắt âm thư viện và cá nhân, mỗi Áp dụng một undo; lỗi mất ACK rồi replay; codec input, ảnh desktop/mobile, WebKit fallback.
- `local/sfx-qa/sfx-acceptance-final.log`: lượt SFX đạt.
- `local/sfx-qa/mysql-1795344567242/results.json`: 9 nhóm API SFX MySQL.
- `local/sfx-qa/storage-1795344633634/`: adapter 13 ca và MySQL API 21 ca đạt; lượt này phát hiện assertion đếm cũ trong suite thư viện, đã sửa cho element mới.
- `local/sfx-qa/storage-1795345230852/storage-results.json`: import/restore và suite lưu trữ/thư viện MySQL đầy đủ đạt sau sửa kiểm chứng trên bundle thực.
- `local/sfx-qa/canvas-browser-handoff.log`: suite Canvas browser đầy đủ đạt.
- `local/sfx-qa/architecture-second.log`: kiến trúc/HTTP/smoke đạt; smoke kiểm stylesheet đóng gói thực.
- `local/sfx-qa/unit-delivery.log`, `check-delivery.log`, `build-delivery-final.log`: unit 574/574, kiểm mã/VI-EN và build.
- `local/sfx-qa/demo-1795346753370/demo-check.json`: link đang bàn giao, 0 request âm cho catalog/quà không âm; tiếng phong bì phát offset 0 trong 850 ms sau opt-in; âm cá nhân nghe chủ động; WebKit Windows không có API âm và fallback vẫn mở quà.

Chưa xác minh: nghe duyệt chủ quan từng âm bởi người, Android thật, Safari/iPhone thật, NVDA/VoiceOver thật, đỉnh bộ nhớ giải mã trên thiết bị thật và mọi biến thể/profile AAC. Không đánh dấu các phần này đạt.


Đóng gói: `npm run package` và `npm run verify:package` đã đạt; manifest bao gồm đủ 40 WAV thư viện, license, catalog và migration 014; không chứa `local/`, tài khoản hoặc media cá nhân của fixture. Không đưa gói này lên server.
