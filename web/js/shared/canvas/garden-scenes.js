import { createElement } from './registry.js';
import { NATURAL_MEDIA_IDS } from './natural-media.js';
import { NATURAL_ARTWORK_LABEL } from './event-media.js';
import { gardenElementModels, gardenMotion } from './garden-elements.js';
import { gardenFlowerPaths } from './garden-botanical.js';
import { eventRecipe } from './event-recipes.js';

// All enhancements are portable Canvas models, not a second HTML page renderer.
export function enrichGardenScenes(doc, localize) {
  doc.schemaVersion = doc.registryVersion = 4;
  const palette = ['#FFF6E8','#FAEFE4','#F6E7D5','#EAF0DF','#F5E5BE','#EFE6ED','#F6E1D4','#E5ECD9','#DCE8D4'];
  const byId = id => doc.scenes.find(s => s.id === id);
  const add = (scene, e, behind = false) => {
    doc.elements.push(e);
    if (behind) { const at=scene.elementIds.findIndex(id=>{const n=doc.elements.find(x=>x.id===id);return n.type==='text'&&!n.accessibility.decorative;});scene.elementIds.splice(Math.max(0,at),0,e.id); } else scene.elementIds.push(e.id);
    if(e.type === 'image' && e.props.assetId && !doc.assets.some(a => a.assetId === e.props.assetId))doc.assets.push({assetId:e.props.assetId,kind:'image'});
    return e;
  };
  const art = (scene, suffix, key, box, options = {}) => add(scene, createElement('image', {
    id: `${scene.id}-garden-${suffix}`, name: localize(`editor.library.item.natural-${key.replace('element-','')}`),
    layout: {x:box[0],y:box[1],width:box[2],height:box[3],rotation:box[4]||0},
    props:{assetId:NATURAL_MEDIA_IDS[key],fit:'contain',radius:0},accessibility:{decorative:true,label:NATURAL_ARTWORK_LABEL},
    ...options,
  },localize), true);
  const piece = (scene, id, box, behind = false) => {
    const models = gardenElementModels(id, localize), xs=models.map(e=>e.layout.x), ys=models.map(e=>e.layout.y);
    const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...models.map(e=>e.layout.x+e.layout.width))-x,h=Math.max(...models.map(e=>e.layout.y+e.layout.height))-y;
    const groupId=`${scene.id}-${models[0].id}`;
    for (const e of models) {
      const old=e.id; e.id=`${scene.id}-${old}`;
      if(models.length>1)e.groupId=groupId;
      e.layout={...e.layout,x:box[0]+(e.layout.x-x)*box[2]/w,y:box[1]+(e.layout.y-y)*box[3]/h,width:e.layout.width*box[2]/w,height:e.layout.height*box[3]/h};
      for(const k of Object.keys(e.layout))e.layout[k]=Math.round(e.layout[k]*100)/100;
      add(scene,e,behind);
    }
    return models;
  };
  const sheet = (scene, suffix, box, color, radius = 20) => add(scene,createElement('shape',{
    id:`${scene.id}-garden-${suffix}`,name:localize('editor.element.shape'),layout:{x:box[0],y:box[1],width:box[2],height:box[3],rotation:0},
    props:{kind:'rectangle',color,radius,strokeColor:'#D8BF95',strokeWidth:1},accessibility:{decorative:true},
  },localize),true);
  for(const [i,scene]of doc.scenes.entries()){
    scene.background.color=palette[i];
    const accent=['#934850','#934850','#875348','#526A47','#856438','#76607A','#965A4C','#3D6045','#48664B'][i];
    for(const id of scene.elementIds){const e=doc.elements.find(n=>n.id===id);if(e.type==='button')e.props.color=accent;}
    scene.effects.ambience=eventRecipe('porch-sun-v1',{density:'sparse',loop:i===0||i===1||i===8});
    if(i!==0&&i!==1){
      for(const id of scene.elementIds){const e=doc.elements.find(n=>n.id===id);if(e.type==='text'&&e.accessibility.role==='heading')e.effects={...e.effects,entrance:{id:'E02',speed:'normal',delay:0}};}
    }
  }
  const cover=byId('scene-cover');
  for(const side of ['left','right']){
    const x=side==='left'?0:195,group=`garden-${side}-door`;
    for(const e of doc.elements.filter(e=>e.groupId===group&&/-sprig$|-flower$/.test(e.id))){cover.elementIds=cover.elementIds.filter(id=>id!==e.id);doc.elements=doc.elements.filter(n=>n.id!==e.id);}
    for(const [position,y,angle]of [['top',4,side==='left'?-45:136],['bottom',690,side==='left'?4:184]]){
      const branch=art(cover,`${side}-${position}-eucalyptus`,'element-eucalyptus',[x-24,y,196,147,angle]);branch.groupId=group;
      gardenMotion(branch,'sway',.48,6600);
      cover.elementIds=cover.elementIds.filter(id=>id!==branch.id);cover.elementIds.splice(cover.elementIds.indexOf(`${group}-title`),0,branch.id);
      const flower=art(cover,`${side}-${position}-rose`,'element-rose',[x+(side==='left'?14:105),position==='top'?45:735,82,100,side==='left'?-11:14]);flower.groupId=group;
      cover.elementIds=cover.elementIds.filter(id=>id!==flower.id);cover.elementIds.splice(cover.elementIds.indexOf(`${group}-title`),0,flower.id);
    }
  }
  doc.elements.find(e=>e.id==='cover-sender').layout.y=210;
  doc.elements.find(e=>e.id==='cover-recipient').layout.y=278;
  doc.elements.find(e=>e.id==='cover-hint').layout={x:70,y:610,width:250,height:64,rotation:0};
  const hero=byId('scene-invitation');
  const frame=doc.elements.find(e=>e.id==='hero-photo-frame');
  Object.assign(frame.layout,{x:95,y:306,width:200,height:270});Object.assign(frame.props,{kind:'arch',color:'#FFF9E9',strokeColor:'#9F9368',strokeWidth:2});
  const photo=doc.elements.find(e=>e.id==='hero-photo');
  Object.assign(photo.layout,{x:102,y:313,width:186,height:256});Object.assign(photo.props,{radius:0,mask:'arch'});
  const left=art(hero,'leaf-left','element-eucalyptus',[-32,286,158,170,-25]);gardenMotion(left,'sway',.52,6400);
  gardenMotion(art(hero,'rose-right','element-rose',[268,439,120,170,18]),'float',.9,5800);
  art(hero,'wildflower-foot','element-wildflowers',[-24,542,86,123,-19]);
  const photoShadow=sheet(hero,'photo-shadow',[100,314,200,270],'#D7DCC6',0);photoShadow.props.kind='arch';
  // Artwork stays behind the optional photo; a true arch mask prevents capsule seams.
  const shadow=hero.elementIds.indexOf(`${hero.id}-garden-photo-shadow`);if(shadow>=0){hero.elementIds.splice(shadow,1);hero.elementIds.unshift(`${hero.id}-garden-photo-shadow`);}
  const message=byId('scene-message');
  sheet(message,'letter',[18,113,354,610],'#FFF9EE');
  message.flow={version:1,region:{x:32,y:165,width:326,height:440}};
  art(message,'pressed-rose','element-rose',[-17,115,93,130,-20],{opacity:.65});
  gardenMotion(art(message,'leaf-foot','element-eucalyptus',[279,658,134,155,18],{opacity:.7}),'sway',.2,7600);
  const details=byId('scene-details');
  sheet(details,'event-ticket',[20,176,350,259],'#FFF9E8',20);
  piece(details,'garden-layered-flower',[159,162,72,72],true);
  art(details,'leaf-edge','element-eucalyptus',[303,75,95,145,17],{opacity:.72});
  const programme=byId('scene-programme');
  sheet(programme,'agenda',[20,181,350,500],'#FFF9E8');
  piece(programme,'garden-porcelain-cup',[260,92,108,117],true);
  art(programme,'flower-edge','element-wildflowers',[-35,602,117,141,-22]);
  for(let i=0;i<4;i++){
    for(const key of ['time','item']){const e=doc.elements.find(n=>n.id===`programme-${key}-${i}`);e.effects={entrance:{id:'E01',speed:'normal',delay:i<2?150:300}};}
    const dot=doc.elements.find(n=>n.id===`programme-dot-${i}`);dot.layout.width=dot.layout.height=19;dot.layout.x=44;dot.artwork={paths:gardenFlowerPaths()};
  }
  const dress=byId('scene-dress');
  sheet(dress,'style-card',[23,176,344,474],'#FCF5EC',20);
  piece(dress,'garden-watercolor-corner',[243,599,139,107],true);
  const petals=piece(dress,'garden-petal-drift',[12,118,309,81],true);
  for(const [i,e]of petals.entries()){
    Object.assign(e.layout,{x:[29,333,18,341][i],y:[151,267,464,546][i],width:13,height:24});
    delete e.groupId;
  }
  const secret=byId('scene-secret');
  piece(secret,'garden-letter-paper',[83,279,226,280],true);
  const paperText=doc.elements.find(e=>e.id===`${secret.id}-garden-letter-paper-body`);if(paperText){secret.elementIds=secret.elementIds.filter(id=>id!==paperText.id);doc.elements=doc.elements.filter(e=>e.id!==paperText.id);}
  gardenMotion(art(secret,'rose-foot','element-rose',[260,565,115,160,18]),'sway',.18,8200);
  const reply=byId('scene-reply');
  doc.elements.find(e=>e.id==='garden-rsvp').layout.y=24;
  gardenMotion(art(reply,'leaf-top','element-eucalyptus',[-26,0,100,130,-34],{opacity:.55}),'float',.7,6200);
  const outro=byId('scene-outro');
  piece(outro,'garden-tea-tray',[85,92,220,154],true);
  art(outro,'rose-edge','element-rose',[-24,440,118,167,-19]);
  gardenMotion(art(outro,'leaf-edge','element-eucalyptus',[282,590,138,163,22]),'sway',.22,8000);
  for(const scene of doc.scenes){
    const bloom=doc.elements.find(e=>e.id===`${scene.id}-flower`);
    if(bloom){bloom.type='shape';bloom.props={kind:'rectangle',color:'#E1B1AE',radius:0};bloom.artwork={paths:gardenFlowerPaths()};bloom.accessibility={decorative:true};gardenMotion(bloom,'pulse',.25,5900);}
  }
  // Reading takes priority after the opening. Retain the editable artwork and
  // its entrance, then let the scene settle instead of moving while people read.
  for(const scene of doc.scenes.slice(1)){
    delete scene.effects.ambience;
    scene.effects.transition={id:['scene-message','scene-secret','scene-outro'].includes(scene.id)?'T08':'T07',speed:'normal'};
    for(const id of scene.elementIds){
      const e=doc.elements.find(n=>n.id===id);
      if(e.type==='image'&&e.accessibility.label===NATURAL_ARTWORK_LABEL)e.opacity=Math.min(e.opacity??1,.38);
      for(const row of e.motions?.rows||[])row.iterations=e.id.includes('steam')?2:1;
      if(e.id.endsWith('-previous')){Object.assign(e.props,{variant:'text',color:'#66715F'});e.layout.x=0;}
      if(e.type==='button'&&e.id.endsWith('-next')&&e.layout.x===70)e.layout.x=80;
    }
  }
  const removeHero=id=>{hero.elementIds=hero.elementIds.filter(n=>n!==id);doc.elements=doc.elements.filter(e=>e.id!==id);};
  for(const id of ['hero-photo-caption',`${hero.id}-garden-photo-shadow`,`${hero.id}-garden-wildflower-foot`])removeHero(id);
  Object.assign(doc.elements.find(e=>e.id==='hero-sender').layout,{x:45,y:112,width:300,height:36});
  doc.elements.find(e=>e.id==='hero-sender').props.fontSize=17;
  const headline=doc.elements.find(e=>e.id==='hero-title');
  Object.assign(headline.layout,{x:45,y:175,width:300,height:124});headline.props.fontSize=42;
  for(const id of ['scene-invitation-rule-left','scene-invitation-rule-right','scene-invitation-flower']){
    const e=doc.elements.find(n=>n.id===id);e.layout.y+=47;
  }
  const welcome=doc.elements.find(e=>e.id==='hero-welcome');
  Object.assign(welcome.layout,{x:45,y:365,width:300,height:90});Object.assign(welcome.props,{fontSize:19,lineHeight:1.55});
  Object.assign(frame.layout,{x:132,y:485,width:126,height:174});frame.props.strokeWidth=1;
  Object.assign(photo.layout,{x:138,y:491,width:114,height:162});photo.props.placeholder='collapse';
  frame.groupId=photo.groupId=photo.id;
  Object.assign(left.layout,{x:-28,y:102,width:104,height:122});left.opacity=.25;
  const rose=doc.elements.find(e=>e.id===`${hero.id}-garden-rose-right`);
  Object.assign(rose.layout,{x:315,y:362,width:83,height:112});rose.opacity=.25;
  const next=doc.elements.find(e=>e.id==='hero-next');
  Object.assign(next.layout,{x:98,y:710,width:244,height:50});next.props.label=localize('templates.garden-tea.readInvitation');next.accessibility.label=next.props.label;
  Object.assign(doc.elements.find(e=>e.id==='scene-invitation-previous').layout,{x:16,y:710,width:44,height:50});
  for(const scene of doc.scenes.slice(1)){
    const primary=doc.elements.find(e=>scene.elementIds.includes(e.id)&&e.type==='button'&&
      (e.actions.some(a=>a.type==='replay')||e.id==='message-next'||e.id==='secret-rsvp'||e.id.endsWith('-next')));
    const back=doc.elements.find(e=>scene.elementIds.includes(e.id)&&e.id.endsWith('-previous'));
    if(primary){Object.assign(primary.layout,{x:84,y:764,width:282,height:56});Object.assign(primary.props,{placement:'footer',variant:'filled',color:'#934850'});}
    if(back){Object.assign(back.layout,{x:24,y:764,width:48,height:56});Object.assign(back.props,{placement:'footer',variant:'text',color:'#66715F'});}
  }
  return doc;
}
