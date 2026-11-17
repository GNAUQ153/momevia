import test from 'node:test';
import assert from 'node:assert/strict';
import {createEditorStore, logicalPoint, gestureLayout, snapLayout} from '../../web/js/features/canvas-editor/store.js';
import {createSaveSession} from '../../web/js/features/canvas-editor/session.js';

const design = () => ({id:'design-one',title:'Quà Việt',revision:1,documentHash:'sha256:initial',document:{schemaVersion:1,text:'Chúc mừng'}});
function cache() { const data = new Map(); return {getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),data}; }
const deferred = () => { let resolve; const promise=new Promise(done=>{resolve=done;});return {promise,resolve}; };

test('stage pointer coordinates and resizing are equivalent at 50/100/200 percent',()=>{
  for(const zoom of [0.5,1,2]){
    const rect={left:30,top:90,width:390*zoom,height:844*zoom},size={width:390,height:844};
    const start=logicalPoint({x:30+50*zoom,y:90+70*zoom},rect,size),end=logicalPoint({x:30+85*zoom,y:90+120*zoom},rect,size);
    const original={x:15,y:20,width:100,height:80,rotation:0};
    assert.deepEqual(gestureLayout(original,start,end),{...original,x:50,y:70});
    assert.deepEqual(gestureLayout(original,start,end,'resize'),{...original,width:135,height:130});
    assert.equal(gestureLayout(original,start,end,'resize',{keepAspect:true}).height,108);
  }
});
test('one gesture is one history command; text composition merges and redo branches correctly',()=>{
  const store=createEditorStore(design());const input={};
  store.update(value=>{value.document.text='T';},'Nhập',{merge:input});
  store.update(value=>{value.document.text='Tiế';},'Nhập',{merge:input});
  store.update(value=>{value.document.text='Tiếng Việt';},'Nhập',{merge:input});
  assert.equal(store.get().document.text,'Tiếng Việt');store.undo();assert.equal(store.get().document.text,'Chúc mừng');
  store.redo();assert.equal(store.get().document.text,'Tiếng Việt');store.undo();store.update(value=>{value.title='Khác';});assert.equal(store.canRedo,false);
});
test('snapping uses logical artboard edges and center without changing distant coordinates',()=>{
  const layout={x:108,y:202,width:180,height:440,rotation:0};
  assert.deepEqual(snapLayout(layout,{width:390,height:844}),{layout:{...layout,x:105,y:202},guides:{x:195,y:422}});
  const distant={...layout,x:49,y:99};assert.deepEqual(snapLayout(distant,{width:390,height:844}).layout,distant);
});
test('save ACK arriving during edits cannot mark newer document clean',async()=>{
  const initial=design(),store=createEditorStore(initial),storage=cache(),gate=deferred(),calls=[],statuses=[];
  const session=createSaveSession({design:initial,store,storage,userId:'A',debounceMs:100000,makeId:(()=>{let i=0;return()=>`mutation-${++i}`;})(),onStatus:value=>statuses.push(value.status),request:async(path,body)=>{
    calls.push(structuredClone(body));if(calls.length===1)await gate.promise;
    return {mutationId:body.mutationId,savedRevision:body.expectedRevision+1,documentHash:`sha256:${calls.length}`};
  }});
  store.update(value=>{value.document.text='Bản thứ nhất';});const saving=session.save();
  store.update(value=>{value.document.text='Bản mới khi đang lưu';});assert.equal(session.dirty,true);gate.resolve();await saving;
  assert.equal(calls.length,2);assert.equal(calls[0].document.text,'Bản thứ nhất');assert.equal(calls[1].document.text,'Bản mới khi đang lưu');
  assert.equal(calls[1].expectedRevision,2);assert.equal(session.revision,3);assert.equal(session.dirty,false);assert.equal(statuses.filter(value=>value==='clean').length,1);session.dispose();
});
test('lost save ACK retries exact mutation/body before sending later edits',async()=>{
  const initial=design(),store=createEditorStore(initial),storage=cache(),calls=[];let fail=true;
  const session=createSaveSession({design:initial,store,storage,userId:'A',debounceMs:100000,request:async(path,body)=>{
    calls.push(structuredClone(body));if(fail){fail=false;throw Object.assign(new Error('Mất ACK'),{status:0});}
    return {mutationId:body.mutationId,savedRevision:body.expectedRevision+1,documentHash:'sha256:saved'};
  }});
  store.update(value=>{value.document.text='Đã gửi';});await assert.rejects(session.save(),/Mất ACK/);assert.equal(session.status,'offline');
  store.update(value=>{value.document.text='Chỉnh thêm';});await session.save();assert.deepEqual(calls[1],calls[0]);assert.notEqual(calls[2].mutationId,calls[0].mutationId);assert.equal(session.revision,3);session.dispose();
});
test('CAS conflict preserves local recovery and prevents automatic last-write-wins',async()=>{
  const initial=design(),store=createEditorStore(initial),storage=cache();let calls=0;
  const session=createSaveSession({design:initial,store,storage,userId:'A',debounceMs:100000,request:async()=>{calls++;throw Object.assign(new Error('Xung đột'),{status:409});}});
  store.update(value=>{value.document.text='Bản riêng';});await assert.rejects(session.save(),/Xung đột/);assert.equal(session.status,'conflict');
  store.update(value=>{value.document.text='Không mất';});await assert.rejects(session.save(),/Xung đột/);assert.equal(calls,1);
  assert.equal(session.readRecovery().value.document.text,'Không mất');
  const other=createSaveSession({design:initial,store:createEditorStore(initial),storage,userId:'B',request:async()=>{}});assert.equal(other.readRecovery(),null);other.dispose();session.dispose();
});
test('disposed sessions ignore late ACK and do not report saved to a later editor',async()=>{
  const initial=design(),store=createEditorStore(initial),storage=cache(),gate=deferred(),states=[];
  const session=createSaveSession({design:initial,store,storage,userId:'A',debounceMs:100000,onStatus:value=>states.push(value.status),request:async(path,body)=>{await gate.promise;return {mutationId:body.mutationId,savedRevision:2,documentHash:'sha256:saved'};}});
  store.update(value=>{value.document.text='Đang ghi';});const saving=session.save();session.dispose();gate.resolve();await saving;
  assert.equal(states.includes('clean'),false);assert.equal(session.readRecovery().value.document.text,'Đang ghi');
});
test('reload after committed save with lost ACK replays retained mutation before later edits',async()=>{
  const initial=design(),storage=cache();
  const committed={...initial,revision:2,documentHash:'sha256:committed',document:{schemaVersion:1,text:'Commit trước mất ACK'}};
  const pending={expectedRevision:1,mutationId:'retained-mutation',title:initial.title,document:committed.document};
  const recovery={ownerId:'A',designId:initial.id,schemaVersion:1,revision:1,pending,value:{title:initial.title,document:{schemaVersion:1,text:'Chỉnh sau mất ACK'}}};
  const calls=[],store=createEditorStore(committed);
  const session=createSaveSession({design:committed,store,storage,userId:'A',debounceMs:100000,request:async(path,body)=>{calls.push(structuredClone(body));return {mutationId:body.mutationId,savedRevision:body.expectedRevision+1,documentHash:'sha256:reconciled'};}});
  session.restore(recovery);await session.save();assert.deepEqual(calls[0],pending);assert.equal(calls[1].expectedRevision,2);assert.equal(calls[1].document.text,'Chỉnh sau mất ACK');assert.equal(session.revision,3);assert.equal(session.dirty,false);session.dispose();
});
