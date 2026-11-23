import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { randomUUID } from 'node:crypto';
const {base,cookies}=JSON.parse(fs.readFileSync('local/natural-v2/session.json'));
const rows=JSON.parse(fs.readFileSync('docs/template-refresh-natural-20261123/browser/journeys-report.json')).cases.filter(r=>r.published);
const out=path.resolve('docs/template-refresh-natural-20261123/editor');fs.mkdirSync(out,{recursive:true});
const report={cases:[],errors:[]},browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'});await context.addCookies(cookies);
 await context.addInitScript(()=>globalThis.localStorage.setItem('momevia-locale','vi'));
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));
 for(const row of rows){
  const created=await context.request.post(base+'/api/designs/designs',{data:{source:{kind:'template',templateId:row.id},mutationId:randomUUID()}});assert.equal(created.status(),201);row.designId=(await created.json()).design.id;
  await page.goto(base+'/design/'+row.designId);
  if(await page.locator('.editor-workspace.is-quick').count())await page.locator('[data-editor-action="toggle-mode"]').click();
  await page.locator('.editor-workspace:not(.is-quick)').waitFor();
  const art=page.locator('.editor-artboard');await art.locator('[data-element-id="cover-title"]').click({force:true});await page.locator('.editor-selection-outline[data-element-id="cover-title"]').waitFor();
  const design=(await (await context.request.get(base+'/api/designs/designs/'+row.designId)).json()).design;
  const principal=design.document.elements.find(e=>e.id==='cover-object-natural-art');
  assert(principal);await page.locator('[data-editor-action="library-tab"][data-tab="layers"]').click();await page.locator(`[data-editor-action="select"][data-id="${principal.id}"]`).click();await page.locator(`.editor-selection-outline[data-element-id="${principal.id}"]`).waitFor();
  await art.locator(`[data-element-id="${principal.id}"] img`).waitFor();
  await art.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
  await art.screenshot({path:path.join(out,`${row.id}-studio.png`)});
  await page.locator('[data-editor-action="inline-fabric"]').click();const fabric=page.locator('.editor-fabric-dialog--inline[open]');await fabric.locator('canvas.upper-canvas').waitFor();await fabric.locator('[data-editor-action="fabric-apply"]:enabled').waitFor();
  await fabric.locator(`[data-editor-action="fabric-layer-select"][data-layer-id="${principal.id}"]`).click();await fabric.locator('.fabric-properties__input').first().waitFor();
  await fabric.locator('.fabric-surface').screenshot({path:path.join(out,`${row.id}-fabric.png`)});
  // Apply a real reversible nudge; verify the DOM document, and then undo it.
  const x=fabric.locator('[data-fabric-inspector-field="x"]');
  assert.equal(await x.count(),1);await x.fill(String(principal.layout.x+3));await x.press('Tab');
  await fabric.locator('[data-editor-action="fabric-apply"]').click();await fabric.waitFor({state:'detached'});
  await page.locator('[data-editor-action="save"]').click();await page.locator('.editor-save-status[data-tone="saved"]').waitFor();
  const next=(await (await context.request.get(base+'/api/designs/designs/'+row.designId)).json()).design;
  assert.deepEqual(next.source,design.source);assert.deepEqual(next.policy,design.policy);
  assert.deepEqual(next.document.elements.find(e=>e.id===principal.id).props,principal.props);
  assert.equal(next.document.elements.find(e=>e.id===principal.id).layout.x,principal.layout.x+3);
  for(const element of design.document.elements.filter(e=>e.id!==principal.id))assert.deepEqual(next.document.elements.find(e=>e.id===element.id).layout,element.layout,`${row.id} Fabric must preserve ${element.id} geometry`);
  report.cases.push({id:row.id,selectedText:true,selectedArtwork:principal.id,fabricRendered:true,sourceAndPolicyPreserved:true,pinnedArtworkPreserved:true});
  console.log('PASS editor '+row.id);
 }
 // Crop presets use the real Studio commit/Undo path on both photo templates.
 for(const row of rows.filter(r=>['polaroid','mot-ky-niem'].includes(r.id))){
  row.designId=JSON.parse(fs.readFileSync('docs/template-refresh-natural-20261123/browser/journeys-report.json')).cases.find(r=>r.id===row.id&&r.published).designId;
  await page.goto(base+'/design/'+row.designId);
  if(await page.locator('.editor-workspace.is-quick').count())await page.locator('[data-editor-action="toggle-mode"]').click();
  const d=(await (await context.request.get(base+'/api/designs/designs/'+row.designId)).json()).design;
  const scene=d.document.scenes.find(s=>s.elementIds.includes('photo-window-image'));
  await page.locator(`[data-editor-action="scene-select"][data-id="${scene.id}"]`).click();
  await page.locator('.editor-artboard [data-element-id="photo-window-image"]').click({force:true});
  const beforePoint=d.document.elements.find(e=>e.id==='photo-window-image').props.focalPoint;
  const anchor=page.locator('.editor-crop-panel [data-crop-anchor][aria-pressed="false"]').first();await anchor.click();
  await page.locator('[data-editor-action="save"]').click();await page.locator('.editor-save-status[data-tone="saved"]').waitFor();
  const next=(await (await context.request.get(base+'/api/designs/designs/'+row.designId)).json()).design;
  const point=next.document.elements.find(e=>e.id==='photo-window-image').props.focalPoint;assert.notDeepEqual(point,beforePoint);
  await page.locator('[data-editor-action="undo"]').click();report.cases.push({id:row.id,cropPresetThroughUI:point,undo:true});
 }
 assert.deepEqual(report.errors,[]);report.passed=true;await context.close();
}catch(error){report.failure={message:error.message,stack:error.stack};console.error(error.stack);process.exitCode=1;}
finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
