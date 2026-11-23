export const visualKinds=['all','shapes','graphics','photos','three-d','animation','interactive','text'];
const cache=new WeakMap();
export function blockVisualKind(block){
 if(block.visualKind)return block.visualKind;
 if(block.id.startsWith('object-'))return 'photos';
 if(['flowers','leaves','stars'].includes(block.id)||/^m5[45]-/.test(block.id))return 'graphics';
 if(cache.has(block))return cache.get(block);
 const models=block.create();
 const value=models.some(e=>['interaction','button','envelope','gift-box','reply','sound-button'].includes(e.type))?'interactive':models.some(e=>e.type==='image')?'photos':models.every(e=>e.type==='text')?'text':models.every(e=>['shape','line'].includes(e.type)&&(!e.artwork||['rectangle','ellipse','triangle','diamond','hexagon','arch','ribbon','speech'].includes(e.props.kind)))?'shapes':'graphics';
 cache.set(block,value);return value;
}
