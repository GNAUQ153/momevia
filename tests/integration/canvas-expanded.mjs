import {usesMotions} from '../../web/js/shared/canvas/motion-stack.js';
import { usesSound } from '../../web/js/shared/canvas/sound.js';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import sharp from 'sharp';
import { createDocument, createElement, publicDocument, assetIds } from '../../web/js/shared/canvas/index.js';
import { previewSvg } from '../../web/js/shared/canvas/cover-svg.js';
import { requiresCanvasV2 } from '../../web/js/shared/canvas/schema.js';
import { interactionKinds } from '../../web/js/shared/canvas/interactions.js';
import {photoSlots} from '../../web/js/shared/canvas/interactions.js';
import {builtinMedia} from '../../src/modules/designs/builtin-media.mjs';
import { catalog } from '../../web/js/features/canvas-editor/library.js';

const art = [['#EFCDB3','#9D6D8A','#F6E4A7'],['#B7D4DE','#46778E','#F3D497'],['#CEDEC6','#567A64','#EAC1D3']];
export function syntheticPhoto(index) {
  const [sky,land,sun] = art[index];
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="480" height="320" fill="${sky}"/><circle cx="${110+index*108}" cy="${70+index*19}" r="46" fill="${sun}"/><path d="M0 252Q90 94 178 228T480 171V320H0Z" fill="${land}"/><path d="M0 307Q120 206 226 284T480 244V320H0Z" fill="#32243B" opacity=".23"/></svg>`)).png().toBuffer();
}

const blocks = new Map(catalog.flatMap(group=>group.items.map(item=>[item.id,item])));
const frozenNames = ['Ánh Mai', 'Đăng và Linh', 'Người bạn thân'];
const themes = [
  ['birthday','Sinh nhật Ánh Mai','#FFF1F4',['Mở thư','Thắp nến','Lời hồi đáp']],
  ['anniversary','Kỷ niệm của Đăng và Linh','#F9F0DF',['Trang bìa','Những bức ảnh','Trước và sau']],
  ['thanks','Cảm ơn vì đã ở đó','#F5EEE9',['Một bó hoa','Ba điều mình quý','Xem lại']],
];

function compose(index, images) {
  const [key,title,background,scenes] = themes[index];
  const document = createDocument();
  document.schemaVersion = document.registryVersion = 2;
  Object.assign(document.responsive.desktop,{maxContentWidth:610});
  for (const [binding,value] of Object.entries({recipientName:frozenNames[index],senderName:'Bạn của bạn',
    message:'Cảm ơn vì đã có mặt trong câu chuyện này.'})) document.bindings[binding].value = value;
  document.scenes = scenes.map((name,i)=>({id:`${key}-${i}`,name,background:{kind:'solid',color:background},elementIds:[]}));
  document.entrySceneId = document.scenes[0].id;
  document.assets = images.map(assetId=>({assetId,kind:'image'}));
  function add(scene,models,x,y) {
    for (const model of models) {
      model.layout.x += x;
      model.layout.y += y;
      document.elements.push(model);
      document.scenes[scene].elementIds.push(model.id);
    }
    return models;
  }
  const block = (scene,id,x,y) => add(scene,blocks.get(id).create(),x,y);
  function nav(scene,label,x,y,dest) {
    return add(scene,[createElement('button',{
      props:{label,color:'#633D77'}, layout:{x:0,y:0,width:226,height:58},
      actions:[dest === 'replay' ? {on:'activate',type:'replay'} : {on:'activate',type:'goToScene',targetSceneId:document.scenes[dest].id}],
    })],x,y)[0];
  }
  function heading(scene,text,y) {
    return add(scene,[createElement('text',{layout:{x:0,y:0,width:340,height:65},
      props:{text,align:'center',fontToken:'serif',fontSize:31},accessibility:{role:'heading',level:2}})],25,y)[0];
  }
  if (index===0) {
    block(0,'recipient',55,84);
    const [envelope]=block(0,'envelope',65,216);
    envelope.props.color='#774875';
    envelope.actions[0].targetSceneId=document.scenes[1].id;
    envelope.effects={reaction:{id:'R01',speed:'slow'}};
    block(0,'wax-seal',143,253)[0].layout = {x:175,y:269,width:40,height:40,rotation:0};
    heading(1,'Thêm một vòng quanh mặt trời',58).effects={entrance:{id:'E01'}};
    document.scenes[1].effects={transition:{id:'T01'},ambience:{id:'B01',density:'sparse'}};
    block(1,'light-a-candle',80,245)[0].effects={reaction:{id:'R04'}};
    nav(1,'Gửi lời hồi đáp',82,490,2);
    heading(2,'Gửi một lời cho người tặng',51);
    block(2,'reply',35,154);
    nav(2,'Xem lại',82,558,'replay');
  } else if (index===1) {
    const [,cover]=block(0,'magazine-cover',40,54);
    cover.props.assetId=images[0]; cover.accessibility.alt='Bầu trời màu đào trên những ngọn đồi';
    cover.effects={surface:{id:'S01'}};
    nav(0,'Mở album',82,486,1);
    heading(1,'Những buổi chiều đáng nhớ',46);
    const [album]=block(1,'swipe-album',26,168);
    album.props.photos.forEach((photo,i)=>Object.assign(photo,{assetId:images[i],alt:`Phong cảnh minh hoạ ${i+1}`,
      caption:['Ngày ấy, chúng mình ngồi trên đồi đến khi mặt trời tắt hẳn và chỉ còn một đường sáng ở chân trời.','Lần quay lại, bầu trời xanh hơn trong trí nhớ.','Một chiều yên tĩnh, cả hai đi bộ qua một bãi cỏ.'][i],
      focalPoint:{x:[.22,.54,.8][i],y:.27}}));
    nav(1,'So sánh hai ảnh',82,545,2);
    heading(2,'Cùng một nơi, hai buổi chiều',48);
    const [compare]=block(2,'photo-comparison',26,155);
    compare.props.photos.forEach((photo,i)=>Object.assign(photo,{assetId:images[i],alt:album.props.photos[i].alt,
      caption:i ? 'Trở lại vào mùa hè' : 'Lần đầu ở trên đồi',focalPoint:{x:i ? .8 : .16,y:.27}}));
    nav(2,'Xem lại',82,526,'replay');
  } else {
    block(0,'wrapped-bouquet',65,74);
    block(0,'quote-block',31,350);
    nav(0,'Mở lời cảm ơn',82,580,1);
    heading(1,'Gửi bạn một lời cảm ơn',56);
    const [flip]=block(1,'flip-card',35,167);
    flip.props.entries[0]={heading:'Bạn đoán mình quý điều gì ở bạn?',body:'1. Bạn kiên nhẫn lắng nghe.\n2. Bạn luôn giữ lời.\n3. Bạn làm những ngày bình thường vui hơn.'};
    nav(1,'Đọc lại lời nhắn',82,482,2);
    document.scenes[1].effects={surface:{id:'S03'},transition:{id:'T03'},ambience:{id:'B02',density:'sparse'}};
    heading(2,'Cảm ơn vì đã ở đó',63);
    block(2,'signature',70,187);
    nav(2,'Xem lại từ đầu',82,315,'replay');
  }
  return {key,title,document};
}

export async function runExpandedApi(base, cookie, otherCookie, { artifacts, allCards = false, browser = false } = {}) {
  async function api(route, options={}) {
    const { body, bytes, guest, other, status = 200,mime='image/png',mutationId=randomUUID() } = options;
    // Exercise the public write budget at human pace, including stock-media uploads.
    if(body||bytes)await delay(300);
    const response = await fetch(`${base}/api${route}`,{
      method: body || bytes ? 'POST' : 'GET',
      headers:{...(guest ? {} : {cookie: other ? otherCookie : cookie}),
        ...(body ? {'content-type':'application/json'} : {}),
        ...(bytes ? {'content-type':mime,'x-mutation-id':mutationId} : {})},
      body: body ? JSON.stringify(body) : bytes,
    });
    const data = response.headers.get('content-type')?.includes('json') ? await response.json() : await response.arrayBuffer();
    assert.equal(response.status,status,`${route} ${JSON.stringify(data)}`);
    return data;
  }
  const create = async title => (await api('/designs/designs',{status:201,body:{source:{kind:'blank'},mutationId:randomUUID(),title}})).design;
  const save = (draft, document) => api(`/designs/designs/${draft.id}/save`,{body:{title:draft.title,document,expectedRevision:draft.revision,mutationId:randomUUID()}});
  if (allCards) {
    const draft = await create('Round-trip 172 thẻ QA');
    const stockAliases=new Map();
    for (const [id, card] of blocks) {
      const document = createDocument();
      document.elements = card.create();
      for(const model of document.elements)for(const slot of photoSlots(model))if(slot.assetId){
        const original=slot.assetId;
        if(!stockAliases.has(original)){const media=builtinMedia(original);assert(media&&!media.previewOnly,'factory media must be distributable');const {asset}=await api(`/designs/designs/${draft.id}/assets`,{bytes:media.bytes,mime:'image/webp',status:201});stockAliases.set(original,asset.id);}
        slot.assetId=stockAliases.get(original);if(!document.assets.some(a=>a.assetId===slot.assetId))document.assets.push({assetId:slot.assetId,kind:'image'});
      }
      document.scenes[0].elementIds = document.elements.map(item=>item.id);
      if (requiresCanvasV2(document)) document.schemaVersion=document.registryVersion=2;
      if(usesSound(document))document.schemaVersion=document.registryVersion=3;
      if(usesMotions(document))document.schemaVersion=document.registryVersion=4;
      const ack = await save(draft,document);
      const {design} = await api(`/designs/designs/${draft.id}`);
      assert.deepEqual(design.document,document,id);
      draft.revision=ack.savedRevision;
    }
  }
  const cards = [];
  if (artifacts) fs.mkdirSync(artifacts,{recursive:true});
  for (const [index, [key,title]] of themes.entries()) {
    const draft = await create(title);
    const assets = [];
    const encoded = new Map();
    if (index===1) {
      for (let i=0;i<3;i++) {
        const bytes = await syntheticPhoto(i);
        const {asset} = await api(`/designs/designs/${draft.id}/assets`,{bytes,status:201});
        assets.push(asset.id);
        const {data,info} = await sharp(bytes).webp().toBuffer({resolveWithObject:true});
        encoded.set(asset.id,{url:`data:image/webp;base64,${data.toString('base64')}`,width:info.width,height:info.height});
        await api(`/designs/designs/${draft.id}/assets/${asset.id}`,{other:true,status:404});
      }
    }
    const {document} = compose(index,assets);
    const ack = await save(draft,document);
    const {design:read} = await api(`/designs/designs/${draft.id}`);
    assert.deepEqual(read.document,document);
    assert.equal(read.schemaVersion,2);
    const {canPublish} = await api(`/designs/designs/${draft.id}/preflight`,{body:{expectedRevision:ack.savedRevision}});
    assert.equal(canPublish,true);
    const body={designId:draft.id,expectedRevision:ack.savedRevision,expectedDocumentHash:ack.documentHash,idempotencyKey:randomUUID()};
    const {gift} = await api('/gifts/gifts/from-design',{status:201,body});
    const {gift:publicGift} = await api(`/gifts/gifts/${gift.slug}`,{guest:true});
    const snapshot = publicDocument(document);
    assert.equal(publicGift.runtimeVersion,2);
    assert.deepEqual(publicGift.documentSnapshot,snapshot);
    assert.deepEqual(assetIds(snapshot),assets);
    for (const assetId of assets) {
      const bytes=await api(`/gifts/gifts/${gift.slug}/assets/${assetId}`, {guest:true});
      assert(bytes.byteLength>0,assetId);
      if (artifacts) fs.writeFileSync(path.join(artifacts,`${assetId}.png`),Buffer.from(bytes));
    }
    cards.push({ key,draftId:draft.id,slug:gift.slug,snapshot });
    if (artifacts) {
      fs.writeFileSync(path.join(artifacts,`${key}.json`),JSON.stringify(document,null,2));
      fs.writeFileSync(path.join(artifacts,`${key}-snapshot.json`),JSON.stringify(snapshot,null,2));
      for (const [i,scene] of snapshot.scenes.entries()) {
        fs.writeFileSync(path.join(artifacts,`${key}-scene-${i+1}.svg`),previewSvg(snapshot,scene.id,encoded));
      }
    }
  }
  const draft = await create('Thu hồi V2 QA');
  const {document} = compose(2,[]);
  const ack = await save(draft,document);
  const {gift} = await api('/gifts/gifts/from-design',{status:201,body:{designId:draft.id,expectedRevision:ack.savedRevision,
    expectedDocumentHash:ack.documentHash,idempotencyKey:randomUUID()}});
  await api(`/gifts/gifts/mine/${gift.slug}/revoke`,{body:{}});
  await api(`/gifts/gifts/${gift.slug}`,{guest:true,status:410});
  let controls;
  if (browser) {
    const draft = await create('Tương tác Canvas QA');
    const document = draft.document;
    document.schemaVersion = document.registryVersion = 2;
    for (const binding of Object.values(document.bindings)) binding.value = 'Tương tác Canvas QA';
    // This fixture exercises insertable library blocks; template-only interactions have their own end-to-end suite.
    document.scenes = [...blocks.keys()].filter(id => Object.hasOwn(interactionKinds, id)).map(id => ({id,name:interactionKinds[id].label,
      background:{kind:'solid',color:'#FFF5EA'},elementIds:[]}));
    document.entrySceneId = document.scenes[0].id;
    document.elements = document.scenes.map(scene => {
      const [element] = blocks.get(scene.id).create();
      // Keep this fixture on persisted, pre-tactile readers (details toggle,
      // scratch bypass). The versioned paper readers have a separate suite.
      delete element.props.paperTreatment;
      Object.assign(element.layout,{x:26,y:40});
      scene.elementIds.push(element.id);
      return element;
    });
    const doors = document.elements.find(element=>element.props.kind==='scene-choices');
    doors.actions[0].targetSceneId='wish-pick';
    doors.actions[1].targetSceneId='light-a-candle';
    const countdown = document.elements.find(element=>element.props.kind==='event-countdown');
    countdown.props.eventAt='2000-01-01T00:00:00.000Z';
    const [future] = blocks.get('event-countdown').create();
    future.layout = {...countdown.layout};
    future.props.eventAt=new Date(Date.now()+86400_000).toISOString();
    document.scenes.push({id:'future-clock',name:'Đồng hồ đang chạy',background:{kind:'solid',color:'#FFF5EA'},elementIds:[future.id]});
    document.elements.push(future);
    const photoIds = [];
    for (let i=0;i<2;i++) {
      const {asset} = await api(`/designs/designs/${draft.id}/assets`,{bytes:await syntheticPhoto(i),status:201});
      document.assets.push({assetId:asset.id,kind:'image'}); photoIds.push(asset.id);
    }
    for (const element of document.elements.filter(element=>element.props.photos)) {
      for (const [i,slot] of element.props.photos.slice(0,2).entries())
        Object.assign(slot,{assetId:photoIds[i],alt:`Ảnh QA ${i+1}`,caption:`Chú thích QA ${i+1}`,focalPoint:{x:i?.7:.2,y:.29}});
    }
    // Public gifts navigate only through document elements. Give this synthetic
    // interaction fixture its own scene links; preview still tests shell navigation.
    for (const scene of document.scenes) {
      const bottom = Math.max(...document.elements.filter(element => scene.elementIds.includes(element.id))
        .map(element => element.layout.y + element.layout.height));
      for (const [index, target] of document.scenes.entries()) {
        const link = createElement('button', {
          id: `qa-nav-${scene.id}-${target.id}`,
          layout: { x: 26, y: bottom + 20 + index * 54, width: 334, height: 44 },
          props: { label: `Cảnh QA ${index + 1}`, color: '#6136DF' },
          actions: [{ on: 'activate', type: 'goToScene', targetSceneId: target.id }],
        });
        scene.elementIds.push(link.id);
        document.elements.push(link);
      }
    }
    const ack=await save(draft,document);
    const {gift}=await api('/gifts/gifts/from-design',{status:201,body:{designId:draft.id,expectedRevision:ack.savedRevision,
      expectedDocumentHash:ack.documentHash,idempotencyKey:randomUUID()}});
    controls = {draftId:draft.id,slug:gift.slug};
  }
  return { cards,controls };
}
