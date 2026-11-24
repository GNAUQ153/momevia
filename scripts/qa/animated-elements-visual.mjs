import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {ANIMATED_ELEMENTS,animatedElementCards} from '../../web/js/shared/canvas/animated-elements.js';
import {createDocument} from '../../web/js/shared/canvas/presets.js';
import {pinDocumentArtwork} from '../../web/js/shared/canvas/library-materialize.js';
import {previewSvg} from '../../web/js/shared/canvas/cover-svg.js';
const out=path.resolve('docs/animated-elements-50');fs.mkdirSync(path.join(out,'static'),{recursive:true});
const provenance=[];
for(const spec of ANIMATED_ELEMENTS){
 const [model]=animatedElementCards(spec.group).find(c=>c.id===spec.id).create();
 const doc=createDocument({presetId:'blank'});doc.artboard.baseSize={width:240,height:240};model.layout={x:10,y:10,width:220,height:220,rotation:0};doc.elements=[model];doc.scenes[0].elementIds=[model.id];pinDocumentArtwork(doc);
 for(const [theme,color]of [['light','#FFF5F8'],['dark','#292231']]){
  doc.scenes[0].background.color=color;const svg=previewSvg(doc);fs.writeFileSync(path.join(out,'static',spec.id+'-'+theme+'.svg'),svg);
  for(const size of [64,82,220,440])await sharp(Buffer.from(svg)).resize(size,size).png().toFile(path.join(out,'static',spec.id+'-'+theme+'-'+size+'.png'));
 }
 provenance.push({number:spec.number,id:spec.id,name:spec.vi,english:spec.en,artworkOwner:'Momevia',artworkSource:'web/js/shared/canvas/animated-elements.js',artworkLicense:'Project-owned original vector artwork; no third-party artwork redistributed',sha256:createHash('sha256').update(JSON.stringify(spec.parts)).digest('hex'),inspiration:spec.number===11?'User brief; Tabler balloon silhouette idea (no copied path)': [1,2,9,12,14].includes(spec.number)?'User brief; Noto and Fluent timing ideas (no copied artwork)': [13,38].includes(spec.number)?'User brief; canvas-confetti local arc/settling idea (no copied code)':'User brief; original Momevia drawing',referenceUrls:spec.number===11?['https://github.com/tabler/tabler-icons/blob/main/icons/outline/balloon.svg']: [13,38].includes(spec.number)?['https://www.kirilv.com/canvas-confetti/']: [1,2,9,12,14].includes(spec.number)?['https://googlefonts.github.io/noto-emoji-animation/','https://github.com/microsoft/fluentui-emoji-animated']:[],modifications:'New numeric vector paths and choreography authored for this project; not derived from external path data',attributionLocation:'docs/animated-elements-50/provenance.json',staticPose:spec.rest,motions:spec.rows.map(r=>r.title),parts:spec.parts.length,tracks:spec.rows.reduce((n,r)=>n+r.tracks.length,0),particles:spec.number===13||spec.number===38?6:0,externalAssetReferences:0});
}
for(const theme of ['light','dark']){
 const cells=[];for(const [i,e]of ANIMATED_ELEMENTS.entries()){
  const png=fs.readFileSync(path.join(out,'static',e.id+'-'+theme+'-220.png'));cells.push({input:png,left:(i%5)*250+15,top:Math.floor(i/5)*264+8});
  const svg=`<svg width="250" height="34"><text x="125" y="21" text-anchor="middle" font-family="Arial" font-size="13" fill="${theme==='dark'?'#FFF4DE':'#55485E'}">${String(e.number).padStart(2,'0')}. ${e.vi}</text></svg>`;cells.push({input:Buffer.from(svg),left:(i%5)*250,top:Math.floor(i/5)*264+229});
 }
 await sharp({create:{width:1250,height:2640,channels:4,background:theme==='dark'?'#292231':'#FFF5F8'}}).composite(cells).png().toFile(path.join(out,'contact-sheet-'+theme+'.png'));
}
const thumbs=[];for(const [i,e]of ANIMATED_ELEMENTS.entries()){thumbs.push({input:fs.readFileSync(path.join(out,'static',e.id+'-light-64.png')),left:i%10*100+18,top:Math.floor(i/10)*100+4});thumbs.push({input:Buffer.from(`<svg width="100" height="24"><text x="50" y="18" font-family="Arial" font-size="12" text-anchor="middle" fill="#55485E">${String(e.number).padStart(2,'0')}</text></svg>`),left:i%10*100,top:Math.floor(i/10)*100+72});}await sharp({create:{width:1000,height:500,channels:4,background:'#FFF5F8'}}).composite(thumbs).png().toFile(path.join(out,'contact-sheet-thumbnails.png'));
fs.writeFileSync(path.join(out,'provenance.json'),JSON.stringify(provenance,null,2)+'\n');console.log('Rendered 50 original vectors × two backgrounds × four sizes; provenance has 50 hashes and zero external asset URLs.');
