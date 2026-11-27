import { createElement } from './registry.js';
import { motionRow } from './motion-stack.js';
import { gardenSprigPaths, gardenFlowerPaths, gardenCupPaths } from './garden-botanical.js';
import { NATURAL_MEDIA_IDS } from './natural-media.js';
import { NATURAL_ARTWORK_LABEL } from './event-media.js';
import { canonicalText } from '../locale.js';

export const GARDEN_ELEMENT_SPECS = [
  ['garden-botanical-branch','Cành lá có gân','Veined botanical branch','leaf botanical garden leaves'],
  ['garden-layered-flower','Hoa cánh mềm nhiều lớp','Layered soft-petal flower','flower petals bloom garden'],
  ['garden-watercolor-corner','Góc hoa lá màu nước','Watercolor botanical corner','rose eucalyptus watercolor garden'],
  ['garden-porcelain-cup','Tách trà sứ và hơi ấm','Porcelain tea and rising steam','tea cup ceramic steam garden'],
  ['garden-tea-tray','Khay trà đôi','Tea for two tray','tea tray cups garden'],
  ['garden-arch-frame','Khung ảnh vòm hoa','Floral arched photo frame','arch photo frame garden'],
  ['garden-calendar-card','Thẻ lịch vườn trà','Garden date card','calendar date invitation garden'],
  ['garden-letter-paper','Giấy thư hoa ép','Pressed-flower letter','letter message paper garden'],
  ['garden-petal-drift','Cánh hoa bay nhẹ','Drifting petals','petals motion garden'],
  ['garden-leaf-divider','Nét hoa phân cách','Floral divider','divider flower rule garden'],
  ['garden-opening-door','Cánh cửa vườn mở đôi','Opening botanical doors','gate doors open garden'],
  ['garden-attendance','Khối xác nhận tham dự','Event RSVP block','rsvp attendance invitation garden'],
  ['garden-reveal-ticket','Thẻ cào bật mí mượt','Smooth secret scratch card','scratch reveal secret garden'],
];
export function gardenMotion(model, kind = 'sway', amplitude = .28, periodMs = 7200, iterations = 'infinite') {
  const row = motionRow(kind, `${model.id}-${kind}`);
  Object.assign(row, { amplitude, periodMs, iterations, anchor: { x: .5, y: .9 } });
  model.motions = { version: 1, enabled: true, rows: [row] };
  return model;
}
export function gardenElementModels(id, localize = canonicalText) {
  const models = [], title = localize(`editor.library.item.${id}`);
  const add = (type, suffix, box, props, extra = {}) => {
    const e = createElement(type, { id: `${id}-${suffix}`, name: title, layout: { x: box[0], y: box[1], width: box[2], height: box[3], rotation: box[4] || 0 }, props, ...extra }, localize);
    models.push(e); return e;
  };
  const vector = (suffix, box, paths, color = '#789267') => add('shape', suffix, box, { kind: 'rectangle', color }, { artwork: { paths } });
  const shape = (suffix, box, color, kind = 'rectangle', extra = {}) => add('shape', suffix, box, { kind, color, radius: 20, ...extra });
  const image = (suffix, key, box) => add('image', suffix, box, { assetId: NATURAL_MEDIA_IDS[key], fit: 'contain', radius: 0 }, { accessibility: { decorative: true, label: NATURAL_ARTWORK_LABEL } });
  const text = (suffix, value, box, binding) => add('text', suffix, box, { ...(binding ? { textBinding: binding } : { text: value }), fontToken: 'serif', fontSize: 20, color: '#344B37', align: 'center', fontStyle: 'italic' });
  if (id === 'garden-botanical-branch') gardenMotion(vector('branch', [0,0,120,230], gardenSprigPaths()), 'sway', .28);
  else if (id === 'garden-layered-flower') gardenMotion(vector('flower', [0,0,126,126], gardenFlowerPaths()), 'pulse', .35, 4800);
  else if (id === 'garden-watercolor-corner') {
    gardenMotion(image('leaf','element-eucalyptus',[0,0,230,174,-24]),'sway',.22);
    image('rose','element-rose',[99,57,105,125,14]);
  } else if (id === 'garden-porcelain-cup') {
    vector('cup',[0,24,180,150],gardenCupPaths());
    gardenMotion(vector('steam',[51,0,70,49],[{d:'M25 94C69 70 5 50 48 8M63 93C96 70 45 44 79 3',fill:'none',stroke:'#A3B09A',strokeWidth:1.7}]),'float',1.2,3900);
  } else if (id === 'garden-tea-tray') {
    shape('tray',[0,82,300,104],'#EAD8B3','ellipse',{strokeColor:'#C0A36F',strokeWidth:1});
    vector('cup-one',[32,2,117,154],gardenCupPaths()); vector('cup-two',[151,27,105,139],gardenCupPaths());
    image('rose','element-rose',[212,83,85,86,-26]);
  } else if (id === 'garden-arch-frame') {
    shape('frame',[0,0,216,300],'#FFF8E7','arch',{strokeColor:'#B6A16E',strokeWidth:2});
    add('image','photo',[8,8,200,284],{assetId:null,fit:'cover',radius:0,mask:'arch',optional:true,placeholder:'portrait'},{accessibility:{decorative:true}});
    image('flower','element-wildflowers',[132,190,112,140,12]);
  } else if (id === 'garden-calendar-card') {
    shape('paper',[0,12,270,218],'#FFF9EA','rectangle',{strokeColor:'#C3AF7C',strokeWidth:1});
    shape('band',[0,12,270,49],'#A9BF99','rectangle');
    for(const [i,x]of [45,215].entries())add('line','ring-'+i,[x,0,28,2,90],{color:'#9A7E4C',strokeWidth:4});
    text('heading',localize('templates.garden-tea.details'),[20,83,230,60]);
    text('date',localize('templates.garden-tea.previewDateHint'),[20,159,230,44]);
  } else if (id === 'garden-letter-paper') {
    shape('paper',[0,0,310,330],'#FFF9ED','rectangle',{strokeColor:'#D4BCA2',strokeWidth:1});
    text('body','',[28,50,254,228],'message'); image('flower','element-wildflowers',[222,203,100,130,14]);
  } else if (id === 'garden-petal-drift') {
    for(let i=0;i<4;i++){
      const colors=['#D8A4A0','#E4C58B','#C6D2AD'];
      const petal=vector('petal-'+i,[i*45,(i%3)*38,16,28,21+i*31],[
        {d:'M14 94C-2 53 18 7 61 4C105 2 99 47 69 68C50 81 31 80 14 94Z',fill:'color'},
        {d:'M14 94C30 67 44 44 68 24C47 51 33 79 14 94Z',fill:'#FFF2DF'},
        {d:'M18 87Q42 57 75 32',fill:'none',stroke:'#BD8D87',strokeWidth:.6},
      ],colors[i%3]);
      gardenMotion(petal,'float',1,5800+i*650);
      Object.assign(petal.motions.rows[0],{delayMs:i*280,tracks:[{target:'whole',anchor:{x:.5,y:.5},delayMs:0,frames:[
        {at:0,x:-9,y:-18,rotation:-12,opacity:.7,easing:'ease-in-out'},
        {at:.5,x:14,y:22,rotation:23,opacity:1,easing:'ease-in-out'},
        {at:1,x:-9,y:-18,rotation:-12,opacity:.7},
      ]}]});
    }
  } else if (id === 'garden-leaf-divider') {
    add('line','rule',[0,39,300,2],{color:'#BB9A72',strokeWidth:1});
    vector('flower',[124,12,52,52],gardenFlowerPaths());
    vector('leaf-left',[90,14,36,55,68],gardenSprigPaths());vector('leaf-right',[177,14,36,55,-68],gardenSprigPaths());
  } else if (id === 'garden-opening-door') add('envelope','door',[0,0,280,340],{label:localize('templates.garden-tea.openDoorLabel'),color:'#5E7156',preset:'botanical-gate-v2'},{actions:[{on:'activate',type:'replay'}]});
  else if (id === 'garden-attendance') add('reply','rsvp',[0,0,342,650],{replyMode:'attendance',title:localize('rsvp.title'),submitLabel:localize('rsvp.save'),color:'#3D6045'});
  else if (id === 'garden-reveal-ticket') add('interaction','scratch',[0,0,326,210],{kind:'scratch-ticket',appearance:'scratch-progress-v1',color:'#E8D4A8',entries:[{heading:localize('templates.garden-tea.scratch'),body:localize('templates.garden-tea.secretBody')}]});
  return models;
}
export const gardenElementCards = (localize = canonicalText) => GARDEN_ELEMENT_SPECS.map(([id,vi,en,keywords]) => ({
  id, title: localize(`editor.library.item.${id}`), titleTexts: { vi, en }, visualKind: ['garden-opening-door','garden-attendance','garden-reveal-ticket'].includes(id)?'interactive':id==='garden-arch-frame'?'photos':'graphics', keywords: `vườn trà hoa lá ${vi} ${keywords}`,
  create: () => gardenElementModels(id, localize).map(e=>({...e,id:globalThis.crypto.randomUUID()})),
}));
