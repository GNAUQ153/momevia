import { PAPER_GRAIN_URL } from '../../shared/canvas/paper-grain.js';
import { displayCopy } from '../../shared/locale.js';
import { effectSpeed } from '../../shared/canvas/effects.js';

const animationFor = preset => preset?.definition?.animation;
export const recipeDuration = preset => (animationFor(preset)?.duration || 600) * effectSpeed[preset.speed || 'normal'] / effectSpeed.normal;
export function playRecipe(node, preset, motion, signal) {
  const animation = animationFor(preset);
  if (animation?.engine !== 'keyframes') return null;
  node.dataset.giftEffect = preset.id;
  return motion.run(node, animation.keyframes, { duration: recipeDuration(preset), delay: preset.delay || 0,
    easing: animation.easing || 'ease-out', iterations: animation.iterations === 'infinite' ? Infinity : animation.iterations || 1, ...(animation.composite?{composite:animation.composite}:{}), fill: 'backwards' }, signal,
  () => delete node.dataset.giftEffect);
}
const surfaces = new WeakMap();
export function applyRecipeSurface(node, preset) {
  for (const [key, previous, applied] of surfaces.get(node) || []) if (node.style[key] === applied) node.style[key] = previous;
  surfaces.delete(node);
  const animation = animationFor(preset);
  if (animation?.engine !== 'surface') return false;
  const style = animation.styles, keys = [], before = {};
  for (const key of ['color','backgroundColor','borderColor','borderWidth','borderRadius','borderStyle','boxShadow','filter','backgroundImage','backgroundSize']) before[key] = node.style[key];
  for (const key of ['color','backgroundColor','borderColor']) if (style[key]) { node.style[key] = style[key]; keys.push(key); }
  for (const key of ['borderWidth','borderRadius']) if (style[key] !== undefined) { node.style[key] = `${style[key]}px`; keys.push(key); }
  if (style.borderWidth !== undefined) { node.style.borderStyle = 'solid'; keys.push('borderStyle'); }
  const filters=[];
  if(style.blur)filters.push(`blur(${style.blur}px)`);
  if (style.shadowBlur !== undefined) {
    const base=preset.color || style.shadowColor || '#32243B',alpha=Math.round((style.shadowOpacity ?? 1)*255).toString(16).padStart(2,'0');
    const shadow=`${style.shadowX ?? 0}px ${style.shadowY ?? 4}px ${style.shadowBlur}px ${base}${alpha}`;
    if(style.shadowMode==='alpha')filters.push(`drop-shadow(${shadow})`);else{node.style.boxShadow=shadow;keys.push('boxShadow');}
  }
  if(filters.length){node.style.filter=filters.join(' ');keys.push('filter');}
  if(style.texture==='paper-grain-v1'){node.style.backgroundImage=`url("${PAPER_GRAIN_URL}")`;node.style.backgroundSize='128px 128px';keys.push('backgroundImage','backgroundSize');}
  surfaces.set(node, keys.map(key => [key, before[key], node.style[key]])); return true;
}
export function playParticleRecipe(stage, preset, motion, signal) {
  const animation = animationFor(preset);
  if (animation?.engine !== 'particles') return null;
  let stopped = false, timer, cycle, finish;
  const completed = new Promise(resolve => { finish = resolve; });
  let untrack = () => {};
  const stop = () => { if (stopped) return; stopped = true; clearTimeout(timer); cycle?.abort(); signal?.removeEventListener('abort', stop); untrack(); finish(); };
  untrack = motion.track(stop); signal?.addEventListener('abort', stop, { once: true });
  const start = async () => {
    if (stopped || signal?.aborted || !motion.enabled() || !stage.isConnected) return stop();
    if (document.hidden) { timer = setTimeout(start, 1000); return; }
    cycle = new AbortController();
    const layer = document.createElement('span'); layer.className = 'gift-ambience'; layer.dataset.giftEffect = preset.id;
    layer.setAttribute('aria-hidden', 'true'); stage.append(layer);
    const count = Math.min(24, Math.max(1, Math.round(animation.count * (preset.density === 'sparse' ? .5 : 1))));
    const tasks = [];
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('span'); particle.className = 'gift-particle';
      particle.style.background = 'transparent'; particle.style.fontSize = '20px'; particle.style.width = particle.style.height = '24px';
      particle.textContent = displayCopy(animation.glyphs[i % animation.glyphs.length]); particle.style.color = animation.colors[i % animation.colors.length];
      particle.style.left = `${5 + i * 41 % 90}%`; particle.style.top = `${i * 29 % 75}%`; layer.append(particle);
      tasks.push(motion.run(particle, [{ opacity: 0, transform: 'translateY(0px)' }, { opacity: .85, offset: .2 },
        { opacity: 0, transform: `translateY(${animation.drift ?? 120}px)` }],
      { duration: recipeDuration(preset), delay: i * 35, fill: 'backwards' }, cycle.signal));
    }
    try { await Promise.all(tasks); } finally { layer.remove(); cycle = null; }
    if (stopped) return;
    if (preset.loop) timer = setTimeout(start, 500); else stop();
  };
  void start(); return completed;
}
