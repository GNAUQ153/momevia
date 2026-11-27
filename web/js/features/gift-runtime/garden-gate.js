import { gardenDoorSide } from '../../shared/canvas/garden-tea.js';

// A standalone library control uses the same hinge sequence within its bounds.
export function playInlineGardenGate(control, motion, signal) {
  if (!motion?.enabled() || signal.aborted) return;
  const nodes = [...control.querySelectorAll('.gift-botanical-panel, .gift-botanical-seal')];
  const original = nodes.map(node => [node, node.style.transform, node.style.opacity]);
  const restore = () => original.forEach(([node, transform, opacity]) => Object.assign(node.style, {transform, opacity}));
  signal.addEventListener('abort', restore, {once:true});
  return Promise.all(nodes.map(node => {
    const seal = node.classList.contains('gift-botanical-seal');
    const end = seal ? {opacity:0, transform:'scale(.82) rotate(14deg)'}
      : {transform:`rotateY(${node.classList.contains('is-left')?-92:92}deg)`};
    return motion.run(node, [seal?{opacity:1,transform:'scale(1) rotate(0deg)'}:{transform:'rotateY(0deg)'}, end],
      {duration:seal?320:1350,delay:seal?0:130,easing:'cubic-bezier(.32,.04,.2,1)'},signal)
      .then(()=>{if(!signal.aborted)Object.assign(node.style,end);});
  })).finally(()=>{signal.removeEventListener('abort',restore);if(signal.aborted)restore();});
}

// Animate each whole door as one plane. All original editable layers survive.
export function playGardenGate(control, document, motion, signal, renderBelow) {
  if (!motion?.enabled() || signal.aborted) return;
  const sceneContent=control.closest('.gift-scene-content');
  const content = control.closest('.gift-scene-body-content')||sceneContent;
  if (!content||!sceneContent) return;
  const originalChildren = [...content.children];
  const nodes = new Map(originalChildren.filter(n => n.dataset.runtimeElement).map(n => [n.dataset.runtimeElement, n]));
  const panels = document.elements.filter(gardenDoorSide);
  const planes = [], restored = [], jobs = [];
  const below = renderBelow?.();
  if (below) { content.append(below); planes.push(below); }
  const properties = ['left', 'top', 'width', 'height', 'minHeight', 'opacity'];
  const perspective = content.style.perspective;
  let finished = false;
  sceneContent.dataset.gardenOpening = '';
  content.style.perspective = `${content.clientWidth * 2.2}px`;
  const restore = () => {
    if (finished) return;
    for (const { node, styles } of restored) {
      content.append(node);
      for (const key of properties) node.style[key] = styles[key];
    }
    for (const node of originalChildren) content.append(node);
    planes.forEach(plane => plane.remove());
    content.style.perspective = perspective;
    delete sceneContent.dataset.gardenOpening;
  };
  signal.addEventListener('abort', restore, { once: true });
  if (below) {
    const groupIds = new Set(panels.map(p => p.groupId));
    const moving = new Set(document.elements.filter(e => panels.some(p => p.id === e.id) || (e.groupId && groupIds.has(e.groupId))).map(e => e.id));
    for (const node of originalChildren.filter(n => n !== control && !moving.has(n.dataset.runtimeElement))) {
      restored.push({ node, styles: Object.fromEntries(properties.map(key => [key, node.style[key]])) }); node.style.opacity = '0';
    }
  }
  for (const panel of panels) {
    const anchor = nodes.get(panel.id);
    if (!anchor) continue;
    const members = document.elements.filter(e => e.id === panel.id || (panel.groupId && e.groupId === panel.groupId)).map(e => nodes.get(e.id)).filter(Boolean);
    const x = anchor.offsetLeft, y = anchor.offsetTop, w = anchor.offsetWidth, h = anchor.offsetHeight;
    const boxes = members.map(node => ({ node, x: node.offsetLeft - x, y: node.offsetTop - y, w: node.offsetWidth, h: node.offsetHeight }));
    const plane = globalThis.document.createElement('div');
    plane.className = 'gift-garden-door-plane';
    plane.setAttribute('aria-hidden', 'true');
    Object.assign(plane.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`,
      zIndex: String(Math.max(...members.map(n => Number(n.style.zIndex) || 0))),
      transformOrigin: gardenDoorSide(panel) === 'left' ? '0 50%' : '100% 50%' });
    content.append(plane); planes.push(plane);
    for (const box of boxes) {
      const { node } = box;
      restored.push({ node, styles: Object.fromEntries(properties.map(key => [key, node.style[key]])) });
      Object.assign(node.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px`, minHeight: `${box.h}px` });
      plane.append(node);
    }
    const end = `rotateY(${gardenDoorSide(panel) === 'left' ? -92 : 92}deg)`;
    jobs.push(motion.run(plane, [{ transform: 'rotateY(0deg)' }, { transform: end }],
      { duration: 1350, delay: 130, easing: 'cubic-bezier(.32,.04,.2,1)' }, signal).then(() => { if (!signal.aborted) plane.style.transform = end; }));
  }
  const opacity = control.style.opacity;
  jobs.push(motion.run(control, [{ opacity: 1, transform: 'rotate(0deg) scale(1)' }, { opacity: 0, transform: 'rotate(14deg) scale(.82)' }], { duration: 320 }, signal).then(() => {
    if (!signal.aborted) control.style.opacity = '0';
  }));
  return Promise.all(jobs).then(() => {
    if (signal.aborted) { control.style.opacity = opacity; return; }
    finished = true;
    signal.removeEventListener('abort', restore);
    // Keep the final plane positions for the outgoing scene's short crossfade.
    // No retained animation handles or resize measurements remain alive.
  });
}
