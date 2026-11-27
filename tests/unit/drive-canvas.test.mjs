import test from'node:test';import assert from'node:assert/strict';
import{calendarMonth,graduationPassSvg}from'../../web/js/shared/canvas/drive-data.js';
import{driveElementCards,DRIVE_BLOCKS}from'../../web/js/shared/canvas/drive-elements.js';
import{createDocument}from'../../web/js/shared/canvas/presets.js';
import{validateDocument,duplicateDocument,publicDocument}from'../../web/js/shared/canvas/schema.js';
import{pinDocumentArtwork}from'../../web/js/shared/canvas/library-materialize.js';
import{scenePresentation}from'../../web/js/shared/canvas/scene-presentation.js';
import{catalog,matchesBlock}from'../../web/js/features/canvas-editor/library.js';
import{hasCanvasResponse}from'../../web/js/shared/rsvp.js';
test('calendar derives correct local month/year, leap days and weekday alignment',()=>{
 assert.deepEqual(calendarMonth('2026-12-31T18:00:00.000Z','Asia/Ho_Chi_Minh','en'),{year:2027,month:1,day:1,offset:4,days:31,title:'January 2027'});
 assert.equal(calendarMonth('2028-02-29T12:00:00.000Z','UTC').days,29);
 assert.equal(calendarMonth('2027-01-01T00:00:00.000Z','America/Los_Angeles').year,2026);
 assert.equal(calendarMonth(null),null);
});
test('SVG keeps Vietnamese names and event data while escaping XML markup',()=>{
 const svg=graduationPassSvg({name:'Nguyễn Ánh <script>&"',venue:'Hà Nội <&>',title:'Vé <&>',eventAt:'2027-01-03T02:45:00.000Z',timeZone:'Asia/Ho_Chi_Minh'});
 assert(svg.includes('Nguyễn Ánh &lt;script&gt;&amp;&quot;'));assert(svg.includes('Hà Nội &lt;&amp;&gt;'));assert(!svg.includes('<script>'));assert(svg.includes('2027'));assert(svg.includes('09:45'));
});
test('every Drive library block inserts into a blank document, duplicates and publishes without hidden dependencies',()=>{
 for(const card of driveElementCards()){
  const doc=createDocument();doc.elements=card.create();doc.scenes[0].elementIds=doc.elements.map(e=>e.id);pinDocumentArtwork(doc);
  for(const b of Object.values(doc.bindings))b.value='QA';
  assert.doesNotThrow(()=>validateDocument(doc,{mode:'publish'}),card.id);
  const copy=duplicateDocument(doc);assert(copy.elements.every(e=>!doc.elements.some(n=>n.id===e.id)));assert.doesNotThrow(()=>validateDocument(copy));
  assert.deepEqual(publicDocument(doc).elements.map(e=>e.props),doc.elements.map(e=>e.props));
 }
 assert.equal(DRIVE_BLOCKS.length,9);
});
test('optional audio collapses only when opted in and empty',()=>{
 const doc=createDocument(),base={id:'voice',type:'sound-button',layout:{x:20,y:20,width:300,height:50},props:{optional:true}};doc.elements=[base];doc.scenes[0].elementIds=['voice'];
 assert.equal(scenePresentation(doc,doc.scenes[0]).elements.length,0);
 base.sound={kind:'audio',assetId:'qa',volume:.5};assert.equal(scenePresentation(doc,doc.scenes[0]).elements.length,1);
 delete base.sound;delete base.props.optional;assert.equal(scenePresentation(doc,doc.scenes[0]).elements.length,1);
});
test('all Canvas IDs remain discoverable after their visible labels are translated',()=>{
 for(const block of catalog.flatMap(g=>g.items))assert(matchesBlock(block,block.id),block.id);
});
test('explicit Canvas response modes suppress duplicate forms while legacy greeting replies retain their existing RSVP',()=>{
 assert.equal(hasCanvasResponse({elements:[{type:'reply',props:{}}]}),false);
 for(const replyMode of ['attendance','message'])assert.equal(hasCanvasResponse({elements:[{type:'reply',props:{replyMode}}]}),true);
});
