import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MusicLibraryService, audioLibraryDefaults, validateAudioCuration } from '../../src/modules/designs/music-library.service.mjs';
import { installAudioCuration } from '../../web/js/shared/canvas/music-curation.js';
import { matchingMusicTracks } from '../../web/js/features/canvas-editor/music-panel.js';
import { soundtrackById } from '../../web/js/shared/canvas/soundtracks.js';

test('audio curation persists without changing source bytes; CAS serializes parallel edits and keeps history', async () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'momevia-music-')),filepath=path.join(root,'library.json');
  try {
    const first=new MusicLibraryService(null,{filepath}),second=new MusicLibraryService(null,{filepath});
    await first.ready();const item=(await first.list()).items.find(row=>row.kind==='music');
    const bytes=fs.readFileSync(new URL('../../web'+item.src,import.meta.url));
    await assert.rejects(first.put({role:'sender'},item.key,{expectedRevision:0}),{status:403});
    const input={expectedRevision:0,title:{vi:'Lời chúc riêng của Admin',en:'Admin greeting'},status:'disabled',keywords:'thu vien am nhac',theme:'birthday'};
    const results=await Promise.allSettled([first.put({role:'admin'},item.key,input),second.put({role:'admin'},item.key,input)]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
    const reloaded=(await new MusicLibraryService(null,{filepath}).list()).items.find(row=>row.key===item.key);
    assert.equal(reloaded.revision,1);assert.equal(reloaded.status,'disabled');assert.equal(reloaded.title.vi,input.title.vi);assert.equal(reloaded.sha256,item.sha256);
    await second.put({role:'admin'},item.key,{expectedRevision:1,status:'active'});
    assert.equal(first.json().read().history.length,1);
    assert.deepEqual(fs.readFileSync(new URL('../../web'+item.src,import.meta.url)),bytes);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('curation cannot forge media/rights/region metadata; disabled music disappears only from new choices', () => {
  const original=audioLibraryDefaults().find(row=>row.kind==='music');
  for(const patch of [{src:'https://example.test/a.mp3'},{market:'vietnam'},{license:'CC0-1.0'},{title:{vi:'<script>',en:''}},{theme:'made-up'},{expectedRevision:-1}]){
    assert.throws(()=>validateAudioCuration({expectedRevision:0,...patch},original));
  }
  try {
    installAudioCuration({items:[{...original,status:'disabled'}]});
    assert(!matchingMusicTracks().some(track=>track.id===original.id));assert(soundtrackById(original.id));
    installAudioCuration({items:[{...original,title:{vi:'Nhạc đã sửa',en:'Edited song'},theme:'tet',keywords:'tu khoa moi'}]});
    assert(matchingMusicTracks({query:'tu khoa moi',occasion:'tet'}).some(track=>track.id===original.id));
  } finally { installAudioCuration(null); }
});
