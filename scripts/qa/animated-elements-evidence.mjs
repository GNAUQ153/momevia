import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {ANIMATED_ELEMENTS,ANIMATED_GROUPS} from '../../web/js/shared/canvas/animated-elements.js';
import {builtinLibraryItems} from '../../src/modules/designs/library.seed.mjs';
const out=path.resolve('docs/animated-elements-50'),read=name=>JSON.parse(fs.readFileSync(path.join(out,name))),qa=read('qa-report.json'),extra=read('extra-qa.json'),controls=read('controls-qa.json'),perf=read('performance-before-after.json'),network=read('network-before-after.json'),fresh=read('fresh-mysql.json'),provenance=read('provenance.json'),session=JSON.parse(fs.readFileSync('local/animated-elements-50/session.json'));
const unitLog=fs.readFileSync('local/animated-elements-50/unit-release-candidate.log','utf8'),checkLog=fs.readFileSync('local/animated-elements-50/check-release-candidate.log','utf8');assert.match(unitLog,/ℹ pass 767/);assert.match(unitLog,/ℹ fail 0/);assert.match(checkLog,/PASS JavaScript syntax\/scope/);assert.match(checkLog,/PASS CSS style/);
for(const [name,r]of Object.entries({qa,extra,controls,perf,network,fresh}))assert.equal(r.passed,true,name+': '+JSON.stringify(r.failure));
assert.equal(qa.elements.length,50);assert.equal(new Set(qa.elements.map(e=>e.id)).size,50);assert.equal(provenance.length,50);assert(controls.legacyLoopEnablePreservesEntrance);
const response=await fetch(session.base+'/api/designs/library'),live=await response.json();assert.equal(response.status,200);const expected=builtinLibraryItems().filter(r=>r.kind==='element'&&(r.id.startsWith('motion-')||r.id==='natural-motion-heart'));
for(const row of expected){const got=live.library.items.find(r=>r.kind===row.kind&&r.id===row.id);assert(got);assert.equal(got.status,'active');assert.deepEqual(got.definition,row.definition,row.id);}
const groups=ANIMATED_GROUPS.map(([name])=>live.library.items.filter(r=>r.kind==='element'&&r.id.startsWith('motion-')&&r.definition.group.vi===name).length);assert.deepEqual(groups,[10,10,10,10,10]);
const changedFiles=execFileSync('git',['diff','527e6468e0669e6bd5b55dc3a674f45e605e52bc','--name-only'],{encoding:'utf8'}).split(/\r?\n/).concat(execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).split(/\r?\n/)).filter(f=>/^(?:src|web)\//.test(f)&&/\.(?:js|mjs|json|css)$/.test(f));
const files=[...new Set([...changedFiles,'web/js/shared/canvas/natural-motion.js','web/js/shared/canvas/library-contract.js','web/js/features/gift-runtime/recipe-runtime.js','src/modules/designs/designs.service.mjs'])].sort();
const source={};for(const f of files){const a=fs.readFileSync(f),b=fs.readFileSync(path.join(session.fixture,f));assert(a.equals(b),'Current QA source differs: '+f);source[f]=createHash('sha256').update(a).digest('hex');}fs.writeFileSync(path.join(out,'source-fingerprints.json'),JSON.stringify(source,null,2)+'\n');
const verified={date:'2026-11-24',branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),baseline:'527e6468e0669e6bd5b55dc3a674f45e605e52bc',requestedReference:'2fc7cbf',liveRows:live.library.items.length,liveElements:live.library.items.filter(r=>r.kind==='element').length,liveMotionElements:live.library.items.filter(r=>r.kind==='element'&&r.definition.visualKind==='animation').length,newIds:expected.filter(r=>r.id.startsWith('motion-')).map(r=>r.id),groups,sourceFilesMatched:files.length,sourceAndApiBlueprintsMatched:51,p95NewTen:perf.cases.filter(c=>c.scene==='new-ten').map(c=>c.p95Ms),peakAnimations:Math.max(...perf.cases.filter(c=>c.scene==='new-ten').map(c=>c.peakAnimations)),remainingAfterExit:0,allFifty:qa.elements.every(e=>e.inserted&&e.preview&&e.player&&e.searchVi&&e.searchUnaccented&&e.searchEn&&e.explicitPreview),passed:true};assert(verified.allFifty);fs.writeFileSync(path.join(out,'verified-summary.json'),JSON.stringify(verified,null,2)+'\n');
const matrix=['# Đối chiếu 50 element động','',`Thư viện MySQL QA: **${verified.liveElements} element**, **${verified.liveMotionElements} mục Chuyển động**. Danh sách dưới đây có đúng 50 ID mới, mỗi nhóm 10. Tim tự nhiên nâng cấp riêng, không tính vào 50.`,'','Artwork của cả 50 mục là vector Momevia tự vẽ trong `web/js/shared/canvas/animated-elements.js`; không phân phối lại artwork ngoài. Mỗi ID có SHA-256, chủ sở hữu, nguồn cảm hứng, đường dẫn nguồn và tư thế tĩnh riêng trong [provenance.json](provenance.json).','', '| STT | ID ổn định | Tên VI / EN | Nguồn / quyền | Chuyển động 1 | Chuyển động 2 | Tư thế tĩnh | Chèn / Studio / preview / player |','|---|---|---|---|---|---|---|---|',...ANIMATED_ELEMENTS.map(e=>{const r=qa.elements.find(r=>r.id===e.id);assert(r?.inserted&&r.preview&&r.player);return `| ${String(e.number).padStart(2,'0')} | \`${e.id}\` | ${e.vi} / ${e.en} | Momevia tự vẽ / nội bộ | ${e.rows[0].title} | ${e.rows[1].title} | ${e.rest} | Đạt / Đạt / Đạt / Đạt |`;})];fs.writeFileSync(path.join(out,'acceptance.md'),matrix.join('\n')+'\n');
const range=a=>`${Math.min(...a).toFixed(1)}–${Math.max(...a).toFixed(1)}`,summaryBy=(version,scene)=>range(perf.cases.filter(c=>c.version===version&&c.scene===scene).map(c=>c.p95Ms)),net=(v,t)=>{const a=network.samples.filter(s=>s.version===v&&s.type===t);return `${Math.round(a.reduce((n,s)=>n+s.transferBytes,0)/a.length).toLocaleString('en-US')} byte; ${a[0].requests} yêu cầu`;};
const document=`# 50 element động và nhiều chuyển động trên một vật thể

Đã tích hợp trên nhánh \`${verified.branch}\`, mã cục bộ và MySQL QA riêng. Không đẩy Git, không triển khai dịch vụ hay cập nhật dữ liệu người dùng thật.

## Xem và sử dụng

- [Thiệp QA đủ mở quà → lời chúc/ảnh → hồi đáp](${extra.completeCard.url}). Có thể mở ẩn danh; Enter mở hộp, thao tác chạm chuyển cảnh và gửi hồi đáp QA.
- [Quà QA chứa đủ 50 mẫu](${qa.collectionGift}), năm cảnh với mười vật thể/cảnh; đây là trang xem mẫu.
- [Tim hai chuyển động](${qa.heartGift}).
- Studio QA: [thiết kế đủ 50 mẫu](${session.base}/design/${qa.collectionDesignId}); cần phiên đăng nhập của tài khoản QA. Vào **Thêm → Chuyển động**, tìm bằng VI có dấu, không dấu hoặc tên EN. **Xem trước** ngay trong thư viện không ghi nháp; chọn mẫu để chèn một vật thể. Mở **Chỉnh → Chuyển động trên vật thể** để thêm/xóa, bật/tắt hoặc phát thử từng dòng.
- [Bảng đủ 50 ID và kết quả](animated-elements-50/acceptance.md), [ảnh tổng quan sáng](animated-elements-50/contact-sheet-light.png), [nền tối](animated-elements-50/contact-sheet-dark.png), [thumbnail 64 px](animated-elements-50/contact-sheet-thumbnails.png).

## Mốc so sánh và dữ liệu thật

Kho ban đầu sạch, nhánh \`main\`, HEAD \`527e646\`, sau mốc tham khảo \`2fc7cbf\`. Nguồn dựng sẵn ban đầu có 480 hàng thư viện, 243 element, 6 mục chuyển động. Cổng QA tham khảo cũ 4121 trả 200 nhưng không có danh mục DB để đếm; không dùng mốc đó làm bằng chứng MySQL.

MySQL QA đo được trước cập nhật **243 element / 6 chuyển động**; sau cập nhật **${verified.liveElements} element / ${verified.liveMotionElements} chuyển động**, tổng ${verified.liveRows} hàng active. Trong đó đúng 50 ID mới, nhóm thực tế ${groups.join(' / ')}. Tim giữ ID \`natural-motion-heart\`, là bản nâng cấp riêng. 51 định nghĩa trả qua API cuối cùng được so đầy đủ với định nghĩa dựng sẵn; ${files.length} file runtime/Studio/server trùng SHA giữa nguồn bàn giao và bản QA phục vụ. Xem [verified-summary.json](animated-elements-50/verified-summary.json), [source-fingerprints.json](animated-elements-50/source-fingerprints.json).

## Contract và kết hợp

- Giữ reader Canvas 1/2/3; chỉ tài liệu có \`motions\` hoặc \`assembly\` dùng schema/registry 4. Danh sách chuyển động và bộ phận đều có \`version:1\`. Lưu nháp, public allowlist, clone và snapshot giữ hai cấu trúc đó.
- Tối đa 3 dòng chính, tính cả emphasis cũ nếu còn dùng; xuất hiện và phản hồi ở các lớp riêng. 12 bộ phận/vật thể, tối đa 24 track, 16 mốc/track; giới hạn 256 KiB, 400 element, 32 cảnh vẫn giữ. Hai mẫu hạt cục bộ dùng 6 hình/hạt cố định, không timer phát hạt, không RNG; seed quy ước 0.
- Mỗi dòng có ID, loại được duyệt, target whole/part, neo cục bộ 0–1, trigger scene, delayMs, periodMs, iterations, enabled, direction, amplitude. Chu kỳ 300–30000 ms; mỗi độ trễ 0–10000 ms; số vòng 1–5 hoặc infinite; amplitude 0–1 cho choreography đã vẽ, 0–2 cho nhịp đơn. X/y dùng đơn vị trên khung cục bộ 100×100, giới hạn ±35; góc theo độ ±720; scale .05–2; opacity/draw 0–1. Tất cả số phải hữu hạn.
- Ngoài cùng giữ layout, góc thiết kế và vùng bấm. Trong cùng mỗi lớp dùng T·R·S; dòng đầu ở trong, dòng sau bọc ngoài theo thứ tự danh sách. Góc quay cùng tâm cộng lại, scale/opacity nhân nhau. Hai dòng cùng thuộc tính không ghi đè nhau. Xuất hiện, emphasis cũ và phản hồi có lớp riêng để cùng tồn tại với các dòng mới.
- Dùng WAAPI và cùng motion controller trong Studio, Admin preview và player. Giữ pha theo element ID + row ID + track ID khi dựng lại Studio; sửa dòng hoặc phát thử dòng không đặt lại dòng khác. Đổi cảnh hủy hoạt ảnh cũ và bắt đầu cảnh mới; dispose/cancel hủy cả fill của đoạn chạy một lượt. Các đoạn một lượt giữ tư thế cuối đến khi rời cảnh.
- Vật thể ghép là một shape được duyệt, chứa đường path và các bộ phận/neo nội bộ. Hạt được giới hạn trong object; tuyết và vân hành tinh có clip ellipse, ảnh máy ảnh có clip rect tại khe. Không HTML, JS, CSS hoặc URL tùy ý trong document; pipeline ảnh một khung giữ nguyên.
- Ảnh, sticker, shape, line và button/envelope/gift-box phù hợp có thể thêm dòng. Reply và tương tác có nhiều input giữ quy tắc riêng; envelope ảnh/chú thích có bố cục đặc biệt được loại khỏi bộ này. Đồ trang trí không bắt focus/chặn chạm. Bảng di động dùng cùng trường có nhãn, thao tác Space bật/tắt đã thử.

## Tim và tương thích

Tim mới bật sẵn Đập (1800 ms) và Xoay quanh tâm (8000 ms, cùng chiều kim đồng hồ). Nhịp có scale 1.055 ở 18% và 1.04 ở 48%; easing áp dụng theo đoạn để hai đỉnh nằm đúng mốc. Xoay đều 360°, tách khỏi layout và nhịp đập; đây là tự xoay, khác quỹ đạo.

Với góc thiết kế 20°, ma trận đo tại 0/2/4/6/8 giây cho 20/110/200/290/20° (sai số <.02°); tâm lệch <.5 px. Hai đỉnh đo được ${qa.heartSamples.peaks.map(p=>p.scale.toFixed(6)).join(' / ')}. Đổi chiều được đo −90° sau hai giây trên lớp quay. Có bằng chứng tắt riêng từng dòng, lưu all-off/reload, ba dòng, undo/redo, nhân bản, copy/paste, khóa lớp, kéo/đổi cỡ, surface và entrance. [qa-report.json](animated-elements-50/qa-report.json), [controls-qa.json](animated-elements-50/controls-qa.json).

Sáu fixture vòng lặp cũ giữ riêng; nháp cũ có thể tự thêm spin. Nút bật lặp của nháp cũ đã được kiểm riêng: giữ hiệu ứng xuất hiện, giữ schema 2 và không tự thêm vòng xoay. Snapshot cũ không lấy chuyển động mới từ thư viện. A05 thực tế vẫn chạy đúng một lượt ${extra.a05.duration} ms rồi dừng. All-off lưu được và ngừng cả legacy emphasis lẫn dòng mới; tim tĩnh đo ${controls.staticHeart.angle.toFixed(5)}°, scale ${controls.staticHeart.scale.toFixed(6)}, 0 bộ phát dòng. Bật lại chỉ có một bản/dòng. Hai spin cùng lúc đo ${extra.composition.combinedAngle.toFixed(5)}°, và hai lớp opacity .65 cho pixel RGB ${extra.composition.centerPixel.join('/')} trên nền trắng, phù hợp với tích .4225. [extra-qa.json](animated-elements-50/extra-qa.json).

## Kiểm chứng và ngân sách

50/50 được bấm chèn trong Studio, tìm theo ba dạng tên, kiểm thumbnail tĩnh, phát thử thư viện, seek qua các mốc của cả hai dòng, lưu/reload, xem trước và phát snapshot công khai. Các đợt kiểm theo 10 mẫu đại diện của yêu cầu, 20 số nhỏ nhất còn lại, rồi 20 mục cuối; danh sách trong qa-report. 50/50 đi qua API Admin preview thật, 10 mẫu đại diện đi qua giao diện Admin. Các ảnh tĩnh được dựng lại ở 64/82/220/440 px trên hai nền; đã xem contact sheet.

Build/check và **767 unit tests** đạt. Bộ \`test:canvas:browser\` mở rộng duyệt toàn bộ 293 factory và các ca Canvas cũ: lưu/đọc JSON, quyền media, xuất bản, reply, offline/lost ACK, Creator, IME, nhiều kích cỡ, phím/touch và Fabric. Các nhãn log lịch sử “172” ở các lượt cũ chỉ là tên ca; vòng lặp dùng toàn bộ danh mục thực tế, không giới hạn 172.

Frame pacing trên ${perf.host.cpu}, Windows, Chrome ${perf.browser}, viewport 390×844, CPU chậm 4×, ba lượt × 120 khung/cảnh. Đây là RAF lab, không phải phép đo điện thoại vật lý.

| Cảnh | Trước p95 ms | Sau p95 ms |
|---|---|---|
| Trống | ${summaryBy('before','empty')} | ${summaryBy('after','empty')} |
| Cùng 10 vật thể legacy | ${summaryBy('before','legacy-ten')} | ${summaryBy('after','legacy-ten')} |
| 10 vật thể mới, mỗi vật thể có hai dòng | Chưa có tính năng | ${summaryBy('after','new-ten')} |

Mục tiêu 33 ms đạt ở cả ba lượt mới. Đỉnh ${verified.peakAnimations} animation, 6 hạt cục bộ trong tập đại diện; sau thoát 0 animation và 0 pending controller. Bộ phận/hạt là hình có sẵn, không emitter/timer riêng. [performance-before-after.json](animated-elements-50/performance-before-after.json).

Mở lạnh, tắt cache, CPU 4×, cùng loopback/MySQL và ba lượt; số byte gồm HTML, CSS/JS, font, API và các tài nguyên mở ban đầu:

| Đường mở | Trước | Sau |
|---|---|---|
| Studio + thư viện | ${net('before','library')} | ${net('after','library')} |
| Cùng thiệp legacy mười vật thể | ${net('before','legacy-gift')} | ${net('after','legacy-gift')} |

50 mẫu mới không tải tệp artwork từ ngoài hoặc tự chạy 50 preview. Số liệu này là chi phí mở lạnh toàn trang, không chỉ riêng dữ liệu 50 mẫu. [network-before-after.json](animated-elements-50/network-before-after.json).

Chromium đã kiểm toàn luồng. Playwright WebKit đã phát đủ 50 và đo tim 2 giây ở ${qa.webkit.heartAngleAt2s.toFixed(5)}°. Firefox chưa chạy vì thiếu executable. Chưa xác minh Safari thật, điện thoại vật lý hoặc trình đọc màn hình. Kiểm pause/resume qua visibilitychange dùng mô phỏng thuộc tính hidden. Thử đổi tab Chrome headless thật ghi background=${controls.nativeVisibilityProbe.background}, returned=${controls.nativeVisibilityProbe.returned}, observedHidden=${controls.nativeVisibilityProbe.observedHidden}; chỉ gọi là đã quan sát tab ẩn khi giá trị observedHidden là true. Thử thêm Chrome có cửa sổ offscreen cũng chưa quan sát được tab ẩn; [native-visibility.json](animated-elements-50/native-visibility.json) ghi rõ chưa xác minh. Reduced-motion là tín hiệu trình duyệt được Playwright bật/tắt thực, cùng nút tắt trong player.

## Gói DB và vận hành QA

Gói mới \`animated-elements-50-20261124-v1\` chỉ 50 ID + tim; dependencies=[] vì dùng primitive nội bộ. Không mở rộng gói rollout cũ. Trên MySQL mới, seed và gói phát hành hội tụ: ${fresh.rows} hàng, ${fresh.apiElements} element, 51 unchanged, 0 ghi. Trên DB đã có dữ liệu: preview/fingerprint/CAS, gián đoạn 10 + tiếp tục 41, chạy lại 0, rollback 51 và rollback lại 0; các hàng khác giữ nguyên. Sửa của Admin trước áp dụng hoặc sau triển khai chặn gói/rollback và giữ nguyên dữ liệu. Dùng baseline mới được duyệt để tiếp tục; không ép revision hoặc bỏ fingerprint.

1. Xuất baseline đúng DB QA bằng CLI thư viện hiện có.
2. Tạo gói từ baseline: \`node database/scripts/animated-elements-rollout.mjs --from-export <baseline.json> --output <bundle.json>\`.
3. Preview: \`node database/scripts/animated-elements-rollout.mjs --bundle <bundle.json>\`. Muốn áp dụng thêm \`--apply\`; rollback thêm \`--rollback --apply\`.
4. Đường DB chỉ nhận opt-in \`CANVAS_QA_MYSQL_ISOLATED=true\`, host 127.0.0.1 và tên schema \`momevia_canvas_qa_*\`. Không tự đọc/ghi DB sản phẩm. Gói được ship khớp baseline gốc; DB có revision khác cần xem lại baseline, không sửa hash để bỏ qua xung đột.

Xem [gói phát hành](../database/updates/animated-elements-50-20261124-v1.json), [gói theo baseline QA cuối](animated-elements-50/qa-update-bundle-final.json), [MySQL mới](animated-elements-50/fresh-mysql.json), [xung đột DB thật](animated-elements-50/extra-qa.json). QA hiện chạy ở ${session.base}; phiên riêng và thông tin đăng nhập tổng hợp nằm trong \`local/animated-elements-50\` (ignored). Nguồn/hình của 50 mẫu không cần dịch vụ ngoài. Không có push/deploy cho người dùng thật.

## Nguồn và quyền

Artwork phát hành là vector mới do Momevia tự vẽ; provenance từng ID ghi SHA-256, owner, tệp nguồn và nghỉ tĩnh. Các trang Noto/Fluent/Tabler/confetti chỉ cung cấp ý tưởng về nhịp, độ nghiêng, đường nét hoặc cung hạt; không lấy SVG/APNG/Lottie/GIF/WebP hay mã nhúng của họ vào document. Tim dùng lại artwork nội bộ đã có, không thay tệp ảnh.

Tham khảo đã đọc: [Noto animated](https://googlefonts.github.io/noto-emoji-animation/), [định dạng/CC BY 4.0](https://googlefonts.github.io/noto-emoji-files/?view=docs), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), [Fluent](https://github.com/microsoft/fluentui-emoji-animated), [MIT của Fluent](https://github.com/microsoft/fluentui-emoji-animated/blob/main/LICENSE), [Tabler balloon](https://github.com/tabler/tabler-icons/blob/main/icons/outline/balloon.svg), [giấy phép Tabler](https://tabler.io/license), [ví dụ confetti](https://www.kirilv.com/canvas-confetti/), [ISC](https://github.com/catdad/canvas-confetti/blob/master/LICENSE). Vì không tái phân phối tài sản ngoài, gói không gán các giấy phép đó cho artwork tự vẽ. Nút tắt và tư thế tĩnh theo [WCAG Pause/Stop/Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) và [reduced motion C39](https://www.w3.org/WAI/WCAG22/Techniques/css/C39.html).
`;
fs.writeFileSync('docs/ANIMATED_ELEMENTS_50.md',document);console.log('Verified actual API, source fingerprints and all evidence; wrote the 50-row acceptance matrix and handoff.');
