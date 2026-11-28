import { decorateDriveOpening, playDriveOpening } from './drive-interactions.js';
import {decorateNaturalOpening} from './natural-objects.js';
import {NATURAL_OPENINGS,DRIVE_OPENING_PRESETS,naturalObjectFrame} from '../../shared/canvas/natural-objects.js';
import {VOLUME_GIFT_PRESET,giftVolumeGeometry} from '../../shared/canvas/gift-volume.js';
import {ENVELOPE_SOURCE_PRESET} from '../../shared/canvas/studio-constants.js';
import { reflowSceneNodes } from './reflow.js';
import { scenePresentation } from '../../shared/canvas/scene-presentation.js';
import { isSceneFooter, sceneFooterLayout } from '../../shared/canvas/scene-footer.js';
import { responsiveTextSize,responsiveControlSize } from '../../shared/canvas/responsive-type.js';
import { gardenDoorSide } from '../../shared/canvas/garden-tea.js';
import { gardenFlowerPaths, gardenSprigPaths } from '../../shared/canvas/garden-botanical.js';
import { mountGardenRsvp } from '../gifts/garden-rsvp.js';
import { playGardenGate, playInlineGardenGate } from './garden-gate.js';
import { renderAssembly, prepareMotionLayers } from './motion-stack.js';
import { displayLayerText,displayRecipient } from '../../shared/recipient-naming.js';
import { STICKERS } from "../../shared/canvas/index.js";
import { message as label, setAttr, setText, t } from "../../core/i18n.js";
import { masks, vectorParts } from "../../shared/canvas/artwork.js";
import { renderInteraction } from "./interactions.js";
import { applySurface, finishTypewriter, playReaction } from "./effects.js";
import { EVENT_MEDIA, eventMediaUrl, EVENT_ARTWORK_LABEL, ORIGINAL_ARTWORK_LABEL, REALISTIC_ARTWORK_LABEL, NATURAL_ARTWORK_LABEL } from '../../shared/canvas/event-media.js';
import { mountRuntimeImage } from './image-state.js';

const svgNamespace = "http://www.w3.org/2000/svg";
let clipSequence = 0;
const navigationArt = {
  R01: [
    {d:"M5 23H95V81H5Z",fill:"#FFF1DF",stroke:"#DBBDF0","stroke-width":3},
    {d:"M7 24 50 53 93 24M7 79 38 47M93 79 62 47",fill:"none",stroke:"#8A6397","stroke-width":3},
  ],
  R02: [
    {d:"M20 35H80V84H20Z",fill:"#FFF1DF",stroke:"#C89D5A","stroke-width":3},
    {d:"M13 27H87V46H13Z",fill:"#F4D195",stroke:"#C89D5A","stroke-width":3},
    {d:"M50 27C13 19 26-2 50 26 74-2 87 19 50 27V83",fill:"none",stroke:"#AC5478","stroke-width":6},
  ],
};

function clipPhoto(frame, mask, maskPath) {
  const clipId = `gift-photo-clip-${++clipSequence}`;
  const svg = drawVector([]);
  const clip = globalThis.document.createElementNS(svgNamespace, "clipPath");
  const path = globalThis.document.createElementNS(svgNamespace, "path");
  svg.classList.add("gift-runtime-clip");
  clip.id = clipId;
  clip.setAttribute("clipPathUnits", "objectBoundingBox");
  path.setAttribute("d", maskPath || masks[mask]);
  path.setAttribute("transform", "scale(.01)");
  clip.append(path);
  svg.append(clip);
  frame.append(svg);
  frame.style.clipPath = `url("#${clipId}")`;
}
export function drawVector(parts, { stretch = false } = {}) {
  const svg = globalThis.document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", stretch ? "none" : "xMidYMid meet");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "gift-runtime-vector");
  for (const part of parts) {
    const path = globalThis.document.createElementNS(svgNamespace, "path");
    for (const [key, value] of Object.entries(part)) if (value != null) path.setAttribute(key, value);
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.append(path);
  }
  return svg;
}

function element(tag, className, text) {
  const node = globalThis.document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) {
    const content = document.createTextNode("");
    setText(content, text);
    node.append(content);
  }
  return node;
}
function imageUrl(value, mode) {
  if (typeof value !== "string" || value.includes("\\")) return null;
  if (/^\/api\/(?:designs|gifts)\//.test(value)) return value;
  if (['preview', 'thumbnail'].includes(mode) && Object.keys(EVENT_MEDIA).some(id => eventMediaUrl(id) === value || eventMediaUrl(id,{variant:'thumbnail'})===value)) return value;
  if (mode === "preview" && (/^\/api\/catalog\/(?:admin\/)?templates\/[\w-]+\/versions\/[\w-]+\/assets\/[\w-]+$/.test(value)
    || /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value))) return value;
  return null;
}
export function resolveText(node, document) {
  return displayLayerText(node, document, t);
}

// The system preview regenerates the same document structure with translated copy.
export function updateElementCopy(node, model, document) {
  const { type, props: p, accessibility: a = {} } = model;
  if(node.updateDriveCopy){node.updateDriveCopy(model,document);return;}
  if (type === "text") {
    finishTypewriter(node);
    node.textContent = resolveText(model, document);
  } else if (["button", "envelope", "gift-box", "sound-button"].includes(type)) {
    if(DRIVE_OPENING_PRESETS.includes(p.preset)){
      if(NATURAL_OPENINGS.includes(p.preset))node.updateNaturalCopy?.(p);
      else{if(p.preset!=='lid-card-v2')node.querySelector('.gift-drive-bow').textContent=p.preset.startsWith('lid-card')?'∞':p.label;
        node.querySelector('.gift-drive-sliding-card').textContent=p.label;
        node.querySelector('.gift-drive-opening-label').textContent=p.preset.startsWith('wax-letter')?t('drive.openNow'):p.label;}
    }else setText(node.querySelector(".gift-runtime-control-label"), p.label || a.label || label("gift.runtime.continue"));
    setAttr(node, "aria-label", a.label || p.label || label("gift.runtime.continue"));
    if(model.id==='open-gift'&&document.elements.some(e=>e.id.startsWith('refresh-')))node.classList.add('gift-runtime-object-control');
  } else if (type === 'reply' && p.replyMode === 'attendance') {
    setText(node.querySelector('h2'), p.title || label('rsvp.title'));
    const panel = node.querySelector('.garden-rsvp-panel'), name = node.querySelector('input[readonly]');
    if (panel) panel.style.setProperty('--garden-rsvp-primary', p.color || '#3D6045');
    if (name) name.value = displayRecipient(document);
  } else if (type === "reply") {
    setText(node.querySelector("h2"), p.title || label("gift.reply.send"));
    setText(node.querySelector(".gift-runtime-submit"), p.submitLabel || label("gift.reply.send"));
    setAttr(node, "aria-label", a.label || p.title || label("gift.reply.title"));
  } else if (type === "image") {
    const caption = node.querySelector(".gift-runtime-photo-caption");
    if (caption) setText(caption, p.caption);
    const image = node.querySelector("img");
    if (image) image.alt = a.decorative ? "" : a.alt || "";
  } else if (type === 'interaction' && p.kind === 'foldout-letter') {
    for (const [i,fold] of [...node.querySelectorAll('.gift-letter-fold')].entries()) {
      setText(fold.querySelector('summary'), p.entries[i].heading);
      setText(fold.querySelector('p'), p.entries[i].body);
    }
  } else if (type === 'interaction' && p.kind === 'light-a-candle') {
    setText(node.querySelector('.gift-interaction-button'), p.entries[0].heading);
    if (node.querySelector('.is-lit')) setText(node.querySelector('.gift-interaction-copy'), p.entries[0].body);
  } else if (type === 'interaction' && p.optional) {
    if (p.kind === 'event-countdown') {
      setText(node.querySelector('h3'), p.entries[0].heading);
      const arrival = node.querySelector('.gift-interaction-copy');
      if (arrival?.textContent) setText(arrival, p.entries[0].body);
    } else if (p.kind === 'swipe-album') {
      const photos = p.photos.filter(photo => photo.assetId);
      const caption = node.querySelector('figcaption');
      if (caption) setText(caption, photos[Number(node.dataset.albumIndex || 0)]?.caption);
    }
  }
}
export function textFont(token) {
  return token === "heading" ? "var(--canvas-font-display)" :
    token === "serif" ? "var(--canvas-font-serif)" : "var(--canvas-font-body)";
}

export function applyFocalPoint(img, focalPoint) {
  img.style.objectPosition = `${(focalPoint?.x ?? 0.5) * 100}% ${(focalPoint?.y ?? 0.5) * 100}%`;
}

// Assigning typed CSSOM properties is CSP-compatible; there is no style attribute markup,
// stylesheet string, CSS expression, custom URL, or user supplied property name.
export function applyLayout(
  node,
  model,
  baseSize,
  { responsive = false, scale = 1 } = {},
) {
  const layout = model.layout || model;
  if(NATURAL_OPENINGS.includes(model.props?.preset)){
    const s=responsive?scale:1,f=naturalObjectFrame(model.props,layout.width*s,layout.height*s);
    for(const [key,value]of Object.entries(f))node.style.setProperty('--object-'+key,value+'px');
    if(model.props.preset===VOLUME_GIFT_PRESET){const g=giftVolumeGeometry(f.width);for(const [key,value]of Object.entries(g))node.style.setProperty('--cube-'+(key==='lid'?'lid-size':key),value+'px');}
  }
  node.style.position = "absolute";
  node.style.left = responsive
    ? `${(layout.x / baseSize.width) * 100}%`
    : `${layout.x}px`;
  node.style.top = `${layout.y * (responsive ? scale : 1)}px`;
  node.style.width = responsive
    ? `${(layout.width / baseSize.width) * 100}%`
    : `${layout.width}px`;
  if(responsive&&node.classList.contains('gift-runtime-object-control'))node.style.left=`${Math.max(0,Math.min(layout.x*scale,baseSize.width*scale-Math.max(44,layout.width*scale)))}px`;
  node.style.minHeight = `${layout.height * (responsive ? scale : 1)}px`;
  node.style.height = `${layout.height * (responsive ? scale : 1)}px`;
  if (model.type === "image" && model.props.caption)
    node.style.setProperty("--gift-layer-height", `${layout.height * (responsive ? scale : 1)}px`);
  node.style.transform = `rotate(${layout.rotation || 0}deg)`;
  if (model.opacity !== undefined) node.style.opacity = String(model.opacity);
  if(model.type==='envelope'&&model.props.preset==='photo-caption-v3'){
    node.style.setProperty('--gift-envelope-art-space',`${Math.max(0,layout.height-60)*(responsive?scale:1)}px`);node.style.height='auto';
  }
  if(model.type==='interaction'&&model.props.appearance==='cake-photo-v2'){
    const s=responsive?scale:1;for(const [k,v]of Object.entries({half:9,x:-3,y:-41.52,w:24,h:48}))node.style.setProperty(`--gift-flame-${k}`,`${v*s}px`);
  }
  if(model.type==='shape'&&model.props.kind==='graduation-tassel-v1')node.style.transformOrigin='9% 4%';
  if (model.type === "sticker")
    node.style.fontSize = `${Math.max(20, Math.min(layout.width, layout.height) * scale * 0.8)}px`;
}

export function applyStationerySurface(node, scale=1) {
  const image=node.querySelector('img');
  if(!image)return;
  image.style.visibility='hidden';
  node.style.borderStyle='solid';
  node.style.borderColor='transparent';
  node.style.borderWidth=`${20*scale}px`;
  node.style.borderImageSource=`url("${image.getAttribute('src')}")`;
  node.style.borderImageSlice='120 fill';
  node.style.borderImageWidth='1';
  node.style.borderImageRepeat='stretch';
}

export function renderElement(
  model,
  {
    document,
    invitation,
    assetUrl = () => null,
    mode = "preview",
    onAction = () => {},
    onSound = () => {},
    replyAdapter,
    signal,
    motion,
    previewFamily,
    imagePriority = false,
    onReply = () => {},
  } = {},
) {
  const { type, props: p, accessibility: a = {} } = model;
  const vector = vectorParts(model);
  const pendingControls = new WeakSet();
  function activate(control, event, action, actions) {
    if (signal?.aborted || pendingControls.has(control) || control.getAttribute("aria-disabled") === "true") return;
    if(model.sound)onSound(model.sound,{explicit:type==='sound-button'});
    const preset = model.motions?.enabled!==false&&(!previewFamily || previewFamily === "reaction") ? model.effects?.reaction : null;
    const reactionTarget=model.motions?control.querySelector('[data-motion-family="reaction"]')||control:control;
    if (actions?.length) {
      onAction(actions, intentSignal => {
        if(['lid-card-v2','wax-letter-v2',...NATURAL_OPENINGS].includes(p.preset)){
          if(!preset){if(p.preset===ENVELOPE_SOURCE_PRESET)return playDriveOpening(control,{enabled:()=>false},signal?AbortSignal.any([intentSignal,signal]):intentSignal);return;}
          const combined=signal?AbortSignal.any([intentSignal,signal]):intentSignal;
          const base={fast:480,normal:800,slow:1200}[p.motionSpeed]||800,duration=Math.round(base*({fast:.7,normal:1,slow:1.3}[preset.speed||'normal']));
          control.style.setProperty('--drive-duration',duration+'ms');
          const opening=playDriveOpening(control,motion,combined,duration),extra=['R01','R02'].includes(preset.id)?null:playReaction(control,preset,motion,combined,event);
          const played=extra?Promise.all([opening,extra]):opening;pendingControls.add(control);return played.finally(()=>pendingControls.delete(control));
        }
        const played = DRIVE_OPENING_PRESETS.includes(p.preset) ? playDriveOpening(control,motion,signal ? AbortSignal.any([intentSignal,signal]) : intentSignal,p.preset.endsWith('-v2')?({fast:480,normal:800,slow:1200}[p.motionSpeed]||800):850) : type === 'envelope' && p.preset === 'garden-gate-v1'
          ? playGardenGate(control, document, motion, signal ? AbortSignal.any([intentSignal, signal]) : intentSignal, () => {
            const scene = document.scenes.find(s => s.id === actions[0]?.targetSceneId);
            if (!scene) return null;
            const below = element('div', 'gift-garden-underlay');
            below.setAttribute('aria-hidden', 'true'); below.inert = true;
            below.style.backgroundColor = scene.background.color;
            const content = control.closest('.gift-scene-body-content')||control.closest('.gift-scene-content');
            const size = document.artboard.baseSize, scale = content.clientWidth / size.width, targets = [];
            content.append(below);
            for (const e of scenePresentation(document,scene).elements) {
              const visual = renderElement(e, { document, assetUrl, mode: 'thumbnail', signal, imagePriority: true });
              applyLayout(visual, e, size, { responsive: true, scale });
              if (e.type === 'text') { visual.style.fontSize = responsiveTextSize(e,scale); visual.style.height = 'auto'; }
              visual.removeAttribute('data-runtime-element'); below.append(visual); targets.push({ model: e, node: visual });
            }
            reflowSceneNodes(targets.filter(({model})=>!isSceneFooter(model)), scale, below.getBoundingClientRect().top);
            const footer=sceneFooterLayout(scenePresentation(document,scene).elements,size,scale);
            if(footer)for(const {model,node}of targets.filter(({model})=>isSceneFooter(model))){
              const b=footer.layouts.get(model.id);Object.assign(node.style,{left:`${b.x}px`,top:`${b.y}px`,width:`${b.width}px`,height:`${b.height}px`,minHeight:`${b.height}px`,fontSize:responsiveControlSize(scale),lineHeight:'1.3',padding:'4px 8px'});
            }
            return below;
          })
          : type === 'envelope' && p.preset === 'botanical-gate-v2'
            ? playInlineGardenGate(control, motion, signal ? AbortSignal.any([intentSignal, signal]) : intentSignal)
            : playReaction(reactionTarget, preset, motion, intentSignal, event);
        if (!played) return;
        pendingControls.add(control);
        return played.finally(() => pendingControls.delete(control));
      });
      return;
    }
    action?.();
    const played = playReaction(reactionTarget, preset, motion, signal, event);
    if (!played) return;
    pendingControls.add(control);
    void played.finally(() => pendingControls.delete(control));
  }
  let node;
  if (model.assembly) {
    node=element('div','gift-runtime-assembly');node.setAttribute('aria-hidden','true');node.style.pointerEvents=mode==='editor'?'auto':'none';node.append(renderAssembly(model.assembly,p,assetUrl));
  } else if (vector) {
    node = element("div", `gift-runtime-vector-box gift-runtime-${type}`);
    node.setAttribute("aria-hidden", "true");
    if (gardenDoorSide(model)) { node.classList.add('gift-garden-panel', `gift-garden-panel--${gardenDoorSide(model)}`); node.style.backgroundColor = p.color; }
    node.append(drawVector(vector, { stretch: type !== "sticker" || ["paper-wave", "lace", "bunting", "washi-tape"].includes(p.stickerId) }));
  } else if (type === "text") {
    node = element(
      a.role === "heading" ? `h${a.level || 2}` : "p",
      "gift-runtime-text",
      resolveText(model, document),
    );
    node.style.fontFamily = textFont(p.fontToken);
    if (p.dropCap) node.classList.add("gift-runtime-drop-cap");
    if (a.decorative) node.setAttribute("aria-hidden", "true");
    node.style.fontSize = `${p.fontSize || 24}px`;
    node.style.lineHeight = String(p.lineHeight || 1.4);
    node.style.fontStyle = p.fontStyle || 'normal';
    if (p.fontWeight) node.style.fontWeight = String(p.fontWeight);
    node.style.textAlign = p.align || "left";
    node.style.color = p.color || "#32243B";
  } else if (type === "image") {
    node = element("div", "gift-runtime-image");
    if (a.decorative) node.setAttribute("aria-hidden", "true");
    if (a.decorative && [EVENT_ARTWORK_LABEL,ORIGINAL_ARTWORK_LABEL,REALISTIC_ARTWORK_LABEL,NATURAL_ARTWORK_LABEL].includes(a.label)) node.style.backgroundColor = "transparent";
    const url = p.assetId ? imageUrl(assetUrl(p.assetId), mode) : null;
    const framed = p.optional || p.mask || p.caption !== undefined;
    const frame = framed ? element("div", "gift-runtime-photo-frame") : node;
    if (framed) {
      node.classList.add("gift-runtime-photo");
      if (p.caption) node.classList.add("gift-runtime-photo-captioned");
      frame.style.borderRadius = `${p.radius || 0}px`;
      if (p.mask) clipPhoto(frame, p.mask, p.maskPath);
      node.append(frame);
      if (p.caption) node.append(element("p", "gift-runtime-photo-caption", p.caption));
    }
    if (url) {
      const img = element("img");
      img.alt = a.decorative ? "" : a.alt || "";
      img.style.objectFit = p.fit || "cover";
      applyFocalPoint(img, p.focalPoint);
      mountRuntimeImage(img, frame, { url, signal, priority: imagePriority });
    } else if (framed && (p.placeholder !== 'collapse' || mode === 'editor')) {
      frame.append(drawVector(p.placeholder === 'portrait' ? [
        {d:"M0 0H100V100H0Z",fill:"#F3DCD9"},
        {d:"M50 32a11 11 0 1 0 0 22 11 11 0 1 0 0-22ZM29 78c2-15 12-23 21-23s19 8 21 23",fill:"none",stroke:"#A9575F","stroke-width":1.2},
      ] : [
        {d:"M0 0H100V100H0Z",fill:"#EBDEF4"},
        {d:"M71 18a11 11 0 1 0 0 22 11 11 0 1 0 0-22Z",fill:"#FFF2C9"},
        {d:"M0 82 28 43 54 72 67 55 100 87V100H0Z",fill:"#AD94BF"},
        {d:"M0 92 23 75 46 87 77 73 100 86V100H0Z",fill:"#7F698F"},
      ], { stretch: true }));
    } else if (!framed)
      frame.append(
        element("span", "gift-runtime-placeholder", label("gift.runtime.choosePhoto")),
      );
    if (!framed) node.style.borderRadius = `${p.radius || 0}px`;
  } else if (type === "shape" || type === "line") {
    node = element("div", `gift-runtime-shape gift-runtime-${type}`);
    node.style.backgroundColor =
      type === "line" || p.kind === "line" ? "transparent" : p.color;
    node.style.borderColor = p.strokeColor || p.color;
    node.style.borderStyle = "solid";
    node.style.borderWidth =
      type === "line" || p.kind === "line"
        ? `${p.strokeWidth ?? 1}px 0 0`
        : `${p.strokeWidth || 0}px`;
    node.style.borderRadius =
      p.kind === "ellipse" ? "50%" : `${p.radius || 0}px`;
    node.setAttribute("aria-hidden", "true");
  } else if (type === "sticker") {
    node = element("div", "gift-runtime-sticker", STICKERS[p.stickerId]);
    node.style.color = p.color;
    node.setAttribute("aria-hidden", "true");
  } else if (["button", "envelope", "gift-box", "sound-button"].includes(type)) {
    node = element(mode === "thumbnail" ? "span" : "button", `gift-runtime-control gift-runtime-${type}`);
    if(model.id==='open-gift'&&document.elements.some(e=>e.id.startsWith('refresh-')))node.classList.add('gift-runtime-object-control');
    if (mode !== "thumbnail") node.type = "button";
    node.style.backgroundColor = p.color;
    if(type==='button')node.style.borderRadius=`${p.radius??12}px`;
    if(type==='button'&&p.variant==='text'){node.classList.add('gift-runtime-control-text');node.style.backgroundColor='transparent';node.style.color=p.color;}
    if(type==='envelope' && p.preset==='garden-gate-v1'){node.classList.add('gift-garden-gate');node.style.backgroundColor='#F8EBE6';node.style.color=p.color;}
    if(type==='envelope' && p.preset==='compact-v2')node.classList.add('gift-runtime-compact-envelope');
    const photoCaption=type==='envelope'&&p.preset==='photo-caption-v3';
    const botanical=type==='envelope'&&p.preset==='botanical-gate-v2';
    const controlBody=photoCaption?element('span','gift-envelope-footer'):botanical?element('span','gift-botanical-seal'):node;
    if(botanical){
      node.classList.add('gift-botanical-gate');node.style.setProperty('--garden-door-color',p.color);
      for(const side of ['left','right']){
        const panel=element('span',`gift-botanical-panel is-${side}`);panel.setAttribute('aria-hidden','true');
        const branch=element('span','gift-botanical-branch');branch.append(drawVector(gardenSprigPaths()));
        const bloom=element('span','gift-botanical-bloom');bloom.append(drawVector(gardenFlowerPaths()));
        panel.append(branch,bloom);node.append(panel);
      }
      controlBody.append(drawVector(gardenFlowerPaths()));node.append(controlBody);
    }
    if(photoCaption){controlBody.style.backgroundColor=p.color;node.classList.add('gift-envelope-photo-control');node.style.backgroundColor='transparent';node.append(controlBody);}
    if (!["button","sound-button"].includes(type) && !['garden-gate-v1','botanical-gate-v2'].includes(p.preset)) {
      // SVG cục bộ thay glyph emoji để biểu tượng giống nhau trên mọi hệ điều hành.
      const illustration = navigationArt[model.effects?.reaction?.id]
        || (type === "envelope" ? navigationArt.R01 : navigationArt.R02);
      const icon = element("span", "gift-runtime-control-icon gift-control-illustration");
      icon.setAttribute("aria-hidden", "true");
      if (illustration) icon.append(drawVector(illustration, {stretch:true}));
      controlBody.append(icon);
    }
    if (type === 'envelope' && p.preset === 'garden-gate-v1') {
      const mark = element('span', 'gift-garden-seal-mark'); mark.setAttribute('aria-hidden', 'true');
      mark.append(drawVector(gardenFlowerPaths({ petal: '#EAC4C0', center: '#BE9852', vein: p.color }))); controlBody.append(mark);
    }
    controlBody.append(
      element(
        "span",
        "gift-runtime-control-label",
        p.label || a.label || label("gift.runtime.continue"),
      ),
    );
    setAttr(node, "aria-label", a.label || p.label || label("gift.runtime.continue"));
    if(NATURAL_OPENINGS.includes(p.preset))decorateNaturalOpening(node,p,{assetUrl:id=>imageUrl(assetUrl(id),mode),mode,signal,renderImage:assetId=>renderElement({id:model.id+'-seal',type:'image',props:{assetId,fit:'contain'},accessibility:{decorative:true}},{document,assetUrl,mode,signal})});
      else if(DRIVE_OPENING_PRESETS.includes(p.preset))decorateDriveOpening(node,p.preset,p.label,p.color,p.sealColor,p.paperColor,mode,signal,p);
    if (mode === "editor") node.tabIndex = -1;
    else if (mode !== "thumbnail")
      node.addEventListener(
        "click",
        event => activate(node, event, null, model.actions),
        signal ? { signal } : {},
      );
  } else if (type === "interaction") {
    const interactionModel = p.clockSource === 'invitation' ? { ...model, props: { ...p, eventAt: document.invitation?.eventAt || null, timeZone: document.invitation?.timeZone || p.timeZone } } : model;
    node = renderInteraction(interactionModel, {
      mode, signal, motion, document, invitation,videoUrl:p.videoAssetId?imageUrl(assetUrl(p.videoAssetId),mode):null, bindings: document.bindings, activate, renderArt: drawVector,
      renderPhoto: photo => renderElement({
        id: photo.id, type: "image",
          props: { assetId: photo.assetId, fit: photo.fit||"cover", focalPoint: photo.focalPoint, optional: !photo.decorative },
          accessibility: { alt: photo.alt||'',...(photo.decorative?{decorative:true,label:NATURAL_ARTWORK_LABEL}:{}) },
      }, { document, assetUrl, mode, signal }),
    });
  } else if (type === 'reply' && p.replyMode === 'attendance' && mode !== 'thumbnail' && mode !== 'editor') {
    node = element('section', 'gift-runtime-reply gift-garden-rsvp');
    const attendance = replyAdapter?.attendance;
    mountGardenRsvp(node, attendance || { status: null, updatedAt: null, canRespond: mode === 'preview' }, {
      signal, recipientName: displayRecipient(document), title: p.title, color: p.color, appearance:p.appearance,
      eventAt: attendance?.eventAt || document.invitation?.eventAt, timeZone: attendance?.timeZone || document.invitation?.timeZone,
      submit: mode === 'preview' ? async body => ({ ...body, canRespond: true, updatedAt: new Date().toISOString() }) : attendance?.submit,
      onClosed: attendance?.onClosed || (() => {}),
    });
  } else if (type === "reply") {
    node = element("section", "gift-runtime-reply");
    setAttr(node, "aria-label", a.label || p.title || label("gift.reply.title"));
    if (mode === "thumbnail") {
      node.append(element("h2", "", p.title || label("gift.reply.send")));
      node.append(element("div", "gift-runtime-placeholder", label("gift.reply.placeholder")));
      applySurface(node, model.effects?.surface);
      return node;
    }
    node.append(
      element("h2", "", p.title || label("gift.reply.send")),
      element(
        "p",
        "gift-runtime-reply-privacy",
        mode === "public" ? ({
          link: label("gift.reply.linkAudience"),
          invite: label("gift.reply.inviteAudience"),
          sender: label("gift.reply.senderAudience"),
        }[replyAdapter?.replyAudience] || "") : label("gift.reply.preview"),
      ),
    );
    const form = element("form"),
      nameLabel = element("label", "", label("gift.reply.name")),
      name = element("input"),
      messageLabel = element("label", "", label("gift.reply.body")),
      message = element("textarea"),
      submit = element(
        "button",
        "gift-runtime-submit",
        p.submitLabel || label("gift.reply.send"),
      ),
      status = element("p", "gift-runtime-reply-status");
    if (p.color) submit.style.backgroundColor = p.color;
    name.name = "name";
    name.value = replyAdapter?.cardName?.slice(0, 50) || '';
    name.maxLength = 50;
    name.autocomplete = "name";
    message.name = "message";
    message.maxLength = 1000;
    message.required = true;
    message.rows = 3;
    submit.type = "submit";
    status.setAttribute("role", "status");
    nameLabel.append(name);
    messageLabel.append(message);
    form.append(nameLabel, messageLabel, submit, status);
    node.append(form);
    let foldedNote,foldedMessage,foldedHeading;
    if(p.replyMode==='message'){
      foldedNote=element('section','gift-drive-folded-note');foldedNote.hidden=true;foldedNote.setAttribute('role','status');
      foldedHeading=element('h3');foldedHeading.tabIndex=-1;foldedMessage=element('p','gift-drive-note-copy');
      const again=element('button','gift-drive-button',label('drive.writeAnother'));again.type='button';
      again.addEventListener('click',()=>{foldedNote.hidden=true;form.hidden=false;node.classList.remove('is-note-sent');message.focus();},signal?{signal}:{});
      foldedNote.append(foldedHeading,foldedMessage,again);node.append(foldedNote);
    }
    if (mode === "public" && !replyAdapter?.canSend) {
      form.hidden = true;
      node.append(element("p", "", label(replyAdapter?.repliesDisabled
        ? "gift.reply.disabled" : "gift.reply.inviteRequired")));
    }
    const replies = element("div", "gift-runtime-replies");
    const displayedReplies = new Set();
    node.append(replies);
    replies.hidden = mode === "public" && !replyAdapter?.canRead;
    const appendReply = (reply) => {
      if (reply.id && displayedReplies.has(reply.id)) return;
      if (reply.id) displayedReplies.add(reply.id);
      const item = element("blockquote");
      item.append(
        element("p", "", reply.message),
        element("cite", "", reply.name || label("gift.reply.recipient")),
      );
      replies.prepend(item);
    };
    if (mode === "editor") {
      for (const control of [name, message, submit]) {
        control.disabled = true;
        control.tabIndex = -1;
      }
    } else
      form.addEventListener(
        "submit",
        async (event) => {
          event.preventDefault();
          if (!form.reportValidity() || submit.disabled) return;
          submit.disabled = true;
          setText(status, label("gift.reply.sending"));
          try {
            const input = {
              name: name.value.trim(),
              message: message.value.trim(),
            };
            if (!input.message) throw new Error(t("gift.reply.enter"));
            const reply =
              mode === "preview"
                ? input
                : await replyAdapter?.send(input, { signal });
            if (signal?.aborted) return;
            if (!reply)
              throw new Error(t("gift.reply.tryAgain"));
            appendReply(reply);
            message.value = "";
            setText(status, label(mode === "preview" ? "gift.reply.previewSent" : "gift.reply.sent"));
            if(foldedNote){setText(foldedHeading,label(mode==='preview'?'gift.reply.previewSent':'drive.noteSent'));foldedMessage.textContent=reply.message;form.hidden=true;foldedNote.hidden=false;node.classList.add('is-note-sent');foldedHeading.focus();}
            onReply(reply);
          } catch (error) {
            if (!signal?.aborted)
              setText(status, error.message || label("gift.reply.sendFailed"));
          } finally {
            if (!signal?.aborted) submit.disabled = false;
          }
        },
        signal ? { signal } : {},
      );
    if (mode === "public" && replyAdapter?.list)
      Promise.resolve()
        .then(() => (signal?.aborted ? [] : replyAdapter.list({ signal })))
        .then((items) => {
          if (!signal?.aborted) items.slice().reverse().forEach(appendReply);
        })
        .catch(() => {
          if (!signal?.aborted)
            setText(status, label("gift.reply.loadFailed"));
        });
  } else throw new Error(t("gift.runtime.unsupportedElement"));
  if(['paper-soft-v2','garden-soft-v2'].includes(p.appearance)&&type==='reply'){if(p.appearance==='paper-soft-v2')node.classList.add('gift-drive-note-soft');node.style.setProperty('--drive-radius',(p.cornerRadius??24)+'px');}
  prepareMotionLayers(node,model);
  if(model.accessibility?.label==='Momevia Drive vinyl v1')node.classList.add('gift-drive-vinyl');
  node.dataset.runtimeElement = model.id;
  applySurface(node, model.effects?.surface);
  if (model.visible === false) node.hidden = true;
  if (model.opacity !== undefined) node.style.opacity = String(model.opacity);
  return node;
}
