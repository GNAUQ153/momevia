import { effectSpeed } from "../../shared/canvas/effects.js";

const duration = preset => effectSpeed[preset.speed || "normal"];
const standard = "cubic-bezier(.22,.61,.36,1)";
function decoration(css, text) {
  const node = document.createElement("span");
  node.className = css;
  node.setAttribute("aria-hidden", "true");
  if (text) node.textContent = text;
  return node;
}

export function applySurface(node, preset) {
  if (preset) node.dataset.giftSurface = preset.id;
  else delete node.dataset.giftSurface;
  node.style.setProperty("--gift-surface-color", preset?.color || "");
}

export function createMotion(isEnabled) {
  const pending = new Set();
  function run(node, keyframes, options, signal, cleanup = () => {}) {
    if (!isEnabled() || signal?.aborted || !node.animate) {
      cleanup();
      return Promise.resolve();
    }
    const animation = node.animate(keyframes, { easing: standard, ...options });
    const stop = () => animation.cancel();
    pending.add(stop);
    signal?.addEventListener("abort", stop, {once:true});
    return animation.finished.catch(() => {}).finally(() => {
      animation.cancel();
      pending.delete(stop);
      signal?.removeEventListener("abort", stop);
      cleanup();
    });
  }
  function track(stop) {
    pending.add(stop);
    return () => pending.delete(stop);
  }
  return { run, track, cancel: () => pending.forEach(stop => stop()), enabled: isEnabled };
}

const typewriters = new WeakMap();
export function finishTypewriter(node) {
  typewriters.get(node)?.();
}

function playTypewriter(node, entrance, motion, signal, register) {
  const text = node.textContent;
  const units = Array.from(new Intl.Segmenter(document.documentElement.lang, { granularity: "grapheme" }).segment(text), item => item.segment);
  if (!units.length) return Promise.resolve();
  const accessible = decoration("gift-typewriter-accessible", text);
  accessible.removeAttribute("aria-hidden");
  const visual = decoration("gift-typewriter-overlay");
  visual.append(document.createTextNode(""), decoration("gift-typewriter-rest", text));
  node.replaceChildren(accessible, visual);

  return new Promise(resolve => {
    const steps = Math.min(60, units.length);
    const ticks = Math.max(24, Math.round(duration(entrance) * 3 / steps));
    let frame = 0;
    let timer = setTimeout(tick, entrance.delay || 0);
    const releaseMotion = motion.track(finish);
    const releaseSkip = register?.(finish, node);
    typewriters.set(node, finish);
    signal?.addEventListener("abort", finish, { once: true });
    function tick() {
      const end = Math.ceil(++frame * units.length / steps);
      if (frame >= steps) return finish();
      visual.firstChild.data = units.slice(0, end).join("");
      visual.lastChild.textContent = units.slice(end).join("");
      timer = setTimeout(tick, ticks);
    }
    function finish() {
      if (!typewriters.delete(node)) return;
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      releaseMotion();
      node.textContent = text;
      releaseSkip?.();
      resolve();
    }
  });
}

export async function playElement(node, model, motion, signal, only, registerTypewriter) {
  const { entrance, emphasis } = model.effects || {};
  const opacity = model.opacity ?? 1;
  if (entrance && (!only || only === "entrance") && motion.enabled()) {
    node.dataset.giftEffect = entrance.id;
    const frames = {
      E01: [{opacity:0},{opacity}],
      E02: [{opacity:0,translate:"0 18px"},{opacity,translate:"0 0"}],
      E04: [{clipPath:"inset(0 100% 0 0)"},{clipPath:"inset(0 0 0 0)"}],
    }[entrance.id];
    if (entrance.id === "E03") {
      await playTypewriter(node, entrance, motion, signal, registerTypewriter);
    } else {
      await motion.run(node, frames, {duration:duration(entrance),delay:entrance.delay||0,fill:"backwards"}, signal);
    }
    delete node.dataset.giftEffect;
  }
  if (!emphasis || (only && only !== "emphasis") || signal?.aborted || !motion.enabled()) return;
  node.dataset.giftEffect = emphasis.id;
  if (emphasis.id === "A01" || emphasis.id === "A02") {
    const frames = emphasis.id === "A01"
      ? [1,1.055,1,1.05,1].map(scale => ({scale}))
      : ["0deg","-4deg","3deg","0deg"].map(rotate => ({rotate}));
    await motion.run(node,frames,{duration:duration(emphasis)},signal);
  } else {
    const line = emphasis.id === "A04";
    const overlay = decoration(line ? "gift-effect-underline" : "gift-effect-sheen");
    node.append(overlay);
    await motion.run(overlay,line
      ? [{transform:"scaleX(0)",opacity:1},{transform:"scaleX(1)",opacity:1,offset:.7},{transform:"scaleX(1)",opacity:0}]
      : [{transform:"translateX(-90%)",opacity:0},{opacity:1,offset:.35},{transform:"translateX(90%)",opacity:0}],
    {duration:duration(emphasis)},signal,() => overlay.remove());
  }
  delete node.dataset.giftEffect;
}

export function sceneTransition(stage, incoming, previous, preset, motion, signal) {
  if (!previous || !preset || !motion.enabled()) return;
  previous.classList.add("gift-transition-layer");
  previous.dataset.giftEffect = preset.id;
  previous.setAttribute("aria-hidden","true");
  previous.inert = true;
  stage.append(previous);
  const ms = duration(preset);
  if (preset.id === "T04") {
    previous.replaceChildren();
    for (const direction of [-1,1]) {
      const panel = decoration("gift-transition-curtain");
      panel.style.left = direction === -1 ? "0%" : "50%";
      panel.style.backgroundColor = previous.style.backgroundColor;
      previous.append(panel);
      void motion.run(panel,[{translate:"0 0"},{translate:`${direction*100}% 0`}],{duration:ms,fill:"forwards"},signal);
    }
    previous.style.backgroundColor = "transparent";
  }
  const frames = {
    T01: [{opacity:1},{opacity:0}],
    T02: [{translate:"0 0"},{translate:"-100% 0"}],
    T03: [{transform:"perspective(700px) rotateY(0deg)"},{transform:"perspective(700px) rotateY(-93deg)",opacity:.1}],
    T04: [{opacity:1},{opacity:1}],
  }[preset.id];
  if (preset.id === "T02") {
    void motion.run(incoming, [{ translate: "100% 0" }, { translate: "0 0" }], { duration: ms }, signal);
  }
  return motion.run(previous,frames,{duration:ms},signal,() => previous.remove());
}

export function playAmbience(stage,preset,motion,signal) {
  if (!preset || !motion.enabled()) return;
  const layer = decoration("gift-ambience");
  layer.dataset.giftEffect = preset.id;
  stage.append(layer);
  const items = preset.density === "sparse" ? 8 : 16;
  const ms = {slow:3800, normal:3000, fast:2300}[preset.speed || "normal"];
  const colors = ["#a876d0","#e299ac","#cd942a","#679b81"];
  const tasks = [];
  for (let i=0;i<items;i++) {
    const star = preset.id === "B03";
    const particle = decoration("gift-particle",star ? "✦" : "");
    particle.style.left = `${i%2 ? 87+(i%5)*2 : 2+(i%5)*2}%`;
    particle.style.top = `${i*41%90}%`;
    particle.style.color = colors[i%4];
    layer.append(particle);
    const end = {
      B01: {translate:`${i%2 ? "-22" : "22"}px 128px`,rotate:"140deg"},
      B02: {translate:`${i%2 ? "-30" : "30"}px 76px`,rotate:"65deg"},
      B03: {translate:"35px 45px",scale:.7},
      B04: {translate:"12px -19px",scale:.9},
    }[preset.id];
    tasks.push(motion.run(particle,[{opacity:0},{opacity:.68,offset:.3},{...end,opacity:0}],
      {duration:ms-i*24,delay:i*28,fill:"backwards"},signal,() => particle.remove()));
  }
  return Promise.all(tasks).then(() => layer.remove());
}

export function playReaction(control,preset,motion,signal,event) {
  if (!preset || !motion?.enabled() || signal?.aborted) return null;
  const id = preset.id;
  const ms = duration(preset);
  if (id === "R04") {
    const flame = control.closest(".gift-runtime-interaction")?.querySelector(".gift-candle-flame");
    if (flame) {
      flame.dataset.giftEffect = id;
      return motion.run(flame,[{scale:.3,opacity:.25},{scale:1.34,opacity:1},{scale:1}],{duration:ms},signal,
        () => delete flame.dataset.giftEffect);
    }
  }
  if (id === "R01" || id === "R02") {
    const lid = decoration(`gift-reaction-lid gift-reaction-${id}`);
    lid.dataset.giftEffect = id;
    (control.querySelector(".gift-control-illustration") || control).append(lid);
    return motion.run(lid,id === "R01"
      ? [{transform:"perspective(120px) rotateX(0deg)"},{transform:"perspective(120px) rotateX(-105deg)"}]
      : [{transform:"translateY(0) rotate(0deg)"},{transform:"translateY(-28px) rotate(-13deg)"}],
    {duration:ms},signal,() => lid.remove());
  }
  const burst = decoration("gift-reaction-burst","✦");
  burst.dataset.giftEffect = id;
  const box = control.getBoundingClientRect();
  burst.style.left = `${event?.detail ? event.clientX-box.left : box.width/2}px`;
  burst.style.top = `${event?.detail ? event.clientY-box.top : box.height/2}px`;
  control.append(burst);
  return motion.run(burst,[{scale:.45,opacity:.6},{scale:1.8,opacity:1,offset:.5},{scale:2.2,opacity:0}],
    {duration:ms},signal,() => burst.remove());
}
