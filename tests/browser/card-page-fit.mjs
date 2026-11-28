import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {chromium} from 'playwright';
export async function runCardPageFit(base,{onlyFuture=false}={}){
const out=path.resolve('local/card-fit-20261128');fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||undefined,headless:true}),results=[];
try{
 for(const [width,height]of[[320,568],[390,844],[1440,900],[844,390]]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});await page.goto(base);
  const ids=await page.evaluate(async()=>{const {BASIC_TEMPLATES}=await import('/js/shared/canvas/basic-templates.js');return [...Object.keys(BASIC_TEMPLATES),'future-portrait','future-landscape'];});
  for(const id of ids){
   if(onlyFuture&&!id.startsWith('future-'))continue;
   const sceneIds=await page.evaluate(async id=>{
    const {createDocument}=await import('/js/shared/canvas/presets.js'),{editInvitation}=await import('/js/shared/canvas/invitation.js'),{mountPlayer}=await import('/js/features/gift-runtime/index.js');
    globalThis.testPlayer?.dispose();const future=id.startsWith('future-'),doc=createDocument(future?{}:{template:{id}});for(const b of Object.values(doc.bindings))b.value='Nguyễn Ánh';
    if(future){const {createElement}=await import('/js/shared/canvas/registry.js');doc.schemaVersion=doc.registryVersion=Math.max(2,doc.schemaVersion);doc.artboard.baseSize=id==='future-landscape'?{width:700,height:450}:{width:390,height:844};
     globalThis.futureCopy=('Nguyễn Ánh — lời nhắn dài giữ nguyên dấu và xuống dòng.\n').repeat(18).slice(0,980);doc.bindings.message.value=globalThis.futureCopy;
     const text=createElement('text',{id:'future-prose',props:{textBinding:'message',fontSize:24},layout:{x:24,y:30,width:doc.artboard.baseSize.width-48,height:300}});doc.elements=[text];doc.scenes=[doc.scenes[0]];doc.entrySceneId=doc.scenes[0].id;doc.scenes[0].elementIds=[text.id];
    }
    if(doc.invitation){editInvitation(doc,'zone','Asia/Ho_Chi_Minh');editInvitation(doc,'date','2027-01-03T09:45');editInvitation(doc,'venue','Hội trường Nguyễn Văn A, Hà Nội');}
    globalThis.document.body.className='is-playing-gift';globalThis.document.body.replaceChildren();const section=globalThis.document.createElement('section');section.className='recipient-section';section.innerHTML='<div class="recipient-shell"><div class="recipient-player-host"></div></div>';globalThis.document.body.append(section);
    globalThis.testPlayer=mountPlayer(section.querySelector('.recipient-player-host'),{document:doc,mode:'preview',assetUrl:()=>null});return doc.scenes.map(s=>s.id);
   },id);
   for(const scene of sceneIds){await page.evaluate(scene=>globalThis.testPlayer.goToScene(scene),scene);await page.waitForTimeout(45);
    const metrics=await page.evaluate(()=>{const stage=globalThis.document.querySelector('.gift-runtime-stage'),body=stage.querySelector('.gift-scene-body'),b=stage.getBoundingClientRect();return{top:b.top,bottom:b.bottom,width:b.width,height:b.height,viewport:globalThis.innerHeight,scrollHeight:globalThis.document.documentElement.scrollHeight,bodyHeight:globalThis.document.body.getBoundingClientRect().height,bodyScroll:body.scrollHeight>body.clientHeight+1,windowScroll:globalThis.document.documentElement.scrollHeight>globalThis.innerHeight+1,bodyOverflow:globalThis.getComputedStyle(body).overflowY};});
    assert(metrics.top>=-1&&metrics.bottom<=height+1,`${id} ${scene} ${width} viewport ${JSON.stringify(metrics)}`);assert.equal(metrics.bodyScroll,false,`${id} ${scene} has body overflow`);assert.equal(metrics.windowScroll,false,`${id} ${scene} has page overflow ${JSON.stringify(metrics)}`);
    if(['garden-tea','graduation-mixtape','graduation-countdown','midnight-soiree','secret-santa-invitation','the-last-chapter-v2'].includes(id)&&width===390&&['scene-cover','scene-details','scene-reply'].includes(scene))await page.screenshot({path:path.join(out,`${id}-${scene}-${width}.png`)});
   }
   if(id.startsWith('future-')){const parts=[];for(let i=0;i<30;i++){
    parts.push(await page.locator('[data-runtime-element="future-prose"]').textContent());const next=page.locator('.gift-page-navigation button').last();if(await next.isDisabled())break;await next.click();
   }assert.equal(parts.join(''),await page.evaluate(()=>globalThis.futureCopy),'Future long prose must be lossless across all fitted pages');}
   results.push({id,width,height,scenes:sceneIds.length});
  }await page.close();console.log('PASS all built-in scenes',width,height,ids.length);
 }
 fs.writeFileSync(path.join(out,onlyFuture?'fit-future.json':'fit-gate.json'),JSON.stringify({results},null,2));
}catch(e){console.error(e);throw e;}finally{await browser.close();}

}
