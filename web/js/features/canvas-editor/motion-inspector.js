import {node,button,field,input,select} from './dom.js';
import {motionKinds} from '../../shared/canvas/motion-stack.js';
import {currentLocale} from '../../core/i18n.js';
export function motionInspector(model){
 const en=currentLocale()==='en',label=(vi,enText)=>en?enText:vi,stack=model.motions;
 const kind=node('select',{'data-motion-kind':'', 'aria-label':label('Loại chuyển động','Motion type')});
 for(const id of ['pulse','spin','float','sway'])kind.append(node('option',{value:id},motionKinds[id][en?'en':'vi']));
 const target=node('select',{'data-motion-target':'','aria-label':label('Bộ phận','Part')},node('option',{value:'whole'},label('Toàn vật thể','Whole object')),...(model.assembly?.parts||[]).map(p=>node('option',{value:p.id},p.title)));
 const children=[node('legend',{},label('Chuyển động trên vật thể','Object motions')),
  model.effects?.emphasis?node('p',{class:'editor-help'},label('Hiệu ứng nhấn cũ chiếm một trong ba dòng.','Legacy emphasis occupies one of the three rows.')):null,
  stack?field(label('Bật toàn bộ chuyển động','Enable all motions'),node('input',{type:'checkbox',checked:stack.enabled,'data-editor-field':'motion.enabled'})):null,
  ...((stack?.rows||[]).map(row=>{
   const prefix=`motion.${row.id}.`,parts=[...new Set([row.target,...(row.tracks?.map(t=>t.target)||[])])].map(id=>model.assembly?.parts.find(p=>p.id===id)?.title||label('Toàn vật thể','Whole object'));
   const directional=row.kind==='orbit'||!row.tracks&&row.kind==='spin'||row.tracks?.some(t=>t.frames.some(f=>f.rotation));
   const amplitude=row.kind!=='spin'&&(!row.tracks||row.tracks.some(t=>t.frames.some(f=>['x','y','rotation','scaleX','scaleY','opacity'].some(k=>f[k]!==undefined))));
   return node('fieldset',{class:'editor-effect-settings','data-motion-editor-row':row.id},node('legend',{},row.title||motionKinds[row.kind][en?'en':'vi']),node('p',{class:'editor-help'},parts.join(', ')),
    field(label('Bật dòng này','Enable this row'),node('input',{type:'checkbox',checked:row.enabled,'data-editor-field':prefix+'enabled'})),
    input(label('Chu kỳ (ms)','Period (ms)'),prefix+'periodMs',row.periodMs,{type:'number',min:300,max:30000,step:100}),
    input(label('Độ trễ (ms)','Delay (ms)'),prefix+'delayMs',row.delayMs,{type:'number',min:0,max:10000,step:100}),
    amplitude?input(label('Biên độ (hệ số)','Amplitude (factor)'),prefix+'amplitude',row.amplitude,{type:'number',min:0,max:row.tracks?1:2,step:.05}):null,
    directional?select(label('Chiều quay','Rotation direction'),prefix+'direction',row.direction,[['clockwise',label('Cùng chiều kim đồng hồ','Clockwise')],['counterclockwise',label('Ngược chiều kim đồng hồ','Counterclockwise')]]):null,
    select(label('Số vòng','Iterations'),prefix+'iterations',row.iterations,[['infinite',label('Lặp liên tục','Continuous')],[1,'1'],[2,'2'],[3,'3'],[4,'4'],[5,'5']]),
    node('div',{class:'editor-control-row'},button(label('Phát thử dòng này','Play this row'),'motion-preview',{'data-motion-id':row.id}),button(label('Xóa dòng này','Remove this row'),'motion-remove',{'data-motion-id':row.id})));
  })),node('div',{class:'editor-control-row'},kind,target,button(label('Thêm chuyển động','Add motion'),'motion-add',{disabled:(stack?.rows.length||0)+(model.effects?.emphasis?1:0)>=3}),button(label('Phát thử','Play'),'motion-preview'))];
 return node('fieldset',{class:'editor-effect-settings'},...children);
}
