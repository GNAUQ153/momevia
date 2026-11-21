import fs from 'node:fs';
import sharp from 'sharp';
import { createDocument, templatePreviewDocument } from '../../web/js/shared/canvas/index.js';
import { serverText } from '../../src/shared/locale.mjs';
const folder='docs/event-cards-expanded';
const ids=['birthday-radiance','hai-phong-bi','proud-of-you'];
const names=['Sinh nhật · Ước một điều đi!','Đám cưới · Hai phong bì mừng cưới','Tốt nghiệp · Mũ bay, chương mới mở'];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const label=(text,width,height,size=22,color='#442638')=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="16" y="${size+12}" font-family="Arial,sans-serif" font-size="${size}" font-weight="600" fill="${color}">${escape(text)}</text></svg>`);
const metadata=[];
for(const [index,id]of ids.entries()) {
  for(const language of ['vi','en']) {
    const doc=templatePreviewDocument({id},key=>serverText(language,key));
    fs.writeFileSync(`${folder}/${id}-${language}.json`,JSON.stringify(createDocument({template:{id},localize:key=>serverText(language,key)}),null,2)+'\n');
    const pictures=await Promise.all(doc.scenes.map((s,i)=>sharp(`${folder}/${id}-${language}-${i+1}.png`).metadata()));
    const composites=[{input:label(names[index],844,60,28),left:16,top:16},
      {input:label(`${doc.scenes.length} trang · ${language.toUpperCase()} · ảnh / ngày có thể thay trong Dùng mẫu`,844,44,17,'#685644'),left:16,top:76}];
    let y=143;
    for(let row=0;row<Math.ceil(doc.scenes.length/2);row++) {
      const pair=pictures.slice(row*2,row*2+2),height=Math.max(...pair.map(p=>p.height));
      for(let col=0;col<pair.length;col++) {
        const i=row*2+col,x=22+col*414;
        composites.push({input:label(`${i+1}. ${doc.scenes[i].name}`,390,44,18),left:x,top:y});
        composites.push({input:fs.readFileSync(`${folder}/${id}-${language}-${i+1}.png`),left:x,top:y+46});
      }
      y+=height+76;
    }
    composites.push({input:label(language==='vi'?'Ảnh minh họa bằng AI · hiệu ứng hoạt động khi mở thiệp trong ứng dụng.':'AI sample photos · open the card in the app to see animations.',844,44,15,'#685644'),left:16,top:y});
    await sharp({create:{width:848,height:y+70,channels:3,background:'#EEE8DE'}}).composite(composites).png().toFile(`${folder}/${id}-full-${language}.png`);
    metadata.push({id,language,scenes:doc.scenes.map(s=>({id:s.id,name:s.name,effects:s.effects})),effects:doc.elements.filter(e=>e.effects).map(e=>({id:e.id,type:e.type,effects:e.effects}))});
  }
}
fs.writeFileSync(`${folder}/design-map.json`,JSON.stringify(metadata,null,2)+'\n');
fs.writeFileSync(`${folder}/index.html`,`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ba thiệp tương tác mở rộng</title><style>body{margin:0;background:#eee8de;color:#442638;font:16px/1.6 system-ui}main{max-width:1440px;margin:auto;padding:32px 20px}h1{font-size:clamp(30px,5vw,54px);line-height:1.1}a{color:#963851}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}img{display:block;width:100%;border-radius:12px}article{min-width:0}p{max-width:850px}@media(max-width:800px){.grid{grid-template-columns:1fr}}</style><main><p>MOMEVIA ORIGINALS · 21/11/2026</p><h1>Thêm thời gian.<br>Thêm ảnh. Thêm điều muốn kể.</h1><p>Sinh nhật và tốt nghiệp có 5 trang, cưới có 6 trang. Mỗi mẫu có hai đồng hồ chọn ngày độc lập, album 3 ảnh tải lên, chữ hiện dần, hiệu ứng ảnh và chuyển cảnh. Album tự chuyển có nút tạm dừng; giảm chuyển động giữ nguyên nội dung và thao tác.</p><p><a href="REPORT.md">Báo cáo và cách dùng</a> · <a href="browser-results.json">Kết quả kiểm thử hành trình</a> · <a href="design-map.json">Bản đồ cảnh và hiệu ứng</a></p><div class="grid">${ids.map((id,i)=>`<article><h2>${names[i]}</h2><p><a href="http://127.0.0.1:4180/template/${id}?preview=1">▶ Mở bản tương tác có hiệu ứng</a> · <a href="${id}-full-en.png">Bản EN</a></p><p>Ảnh động ghi trực tiếp từ player:</p><a href="${id}-motion.gif"><img src="${id}-motion.gif" alt="Hiệu ứng đang chạy ${names[i]}"></a><p><a href="${id}-full-vi.png">Ảnh tĩnh toàn bộ các trang VI</a> · <a href="${id}-full-en.png">Ảnh tĩnh EN</a></p><p><a href="${id}-vi.json">Document chỉnh sửa được</a></p></article>`).join('')}</div></main></html>`);
console.log('Created three full VI boards, three EN boards and the clickable gallery.');
