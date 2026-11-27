import assert from'node:assert/strict';import{randomUUID}from'node:crypto';import{startSfxFixture}from'./sfx-fixture.mjs';
const previous=process.env.LOCAL_VIDEO_QA_ENABLED;delete process.env.LOCAL_VIDEO_QA_ENABLED;
const fixture=await startSfxFixture({label:'local-video-off'});
try{
 const owner=await fixture.register('Video disabled QA'),lib=await fixture.request('/designs/library');assert.equal(lib.status,200);assert.equal(lib.data.localVideoEnabled,false);
 const created=await fixture.request('/designs/designs',{cookie:owner.cookie,body:{source:{kind:'blank'},mutationId:randomUUID()}});assert.equal(created.status,201);
 const denied=await fixture.request(`/designs/designs/${created.data.design.id}/video`,{cookie:owner.cookie,bytes:Buffer.from('not read'),headers:{'content-type':'video/webm','x-mutation-id':randomUUID()}});assert.equal(denied.status,403);assert.equal(denied.data.code,'LOCAL_VIDEO_ONLY');
 console.log('PASS video upload/availability disabled by default outside explicit local QA');
}finally{await fixture.close();if(previous===undefined)delete process.env.LOCAL_VIDEO_QA_ENABLED;else process.env.LOCAL_VIDEO_QA_ENABLED=previous;}
