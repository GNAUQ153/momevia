// Momevia Originals, recipe v1. Definitions are pinned into each document.
export const eventRecipes = [
  { id: 'photo-settle-v1', family: 'entrance', title: { vi: 'Góc ảnh hạ xuống', en: 'A photo settles' }, targets: { types: ['image'] },
    defaults: { speed: 'normal', delay: 0 }, animation: { engine: 'keyframes', duration: 380, easing: 'ease-out', iterations: 1,
      keyframes: [{ transform: 'translateY(-6px) rotate(-3deg)' }, { transform: 'translateY(0px) rotate(1deg)', offset: .7 }, { transform: 'translateY(0px) rotate(0deg)' }] } },
  { id: 'porch-sun-v1', family: 'ambience', title: { vi: 'Bụi nắng bên hiên', en: 'Sunlight on the porch' }, targets: { scenes: true, types: [] },
    defaults: { speed: 'normal', density: 'sparse', loop: false }, animation: { engine: 'particles', duration: 2400, glyphs: ['·','✧'], colors: ['#E9BA63','#AA5744'], count: 8, drift: -40 } },
  { id:'photo-arrive-v3',family:'entrance',title:{vi:'Ảnh hạ nhẹ trên giấy',en:'Photo lands softly'},targets:{types:['image']},defaults:{speed:'normal',delay:0},animation:{engine:'keyframes',duration:600,easing:'ease-out',iterations:1,composite:'add',keyframes:[{transform:'translateY(-10px) rotate(-1.2deg) scale(0.99)'},{transform:'translateY(1px) rotate(0.2deg) scale(1)',offset:.78},{transform:'translateY(0px) rotate(0deg) scale(1)'}]} },
  { id:'paper-shadow-v2',family:'surface',title:{vi:'Bóng đổ theo đường nét',en:'Natural object shadow'},targets:{types:['text','image','shape','line','sticker','button','envelope','gift-box','interaction','reply']},defaults:{},
    animation:{engine:'surface',styles:{shadowMode:'alpha',shadowColor:'#352B30',shadowOpacity:.2,shadowBlur:14,shadowX:0,shadowY:8}} },
  { id:'contact-shadow-v1',family:'surface',title:{vi:'Bóng tiếp xúc mềm',en:'Soft contact shadow'},targets:{types:['shape']},defaults:{},animation:{engine:'surface',styles:{blur:6}} },
  { id:'keepsake-sway-v1',family:'emphasis',title:{vi:'Chao nhẹ theo ánh sáng',en:'Gentle keepsake sway'},targets:{types:['image']},defaults:{speed:'normal'},
    animation:{engine:'keyframes',duration:3200,easing:'ease-in-out',iterations:3,composite:'add',keyframes:[{transform:'translateY(0px) rotate(0deg)'},{transform:'translateY(-3px) rotate(0.45deg)',offset:.5},{transform:'translateY(0px) rotate(0deg)'}]} },
  { id:'hanging-sway-v2',family:'emphasis',title:{vi:'Đu đưa dịu',en:'Gentle hanging sway'},targets:{types:['shape','line','sticker']},defaults:{speed:'normal'},animation:{engine:'keyframes',duration:2800,easing:'ease-in-out',iterations:3,composite:'add',keyframes:[{transform:'rotate(0deg)'},{transform:'rotate(1.4deg)',offset:.35},{transform:'rotate(-0.8deg)',offset:.72},{transform:'rotate(0deg)'}]} },
  { id:'cotton-paper-v2',family:'surface',title:{vi:'Giấy sần mịn',en:'Fine cotton paper'},targets:{scenes:true,types:['shape','envelope','reply','interaction']},defaults:{},animation:{engine:'surface',styles:{texture:'paper-grain-v1'}} },
];
export function eventRecipe(id, options = {}) {
  const recipe = eventRecipes.find(r => r.id === id);
  if (!recipe) throw new Error('Unknown Original recipe');
  return { id, ...structuredClone(recipe.defaults), ...options, definition: { id, revision: 1, family: recipe.family,
    title: structuredClone(recipe.title), targets: structuredClone(recipe.targets), animation: structuredClone(recipe.animation) } };
}
