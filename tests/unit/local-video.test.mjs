import test from'node:test';import assert from'node:assert/strict';
import{localVideoEnabled,validateLocalWebm,localVideoBody,LOCAL_VIDEO_LIMITS}from'../../src/modules/designs/local-video.service.mjs';
import{localVideoModels}from'../../web/js/shared/canvas/local-video.js';import{createDocument}from'../../web/js/shared/canvas/presets.js';import{validateDocument,assetIds,duplicateDocument,publicDocument}from'../../web/js/shared/canvas/schema.js';import{scenePresentation}from'../../web/js/shared/canvas/scene-presentation.js';
test('video can only be enabled for explicit local JSON, never production or MySQL',()=>{
 const on={LOCAL_VIDEO_QA_ENABLED:'true',NODE_ENV:'test',DESIGNS_STORAGE:'json',GIFTS_STORAGE:'json'};assert(localVideoEnabled(on));for(const patch of[{LOCAL_VIDEO_QA_ENABLED:'false'},{NODE_ENV:'production'},{DESIGNS_STORAGE:'mysql'},{GIFTS_STORAGE:'mysql'}])assert.equal(localVideoEnabled({...on,...patch}),false);
});
test('video byte validation rejects image, truncated EBML and oversize input',()=>{
 for(const bytes of[Buffer.from('not a video'),Buffer.from('89504e470d0a1a0a','hex'),Buffer.from('1a45dfa3ff','hex')])assert.throws(()=>validateLocalWebm(bytes),{code:'VIDEO_WEBM_INVALID'});
 assert.equal(LOCAL_VIDEO_LIMITS.bytes,128*1024*1024);assert.equal(typeof localVideoBody,'function');
});
test('local video follows the shared schema, references, duplicate and public projection contracts',()=>{
 const doc=createDocument();doc.schemaVersion=doc.registryVersion=3;doc.elements=localVideoModels();doc.scenes[0].elementIds=doc.elements.map(e=>e.id);const video=doc.elements[0];
 assert.doesNotThrow(()=>validateDocument(doc));assert.equal(scenePresentation(doc,doc.scenes[0]).elements.length,0);
 video.props.entries[0]={heading:'',body:''};assert.doesNotThrow(()=>validateDocument(doc,{mode:'publish',requiredBindings:[]}));video.props.entries[0].heading='Video';
 video.props.videoAssetId='owned-video';doc.assets=[{assetId:'owned-video',kind:'video'}];assert.deepEqual(assetIds(doc),['owned-video']);assert.doesNotThrow(()=>validateDocument(doc));
 const copy=duplicateDocument(doc);assert.notEqual(copy.elements[0].id,video.id);assert.equal(copy.elements[0].props.videoAssetId,'owned-video');assert.equal(publicDocument(doc).assets[0].kind,'video');
 doc.assets[0].kind='image';assert.throws(()=>validateDocument(doc),{code:'ASSET_REFERENCE'});
});
