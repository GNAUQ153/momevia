import {softenElement} from './drive-soft.js';
import { createElement } from './registry.js';
import { canonicalText } from '../locale.js';
const materializeModels = source => { const copy=structuredClone(source),ids=new Map(copy.map(e=>[e.id,globalThis.crypto.randomUUID()]));for(const e of copy){e.id=ids.get(e.id);if(e.groupId)e.groupId=ids.get(e.groupId);}return copy; };

// Portable compositions. Text, color, photos and event time use the normal inspector.
export const DRIVE_BLOCKS = Object.freeze([
  ['calendar-peel','Lịch bóc sticker','Peel-off calendar',true,0],
  ['camera-print','Máy ảnh in Polaroid','Polaroid instant camera',false,1],
  ['focus-photo','Ống kính lấy nét','Focus lens',false,1],
  ['grade-stamp','Bảng điểm đóng dấu','Stamp report card',false,0],
  ['ribbon-diploma','Bằng tốt nghiệp tháo nơ','Ribbon diploma',false,0],
  ['four-choice-quiz','Quiz bốn đáp án','Four-choice quiz',false,0],
  ['peel-letter','Thư bóc băng keo','Peel-open letter',false,0],
  ['tear-ticket','Vé xé có tên và SVG','Personalized tear-off SVG pass',true,0],
  ['cap-toss','Tung mũ tốt nghiệp','Graduation cap toss',false,0],
]);
export const DRIVE_OPENINGS = [['santa-gift-box','Nắp hộp và thiệp trượt','Gift lid and sliding card'],['soiree-envelope','Phong bì và dấu sáp','Wax-sealed letter']];
export function driveBlockModels(id, localize = canonicalText, {soft=false}={}) {
  const spec = DRIVE_BLOCKS.find(row=>row[0]===id);
  const make = (type,suffix,box,props,extra={}) => createElement(type,{id:`drive-${id}-${suffix}`,name:localize(`drive.block.${id}`),layout:{x:box[0],y:box[1],width:box[2],height:box[3],rotation:0},props,...extra},localize);
  if(spec){
    const props={kind:id,color:'#FFF8E8',entries:Array.from({length:id==='four-choice-quiz'?4:1},(_,i)=>({heading:localize(`drive.entry.${id}.${i}.heading`),body:localize(`drive.entry.${id}.${i}.body`)}))};
    if(id==='four-choice-quiz')props.question=localize('drive.quizQuestion');
    if(spec[3])Object.assign(props,{eventAt:null,timeZone:'Asia/Ho_Chi_Minh',optional:true});
    if(spec[4])Object.assign(props,{optional:true,photos:[{id:`drive-${id}-photo`,assetId:null,alt:'',caption:'',focalPoint:{x:.5,y:.5}}]});
    const model=make('interaction','block',[0,0,338,id==='tear-ticket'?430:id==='calendar-peel'?450:370],props);return [soft?softenElement(model,{ink:'#27394B',accent:'#7D3854',detail:'#EAC572'}):model];
  }
  if(id==='vinyl-record')return [make('shape','record',[0,0,140,140],{kind:'rectangle',color:'#272936',radius:0},{accessibility:{decorative:true,label:'Momevia Drive vinyl v1'},artwork:{paths:[{d:'M50 2A48 48 0 1 0 50 98A48 48 0 1 0 50 2Z',fill:'color'},{d:'M50 34A16 16 0 1 0 50 66A16 16 0 1 0 50 34Z',fill:'#D8A8BE'},{d:'M50 46A4 4 0 1 0 50 54A4 4 0 1 0 50 46Z',fill:'#FFF3DC'}]}})];
  if(id==='santa-gift-box'||id==='soiree-envelope')return [make(id==='santa-gift-box'?'gift-box':'envelope','open',[0,0,326,340],{preset:id==='santa-gift-box'?(soft?'lid-card-v2':'lid-card-v1'):(soft?'wax-letter-v2':'wax-letter-v1'),...(soft?{cornerRadius:22,motionSpeed:'normal'}:{}),label:localize(`drive.entry.${id}.0.heading`),...(id==='soiree-envelope'?{sealColor:'#D7B67C',paperColor:'#FFF2DB'}:{}),color:id==='santa-gift-box'?'#183E35':'#773447'},{actions:[{on:'activate',type:'replay'}],...(soft?{effects:{reaction:{id:id==='santa-gift-box'?'R02':'R01',speed:'normal'}}}:{})})];
  // Selectable pine branches, berries and tag, with a stable group anchor.
  const elements=[make('shape','tag',[68,55,148,102],{kind:'rectangle',color:'#FFF3DC',radius:5}),
    make('text','tag-text',[80,83,124,52],{text:localize('drive.secretSanta'),fontToken:'serif',fontSize:22,align:'center',color:'#183E35'}),
    make('shape','pine',[0,0,125,190],{kind:'rectangle',color:'#357463',radius:0},{artwork:{paths:[{d:'M50 2V100M50 15 12 35M50 15 88 35M50 35 5 60M50 35 95 60M50 60 10 87M50 60 90 87',fill:'none',stroke:'color',strokeWidth:4}]}}),
    ...[0,1,2].map(i=>make('shape','berry-'+i,[98+i*15,140+(i%2)*16,18,18],{kind:'ellipse',color:'#983F4E',radius:0}))];
  for(const e of elements)e.groupId=elements[0].id;
  return elements;
}
export const driveElementCards = (localize=canonicalText) => [...DRIVE_BLOCKS,...DRIVE_OPENINGS,['vinyl-record','Đĩa nhạc khi phát','Playback vinyl record'],['pine-gift-tag','Nhánh thông và thẻ quà','Pine sprig and gift tag']].map(([id,vi,en])=>({id:`drive-${id}`,title:localize(`editor.library.item.drive-${id}`),titleTexts:{vi,en},visualKind:id==='pine-gift-tag'?'graphics':'interactive',keywords:`${vi} ${en} drive graduation invitation tốt nghiệp thiệp mời`,create:()=>materializeModels(driveBlockModels(id,localize,{soft:true})).map(e=>{delete e.groupId;return e;})}));
