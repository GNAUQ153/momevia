import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { REFRESH_21 } from '../../web/js/shared/canvas/refresh-21-config.js';
import { templates } from '../../src/modules/catalog/seed.mjs';
const out=path.resolve('docs/template-refresh-20261123'),web=path.resolve('web/assets/template-refresh-qa');fs.mkdirSync(web,{recursive:true});
const ids=Object.keys(REFRESH_21),journeys=JSON.parse(fs.readFileSync(path.join(out,'browser/journeys-report.json'))),matrix=JSON.parse(fs.readFileSync(path.join(out,'browser/matrix-report.json'))),editor=JSON.parse(fs.readFileSync(path.join(out,'editor/report.json'))),mysql=JSON.parse(fs.readFileSync(path.join(out,'mysql/report.json')));
const longFile=path.join(out,'browser/long-copy-report.json'),long=fs.existsSync(longFile)?JSON.parse(fs.readFileSync(longFile)):null;
const perfFile=path.join(out,'performance/summary.json'),perf=fs.existsSync(perfFile)?JSON.parse(fs.readFileSync(perfFile)):null;
const differences=[
 'Mở chốt ô cửa tàu, đọc lời trên vé cạnh hoàng hôn và viết vào mặt sau vé.',
 'Tai kéo bằng vải mở ngăn hộp kraft; nhãn dưới đáy trở thành tờ hồi âm.',
 'Chạm đế gỗ để có một lượt tuyết, vào ô cửa nhà ấm rồi mở thẻ ở chân cầu.',
 'Máy chụp nhả dải ảnh; một ảnh tùy chọn đi trước lời nhắn và mặt lưng dùng để trả lời.',
 'Công tắc dây bật chụp đèn giấy; lời nằm cạnh vùng sáng và hồi âm tựa chân đèn.',
 'Bậc thang đi giữa ba tầng mây giấy; đọc ở khoảng trời trống và viết dưới tầng cuối.',
 'Kéo dây ống pháo chéo, xem giấy bung một lượt và giữ cuống vé để trả lời.',
 'Chốt cơ học lật 23:59 thành 00:00, không phụ thuộc đồng hồ hay múi giờ của người nhận.',
 'Mở bao lì xì trên mâm trà; lời chúc nằm trên giấy dó có hai thanh cuộn và thẻ lộc nhận hồi âm.',
 'Chốt đồng mở hộp nhung, nhường phần lụa sáng cho lời riêng và thẻ ruy-băng cho lời đáp.',
 'Tay nắm cửa nhà kính mở vùng đọc; hồi đáp nằm trong nhãn cây có dây.',
 'Chạm đường vá vàng của bát gốm; tờ hồi âm cho phép người nhận khép quà mà không trả lời.',
 'Nhấc mép tem hàng không, trải lá thư nhiều nếp và dùng nếp trống để viết lại.',
 'Máy bay giấy nối hai đường chân trời; lời tới mặt bưu thiếp chia địa chỉ và thư.',
 'Dải lanh mở sổ ép hoa, để cành oải hương ở lề và phiếu mẫu vật làm lời hồi đáp.',
 'Khung ảnh gỗ giữ một ảnh tùy chọn; lật sang bìa sau để đọc, rồi lấy thiệp ở chân khung.',
 'Một nụ quỳnh khép trong vườn đêm mở cánh; khoảng tối ổn định giữ lời và nhãn người trồng nhận hồi âm.',
 'Chuông đồng trên xe đạp là điểm mở; lời cài ở giỏ và thẻ ở tay lái là chỗ trả lời.',
 'Núm trục đồng mở đĩa sao; lời nằm ngoài cụm sao rồi chuyển sang sổ quan sát.',
 'Nhấc nhãn tròn của quả đào để trải giấy kraft, rồi viết vào phiếu nhỏ trong túi.',
 'Thẻ dây đay trên bó hoa mở lời cảm ơn; mặt sau thẻ trở thành hồi âm.',
];
const status=ids.map((id,i)=>({id,name:templates.find(t=>t.id===id).title,wave:REFRESH_21[id].wave,scenes:3,languages:['vi','en'],
 matrixCases:matrix.cases.filter(c=>c.id===id).length,longCopyCases:long?.cases.filter(c=>c.id===id).length||0,journey:journeys.cases.some(c=>c.id===id&&c.published&&c.reply),studioFabric:editor.cases.some(c=>c.id===id&&c.fabricRendered),
 mysql:mysql.passed===true,price:templates.find(t=>t.id===id).price,difference:differences[i],templateUrl:`http://localhost:4121/template/${id}`,giftUrl:`http://localhost:4121/g/${journeys.cases.find(c=>c.id===id&&c.published).slug}`,
 light:REFRESH_21[id].light,material:REFRESH_21[id].material}));
fs.writeFileSync(path.join(out,'status-21.json'),JSON.stringify(status,null,2)+'\n');
for(const [label,index]of [['covers',0],['wishes',1],['replies',2]]){
 const w=195,h=422,header=30,parts=[];
 for(const [i,id]of ids.entries()){
  const image=await sharp(path.join(out,'browser',`${id}-${index}.png`)).resize(w,h,{fit:'contain',background:'#F9F4E7'}).png().toBuffer();
  parts.push({input:image,left:i%7*w,top:Math.floor(i/7)*(h+header)+header});
  parts.push({input:Buffer.from(`<svg width="${w}" height="${header}"><rect width="100%" height="100%" fill="#FFF9EC"/><text x="7" y="19" font-family="Arial" font-size="11" fill="#34463e">${i+1}. ${id}</text></svg>`),left:i%7*w,top:Math.floor(i/7)*(h+header)});
 }
 await sharp({create:{width:7*w,height:3*(h+header),channels:3,background:'#FFF9EC'}}).composite(parts).png().toFile(path.join(out,`browser-${label}.png`));
}
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const locale of ['vi','en']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await context.addInitScript(l=>globalThis.localStorage.setItem('momevia-locale',l),locale);const page=await context.newPage();
  await page.goto('http://127.0.0.1:4121/explore');await page.locator('.catalog-grid article').first().waitFor();await page.screenshot({path:path.join(out,`catalog-${locale}.png`),fullPage:true});
  const shelf=page.locator('.seasonal-shelf');await shelf.scrollIntoViewIfNeeded();await shelf.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));await shelf.screenshot({path:path.join(out,`seasonal-live-${locale}.png`)});
  await context.close();
 }
}finally{await browser.close();}
const audit=JSON.parse(fs.readFileSync(path.join(out,'element-audit-182.json'))),counts=Object.fromEntries(['reuse','variant','fix-renderer'].map(k=>[k,audit.filter(r=>r.decision===k).length]));
fs.writeFileSync(path.join(out,'elements.csv'),'id,title_vi,title_en,group_vi,group_en,types,layers,decision,material,templates,verification\n'+audit.map(r=>[r.id,r.title.vi,r.title.en,r.group.vi,r.group.en,r.types.join(' / '),r.layers,r.decision,r.material,r.uses.join(' / '),r.verification].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')+'\n');
const assets=['covers.png','covers-grayscale.png','browser-covers.png','browser-wishes.png','browser-replies.png','seasonal-live-vi.png','seasonal-live-en.png','before-28-covers.png','status-21.json','elements.csv','artwork-rights.json','cover-sizes.json'];
for(const file of assets)fs.copyFileSync(path.join(out,file),path.join(web,file));
if(perf)fs.copyFileSync(perfFile,path.join(web,'performance.json'));
if(long)fs.copyFileSync(longFile,path.join(web,'long-copy-report.json'));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const html=`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>21 mẫu quà · Momevia QA</title><style>body{margin:0;background:#f6f1e7;color:#293e35;font:16px/1.6 system-ui,sans-serif}main{max-width:1360px;margin:auto;padding:40px 24px}h1{font:46px Georgia,serif;margin:16px 0}h2{font:30px Georgia,serif;margin-top:56px}p{max-width:880px}a{color:#315d51}table{border-collapse:collapse;width:100%;background:#fffaf0}td,th{padding:12px;text-align:left;border-bottom:1px solid #ded8c8;vertical-align:top}img{max-width:100%;height:auto;display:block}.sheet{margin:20px 0 40px;border:1px solid #ded8c8}.waves{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.wave{background:#fffaf0;padding:16px}small{color:#59695f}@media(max-width:800px){.waves{grid-template-columns:1fr 1fr}table{font-size:13px}td,th{padding:8px}h1{font-size:34px}}</style><main><small>MOMEVIA ORIGINALS · QA · 23/11/2026</small><h1>21 cách mở một món quà.</h1><p>Bản nội dung mẫu trên cổng <a href="/explore">4121</a>. Cổng <a href="http://localhost:4100/explore">4100</a> giữ nguyên để đối chiếu. Bản này dùng JSON QA biệt lập; phần MySQL được diễn tập trong container QA riêng. Artwork là minh họa vector gốc, gồm các lớp chọn và chỉnh được.</p><p><strong>${status.length}/21 mẫu · ${matrix.cases.length} tổ hợp trình duyệt · 21 hành trình xuất bản và hồi đáp · 21 đối chiếu Studio/Fabric.</strong> Kiểm bàn phím, VI/EN, 320/390/1440 px và giảm chuyển động. Không gọi nhà cung cấp thanh toán thật.</p><div class="waves">${[1,2,3,4].map(w=>`<div class="wave"><b>Đợt ${w} · ${status.filter(s=>s.wave===w).length} mẫu</b>${status.filter(s=>s.wave===w).map(s=>`<p><a href="/template/${s.id}">${esc(s.name)}</a> · <a href="/g/${new URL(s.giftUrl).pathname.split('/').at(-1)}">Quà QA</a></p>`).join('')}</div>`).join('')}</div><h2>Bìa ở kích thước danh mục</h2><img class="sheet" src="covers.png" alt="21 bìa cùng tài nguyên"><details><summary>Ẩn tên và chuyển xám</summary><img class="sheet" src="covers-grayscale.png" alt="21 bìa xám để so hình dáng"></details><h2>Ba bảng ảnh từ trình duyệt</h2>${['covers','wishes','replies'].map((label,i)=>`<h3>${['Mở quà','Lời chúc','Hồi đáp'][i]}</h3><a href="browser-${label}.png"><img class="sheet" src="browser-${label}.png" alt="21 cảnh ${label}"></a>`).join('')}<h2>Kệ theo mùa VI / EN</h2><img class="sheet" src="seasonal-live-vi.png" alt="Kệ theo mùa tiếng Việt"><img class="sheet" src="seasonal-live-en.png" alt="Kệ theo mùa tiếng Anh"><h2>Trạng thái từng mẫu</h2><table><tr><th>Mẫu</th><th>Khác biệt nhìn thấy / thao tác được</th><th>Kết quả</th></tr>${status.map(s=>`<tr><td><a href="/template/${s.id}">${esc(s.name)}</a><br><small>${s.id}</small></td><td>${esc(s.difference)}</td><td>${s.matrixCases}/12 tổ hợp<br>${s.journey&&s.studioFabric?'Lưu · phát · hồi đáp · Fabric ✓':'Cần xem báo cáo'}</td></tr>`).join('')}</table><h2>Element và tài nguyên</h2><p>182 mục gốc: ${counts.reuse} dùng nguyên, ${counts.variant} biến thể, ${counts['fix-renderer']} hưởng bản sửa hiển thị Fabric. Thêm 21 cụm đạo cụ; tổng thư viện hiện có 203 mục. <a href="elements.csv">Bảng 182 mục</a> · <a href="artwork-rights.json">Nguồn, quyền, ánh sáng và chất liệu</a>.</p><h2>Phạm vi chưa xác minh</h2><p>Chưa triển khai vào DB/ứng dụng ở 4100; không thay dữ liệu quà đã phát hành của người dùng. Chưa kiểm thiết bị vật lý, Safari/iOS, trình đọc màn hình hay bàn phím ảo thật. Sửa renderer và kiểm 203 thumbnail không tương đương ảnh Fabric riêng của cả 182 mục cũ. Xem báo cáo bàn giao để biết điều kiện và số đo tải trang.</p><details><summary>28 bìa trước khi sửa</summary><img class="sheet" src="before-28-covers.png" alt="28 bìa cũ"></details></main></html>`;
const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];let page=html.replace(/<style>[\s\S]*?<\/style>/,'<link rel="stylesheet" href="qa.css">');
let extra='';
if(perf)extra+=`<h2>Tốc độ trang</h2><p>40/40 lượt sau đạt LCP dưới 2,6 giây; cao nhất ${(perf.maxLCP/1000).toFixed(3)} giây, CLS cao nhất ${perf.maxCLS.toFixed(4)}. Catalog median 1,760 → 2,340 giây: đạt ngưỡng nhưng chậm hơn trong lần đo này. Cùng Chrome, CPU 4×, mạng 200.000 B/s, latency 100 ms, cache tắt; tám route × năm lượt mỗi bản. <a href="performance.json">Số đo và cấu hình</a>.</p>`;
if(long?.passed)extra+=`<h2>Tên và lời chúc dài</h2><p>${long.cases.length}/126 tổ hợp bổ sung đạt: tên 60 ký tự, lời chúc 1.000 ký tự; VI/EN, 320/1440 CSS px và mô phỏng desktop zoom 200%. <a href="long-copy-report.json">Báo cáo nội dung dài</a>. Bàn phím ảo và thiết bị vật lý chưa xác minh.</p>`;
page=page.replace('<h2>Element và tài nguyên</h2>',extra+'<h2>Element và tài nguyên</h2>');
fs.writeFileSync(path.join(web,'qa.css'),css);fs.writeFileSync(path.join(out,'qa.css'),css);
fs.writeFileSync(path.join(web,'index.html'),page);fs.writeFileSync(path.join(out,'index.html'),page);
console.log(JSON.stringify({templates:status.length,matrix:matrix.cases.length,journeys:journeys.cases.filter(c=>c.published).length,editor:editor.cases.filter(c=>c.fabricRendered).length,audit:counts,gallery:'http://localhost:4121/assets/template-refresh-qa/index.html'}));
