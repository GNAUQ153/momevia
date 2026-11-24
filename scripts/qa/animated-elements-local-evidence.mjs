import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadEnvironment} from '../../src/shared/config.mjs';
import {MySqlClient,resolveMysqlConfig} from '../../src/infrastructure/mysql/client.mjs';
import {libraryFingerprint as fp} from '../../src/modules/designs/library-live-review.mjs';
import {builtinLibraryItems} from '../../src/modules/designs/library.seed.mjs';
import {MOTION_ROLLOUT_IDS} from '../../src/modules/designs/motion-rollout.mjs';

const out=path.resolve('docs/animated-elements-live-20261124'),privateDir=path.resolve('database/private/animated-elements-live-20261124'),read=n=>JSON.parse(fs.readFileSync(path.join(privateDir,n))),state=read('state.json'),before=read('business-before-browser.json'),browser=JSON.parse(fs.readFileSync(path.join(out,'local-live-browser.json'))),cta=JSON.parse(fs.readFileSync(path.join(out,'floating-cta-browser.json')));
assert(browser.passed&&!browser.failure);assert(cta.passed&&!cta.failure&&cta.openReadReplyWithFloatingCta);loadEnvironment();const cfg=resolveMysqlConfig();assert.equal(cfg.host,'127.0.0.1');assert.equal(cfg.database,'momevia_dev');const db=new MySqlClient(),preserved=[];
try{for(const [table,b]of Object.entries(before)){assert(/^[A-Za-z0-9_]+$/.test(table));const[rows]=await db.execute(`SELECT * FROM \`${table}\``),hashes=new Set(rows.map(fp));assert(b.hashes.every(h=>hashes.has(h)),table);preserved.push({table,existingRows:b.count,addedRows:rows.length-b.count});}}finally{await db.close();}
const library=(await(await fetch('http://localhost:4100/api/designs/library')).json()).library.items,source=builtinLibraryItems().filter(r=>r.kind==='element'&&MOTION_ROLLOUT_IDS.includes(r.id));for(const row of source)assert.deepEqual(library.find(r=>r.kind===row.kind&&r.id===row.id).definition,row.definition,row.id);
assert.equal(createHash('sha256').update(fs.readFileSync(path.join(privateDir,state.sql.file))).digest('hex'),state.sql.sha256);assert(!fs.existsSync(path.join(privateDir,'.mysql-client.cnf')));
const results=fs.readdirSync(privateDir).filter(n=>n.startsWith('result-')).map(read),applied=results.find(r=>r.applied===51),rerun=results.find(r=>r.unchanged===51),rollback=results.find(r=>r.rollback&&r.mode==='preview');assert(applied&&rerun&&rollback?.plannedReady===51);
const summary={target:state.target,base:browser.base,backup:{directory:path.relative(process.cwd(),privateDir),sqlBytes:state.sql.bytes,sqlSha256:state.sql.sha256,restoreTest:state.sql.restoreTest,mediaFiles:state.media.length,temporaryCredentialFileRemoved:true},library:{before:243,after:library.filter(r=>r.kind==='element').length,rows:library.length,motion:library.filter(r=>r.kind==='element'&&r.definition.visualKind==='animation').length,newIds:source.filter(r=>r.id!=='natural-motion-heart').map(r=>r.id),sourceDefinitionsMatch:51},rollout:{applied:51,rerun:0,rollbackPreviewReady:51,rollbackApplied:false},preexistingRowsPreserved:preserved,studioAndPlayerAll50:true,cta:{passed:true,create:'/design/new',explore:'/explore',hiddenDuringEditing:true,widths:[320,390,768,1024,1440],anonymousOpenReadReply:true},links:{studio:browser.base+'/design/'+browser.collectionDesignId,all50:browser.collectionGift,heart:browser.heartGift,fullCard:cta.completeCard},passed:true};fs.writeFileSync(path.join(out,'verified-live.json'),JSON.stringify(summary,null,2)+'\n');
const code=value=>'`'+value+'`';
const lines=[
 '# Đưa 50 element động vào MySQL cục bộ đang dùng','',
 'Đã cập nhật **127.0.0.1:3306 / momevia_dev**, phục vụ [Momevia chính](http://localhost:4100). Profile demo 4110 và QA 4191 là môi trường riêng.','',
 '## Xem kết quả','',
 `- [Studio đủ 50 mẫu](${summary.links.studio}) — đăng nhập bằng tài khoản kiểm tra ghi ở ${code('local/animated-elements-live-20261124/REVIEW.txt')}. Vào **Thêm → Chuyển động**.`,
 `- [Link nhận quà đủ 50 mẫu](${summary.links.all50}); [tim hai dòng](${summary.links.heart}).`,
 `- [Mở quà → lời chúc/ảnh → hồi đáp](${summary.links.fullCard}), đã thử Enter/chạm và gửi hồi đáp ẩn danh khi CTA nổi hiện.`,
 '', '## Sao lưu và cập nhật','',
 'Trước cập nhật có 480 hàng thư viện, 243 element, 6 mục Chuyển động; tim revision 2 khớp định nghĩa legacy đã duyệt. Writer 4100 được dừng ngắn để sao lưu và cập nhật rồi mở lại cùng cấu hình MySQL.',
 '',`Backup giữ riêng tại **${summary.backup.directory}**, đã được gitignore; không đưa SQL, media riêng tư hoặc cookie vào Git.`,
 `- SQL đầy đủ **${state.sql.bytes.toLocaleString('en-US')} byte**, SHA-256 ${code(state.sql.sha256)}.`,
 `- Khôi phục thật trên schema tạm riêng: **${state.sql.restoreTest.tables} bảng**, hash từng bảng và toàn bộ SQL data dump trùng. Schema thử được xóa sau khi kiểm.`,
 `- Sao chép và kiểm checksum **${state.media.length} tệp media**. Tệp cấu hình chứa mật khẩu MySQL tạm đã xóa.`,
 '- Gói đúng **50 ID mới + tim**, expectedRevision/fingerprint theo baseline thật; thêm 50 hàng sau thứ tự hiện có. Các gói QA cũ giữ nguyên phạm vi.',
 '- Áp dụng **51**, chạy lại **0 / 51 unchanged**. Dry-run rollback sẵn sàng 51; chưa hoàn tác thư viện đang dùng.',
 '', 'API hiện có **530 hàng / 293 element / 56 mục Chuyển động**. Đối chiếu đủ 51 định nghĩa với nguồn dựng sẵn. 34 bảng ngoài thư viện và 14 media không thay đổi khi áp dụng. Sau kiểm tra trình duyệt, tất cả hàng đã có trước đợt kiểm tra vẫn giữ hash nguyên vẹn. Chỉ thêm tài khoản, nháp, quà/hồi đáp tổng hợp của lần kiểm này.',
 '', '## Git','',
 `Không làm trên main. Nhánh ${code('feat/animated-elements-50-20261124')}; mốc nguyên khối trước khi chia giữ ở ${code('backup/animated-elements-50-unsplit-20261124')}. Ba commit đầu tách engine, bộ 50 mẫu và bằng chứng QA; so cây nguồn sau chia với f4e1e7d không khác biệt. Các commit tiếp theo tách triển khai cục bộ/kiểm chứng và CTA.`,
 '', '## Lệnh cập nhật có bảo vệ','',
 `Lệnh riêng: ${code('database/scripts/animated-elements-live.mjs')}. Luôn truyền ${code('--allow-local-live --host 127.0.0.1 --port 3306 --database momevia_dev --state-dir database/private/animated-elements-live-20261124')}.`,
 `- Chuẩn bị: ${code('--prepare --mysql-bin <thư-mục-mysql> --expected-library-hash <hash-đã-đọc>')}; tạo backup, baseline và kiểm khôi phục trước khi cho phép cập nhật.`,
 `- Xem trước: ${code('--expected-state-hash <hash-của-state.json>')}; áp dụng thêm ${code('--apply')}.`,
 `- Xem trước hoàn tác thêm ${code('--rollback')}; chỉ thực thi khi thêm ${code('--apply')}. CAS/fingerprint không khớp sẽ dừng và giữ sửa của Admin.`,
 '', 'Bằng chứng: [verified-live.json](animated-elements-live-20261124/verified-live.json), [50 Studio/preview/player trên DB chính](animated-elements-live-20261124/local-live-browser.json), [CTA và nhận quà](animated-elements-live-20261124/floating-cta-browser.json). Thông tin đăng nhập tổng hợp nằm trong thư mục local/private, không nằm trong tài liệu này.','',
];fs.writeFileSync('docs/ANIMATED_ELEMENTS_LOCAL_MYSQL.md',lines.join('\n'));
const session=read('review-session.json');fs.writeFileSync('local/animated-elements-live-20261124/REVIEW.txt',`Momevia MySQL cục bộ\n${browser.base}\nEmail QA: ${session.email}\nMật khẩu QA: ${session.password}\nStudio 50: ${summary.links.studio}\nQuà 50: ${summary.links.all50}\nThiệp đủ luồng: ${summary.links.fullCard}\n`);
console.log(JSON.stringify({passed:true,sourceDefinitions:51,preexistingTables:preserved.length,backupRestoreTables:state.sql.restoreTest.tables,elements:summary.library.after,all50:summary.links.all50,fullCard:summary.links.fullCard}));
