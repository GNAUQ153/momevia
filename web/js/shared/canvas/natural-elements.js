import {motionRow} from './motion-stack.js';
import {createElement} from './registry.js';
import {NATURAL_MEDIA_IDS,NATURAL_MEDIA} from './natural-media.js';
import {NATURAL_ARTWORK_LABEL} from './event-media.js';
import {eventRecipe} from './event-recipes.js';
import {openVectorCards,OPEN_VECTOR_IDS} from './open-source-elements.js';
import {naturalMotion} from './natural-motion.js';
import {reviseNaturalMotion} from './natural-motion-revision.js';

export const NATURAL_ELEMENT_SPECS=[
 ['open-kit-alocasia','graphics','Trầu bà vẽ tay','Hand-drawn alocasia','cây lá Kitbitz CC0 alocasia'],
 ['open-kit-bush','graphics','Bụi lá mềm','A soft leafy bush','cây lá Kitbitz CC0 bush'],
 ['open-kit-pine','graphics','Thông rừng vẽ tay','Hand-drawn forest pine','cây thông Kitbitz CC0 pine'],
 ['open-kit-mushrooms','graphics','Nấm rừng nhỏ','Little forest mushrooms','nấm rừng Kitbitz CC0 mushroom'],
 ['open-kit-cloud','graphics','Mây bồng vẽ tay','Hand-drawn billowing cloud','mây Kitbitz CC0 cloud'],
 ['open-kit-stones','graphics','Đá xếp cân bằng','Balanced stones','đá Kitbitz CC0 stone'],
 ['open-branch-flowers','graphics','Cành hoa mềm','Flowering branch','cành hoa Openclipart Almeidah CC0'],
 ['open-vintage-flower','graphics','Hoa nét mực cổ điển','Vintage ink blossom','hoa cổ điển Openclipart CC0 ink'],
 ['open-repo-flower','graphics','Hoa nét cong','Curving flower','hoa SVG Repo CC0 flower'],
 ['open-repo-leaf','graphics','Lá gân mảnh','Delicate leaf veins','lá SVG Repo CC0 leaf'],
 ['lavender','graphics','Oải hương ép','Pressed lavender','hoa ép lavender khô pressed flower'],
 ['eucalyptus','graphics','Lá bạch đàn màu nước','Watercolor eucalyptus','lá cành botanical watercolor'],
 ['rose','graphics','Hồng vẽ tay','Hand-painted rose','hoa hồng phác sketchy flower watercolor'],
 ['wildflowers','graphics','Hoa đồng nội','Meadow wildflowers','hoa cỏ botanical wildflower'],
 ['pampas','graphics','Cỏ lau khô','Dried pampas','cỏ lau hoa khô tự nhiên pampas'],
 ['fern','graphics','Dương xỉ ép','Pressed fern','lá dương xỉ botanical leaf fern'],
 ['paper-cotton','materials','Giấy bông xé mép','Deckled cotton paper','giấy xé cotton paper torn texture'],
 ['paper-kraft','materials','Giấy kraft gấp','Folded kraft paper','giấy kraft brown paper folded'],
 ['washi-tape','materials','Băng dính giấy','Washi paper tape','băng dính washi tape scrapbook'],
 ['linen-ribbon','materials','Dây lanh thắt nút','Knotted linen ribbon','vải lanh dây linen ribbon thread'],
 ['wax-seal','materials','Dấu sáp tự nhiên','Hand-poured wax seal','con dấu sáp wax seal stamp'],
 ['satin-bow','materials','Nơ lụa mềm','Soft satin bow','nơ ruy băng lụa satin bow ribbon'],
 ...[['gift','Hộp quà','Gift'],['heart','Trái tim','Heart'],['star','Ngôi sao','Star'],['camera','Máy ảnh','Camera'],['moon','Mặt trăng','Moon'],['cup','Cúp','Trophy'],['notebook','Sổ tay','Notebook'],['clock','Đồng hồ','Clock']].map(([id,vi,en])=>['3d-'+id,'three-d',vi+' 3D',en+' 3D','3D khối '+vi+' '+en]),
 ['motion-heart','animation','Tim đập nhẹ','A gentle heartbeat','tim animation chuyển động','element-3d-heart','A01'],
 ['motion-star','animation','Sao nghiêng nhẹ','Gently tilting star','sao 3D animation chuyển động Sao nghiêng theo sáng A star catches the light','element-3d-star','keepsake-sway-v1'],
 ['motion-gift','animation','Quà xuất hiện','A gift arrives','hộp quà 3D animation','element-3d-gift','E02'],
 ['motion-leaf','animation','Cành lá đung đưa','A swaying branch','lá botanical animation','element-eucalyptus','keepsake-sway-v1'],
 ['motion-ribbon','animation','Nơ lụa đung đưa','Swaying satin ribbon','nơ lụa animation','element-satin-bow','keepsake-sway-v1'],
 ['motion-paper','animation','Giấy mở vào cảnh','Paper turns into view','giấy lật mở 3D animation','element-paper-cotton','paper-unfold-natural-v1'],
];

export function naturalElementCards(kind,translate){
 return NATURAL_ELEMENT_SPECS.filter(spec=>spec[1]===kind&&NATURAL_MEDIA_IDS[spec[5]||'element-'+spec[0]]).map(spec=>{
  const [id,,vi,,keywords,assetKey,effect]=spec;
  return {id:'natural-'+id,title:translate?.(`editor.library.item.natural-${id}`)||vi,visualKind:kind==='materials'?'graphics':kind,keywords,create:()=>{
   const assetId=NATURAL_MEDIA_IDS[assetKey||'element-'+id],media=NATURAL_MEDIA[assetId],size=kind==='three-d'?220:300,scale=Math.min(size/media.width,size/media.height);
   const model=createElement('image',{name:vi,layout:{x:0,y:0,width:Math.round(media.width*scale),height:Math.round(media.height*scale)},props:{assetId,fit:'contain',radius:0},accessibility:{decorative:true,label:NATURAL_ARTWORK_LABEL}});
   if(kind==='animation'&&id==='motion-heart')model.motions={version:1,enabled:true,rows:[motionRow('pulse','heart-beat'),motionRow('spin','heart-spin')]};
   else if(kind==='animation')model.effects={emphasis:naturalMotion(id,spec[2],spec[3])};
   else if(effect){const family=effect==='E02'||effect==='paper-unfold-natural-v1'?'entrance':'emphasis';model.effects={[family]:effect.includes('-v')?eventRecipe(effect):{id:effect,speed:'normal',...(family==='entrance'?{delay:0}:{})}};}
   if(kind==='animation')reviseNaturalMotion(model,id);
   return [model];
  }};
 });
}

export const NATURAL_COMPOSITION_IDS=['natural-foldout-note','natural-photo-frame',...OPEN_VECTOR_IDS];
export function naturalCompositionCards(translate){
 const result=openVectorCards(translate);
 if(NATURAL_MEDIA_IDS['element-paper-cotton'])result.push({id:'natural-foldout-note',title:translate('editor.library.item.natural-foldout-note'),visualKind:'interactive',keywords:'thư nhiều nếp giấy foldout letter paper interactive',create:()=>[
  createElement('image',{name:translate('editor.library.item.natural-paper-cotton'),layout:{x:0,y:0,width:320,height:430},props:{assetId:NATURAL_MEDIA_IDS['element-paper-cotton'],fit:'cover',radius:0},accessibility:{decorative:true,label:NATURAL_ARTWORK_LABEL}}),
  createElement('interaction',{name:translate('editor.library.item.natural-foldout-note'),layout:{x:18,y:54,width:284,height:318},props:{kind:'foldout-letter',appearance:'paper-fold-v2',color:'#FAF0DC',entries:[1,2,3].map(i=>({heading:translate('interactive.milestone'+i),body:translate('interactive.proudFold'+i)}))},effects:{surface:eventRecipe('cotton-paper-v2')}}),
 ]});
 const frameId=NATURAL_MEDIA_IDS['mot-ky-niem'],stilllife=NATURAL_MEDIA_IDS['default-stilllife'];
 if(frameId&&stilllife&&NATURAL_MEDIA[frameId].aperture)result.push({id:'natural-photo-frame',title:translate('editor.library.item.natural-photo-frame'),visualKind:'photos',keywords:'khung ảnh gỗ thay ảnh natural photo frame memory',create:()=>{
  const media=NATURAL_MEDIA[frameId],scale=Math.min(280/media.width,330/media.height),w=media.width*scale,h=media.height*scale,a=media.aperture;
  return [createElement('image',{name:translate('editor.library.item.natural-photo-frame'),layout:{x:(280-w)/2+a.x*w+1,y:a.y*h+1,width:a.width*w-2,height:a.height*h-2},props:{assetId:stilllife,optional:true,fit:'cover',radius:0},accessibility:{alt:translate('editor.element.photoAlt')}}),createElement('image',{name:translate('editor.library.item.object-mot-ky-niem'),layout:{x:(280-w)/2,y:0,width:w,height:h},props:{assetId:frameId,fit:'contain',radius:0},accessibility:{decorative:true,label:NATURAL_ARTWORK_LABEL}}),createElement('text',{name:translate('editor.library.item.natural-photo-frame'),layout:{x:0,y:h+10,width:280,height:54},props:{text:translate('templates.copy.polaroidCaption'),fontToken:'serif',fontSize:20,align:'center',color:'#34463E'}})];
 }});
 return result;
}
