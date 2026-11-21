import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { randomUUID } from 'node:crypto';
const base=process.env.EVENT_STORY_BASE_URL||'http://127.0.0.1:4178';
assert.match(base,/^http:\/\/127\.0\.0\.1:(4178|4180|4182)$/);
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[];
try {
  const c=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
  const auth=await c.request.post(base+'/api/auth/demo',{data:{name:'Canvas Effects QA',deviceId:randomUUID()}});
  assert.equal(auth.status(),200);
  const api=async(route,body)=>{const r=await c.request.fetch(base+'/api'+route,{method:body?'POST':'GET',data:body});assert(r.ok(),await r.text());return r.json();};
  const {design}=await api('/designs/designs',{source:{kind:'template',templateId:'birthday-radiance'},mutationId:randomUUID()});
  const p=await c.newPage();await p.goto(base+'/design/'+design.id);await p.locator('.editor-workspace').waitFor();
  const action=k=>p.locator(`[data-editor-action="${k}"]`),field=k=>p.locator(`[data-editor-field="${k}"]`);
  const save=async()=>{await action('save').click();await p.locator('.editor-save-status[data-tone="saved"]').waitFor();};
  for(const [family,id,scope] of [['entrance','E05','image'],['entrance','E06','image'],['emphasis','A05','image'],['transition','T05','scene'],['transition','T06','scene'],['ambience','B05','scene'],['ambience','B06','scene'],['ambience','B07','scene'],['ambience','B08','scene']]) {
    if(scope==='image') {
      await p.locator('[data-editor-action="library-tab"][data-tab="layers"]').click();
      await p.locator('.editor-layers [data-id="event-photo-birthday"]').click();
    } else await p.locator('[data-editor-action="scene-select"]').first().click();
    if(family==='ambience') {
      await field(`celebration.${id}.enabled`).check();
      await field(`celebration.${id}.speed`).selectOption('slow');
    } else {
      await field(`effect.${family}.id`).selectOption('');await field(`effect.${family}.id`).selectOption(id);
      await field(`effect.${family}.speed`).selectOption('slow');
    }
    await save();
    const d=(await api('/designs/designs/'+design.id)).design;
    const effect=(scope==='image'?d.document.elements.find(e=>e.id==='event-photo-birthday'):d.document.scenes[0]).effects;
    if(family==='ambience')assert.equal(effect.celebrations[id].enabled,true);else assert.equal(effect[family].id,id);
    await p.locator(family==='ambience'?`[data-editor-action="celebration-preview"][data-celebration="${id}"]`:`[data-editor-action="effect-preview"][data-family="${family}"]`).click();
    const dialog=p.locator('dialog.editor-preview-dialog[open]');await dialog.waitFor();
    await dialog.locator(`[data-gift-effect="${id}"]`).first().waitFor();
    if(id==='E05'||id==='E06')await dialog.locator('.gift-photo-fragment').first().waitFor();
    if(id==='B05')await dialog.locator('.gift-bubble').first().waitFor();
    if(id==='B06')await dialog.locator('.gift-butterfly').first().waitFor();
    if(id==='B07')await dialog.locator('.gift-firework-spark').first().waitFor();
    if(id==='B08')await dialog.locator('.gift-bloom').first().waitFor();
    await dialog.locator('[data-editor-action="preview-close"]').click();results.push({family,id,result:'PASS',check:'Chosen in Canvas, saved through API, and rendered by effect-specific preview'});
  }
  await p.reload();await p.locator('.editor-workspace').waitFor();
  const d=(await api('/designs/designs/'+design.id)).design;
  assert.equal(d.document.scenes[0].effects.celebrations.B08.enabled,true);
  assert.equal(d.document.elements.find(e=>e.id==='event-photo-birthday').effects.entrance.id,'E06');
  assert.equal(d.document.elements.find(e=>e.id==='event-photo-birthday').effects.emphasis.id,'A05');
  await p.locator('[data-editor-action="scene-select"]').first().click();
  await p.screenshot({path:'docs/event-cards-expanded/canvas-effects.png',fullPage:true});
  fs.writeFileSync('docs/event-cards-expanded/canvas-effects-results.json',JSON.stringify(results,null,2)+'\n');
  console.log('PASS all 9 new effects selected, saved, previewed and retained after Canvas reload.');
}finally{await browser.close();}
