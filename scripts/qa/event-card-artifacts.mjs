import fs from 'node:fs';
import { chromium } from 'playwright';
import { createDocument, templatePreviewDocument, validateDocument } from '../../web/js/shared/canvas/index.js';
import { previewSvg } from '../../web/js/shared/canvas/cover-svg.js';
import { serverText } from '../../src/shared/locale.mjs';
import { builtinCoverImages } from '../../src/modules/designs/builtin-media.mjs';
import sharp from 'sharp';
const images = builtinCoverImages();
const folder = 'docs/event-cards';
for (const dir of ['documents','storyboard','before-snapshots']) fs.mkdirSync(`${folder}/${dir}`,{recursive:true});
const ids=['birthday-radiance','hai-phong-bi','proud-of-you'];
const names=['Ước một điều đi!','Hai phong bì mừng cưới','Mũ bay, chương mới mở'];
const covers=[];
for(const [i,id]of ids.entries()) for(const [j,language]of ['vi','en'].entries())
  covers.push({input:await sharp(`${folder}/after/${id}-${language}-1.png`).resize({width:260,height:590,fit:'contain',background:'#F4F0E8'}).toBuffer(),left:i*272,top:j*606});
await sharp({create:{width:804,height:1196,channels:3,background:'#F4F0E8'}}).composite(covers).png().toFile(`${folder}/final-covers.png`);
const baseline=JSON.parse(fs.readFileSync('tests/fixtures/event-cards-before.json'));
const map=[];
for(const [index,id] of ids.entries()) {
  const old=baseline.documents[id];
  old.bindings.recipientName.value=serverText('vi','templates.preview.recipient');
  old.bindings.senderName.value=serverText('vi','templates.preview.sender');
  old.bindings.message.value=serverText('vi','templates.preview.greeting');
  fs.writeFileSync(`${folder}/before-snapshots/${id}.svg`,previewSvg(old));
  for(const locale of ['vi','en']) {
    const localize=key=>serverText(locale,key);
    fs.writeFileSync(`${folder}/documents/${id}-${locale}.json`,JSON.stringify(validateDocument(createDocument({template:{id},localize})),null,2)+'\n');
    const doc=templatePreviewDocument({id},localize);
    for(const [sceneIndex,scene] of doc.scenes.entries()) {
      const svg=previewSvg(doc,scene.id,images);
      const content=doc.elements.filter(e=>scene.elementIds.includes(e.id)&&!['shape','line','sticker'].includes(e.type));
      map.push({id,locale,scene:scene.id,name:scene.name,readingOrder:content.map(e=>({id:e.id,binding:e.props.textBinding||null,box:e.layout,action:e.actions||[]})),editableLayers:doc.elements.filter(e=>scene.elementIds.includes(e.id)).map(e=>({id:e.id,name:e.name,type:e.type}))});
      const outlines=content.map((e,i)=>`<rect x="${e.layout.x}" y="${e.layout.y}" width="${e.layout.width}" height="${e.layout.height}" rx="2" fill="none" stroke="#BD3370" stroke-width="1.5" stroke-dasharray="5 4"/><circle cx="${e.layout.x}" cy="${e.layout.y}" r="9" fill="#BD3370"/><text x="${e.layout.x}" y="${e.layout.y+4}" text-anchor="middle" font-family="Arial" font-size="11" fill="white">${i+1}</text>`).join('');
      fs.writeFileSync(`${folder}/storyboard/${id}-${locale}-${sceneIndex+1}.svg`,svg.replace('</svg>','<g>'+outlines+'</g></svg>'));
    }
  }
  console.log(`${names[index]}: real V1 documents and annotated scene map.`);
}
fs.writeFileSync(`${folder}/scene-map.json`,JSON.stringify(map,null,2)+'\n');
const css=`*{box-sizing:border-box}body{margin:0;background:#f4f0e8;color:#272235;font:16px/1.55 system-ui,Arial}main{max-width:1480px;margin:auto;padding:40px 24px}h1{font-size:clamp(32px,5vw,64px);letter-spacing:-.045em;line-height:1.05;max-width:850px}h2{margin-top:56px;font-size:28px}h3{margin:8px 0}a{color:#71334a}img{max-width:100%;display:block;border-radius:14px}figure{margin:0}figcaption{margin:8px 0 24px}.grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:18px}.triple{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}.small{max-width:150px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:12px;border-bottom:1px solid #d7cbbf}.note{background:white;padding:20px;border-radius:14px}summary{cursor:pointer;padding:16px;background:#fff;margin:16px 0}li{margin:8px 0}@media(max-width:800px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.triple{grid-template-columns:1fr}main{padding:24px 16px}h1{font-size:40px}}`;
const cover=(id,language)=>`../../web/assets/basic-templates/${language==='en'?'en/':''}${id}.svg`;
fs.writeFileSync(`${folder}/index.html`,`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ba thiệp Momevia · Bàn giao 21/11/2026</title><style>${css}</style><main><p>MOMEVIA ORIGINALS · 21.11.2026</p><h1>Ba dịp.<br>Ba cách mở niềm vui.</h1><p>3 mẫu chỉnh sửa được · 9 cảnh · VI & EN · Canvas V1</p><p><a href="sketches/comparison.html">Xem sáu phác thảo A1–C2</a> · <a href="ACCEPTANCE.md">Báo cáo nghiệm thu</a> · <a href="browser-results.json">Kết quả hành trình trình duyệt</a></p><h2>Mở trực tiếp trong ứng dụng thử</h2><ul>${ids.map((id,i)=>`<li><a href="http://127.0.0.1:4178/template/${id}">${names[i]}</a> → Xem thử / Dùng mẫu / Chỉnh bố cục</li>`).join('')}</ul><h2>Sáu bìa cuối · từ document đã validate</h2><div class="grid">${ids.flatMap((id,i)=>['vi','en'].map(l=>`<figure><a href="${cover(id,l)}"><img src="${cover(id,l)}" alt="${names[i]} ${l}"></a><figcaption>${names[i]} · ${l.toUpperCase()}<br><a href="documents/${id}-${l}.json">Document chỉnh sửa được</a></figcaption></figure>`)).join('')}</div><h2>Nhận diện ở 150 px</h2><div class="grid">${ids.flatMap(id=>['vi','en'].map(l=>`<img class="small" src="${cover(id,l)}" alt="Bìa ${id} ${l} 150px">`)).join('')}</div><h2>Trước / Sau</h2><p>Bìa trước dưới đây dựng lại từ snapshot đã lưu ở commit kế hoạch; ảnh trình duyệt chụp trước khi sửa nằm ở <a href="before/">before/</a>.</p><div class="triple">${ids.map((id,i)=>`<section><h3>${names[i]}</h3><div class="pair"><figure><img src="before-snapshots/${id}.svg" alt="Bìa trước"><figcaption>Trước</figcaption></figure><figure><img src="${cover(id,'vi')}" alt="Bìa sau"><figcaption>Sau</figcaption></figure></div></section>`).join('')}</div><h2>Chín cảnh · ảnh từ player trong ứng dụng</h2>${['vi','en'].map(l=>`<details ${l==='vi'?'open':''}><summary>${l.toUpperCase()} · xem bìa, lời chúc/kỷ niệm và hồi đáp</summary><div class="triple">${ids.map((id,i)=>`<section><h3>${names[i]}</h3><div class="triple">${[1,2,3].map(n=>`<a href="after/${id}-${l}-${n}.png"><img src="after/${id}-${l}-${n}.png" alt="${names[i]} cảnh ${n}"></a>`).join('')}</div></section>`).join('')}</div></details>`).join('')}<h2>Bản đồ chỉnh sửa & thứ tự đọc</h2><p>Khung đứt màu hồng đánh dấu nội dung, số chỉ thứ tự đọc. Văn bản dài được nối tiếp theo luồng; toàn bộ hình khối đều là lớp có thể di chuyển. <a href="scene-map.json">Tọa độ và hành động từng lớp</a>.</p><div class="triple">${ids.map((id,i)=>`<section><h3>${names[i]}</h3><div class="triple">${[1,2,3].map(n=>`<a href="storyboard/${id}-vi-${n}.svg"><img src="storyboard/${id}-vi-${n}.svg" alt="Bản đồ cảnh ${n}"></a>`).join('')}</div></section>`).join('')}</div><h2>Đánh giá tiếp</h2><p class="note">Đã tự rà thiết kế. Chưa thử nhận diện với người tham gia, chưa thử trên điện thoại vật lý. Kiểm thử trình duyệt mô phỏng 320, 390, 768, 1440 px, tên dài, nội dung nhiều đoạn, giảm chuyển động và quyền hồi đáp. Xem báo cáo nghiệm thu để phân biệt từng loại bằng chứng.</p></main></html>`);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{const page=await browser.newPage({viewport:{width:1680,height:1100}});await page.goto(new URL('../../docs/event-cards/index.html',import.meta.url).href);await page.screenshot({path:`${folder}/contact-sheet.png`,fullPage:true});}finally{await browser.close();}
