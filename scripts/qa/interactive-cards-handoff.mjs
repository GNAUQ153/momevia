// Copies selected, unmodified browser evidence; never copies fixture credentials.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {semanticSlots} from '../../web/js/shared/canvas/template-slots.js';
import {createDocument} from '../../web/js/shared/canvas/presets.js';
import {templates} from '../../src/modules/catalog/seed.mjs';
import {CANDLE_SKINS} from '../../web/js/shared/canvas/candle-skins.js';
import {PAPER_GRAIN_SVG} from '../../web/js/shared/canvas/paper-grain.js';
const root=path.resolve('local/interactive-cards-20261122'),out=path.resolve('docs/interactive-cards-20261122');fs.mkdirSync(out,{recursive:true});
const ids=['hai-phong-bi','birthday-radiance','proud-of-you','loi-moi-ben-hien','cuon-phim-ngay-ay','ban-do-ngay-ra-truong'];
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const copy=(from,to)=>fs.copyFileSync(from,path.join(out,to));
for(const id of ids)for(const locale of ['vi','en'])copy(path.join(root,'final/browser',`${id}-${locale}-cover.png`),`${id}-${locale}.png`);
for(const id of ids.slice(0,3))for(const locale of ['vi','en'])copy(path.join(root,'baseline/browser',`${id}-${locale}-cover.png`),`${id}-${locale}-before.png`);
for(const locale of ['vi','en']){copy(path.join(root,'final/handoff',`catalog-${locale}-1440.png`),`catalog-${locale}.png`);const studio=path.join(root,'final/handoff',`studio-${locale}-1440.png`);if(fs.existsSync(studio))copy(studio,`studio-${locale}.png`);}
const videos=fs.readdirSync(path.join(root,'final/handoff/video')).filter(f=>f.endsWith('.webm')).map(name=>({name,at:fs.statSync(path.join(root,'final/handoff/video',name)).mtimeMs})).sort((a,b)=>b.at-a.at);
if(videos[0])copy(path.join(root,'final/handoff/video',videos[0].name),'candle.webm');
const inventory=read(path.join(root,'final/inventory.json'));
const slots=ids.map(id=>({id,templateVersionId:inventory.find(r=>r.template.id===id)?.version,slots:semanticSlots(createDocument({template:templates.find(t=>t.id===id)}))}));
fs.writeFileSync(path.join(out,'semantic-slots.json'),JSON.stringify(slots,null,2)+'\n');
const baseline=read(path.join(root,'baseline/inventory.json')),after=read(path.join(root,'final/inventory.json'));
fs.writeFileSync(path.join(out,'template-inventory.json'),JSON.stringify({baseCommit:'70f2be0',baseline,after},null,2)+'\n');
const media=read('web/assets/event-cards/originals-v2/manifest.json');
const realisticMedia=read('web/assets/event-cards/realistic-v3/manifest.json');
const vector=createDocument({template:{id:'proud-of-you'}}).elements.find(e=>e.id==='graduation-tassel').artwork;
fs.writeFileSync(path.join(out,'artwork-rights.json'),JSON.stringify({media,realisticMedia,prompts:'REALISTIC_ASSETS.md',candleSkins:{source:'web/js/shared/canvas/candle-skins.js',definitions:CANDLE_SKINS},paperTexture:{source:'web/js/shared/canvas/paper-grain.js',version:1,rights:'Original immutable SVG authored for Momevia; distributable with gifts',definition:PAPER_GRAIN_SVG,sha256:createHash('sha256').update(PAPER_GRAIN_SVG).digest('hex')},tassel:{version:1,source:'web/js/shared/canvas/event-upgrade.js',rights:'Original vector authored for Momevia; distributable with gifts',definition:vector,sha256:createHash('sha256').update(JSON.stringify(vector)).digest('hex')}},null,2)+'\n');
const reports={matrix:read(path.join(root,'final/browser/matrix-report.json')),edge:read(path.join(root,'final/edge/report.json')),api:read(path.join(root,'final/api-report.json')),capture:read(path.join(root,'final/handoff/report.json')),rollout:read(path.join(root,'mysql/rollout-report.json'))};
for(const [name,report]of Object.entries(reports))fs.writeFileSync(path.join(out,`${name}-report.json`),JSON.stringify(report,null,2)+'\n');
copy(path.join(root,'final/contrast-report.json'),'contrast-report.json');
copy(path.join(root,'final/motion-budget.json'),'motion-budget.json');
for(const locale of ['vi','en'])copy(path.join(root,'baseline/handoff',`catalog-${locale}-1440.png`),`catalog-${locale}-before.png`);
const legacy=path.join(root,'legacy-evidence');
if(fs.existsSync(path.join(legacy,'report.json'))){copy(path.join(legacy,'report.json'),'legacy-capture-report.json');for(const file of fs.readdirSync(legacy).filter(f=>f.endsWith('.png')))copy(path.join(legacy,file),file);}
const logs=['check','unit','build','templates','canvas-browser','mysql','matrix','edge','api','capture','perf'].map(name=>`realistic-${name}.log`);
const evidence=path.join(out,'logs');fs.mkdirSync(evidence,{recursive:true});
for(const file of logs)fs.copyFileSync(path.join(root,file),path.join(evidence,file));
const perfFiles={baseline:path.join(root,'baseline/browser/perf-report.json'),final:path.join(root,'final/browser/perf-report.json')};
const performance={};
for(const [phase,file]of Object.entries(perfFiles))if(fs.existsSync(file)){
 const report=read(file);if(report.phase!==phase)continue;
 performance[phase]={configuration:report.configuration,browser:report.browser,touchResponseMs:report.touchResponseMs,afterPreviewClose:report.afterPreviewClose,routes:[]};
 for(const route of [...new Set(report.cases.map(c=>c.route))]){
  const runs=report.cases.filter(c=>c.route===route),median=values=>values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)];
  const imageBytes=runs.map(r=>(r.networkResources||r.resources).filter(a=>/^image\//.test(a.mime||'')||/\.(svg|webp|png)$/.test(a.name)).reduce((n,a)=>n+a.bytes,0));
  performance[phase].routes.push({route,runs:runs.length,lcpMedian:median(runs.map(r=>r.lcp)),clsMedian:median(runs.map(r=>r.cls)),transferMedian:median(runs.map(r=>r.networkTotalBytes??r.totalBytes)),imageTransferMedian:median(imageBytes),samples:runs.map(r=>({run:r.run,lcp:r.lcp,cls:r.cls,totalBytes:r.networkTotalBytes??r.totalBytes}))});
 }
 fs.writeFileSync(path.join(out,`${phase}-performance-raw.json`),JSON.stringify(report,null,2)+'\n');
}
fs.writeFileSync(path.join(out,'performance-summary.json'),JSON.stringify(performance,null,2)+'\n');
const e=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cards=ids.map(id=>{const t=templates.find(t=>t.id===id);return `<section><h2>${e(t.title)}</h2><p><a href="http://localhost:4119/template/${id}">Mở mẫu local</a> · ${t.scenes} cảnh · giá fixture ${t.price}đ</p><div class="frames">${['vi','en'].map(locale=>`<figure><img loading="lazy" src="${id}-${locale}.png" alt="${e(t.title)} ${locale}"/><figcaption>${locale.toUpperCase()} · sau thay đổi</figcaption></figure>`).join('')}${ids.slice(0,3).includes(id)?`<figure><img loading="lazy" src="${id}-vi-before.png" alt="${e(t.title)} trước thay đổi"/><figcaption>VI · mốc 70f2be0</figcaption></figure>`:''}</div></section>`;}).join('');
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Momevia · Bàn giao thiệp 22/11/2026</title><style>body{margin:0;background:#fff8f7;color:#30223c;font:16px/1.6 system-ui}main{max-width:1180px;margin:auto;padding:24px}a{color:#6136df}header,section{padding:24px 0;border-bottom:1px solid #dccdf0}h1,h2{line-height:1.2}.frames{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}figure{margin:0}img{max-width:100%;height:auto;border:1px solid #dccdf0;border-radius:12px}video{max-width:390px;width:100%}figcaption{padding:8px 0}code{overflow-wrap:anywhere}</style><main><header><p>Momevia Originals · local</p><h1>Sáu thiệp với ảnh, giấy và chuyển động</h1><p><a href="http://localhost:4119/explore">Mở Catalog</a> · <a href="../INTERACTIVE_CARDS_G0_G5.md">Đọc bàn giao và giới hạn kiểm thử</a> · <a href="performance-summary.json">Số đo lab</a></p><p>Ảnh dưới đây là ảnh chụp Chrome thật; không dựng lại giao diện. Artwork phong cách chụp thật được tạo riêng cho Momevia, không phải ảnh người hay địa điểm thật. Dữ liệu trong thiệp là fixture.</p><p><a href="catalog-vi-before.png">Catalog VI trước</a> · <a href="catalog-en-before.png">Catalog EN trước</a> · <a href="baseline-studio-en.png">Studio EN trước</a> · <a href="studio-en.png">Studio EN sau</a> · <a href="legacy-old-v2-vi.png">Quà V2 cũ</a> · <a href="REALISTIC_ASSETS.md">Nguồn ảnh và prompt</a> · <a href="verification-results.json">Kết quả kiểm thử</a></p></header>${cards}<section><h2>Thắp nến và đọc tiếp</h2><video controls preload="metadata" src="candle.webm"></video><p>Bản ghi thao tác thật trong Chrome, không có âm thanh tự phát.</p></section><section><h2>Đối chiếu dữ liệu</h2><p><a href="template-inventory.json">ID, giá, quyền, phiên bản, hash, cảnh và ảnh</a> · <a href="semantic-slots.json">Vai trò nội dung</a> · <a href="artwork-rights.json">Nguồn, quyền và SHA-256 artwork</a> · <a href="matrix-report.json">Ma trận trình duyệt</a> · <a href="rollout-report.json">MySQL và rollback</a></p></section></main></html>`);
console.log(`Exported reviewable evidence to ${out}`);
