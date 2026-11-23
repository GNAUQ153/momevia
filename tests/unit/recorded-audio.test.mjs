import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {sfxCatalog,librarySound,validatePcmWav} from '../../src/modules/designs/audio.service.mjs';
import {SFX_CURRENT_VERSION} from '../../web/js/shared/canvas/sfx-index.js';
import {SOUNDTRACKS,LEGACY_SOUNDTRACKS,soundtrackById} from '../../web/js/shared/canvas/soundtracks.js';
import {validateDocument,publicDocument} from '../../web/js/shared/canvas/schema.js';
import {createDocument,createElement} from '../../web/js/shared/canvas/index.js';

const read=relative=>fs.readFileSync(new URL('../../'+relative,import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('active SFX uses 50 external author assets with exact PCM, provenance and CC0 evidence',()=>{
 assert.equal(SFX_CURRENT_VERSION,2);const catalog=sfxCatalog();assert.equal(catalog.version,2);assert.equal(catalog.assets.length,50);
 const groups=new Map(),digests=new Set();
 for(const asset of catalog.assets){
  assert.equal(asset.version,2);assert(!asset.author.includes('Momevia'));assert(['recording','authored-sfx'].includes(asset.sourceKind));assert.equal(asset.license,'CC0-1.0');
  const evidence=JSON.parse(read(asset.evidence));assert.equal(evidence.author,asset.author);assert.equal(evidence.license,asset.license);assert.match(evidence.sourcePage,/^https:\/\/(opengameart\.org|freesound\.org)\//);assert.match(evidence.pageSha256,/^[a-f0-9]{64}$/);
  assert.match(asset.provenance.sourceDownloadUrl,/^https:\/\/(opengameart\.org|cdn\.freesound\.org)\//);assert.equal(asset.provenance.sourcePage,evidence.sourcePage);assert.match(asset.sourceSha256,/^[a-f0-9]{64}$/);
  const bytes=read(asset.sourceFile),pcm=validatePcmWav(bytes);assert.equal(hash(bytes),asset.sha256);assert.equal(bytes.length,asset.bytes);assert.equal(pcm.sampleCount,asset.sampleCount);assert.equal(pcm.durationMs,asset.durationMs);
  assert.equal(librarySound(2,asset.id).contentType,'audio/wav');digests.add(asset.sha256);groups.set(asset.group,(groups.get(asset.group)||0)+1);
  for(const license of asset.provenance.bundledLicenseFiles)assert.equal(hash(read(license.path)),license.sha256);
 }
 assert.equal(digests.size,50);assert.deepEqual([...groups.values()],[8,8,5,6,8,5,5,5]);
});
test('fifty full author compositions replace new choices; legacy twenty-four-second files stay addressable',()=>{
 const manifest=JSON.parse(read('web/assets/music/v2/catalog.json'));assert.equal(manifest.tracks.length,50);assert.equal(SOUNDTRACKS.length,50);assert.equal(LEGACY_SOUNDTRACKS.length,10);
 const ids=new Set(),digests=new Set();for(const track of SOUNDTRACKS){assert.equal(soundtrackById(track.id),track);assert(!LEGACY_SOUNDTRACKS.some(old=>old.id===track.id));assert.equal(track.version,2);assert(['CC0-1.0','CC-BY-4.0'].includes(track.license));assert(track.artist&&track.originalTitle);assert.match(track.src,/^\/assets\/music\/v2\/[a-z0-9-]+\.mp3$/);assert(track.durationSeconds>10);ids.add(track.id);
  const metadata=manifest.tracks.find(a=>a.id===track.id);assert.equal(metadata.sourceKind,metadata.instrumental?'instrumental-composition':'vocal-composition');assert.equal(metadata.durationSeconds,track.durationSeconds);const bytes=read('web'+track.src);assert.equal(bytes.length,metadata.bytes);assert.equal(hash(bytes),metadata.sha256);digests.add(metadata.sha256);assert.equal(bytes.subarray(0,3).toString(),'ID3');const evidence=JSON.parse(read(metadata.evidence));assert.equal(evidence.sourcePage,track.sourceUrl);assert.equal(evidence.license,track.license);
  if(track.market==='korea'){assert.equal(track.license,'CC-BY-4.0');assert.match(evidence.primarySource,/^https:\/\/gongu\.copyright\.or\.kr\//);assert.match(evidence.primaryPageSha256,/^[a-f0-9]{64}$/);assert.match(metadata.sourceDownloadUrl,/^https:\/\/gongu\.copyright\.or\.kr\/gongu\/wrt\/cmmn\/wrtFileMediaPlay\.do\?wrtSn=\d+&fileSn=\d+$/);}
 }
 assert.equal(ids.size,50);assert.equal(digests.size,50);assert.equal(SOUNDTRACKS.filter(t=>t.market==='korea').length,6);assert.equal(SOUNDTRACKS.filter(t=>!t.instrumental).length,1);for(const old of LEGACY_SOUNDTRACKS){assert.equal(soundtrackById(old.id),old);assert(!SOUNDTRACKS.includes(old));}
});
test('all fifty legacy sound/music payloads remain byte-for-byte unchanged',()=>{
 const baseline=JSON.parse(read('web/assets/audio-licenses/legacy-sha256.json'));assert.equal(baseline.files.length,50);for(const item of baseline.files)assert.equal(hash(read(item.file)),item.sha256,item.file);
 const d=createDocument();d.schemaVersion=d.registryVersion=3;const e=createElement('sound-button',{sound:{kind:'library',version:1,id:'seal-peel',startMs:0,endMs:850,volume:.5}});d.elements.push(e);d.scenes[0].elementIds.push(e.id);d.soundtrack={id:'calm-dawn',volume:.3};assert.deepEqual(publicDocument(validateDocument(d)).soundtrack,d.soundtrack);assert.equal(librarySound(1,'seal-peel').contentType,'audio/wav');
 const current=sfxCatalog().assets[0];e.sound={kind:'library',version:2,id:current.id,startMs:0,endMs:current.durationMs,volume:.5};d.soundtrack={id:SOUNDTRACKS[0].id,volume:.3};assert.deepEqual(publicDocument(validateDocument(d)).soundtrack,d.soundtrack);
});
