import {createElement} from './registry.js';
import {PINE_PARTS} from './pine-art.js';
import {groupElements,ANCHORED_SURFACE_LABEL} from './element-groups.js';
// OlKu / Openclipart 173819 (CC0), normalized source curves, not a raster sticker.
export function pineGiftTagModels(localize){
 const make=(type,suffix,box,props,extra={})=>createElement(type,{id:'drive-pine-gift-tag-'+suffix,name:localize('drive.block.pine-gift-tag'),layout:{x:box[0],y:box[1],width:box[2],height:box[3],rotation:0},props,...extra},localize);
 // Compensate the 170×96 paper aspect so the punch is circular at authored size.
 const tagPath='M0 30Q0 25 5 20L23 4Q27 0 33 0H92Q100 0 100 8V92Q100 100 92 100H8Q0 100 0 92ZM19.06 19a2.94 5.21 0 1 0 5.88 0a2.94 5.21 0 1 0-5.88 0Z';
 const tag=make('shape','tag',[100,26,170,96],{kind:'rectangle',color:'#FFF3DC',strokeColor:'#C69A60',strokeWidth:1,radius:0},{artwork:{paths:[{d:tagPath,fill:'color',stroke:'strokeColor',strokeWidth:.6}]},accessibility:{decorative:true,label:ANCHORED_SURFACE_LABEL}});
 const shadow=make('shape','shadow',[102,29,170,96],{kind:'rectangle',color:'#061B17',radius:8},{opacity:.18,accessibility:{decorative:true}});
 const twine=make('shape','twine',[63,10,82,60],{kind:'rectangle',color:'#C69A60',radius:0},{artwork:{paths:[{d:'M8 30C20 4 46 2 62 12C80 24 67 48 48 35C36 24 58 9 78 18C96 26 103 48 91 57M91 57C79 64 85 80 98 78M91 57C77 63 72 76 74 87',fill:'none',stroke:'color',strokeWidth:1.5}]},accessibility:{decorative:true}});
 const pine=PINE_PARTS.map((artwork,i)=>make('shape','pine-'+i,[0,0,140,96],{kind:'rectangle',color:'#6AA36C',radius:0},{artwork:structuredClone(artwork),accessibility:{decorative:true,label:'Momevia evergreen sprig v1'}}));
 const berries=[[104,25],[112,34]].map(([x,y],i)=>make('shape','berry-'+i,[x,y,11,11],{kind:'ellipse',color:'#AF2241',radius:0},{accessibility:{decorative:true}}));
 const label=make('text','tag-text',[147,56,108,46],{text:localize('drive.secretSanta'),fontToken:'serif',fontSize:18,lineHeight:1.15,align:'center',color:'#183E35'});
 return groupElements([shadow,tag,twine,...pine,...berries,label],{flow:'anchored'});
}
