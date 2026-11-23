import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { validateDocument,publicDocument,assetIds,imageAssetIds } from '../../web/js/shared/canvas/schema.js';
import { createDocument,createElement } from '../../web/js/shared/canvas/index.js';
import { cleanGiftLayout } from '../../web/js/shared/canvas/clean-layout.js';
import { validatePcmWav,sfxCatalog } from '../../src/modules/designs/audio.service.mjs';
import { encodeWav,trimPcm,sampleWindow } from '../../web/js/shared/canvas/audio-pcm.js';
import { createSoundPlayer } from '../../web/js/features/gift-runtime/audio.js';
import { normalizeSoundSearch } from '../../web/js/features/canvas-editor/sound-editor.js';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { AudioAssetsService,audioBody } from '../../src/modules/designs/audio.service.mjs';
import { DesignsService } from '../../src/modules/designs/designs.service.mjs';
import { JsonDesignRepository } from '../../src/modules/designs/json.repository.mjs';
import { auditAudioMedia,quarantineAudioOrphans } from '../../scripts/dev/audio-media-audit.mjs';

const sound={kind:'library',id:'seal-peel',version:1,startMs:0,endMs:850,volume:.6};
test('new sound buttons use the active locale for their editable label and accessible name',()=>{const element=createElement('sound-button',{},key=>key==='sfx.listen'?'Listen':key);assert.equal(element.props.label,'Listen');assert.equal(element.accessibility.label,'Listen');});
function documentWithSound(){const d=createDocument();d.schemaVersion=d.registryVersion=3;const e=createElement('sound-button',{sound:structuredClone(sound)});d.elements.push(e);d.scenes[0].elementIds.push(e.id);return d;}
test('legacy synthesized v1 stays byte-compatible for already-pinned gifts',()=>{
 const catalog=sfxCatalog(1);assert.equal(catalog.assets.length,40);const groups=new Map(),hashes=new Set();
 for(const a of catalog.assets){const bytes=fs.readFileSync(new URL('../../'+a.sourceFile,import.meta.url)),pcm=validatePcmWav(bytes);assert.equal(pcm.sampleCount,a.sampleCount);assert.equal(pcm.durationMs,a.durationMs);assert.equal(bytes.length,a.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256);assert(a.name.vi&&a.name.en&&a.author&&a.evidence&&a.sourceFile);assert.equal(a.license,'CC0-1.0');groups.set(a.group,(groups.get(a.group)||0)+1);hashes.add(a.sha256);let peak=0;for(let i=44;i<bytes.length;i+=2)peak=Math.max(peak,Math.abs(bytes.readInt16LE(i)));assert(peak>1000&&peak<30000);}
 assert.equal(hashes.size,40);assert.equal(groups.size,8);assert.deepEqual([...groups.values()],Array(8).fill(5));assert.equal(normalizeSoundSearch('BÓC NIÊM PHONG Đẹp'),'boc niem phong dep');
});
test('SFX requires v3, private refs are typed and public/regift projections preserve only the intended sound',()=>{
 const d=documentWithSound();assert.deepEqual(validateDocument(d),d);d.schemaVersion=d.registryVersion=2;assert.throws(()=>validateDocument(d));d.schemaVersion=d.registryVersion=3;
 d.elements[0].sound={kind:'audio',assetId:'personal-1',volume:.4};assert.throws(()=>validateDocument(d));d.assets=[{kind:'audio',assetId:'personal-1'}];assert.deepEqual(assetIds(d),['personal-1']);assert.deepEqual(imageAssetIds(d),[]);
 assert.equal(publicDocument(d).elements[0].sound.assetId,'personal-1');assert.equal(cleanGiftLayout(d).elements[0].sound,undefined);
 d.elements[0].sound=sound;d.assets=[];assert.deepEqual(cleanGiftLayout(d).elements[0].sound,sound);
 for(const mutation of [s=>s.version=999,s=>s.id='toString',s=>s.volume=2,s=>s.startMs=-1,s=>s.endMs=50,s=>s.url='https://evil.test']){const x=documentWithSound();mutation(x.elements[0].sound);assert.throws(()=>validateDocument(x));}
});

test('Canvas v3 keeps background music and both sound kinds through public projection and safe regifting',()=>{
 const d=documentWithSound();
 d.soundtrack={id:'calm-dawn',volume:.35};
 const personal=createElement('sound-button',{sound:{kind:'audio',assetId:'personal-mixed',volume:.4}});
 d.elements.push(personal);d.scenes[0].elementIds.push(personal.id);d.assets.push({kind:'audio',assetId:'personal-mixed'});
 assert.deepEqual(validateDocument(d),d);
 const published=publicDocument(d);
 assert.deepEqual(published.soundtrack,d.soundtrack);
 assert.deepEqual(published.elements.map(e=>e.sound),[sound,personal.sound]);
 assert.deepEqual(assetIds(published),['personal-mixed']);
 const regift=validateDocument(cleanGiftLayout(published));
 assert.equal(regift.soundtrack,undefined);
 assert.deepEqual(regift.elements[0].sound,sound);
 assert.equal(regift.elements[1].sound,undefined);
 assert.deepEqual(regift.assets,[]);
});

test('Creator v3 permits background music personalization while keeping element sounds locked',()=>{
 const service=new DesignsService({}),document=documentWithSound();
 const current={document,policy:{kind:'creator-template',editableBindings:[],photoId:null}};
 const next=structuredClone(document);next.soundtrack={id:'calm-dawn',volume:.35};
 assert.doesNotThrow(()=>service.enforcePolicy(current,next));
 next.elements[0].sound.volume=.1;
 assert.throws(()=>service.enforcePolicy(current,next),error=>error.code==='LOCKED_ELEMENT');
});
test('PCM export cuts exact middle samples without gain; start/end/minimum clips and malformed server headers',()=>{
 const samples=Float32Array.from({length:132300},(_,i)=>Math.sin(2*Math.PI*(i<44100?220:i<88200?880:1760)*i/44100)*.4),buffer={sampleRate:44100,length:samples.length,numberOfChannels:1,getChannelData:()=>samples};
 for(const [start,end]of [[1000,2000],[0,100],[2900,3000],[0,10000]]){
  if(end>3000){assert.throws(()=>trimPcm(buffer,start,end));continue;}
  const {bytes}=trimPcm(buffer,start,end),pcm=validatePcmWav(bytes);assert.equal(pcm.sampleCount,Math.round((end-start)*44.1));const wave=Buffer.from(bytes);for(let i=0;i<pcm.sampleCount;i++)assert(Math.abs(wave.readInt16LE(44+i*2)/32768-samples[Math.round(start*44.1)+i])<.00006);
 }
 const bytes=Buffer.from(encodeWav(samples.slice(0,4410)));for(const offset of [0,4,8,12,16,20,22,24,28,32,34,36,40]){const bad=Buffer.from(bytes);bad[offset]^=1;assert.throws(()=>validatePcmWav(bad));}
 assert.throws(()=>sampleWindow(0,99,44100,44100));assert.throws(()=>validatePcmWav(Buffer.concat([bytes,Buffer.from([0])])));
});
test('runtime stays silent initially, limits voices, starts cached sound synchronously, and drops stale fetches',async()=>{
 let requests=0,starts=0,stops=0,closed=0,gainValue;const buffer={duration:.85},context={state:'running',destination:{},resume:async()=>{},close:async()=>{closed++;},decodeAudioData:async()=>buffer,createGain:()=>({gain:{set value(v){gainValue=v;}},connect(){},disconnect(){}}),createBufferSource:()=>({connect(){},disconnect(){},start(){starts++;},stop(){stops++;}})};
 const player=createSoundPlayer({assetUrl:()=>'/private.wav',contextFactory:()=>context,fetcher:async()=>{requests++;return new Response(new Uint8Array(44));}});
 assert.equal(await player.play(sound),false);assert.equal(requests,0);await player.play(sound,{explicit:true});assert.equal(starts,1);assert.equal(gainValue,.6);
 player.setEnabled(true);const pending=player.play(sound);assert.equal(starts,2,'cached sound starts inside the activation call');await pending;assert(stops>=1);player.setEnabled(false);player.dispose();assert.equal(closed,1);
 let resolve;const late=new Promise(r=>{resolve=r;}),other=createSoundPlayer({assetUrl:()=>'/slow.wav',contextFactory:()=>context,fetcher:()=>late});const play=other.play(sound,{explicit:true});other.cancelPending();resolve(new Response(new Uint8Array(44)));await play;assert.equal(starts,2);other.dispose();
});
test('binary API enforces actual/declaration sizes, media type and PCM sample boundaries',async()=>{
 const bytes=Buffer.from(encodeWav(new Float32Array(4410))),make=(headers,body=bytes)=>{const req=Readable.from([body]);req.headers=headers;return req;};
 assert.deepEqual(await audioBody(make({'content-type':'audio/wav','content-length':String(bytes.length)})),bytes);
 await assert.rejects(audioBody(make({'content-type':'audio/mpeg'})),{status:415});await assert.rejects(audioBody(make({'content-type':'audio/wav','content-length':String(bytes.length+1)})),{status:422});await assert.rejects(audioBody(make({'content-type':'audio/wav','content-length':'882045'})),{status:413});
 for(const samples of [4409,441001])assert.throws(()=>validatePcmWav(encodeWav(new Float32Array(samples))));
});
test('interrupted metadata commit repairs with the same audio ID; offline orphan quarantine retains every pinned asset',async()=>{
 const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'momevia-sfx-')),mediaRoot=path.join(root,'assets');
 try{
  const repo=new JsonDesignRepository(path.join(root,'canvas.json')),owner={sub:randomUUID()},id=randomUUID(),mutation=randomUUID(),record={id,ownerId:owner.sub,document:createDocument(),revision:1};await repo.create(owner.sub,randomUUID(),'synthetic',record);
  const designs=new DesignsService({repository:repo,mediaRoot,flags:{edit:true,sfxCreate:true}}),service=new AudioAssetsService(designs),bytes=Buffer.from(encodeWav(new Float32Array(4410)));
  repo.fault=()=>{throw new Error('injected before metadata commit');};await assert.rejects(service.upload(owner,id,mutation,bytes),/injected/);assert.equal(Object.keys(repo.read().assets).length,0);assert.equal(fs.readdirSync(mediaRoot).length,1);
  repo.fault=()=>{};const repaired=await service.upload(owner,id,mutation,bytes);assert.equal(fs.readdirSync(mediaRoot).length,1);assert.equal((await service.upload(owner,id,mutation,bytes)).id,repaired.id);
  const orphan=randomUUID()+'.wav',recent=randomUUID()+'.wav';fs.writeFileSync(path.join(mediaRoot,orphan),bytes);fs.writeFileSync(path.join(mediaRoot,recent),bytes);const old=new Date(Date.now()-8*86400000);fs.utimesSync(path.join(mediaRoot,orphan),old,old);fs.utimesSync(path.join(mediaRoot,repaired.id+'.wav'),old,old);
  const plan=auditAudioMedia({mediaRoot,assets:Object.values(repo.read().assets),snapshots:[repo.read()]});assert.deepEqual(plan.files.filter(f=>f.quarantineCandidate).map(f=>f.name),[orphan]);assert.throws(()=>quarantineAudioOrphans(plan),/offline/);assert.deepEqual(quarantineAudioOrphans(plan,{offline:true}).moved,[orphan]);assert(fs.existsSync(path.join(mediaRoot,repaired.id+'.wav')));assert(fs.existsSync(path.join(mediaRoot,recent)));
 }finally{assert.equal(path.dirname(path.resolve(root)),fs.realpathSync(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});}
});
