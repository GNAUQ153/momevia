// Original, redistributable Momevia path drawings. Each call creates a selectable
// physical part; names and personal text never live inside an illustration.
import { eventRecipe } from './event-recipes.js';
import { NATURAL_MEDIA_IDS } from './natural-media.js';
import { NATURAL_ARTWORK_LABEL } from './event-media.js';

export function refreshArt(doc, api, scene, prefix, box, palette, state = 'closed') {
  const { add, shape, line } = api, p = palette;
  const [ox,oy,bw,bh] = box;
  const naturalId=NATURAL_MEDIA_IDS[state==='closed'&&p.templateId==='midnight-bloom'&&NATURAL_MEDIA_IDS['midnight-bloom-bud']?'midnight-bloom-bud':state==='open'&&NATURAL_MEDIA_IDS[p.templateId+'-open']?p.templateId+'-open':p.templateId];
  if(naturalId){
    if(!doc.assets.some(a=>a.assetId===naturalId))doc.assets.push({assetId:naturalId,kind:'image'});
    const image=add(scene,'image',`${prefix}-natural-art`,[ox,oy,bw,bh],{assetId:naturalId,fit:'contain',radius:0},{name:p.name,accessibility:{decorative:true,label:NATURAL_ARTWORK_LABEL}});
    return {image};
  }
  const b = (x,y,w,h,r=0) => [ox+x*bw/100,oy+y*bh/100,w*bw/100,h*bh/100,r];
  let n=0;
  const key=name=>name.toLowerCase().replace(/[^a-z0-9_-]+/g,'-');
  const path = (d,fill='color',stroke,strokeWidth) => ({d,fill,...(stroke?{stroke,strokeWidth:strokeWidth??1}:{})});
  const v = (name, paths, color=p.accent, area=[0,0,100,100]) => {
    const first=paths.findIndex(part=>/^#[0-9a-f]{6}$/i.test(part.fill));
    if(first>=0){color=paths[first].fill;paths=paths.map((part,i)=>i===first?{...part,fill:'color'}:part);}
    return add(scene,'shape',`${prefix}-${key(name)}`,b(...area),
      {kind:`refresh-v1-${key(name)}`,color,radius:0},{name,artwork:{paths}});
  };
  const r = (name,x,y,w,h,color,rad=2,rotation=0) => {
    const e=shape(scene,`${prefix}-${key(name)}`,b(x,y,w,h,rotation),color,'rectangle',{radius:rad*bw/100});e.name=name;return e;
  };
  const e = (name,x,y,w,h,color,opacity=1) => {
    const node=shape(scene,`${prefix}-${key(name)}`,b(x,y,w,h),color);node.name=name;node.opacity=opacity;return node;
  };
  const l = (name,x,y,w,rotation,color,width=1) => line(scene,`${prefix}-${key(name)}`,b(x,y,w,.3,rotation),color,width);
  const shadow=(x=12,y=87,w=78,h=6)=>{const node=e('Contact shadow',x,y,w,h,'#352B30',.24);node.effects={surface:eventRecipe('contact-shadow-v1')};};
  const paper = node => {node.effects={surface:eventRecipe('cotton-paper-v2')};return node;};
  const lifted = node => {node.effects={surface:eventRecipe('paper-shadow-v2')};return node;};
  const sprig=(x,y,s=1,color='#547360')=>v(`Leaf sprig ${n++}`, [
    path('M50 98Q49 55 57 6','none',color,1.1),
    path('M52 76C19 75 12 56 17 52 39 49 50 58 52 76ZM52 58C79 58 91 39 85 33 67 32 55 45 52 58ZM54 39C29 38 21 20 27 17 44 14 54 23 54 39ZM56 24C76 21 82 8 75 3 60 5 56 12 56 24Z',color),
    path('M50 75 23 57M53 57 80 39M53 37 32 22','none','#8DA78B',.55),
  ],color,[x,y,22*s,53*s]);
  const bloom=(x,y,s=1,color='#E4B5BA')=>v(`Flower ${n++}`,[
    path('M50 50C-9 24 14-6 43 27 28-20 79-8 64 30 91 0 116 42 71 49 118 62 78 102 61 67 63 112 16 105 31 66-5 89-17 42 25 44Z',color),
    path('M50 35C74 35 73 65 50 65 27 65 27 35 50 35Z','#D7A854'),
    path('M47 43 54 48 46 55M52 39 59 45','none','#FFF4DC',1.5),
  ],color,[x,y,25*s,25*s]);
  switch(p.object) {
  case 'train-window':
    shadow(3,91,95,6);
    v('Walnut window frame',[path('M2 2H98V85H2Z','#684639'),path('M6 5H94V79H6Z','#C39A78'),path('M9 8H91V76H9Z','#7C5746'),path('M12 10H88V73H12Z','#DDA78B')]);
    v('Sunset sky',[path('M12 10H88V49H12Z','#CA8E8D'),path('M12 28H88V52H12Z','#E8B895'),path('M12 45H88V73H12Z','#8F9295'),path('M12 48Q36 44 62 49T88 48V73H12Z','#7E868E'),path('M43 49A12 12 0 1 1 67 49Z','#FFE7B5'),path('M49 52H65L61 54H48ZM44 58H69V59H44ZM41 64H72V65H41Z','#D4BBA4')]);
    v('Glass edge reflection',[path('M14 13H17V69H14ZM19 13H20V39H19Z','#FDE9D4'),path('M73 12 85 12 53 72H48Z','#DBB5A2')]).opacity=.42;
    paper(r('Wooden sill',0,80,100,12,'#A27455',1));
    v('Wood grain',[path('M3 84H96M5 89Q41 86 72 89T96 89','none','#6D4839',.5)]);
    r('Brass window latch',85,47,9,6,'#BE9D66',1);r('Latch edge highlight',86,47,7,.8,'#F7DA9B',0);
    lifted(paper(r('Ticket on sill',12,78,63,21,'#FFF1D4',1,-4)));
    v('Ticket perforation',[path('M64 81V96','none','#B59E7C',.6)]);
    break;
  case 'drawer':
    shadow(10,82,84,8);
    v('Kraft sleeve',[path('M8 22 72 10 96 30 33 44Z','#C7A77C'),path('M8 22 33 44V80L8 60Z','#98754E'),path('M33 44 96 30V66L33 80Z','#765737'),path('M36 48 92 36V63L36 75Z','#3E3328')]);
    v('Open drawer',[path(state==='open'?'M21 52 84 39 99 54 38 71Z':'M35 48 92 35 94 62 37 76Z','#D3B68D'),path(state==='open'?'M38 71 99 54V76L38 93Z':'M37 57 94 43V68L37 82Z','#B38E61'),path(state==='open'?'M21 52 38 71V93L21 76Z':'M35 48 37 57V82L35 74Z','#8A663F'),path('M40 62 89 50','none','#E9D5B6',.8)]);
    lifted(v('Woven pull loop',[path('M58 74C42 78 49 96 63 91L69 79 63 77C57 89 51 89 54 82Z','#668873'),path('M55 78C47 90 55 94 61 88','none','#A9BC9D',.7),path('M57 78 54 85M59 78 56 88M61 79 59 88','none','#456553',.35)]));
    v('Sleeve embossed border',[path('M13 24 71 14 90 30M12 27 29 44V68','none','#E0C8A4',.65)]);
    break;
  case 'snow-globe':
    shadow(10,89,82,6);
    v('Glass globe',[path('M50 4C-3 4-6 67 22 78H78C106 67 103 4 50 4Z','#436C69'),path('M50 7C5 7 1 61 24 75H76C100 61 95 7 50 7Z','#315B59'),path('M20 62Q48 44 82 65L75 76H25Z','#D4E0D6'),path('M24 68Q53 58 78 69L73 78H29Z','#F3F0DF')]);
    v('Tiny warm winter house',[path('M34 48H67V70H34Z','#B38B6B'),path('M28 48 50 29 73 48Z','#F6EFE0'),path('M33 47 50 34 68 47Z','#745D53'),path('M46 53H57V70H46Z','#F2BD70'),path('M38 53H43V60H38ZM61 52H65V59H61Z','#FFE1A1'),path('M61 30H66V41H61Z','#8C7568')]);
    v('Glass highlight arcs',[path('M17 45C11 23 28 10 44 10','none','#E2F0E7',2),path('M19 48 20 54M78 18C94 35 91 56 80 65','none','#A1C6BF',.8)]);
    v('Foreground and distant snow',[path('M25 22h1v1h-1ZM58 16h1v1h-1ZM70 30h1v1h-1ZM29 46h1v1h-1ZM77 52h1v1h-1ZM52 25h1v1h-1Z','#B5CDCA'),path('M26 34h2v2h-2ZM72 44h2v2h-2ZM58 68h2v2h-2ZM42 20h2v2h-2ZM32 59h2v2h-2Z','#FFF9E8')]);
    v('Turned walnut base',[path('M22 77H78L85 87H15Z','#82583E'),path('M15 87H85V92H15Z','#523C30'),path('M23 79H77V82H23Z','#BE966C'),path('M20 86Q50 82 81 86','none','#A67C52',.7)]);
    break;
  case 'camera':
    shadow(9,77,80,7);
    v('Instant camera body',[path('M12 13H80L94 33V64H8V32Z','#554C48'),path('M15 16H77L86 33H11Z','#B9AD96'),path('M9 35H92V62H9Z','#807C70'),path('M15 43H85V59H15Z','#3F4543'),path('M19 64H80V71H19Z','#2C3330'),path('M20 67H79V68H20Z','#D2C4A9')]);
    v('Camera lens',[path('M51 23a18 18 0 1 0 0 36 18 18 0 1 0 0-36Z','#353B37'),path('M51 27a14 14 0 1 0 0 28 14 14 0 1 0 0-28Z','#B6AB8E'),path('M51 30a11 11 0 1 0 0 22 11 11 0 1 0 0-22Z','#263E3D'),path('M44 34Q47 29 53 33L48 38Z','#8DA5A0'),path('M59 45 56 49','none','#718D89',1)]);
    r('Flash',18,20,17,10,'#F0E7D2',1);r('Shutter',76,40,8,8,'#C07E5D',2);
    lifted(paper(r('Satin photo strip',31,64,41,35,'#FFFAED',.8,-6)));
    v('Default still life in strip',[path('M35 69H65V89H35Z','#899C91'),path('M35 81H65V89H35Z','#BBA58B'),path('M47 78H56L55 86H48Z','#E5D3B2'),path('M51 79V70M51 74 45 70M51 76 59 72','none','#405E49',1),path('M40 70 41 70 41 87 40 87Z','#D0D8CD')]);
    break;
  case 'paper-lamp':
    shadow(23,91,59,5);
    if(state==='open')v('Lamp cast light',[path('M35 25 80 22 100 91H3Z','#EBD1A6')]).opacity=.32;
    r('Beech lamp foot',29,86,47,7,'#9B7958',4);r('Lamp stem',51,54,3,34,'#765B43',0);
    v('Translucent pleated shade',[path('M31 17Q53 7 75 17L85 58Q53 72 21 58Z','#D8C5A0'),path('M36 18Q54 12 69 18L77 59Q53 66 29 59Z',state==='open'?'#F6E6BB':'#DDD4BA'),path('M41 17 37 61M49 15 47 64M59 15 60 64M67 18 73 61','none','#B59C77',.6),path('M31 17Q53 25 75 17M21 58Q52 47 85 58','none','#9D825F',.7)]);
    v('Pull switch cord',[path('M75 60V84','none','#6B6656',.7),path('M73 81H77V88H73Z','#BA965C')]);
    break;
  case 'cloud-theatre':
    shadow(3,90,93,5);
    for(const [i,[x,y,c]] of [[0,[9,13,'#AAC3CD']],[1,[0,39,'#D0DDE0']],[2,[13,65,'#F7F8F0']]]) {
      lifted(v(`Paper cloud tier ${i+1}`,[path('M3 42C-5 28 7 18 22 21 18-3 55-8 62 17 78 4 104 22 96 42L88 61H10Z',c),path('M8 44Q50 53 92 44','none','#FFFFFF',.6)],c,[x,y,88,32]));
    }
    v('Thin ladder',[path('M38 45 28 92M48 45 38 92M37 51 47 51M35 60 45 60M33 69 43 69M31 78 41 78M29 87 39 87','none','#B89D70',1)]);
    break;
  case 'party-popper':
    shadow(5,87,90,5);
    v('Diagonal cardboard popper',[path('M18 76 60 24 82 40 41 94Z','#A65054'),path('M18 76 28 65 51 81 41 94Z','#E0B487'),path('M24 70 65 25 73 31 32 77Z','#D88478'),path('M59 26Q73 17 83 39L77 44Z','#5B3F46'),path('M64 27 80 39','none','#F2CBB1',1),path('M36 63 43 67M42 54 49 58M49 45 56 49','none','#EBC794',2)]);
    v('Pull cord',[path('M21 79Q4 85 9 98','none','#806B5A',1),path('M6 94H13V99H6Z','#E4B96E')]);
    for(let i=0;i<8;i++) r(`Foil fragment ${i}`,36+i*7,6+(i*19)%31,1.5,5,['#A7785A','#C88079','#698D92'][i%3],0,i*23-60);
    v('Curled paper streamer',[path('M70 30C98 13 71-3 63 7S91 15 93 2','none','#CE9D6C',1),path('M61 22Q38 9 51 1','none','#839FA0',1)]);
    break;
  case 'flip-clock':
    shadow(4,75,92,9);
    v('Mechanical clock casing',[path('M3 20H97V75H3Z','#343D42'),path('M6 23H94V70H6Z','#18252C'),path('M9 26H91V66H9Z','#E6D6B6'),path('M11 28H89V64H11Z','#202B31'),path('M3 20H97V23H3Z','#7A8481'),path('M3 73H97V77H3Z','#101D24')]);
    for(let i=0;i<4;i++) {
      const x=14+i*18;
      r(`Clock leaf ${i}`,x,30,15,32,'#152129',.8);
      v(`Clock digit ${i}`,[path(state==='open'?'M25 10H75V90H25ZM38 23V77H62V23Z':i===0?'M25 15H75V45L38 75H75V88H24V73L61 38V28H25Z':i===1?'M25 13H75V88H25V75H62V55H36V43H62V26H25Z':i===2?'M74 13V26H39V43H73V88H25V75H60V56H25V13Z':'M25 13H75V88H61V56H25ZM39 26V43H61V26Z','#EDE4D1')],p.ink,[x+3,34,9,22]);
      r(`Steel hinge ${i}`,x,45,15,1.2,'#9EACA8',0);
    }
    r('Clock side switch',94,38,6,17,'#B9A471',1);
    break;
  case 'tea-tray':
    shadow(2,86,96,7);
    v('Lacquer tea tray',[path('M50 3C-14 3-14 95 50 95S114 3 50 3Z','#644231'),path('M50 6C-8 6-8 91 50 91S108 6 50 6Z','#BD8A55'),path('M50 10C0 10 0 86 50 86S100 10 50 10Z','#8C573E'),path('M15 34Q25 11 51 13','none','#D9B57C',.8)]);
    v('Porcelain tea cup',[path('M26 23a19 19 0 1 0 0 38 19 19 0 1 0 0-38Z','#C8C8AD'),path('M26 25a17 17 0 1 0 0 34 17 17 0 1 0 0-34Z','#F4E9CA'),path('M26 29a13 13 0 1 0 0 26 13 13 0 1 0 0-26Z','#6B482F'),path('M26 31a11 11 0 1 0 0 22 11 11 0 1 0 0-22Z','#B88C4E'),path('M17 34Q22 29 28 31','none','#FFE9B9',1.5)]);
    lifted(v('Red gift envelope',[path('M58 42 90 47 82 90 50 85Z','#8D2737'),path('M59 44 88 49 82 60 58 56Z','#B84045'),path('M69 59 78 67 68 78 61 69Z','#D4AC60'),path('M70 63 73 67 67 73','none','#F3D68A',1)]));
    sprig(24,53,.7,'#4E6D4B');bloom(20,62,.55,'#E4C27A');
    break;
  case 'velvet-case':
    shadow(4,80,94,8);
    v('Velvet box depth',[path('M6 28 83 17 98 39 20 52Z','#914859'),path('M6 28 20 52V83L6 64Z','#532535'),path('M20 52 98 39V73L20 86Z','#4A2030'),path('M24 54 94 43V70L24 81Z','#6D3043'),path('M9 29 83 19 94 36','none','#BC7882',.6)]);
    if(state==='open') v('Open satin lining',[path('M10 19 82 7 91 34 20 48Z','#F0D2C0'),path('M21 52 94 40 93 69 23 79Z','#E3C5B2'),path('M24 59Q59 43 92 48L24 70Z','#FCEAD9'),path('M23 76Q54 60 92 62','none','#BFA193',.8)]);
    v('Velvet nap',[path(Array.from({length:22},(_,i)=>`M${24+i*3} ${54-i*.5}l0 20`).join(' '),'none','#BC7A88',.13)]).opacity=.28;
    v('Brass box clasp',[path('M53 45 65 43V59L53 61Z','#A9844C'),path('M54 46 64 45V49L54 51Z','#F1D39A'),path('M57 51H61V56H57Z','#6D4F31')]);
    v('Silk ribbon end',[path('M76 74Q82 90 72 99L88 97Q91 87 85 73Z','#BB7B87'),path('M80 77Q85 87 80 97','none','#E4B8BC',1)]);
    break;
  case 'glass-house':
    shadow(4,88,93,6);
    v('Greenhouse glass walls',[path('M8 34 46 6 90 26 94 83 52 96 9 80Z','#B3C9BB'),path('M12 36 45 12 49 89 13 77Z','#D4DFCB'),path('M49 13 86 29 90 79 53 90Z','#96B7A5'),path('M14 42 40 21V28L14 50ZM59 24 63 26 86 65 86 72Z','#E9F1DC')]);
    v('Greenhouse metal mullions',[path('M8 34 46 6 90 26 94 83 52 96 9 80ZM8 34 52 53 90 26M46 6 52 96M9 80 52 63 94 83M28 20 32 88M70 17 74 89','none','#476856',1)]);
    sprig(10,40,.8);sprig(58,35,.9);r('Terracotta pot',61,69,15,18,'#AB7654',1);
    v('Hinged greenhouse door',[path('M45 47 64 44 65 87 48 95Z',state==='open'?'#D7E4CB':'#A9C4AF','#456650',.8),path('M60 65H62V72H60Z','#C7A365')]);
    break;
  case 'kintsugi-bowl':
    shadow(5,84,89,6);
    v('Ceramic bowl',[path('M5 37Q48 8 95 37L84 73Q52 96 18 73Z','#9EABA5'),path('M9 39Q52 67 91 39L81 71Q52 88 21 70Z','#C5CCC0'),path('M5 37C5 7 95 7 95 37S5 67 5 37Z','#DDE0D0'),path('M10 36C10 13 90 13 90 36S10 59 10 36Z','#94A49B'),path('M15 33C26 16 70 16 83 31Q51 45 15 33Z','#B8C4B7'),path('M22 64Q38 78 57 76','none','#EDF0DC',1.5)]);
    v('Golden repair seam',[path('M55 15 49 30 58 42 47 53 51 73 43 82M49 30 30 28M58 42 71 42 77 49','none','#B68C41',1.8),path('M55 15 50 30 59 42 48 53 52 72','none','#F0D393',.5)]);
    v('Glaze crazing',[path('M19 35 27 37 29 43M73 21 69 27 76 31M23 64 28 57 37 59M65 70 70 61 81 59','none','#A9B5A8',.35)]);
    break;
  case 'airmail':
    shadow(1,80,96,5);
    lifted(v('Airmail envelope',[path('M0 24 91 15 100 76 8 86Z','#EADCC5'),path('M3 27 89 19 96 74 10 81Z','#FFFAE9'),path('M0 24 51 52 91 15Z','#E3D5BD'),path('M9 82 39 51M96 74 64 49','none','#C4B295',.55)]));
    v('Airmail edge stripes',[path('M3 25 9 24 7 31 2 31ZM18 23 24 22 22 28 16 29ZM33 21 39 20 37 27 31 27ZM7 77 13 76 11 83 8 83ZM23 75 29 74 27 81 21 82Z','#B96261'),path('M11 24 17 23 15 30 9 30ZM26 22 32 21 30 28 24 28ZM39 78 45 77 43 84 37 84ZM54 77 60 76 58 83 52 83Z','#668899')]);
    v('Perforated postage stamp',[path('M69 26H86V46H69Z','#EFE6D0'),path('M71 28H84V44H71Z','#668E7A'),path('M73 40 78 31 82 40Z','#D8D7B3'),path('M68 28H70M68 32H70M68 36H70M68 40H70M68 44H70M85 28H87M85 32H87M85 36H87M85 40H87','none','#B5A98B',.5)]);
    v('Postmark',[path('M68 49a9 9 0 1 0 0 18 9 9 0 1 0 0-18ZM77 50Q86 46 94 49M77 54Q86 50 94 53M77 58Q86 54 94 57','none','#8E8373',.5)]);
    break;
  case 'paper-flight':
    v('Two city skylines',[path('M0 25H6V13H14V25H19V6H25V25H30V18H36V32H0Z','#9DAFAE'),path('M67 81H73V69H79V61H84V77H89V67H95V79H100V92H67Z','#6B8C93'),path('M4 15H6V17H4ZM21 10H23V12H21ZM76 72H78V74H76ZM91 72H93V74H91Z','#EBE3B5')]);
    v('Flight ink route',[path('M10 36C-8 80 79 8 90 39S56 91 94 95','none','#7E9A9F',.7)]);
    lifted(v('Folded paper plane',[path('M12 44 92 19 58 78 46 55Z','#FDF8E8'),path('M12 44 46 55 92 19Z','#D1DCD5'),path('M46 55 49 71 59 62Z','#829B99'),path('M46 55 92 19 54 58 58 78Z','#E5EADF'),path('M54 58 58 75','none','#FFFFFF',.65)]));
    break;
  case 'herbarium':
    shadow(4,89,94,6);
    v('Pressed flower notebook',[path('M9 7 88 12 95 93 13 89Z','#70617B'),path('M14 7 85 10 91 89 17 86Z','#D1C3AE'),path('M18 7 84 10 88 86 20 84Z','#EEE5D0'),path('M21 10 81 12 85 82 23 80Z','#F7F0DC'),path('M13 9 16 86','none','#493E51',1),path('M19 11 21 82','none','#B5A88F',.5)]);
    v('Linen book tie',[path('M4 61 96 68 96 76 4 69Z','#B8A68D'),path('M4 63 96 70M4 66 96 73','none','#DACBB0',.45)]);
    for(let i=0;i<3;i++) {
      const x=42+i*11;
      v(`Pressed lavender ${i}`,[path(`M${x} 76Q${x-7} 51 ${x+4} 23`,'none','#74826A',.65),path(`M${x+1} 22q-9-3-3-7 7-3 7 4 8-4 8 2-1 6-8 4-4 8-8 3Z`,'#99829C'),path(`M${x-1} 35q-7-3-3-6 6-2 6 3 7-3 7 2-1 5-6 3-4 6-7 2Z`,'#B1A0B5')]);
    }
    break;
  case 'desk-frame':
    shadow(3,92,94,5);
    v('Oak standing frame',[path('M7 9 87 4 95 87 14 95Z','#755843'),path('M10 10 85 7 91 84 17 91Z','#C4A27A'),path('M17 17 79 14 84 77 22 83Z','#684B37'),path('M20 19 77 17 81 74 25 79Z','#C8D3C2'),path('M16 88 90 81 91 84 17 91Z','#E3C9A3'),path('M86 36 99 94H95L86 65Z','#715340')]);
    break;
  case 'epiphyllum':
    v('Night garden leaves',[path('M82 99C39 67 92 61 79 28 105 50 95 70 82 99ZM80 97C48 95 31 83 38 70 64 62 69 83 80 97Z','#2D4A43'),path('M81 98Q72 62 86 28','none','#627361',.7)]);
    if(state==='closed'){
      v('Night flower outer petals',[path('M68 69C42 47 49 20 66 7 80 17 91 48 68 69Z','#A59BA9'),path('M68 65C56 45 56 20 66 9 74 31 80 50 68 65Z','#DDD5CB'),path('M67 65Q63 34 66 9','none','#FFF0D2',.6)]);
      v('Fine illuminated petal edges',[path('M66 7Q87 34 68 69','none','#FFF1D3',.65)]);
    }else{
      v('Night flower outer petals',[path('M60 62C31 48 17 27 34 20 41 37 47 40 58 43 32 19 49 2 55 9L67 39C61 13 75 0 80 12L77 40C98 15 107 30 96 42L78 55 88 72 69 69Z','#998DA8'),path('M61 59C39 47 29 29 38 25 48 42 56 42 64 46L58 16 70 43 79 20 74 51 94 36 77 60Z','#D8CECD'),path('M66 58C46 48 42 35 48 34L67 48 66 24 73 49 84 36 77 59Z','#F3EAD8')]);
      v('Fine illuminated petal edges',[path('M34 20Q39 38 58 43M55 9 67 39M80 12 77 40M96 31 78 55','none','#FFF1D3',.65),path('M68 52 76 64M66 53 66 66M70 50 83 56','none','#E6C779',.5)]);
    }
    break;
  case 'bicycle':
    v('Spoke shadows',[path('M0 87 33 97 73 90 100 97M20 89 41 94M70 90 89 95','none','#B5A685',1)]).opacity=.3;
    v('Bicycle wheels',[path('M23 56a20 20 0 1 0 0 40 20 20 0 1 0 0-40ZM79 56a20 20 0 1 0 0 40 20 20 0 1 0 0-40Z','none','#645E4D',1.6),path('M23 58V94M5 76H41M10 63 36 89M10 89 36 63M79 58V94M61 76H97M66 63 92 89M66 89 92 63','none','#9B9981',.45)]);
    v('Enamel yellow bicycle frame',[path('M23 76 39 43 57 76H23L73 43 79 76M39 43H73M39 43 34 34M73 43 69 27 80 22','none','#CA9D3D',2.5),path('M24 75 39 45 56 75M40 43H70','none','#F8DD83',.6),path('M31 33H43M51 78H62','none','#5E5746',2)]);
    v('Wicker bicycle basket',[path('M75 25H99L95 44H79Z','#B58D5E'),path('M79 29H97M80 33H96M81 37H95M82 41H94M82 26 85 44M88 26 90 44M94 26 94 44','none','#DBC39A',.5)]);
    v('Brass bicycle bell',[path('M68 24C65 13 78 11 79 23Z','#CBA961'),path('M70 19Q73 15 76 18','none','#FFF1BA',.8),path('M79 23H82V25H78Z','#735D38')]);
    sprig(77,4,.5);bloom(79,5,.45,'#D9AE83');
    break;
  case 'orrery':
    shadow(3,87,95,5);
    v('Brass astronomical disk',[path('M50 4a44 44 0 1 0 0 88 44 44 0 1 0 0-88Z','#AD8D52'),path('M50 7a41 41 0 1 0 0 82 41 41 0 1 0 0-82Z','#D0B16F'),path('M50 10a38 38 0 1 0 0 76 38 38 0 1 0 0-76Z','#23394B'),path('M50 18a30 30 0 1 0 0 60 30 30 0 1 0 0-60Z','none','#879176',.5),path('M50 29a19 19 0 1 0 0 38 19 19 0 1 0 0-38Z','none','#879176',.4)]);
    v('Engraved star route',[path('M27 30 41 27 61 44 68 64 46 72 27 30M41 27 46 72','none','#BEC09A',.5),path('M50 12V16M50 80V84M14 48H18M82 48H86','none','#F0D79D',.65)]);
    for(let i=0;i<3;i++)e(`Star ${i}`,25+i*18,29+i*17,2,2,'#F2DFAD');
    v('Offset copper axis',[path('M62 57V90H68V57Z','#8E653D'),path('M63 58V89H65V58H63Z','#DBB77B'),path('M61 54a6 6 0 1 0 12 0 6 6 0 1 0-12 0Z','#DBB77B'),path('M65 50H68V57H65Z','#F7DE9E')]);
    break;
  case 'peach-bag':
    shadow(10,89,83,6);
    v('Folded kraft fruit bag',[path('M12 32 77 25 94 87 28 98Z','#AD8359'),path('M12 32 22 28 83 23 78 35 18 42Z','#D6B78D'),path('M18 42 78 35 88 86 29 93Z','#C3A076'),path('M29 45 37 87M75 40 80 80M30 90 83 83','none','#9D754D',.55)]);
    v('Velvety peach',[path('M50 14C21-3 9 27 27 51 34 61 54 66 67 56 98 36 79-4 50 14Z','#DBA18A'),path('M50 15C34 9 20 17 25 35 29 50 45 54 51 51 65 40 67 26 50 15Z','#EAB99A'),path('M54 16Q66 29 55 53','none','#BB7E70',.6),path('M46 17Q31 9 26 16','none','#F7D9B5',.8),path('M49 14C47 1 61 1 67 4Q65 15 49 14Z','#6B8154'),path('M51 13 62 6','none','#A1AE7A',.5)]);
    v('Coated round fruit label',[path('M58 36a11 11 0 1 0 0 22 11 11 0 1 0 0-22Z','#F6EDD4'),path('M51 42Q56 37 63 40','none','#FFFFFF',1.1),path('M53 47 58 52 65 44','none','#A98B64',.65)]);
    break;
  case 'florist-bouquet':
    shadow(1,81,98,6);
    v('Matte bouquet wrapper',[path('M3 33 36 11 91 53 66 86Z','#C8B18B'),path('M3 33 34 26 69 78 66 86Z','#E5D6B7'),path('M36 11 43 39 91 53 75 63Z','#B6A078'),path('M43 39 70 71','none','#F5E7CB',.6)]);
    for(let i=0;i<3;i++) sprig(30+i*12,6+i*8,.9,['#476E53','#70895E','#527854'][i]);
    bloom(19,11,.95,'#D4A09A');bloom(44,7,1.1,'#E2C19B');bloom(32,34,.85,'#DBC5B4');
    v('Bouquet stems and jute binding',[path('M52 52 91 87M56 50 94 81M49 57 86 91','none','#527550',1.4),path('M64 65 72 60M66 68 75 62M68 70 77 64','none','#C9AE80',.9),path('M72 64C56 48 51 68 70 69 88 79 91 60 72 64ZM72 66Q62 82 69 91M74 67 83 82','none','#A88B5F',.6)]);
    break;
  }
  return {v,r,e,l,paper,lifted,sprig,bloom,path,b};
}
