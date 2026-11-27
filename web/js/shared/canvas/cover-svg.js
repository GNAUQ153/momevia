import { PAPER_GRAIN_SVG } from './paper-grain.js';
import { STICKERS } from './registry.js';
import { validateDocument } from './schema.js';
import { heartPieces, masks, vectorParts } from './artwork.js';
import { interactionKinds } from './interactions.js';
import {EVENT_MEDIA} from './event-media.js';
import { stationeryFlow, paperSlices } from './stationery-flow.js';

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function assemblySvg(node,images){
 const {assembly,props:p,id,layout:{width:w,height:h}}=node,paint=v=>v==='color'?p.color:v==='strokeColor'?p.strokeColor||p.color:v;
 const draw=part=>{
  const index=assembly.parts.indexOf(part),clipId=`assembly-${id}-${index}`,rest=part.rest||{},transform=rest.x!==undefined||rest.y!==undefined||rest.rotation!==undefined?` transform="translate(${rest.x||0} ${rest.y||0}) rotate(${rest.rotation||0} ${part.anchor.x*100} ${part.anchor.y*100})"`:'';
  const boundary=part.clip?(part.clip.d?`<path clip-rule="evenodd" d="${escape(part.clip.d)}"/>`:part.clip.x!==undefined?`<rect x="${part.clip.x}" y="${part.clip.y}" width="${part.clip.width}" height="${part.clip.height}"/>`:`<ellipse cx="${part.clip.cx}" cy="${part.clip.cy}" rx="${part.clip.rx}" ry="${part.clip.ry}"/>`):'';
  const media=part.image&&(images.get(part.image.mediaId)||images.get(p.assetId)),picture=part.image&&media?`<image href="${escape(media.url)}" x="${part.image.x}" y="${part.image.y}" width="${part.image.width}" height="${part.image.height}" preserveAspectRatio="none"/>`:'';
  const paths=part.vector.paths.map(path=>`<path d="${escape(path.d)}" fill="${paint(path.fill)||'none'}" stroke="${paint(path.stroke)||'none'}" stroke-width="${path.strokeWidth==='strokeWidth'?p.strokeWidth||0:path.strokeWidth||0}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return `${boundary?`<clipPath id="${clipId}">${boundary}</clipPath>`:''}<g${transform}${rest.opacity!==undefined?` opacity="${rest.opacity}"`:''}${boundary?` clip-path="url(#${clipId})"`:''}>${picture}${paths}${assembly.parts.filter(child=>child.parent===part.id).map(draw).join('')}</g>`;
 };
 const raster=assembly.parts.find(p=>p.image),media=raster&&EVENT_MEDIA[raster.image.mediaId],aspect=media?media.width/media.height:1;
 return `<svg width="${w}" height="${h}" viewBox="0 0 ${100*aspect} 100"><g transform="scale(${aspect} 1)">${assembly.parts.filter(part=>!part.parent).map(draw).join('')}</g></svg>`;
}

function recipeSurface(body,node,id){
 const preset=node.effects?.surface,animation=preset?.definition?.animation;if(animation?.engine!=='surface')return body;
 const v=animation.styles,{width:w,height:h}=node.layout;
 if(v.backgroundColor)body=`<rect width="${w}" height="${h}" rx="${v.borderRadius||0}" fill="${v.backgroundColor}"/>`+body;
 if(node.type==='text'&&v.color)body=body.replace(`fill="${node.props.color}"`,`fill="${v.color}"`);
 if(v.texture==='paper-grain-v1')body+=`<rect width="${w}" height="${h}" fill="url(#momevia-cotton-grain)"/>`;
 if(v.borderWidth)body+=`<rect x="${v.borderWidth/2}" y="${v.borderWidth/2}" width="${Math.max(1,w-v.borderWidth)}" height="${Math.max(1,h-v.borderWidth)}" rx="${v.borderRadius||0}" fill="none" stroke="${v.borderColor||'#32243B'}" stroke-width="${v.borderWidth}"/>`;
 const filter=[...(v.blur?[`<feGaussianBlur stdDeviation="${v.blur}"/>`]:[]),...(v.shadowBlur!==undefined?[`<feDropShadow dx="${v.shadowX??0}" dy="${v.shadowY??4}" stdDeviation="${v.shadowMode==='alpha'?v.shadowBlur:v.shadowBlur/2}" flood-color="${preset.color||v.shadowColor||'#32243B'}" flood-opacity="${v.shadowOpacity??1}"/>`]:[])].join('');
 return filter?`<filter id="depth-${id}" x="-70%" y="-70%" width="240%" height="240%">${filter}</filter><g filter="url(#depth-${id})">${body}</g>`:body;
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const fullWidth = /[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Ideographic}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
// Upper advances in hundredths of an em, in alphabet order. These cover the
// actual Lora/Times and Arial fonts on the SVG, including their bold variants.
// A single average width breaks valid authored lines with Vietnamese diacritics.
const coverAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ĐđƠơƯư';
const coverAdvances = {
  body: [
    73,73,73,73,67,62,78,73,28,56,73,62,84,73,78,67,78,73,67,62,73,67,95,67,67,62,
    56,62,56,62,56,34,62,62,28,28,56,28,89,62,62,62,62,39,56,34,62,56,78,56,56,50,
    56,56,56,56,56,56,56,56,56,56,73,62,86,72,86,73,
  ],
  serif: [
    73,67,73,75,67,62,78,78,39,50,78,67,95,77,80,62,80,73,57,67,76,73,106,73,73,67,
    52,59,54,60,55,35,56,60,29,34,56,28,90,61,59,60,58,45,47,40,60,53,83,53,55,52,
    63,50,54,56,55,55,58,50,57,58,75,60,81,60,81,62,
  ],
};

function clusterWidth(cluster, serif, embeddedSerif) {
  if (fullWidth.test(cluster) || cluster.includes('\u200d')) return 1.16;
  const decomposed = cluster.normalize('NFD');
  const base = decomposed.includes('\u031b') ? (decomposed[0] + '\u031b').normalize('NFC') : decomposed[0];
  const index = coverAlphabet.indexOf(base);
  if (index >= 0) {
    const advance = coverAdvances[serif ? 'serif' : 'body'][index] / 100;
    return (advance + .012) * (serif && !embeddedSerif ? 1.16 : 1);
  }
  if (/[.,'!:;|]/.test(base)) return .35;
  return 1.04;
}

function wrap(text, width, size, font, embeddedSerif = false) {
  const serif = font === 'serif';
  const budget = width / size;
  const limit = Math.max(1, Math.floor(budget / (serif ? .51 : .54)));
  return text.normalize('NFC').split('\n').flatMap(paragraph => {
    const lines = [];
    let line = '', used = 0, count = 0;
    const flush = () => { lines.push(line); line = ''; used = 0; count = 0; };
    for (const word of paragraph.trim().split(/\s+/)) {
      if (!word) continue;
      const letters = Array.from(graphemes.segment(word), part => part.segment);
      const advances = letters.map(letter => clusterWidth(letter, serif, embeddedSerif));
      const wordWidth = advances.reduce((sum, value) => sum + value, 0);
      if (line && (count + 1 + letters.length > limit || used + .29 + wordWidth > budget)) flush();
      if (line) { line += ' '; used += .29; count += 1; }
      for (let i = 0; i < letters.length; i++) {
        if (line && (count >= limit || used + advances[i] > budget)) flush();
        line += letters[i]; used += advances[i]; count += 1;
      }
    }
    lines.push(line);
    return lines;
  });
}

function photoSvg(photo, media, w, h, id) {
  const url = media?.url || media;
  let inner;
  if (typeof url === 'string' && /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(url)) {
    if (media?.width && media?.height) {
      const scale = (photo.fit === 'contain' ? Math.min : Math.max)(w / media.width, h / media.height);
      const width = media.width * scale, height = media.height * scale;
      const x = (w - width) * (photo.focalPoint?.x ?? .5), y = (h - height) * (photo.focalPoint?.y ?? .5);
      inner = `<image x="${x}" y="${y}" width="${width}" height="${height}" href="${url}"/>`;
    } else inner = `<image width="${w}" height="${h}" href="${url}" preserveAspectRatio="xMidYMid ${photo.fit === 'contain' ? 'meet' : 'slice'}"/>`;
  } else if (photo.optional) inner = `<svg width="${w}" height="${h}" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M0 0H100V100H0Z" fill="#EBDEF4"/><circle cx="71" cy="29" r="11" fill="#FFF2C9"/><path d="M0 82 28 43 54 72 67 55 100 87V100H0Z" fill="#AD94BF"/><path d="M0 92 23 75 46 87 77 73 100 86V100H0Z" fill="#7F698F"/></svg>`;
  if (!inner) return '';
  if (photo.mask || photo.optional || media?.width) {
    const clip = photo.mask ? `<path d="${escape(photo.maskPath || masks[photo.mask])}" transform="scale(${w/100} ${h/100})"/>` : `<rect width="${w}" height="${h}" rx="${photo.radius || 0}"/>`;
    return `<clipPath id="photo-${id}">${clip}</clipPath><g clip-path="url(#photo-${id})">${inner}</g>`;
  }
  return inner;
}

function labelSvg(text, x, y, w, size = 16, color = '#32243B') {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="Arial,sans-serif" font-size="${size}">${wrap(text,w,size,'body').slice(0,3).map((line,i)=>
    `<tspan x="${x}" dy="${i*size}">${escape(line)}</tspan>`).join('')}</text>`;
}

function interactionSvg(node, images) {
  const p = node.props, {width:w,height:h} = node.layout;
  const { label, icon } = interactionKinds[p.kind];
  const background = `<rect width="${w}" height="${h}" rx="14" fill="${p.color}"/>`;
  const panel = (x,y,width,height,fill='#FFF7EE') => `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" fill="${fill}"/>`;
  if (p.kind === 'light-a-candle' && ['cake-overlay-v1','cake-photo-v2'].includes(p.appearance)) return panel(0,h-54,w,54,'#FFF8F0') + labelSvg(p.entries[0].heading,16,h-20,w-32);
  if (p.kind === 'prediction-choice') {
    const compact = h < 400, row = compact ? Math.max(42, (h - 88) / 2) : 112;
    const first = compact ? 76 : 170;
    return background + labelSvg(p.question, 20, compact ? 30 : 42, w-40, compact ? 19 : 22) +
      ['A', 'B'].map((id, i) => panel(16, first + i * row, w-32, row - (compact ? 6 : 18), i ? '#FBE8EB' : '#F4EBFA') +
        labelSvg(`${id} - ${p['option'+id]}`, 28, first + i * row + (compact ? 24 : 36), w-56, compact ? 16 : 18)).join('');
  }
  if (p.photos) {
    const compare = p.kind === 'photo-comparison';
    const a = (compare ? p.photos[0] : p.photos.find(photo => photo.assetId)) || p.photos[0], b = p.photos[1];
    const width = w - 24, height = Math.max(1,h - 86);
    const image = (photo, key) => photoSvg({...photo,optional:true},images.get(photo.assetId),width,height,`${node.id}-${key}`);
    const photo = compare ? image(b,'after') + `<clipPath id="split-${node.id}"><rect width="${width/2}" height="${height}"/></clipPath><g clip-path="url(#split-${node.id})">${image(a,'before')}</g><path d="M${width/2} 0v${height}" stroke="#FFF7EE" stroke-width="4"/>` : image(a,'page');
    return background + `<g transform="translate(12 12)">${photo}</g>` + labelSvg(a.caption || (compare ? 'Ảnh trước - Ảnh sau' : 'Trước - Ảnh 1 - Sau'),12,height+36,width);
  }
  if (p.kind === 'scene-choices') return background + p.entries.map((entry,i) => {
    const width = w/2-20, x = 12+i*w/2;
    return `<path d="M${x} ${h-14}V${h*.44}a${width/2} ${h*.36} 0 0 1 ${width} 0V${h-14}Z" fill="${i ? '#E5F2E8' : '#FFF4D3'}" stroke="#76508C" stroke-width="2"/>` +
      labelSvg(entry.heading,x+9,h*.56,width-18);
  }).join('');
  if (p.kind === 'scratch-ticket') return background + `<path d="M12 12H${w-12}V${h*.48}L${w*.76} ${h*.69}H12Z" fill="#81649B"/>` +
    labelSvg(p.entries[0].heading,22,40,w-44,16,'#FFFFFF') + labelSvg('Mở ngay',20,h-18,w-40);
  if (p.kind === 'foldout-letter' || p.kind === 'wish-pick') return background + p.entries.map((entry,i) => {
    const y = 12 + i*(h-20)/3;
    return panel(11,y,w-22,(h-32)/3) + labelSvg(entry.heading,20,y+22,w-44);
  }).join('');
  if (p.kind === 'heart-puzzle') return background + `<svg x="${w/2-43}" y="6" width="86" height="86" viewBox="0 0 100 100">${heartPieces.map((d,i) =>
    `<path d="${d}" fill="${['#a93a61','#c0517b','#88284f'][i]}" stroke="#fff3f8" stroke-width="3"/>`).join('')}</svg>` +
    labelSvg(p.entries[0].heading,16,h-23,w-32);
  return background + labelSvg(icon,16,45,w-32,32,'#8C4D76') +
    labelSvg(p.entries[0].heading || label,16,76,w-32) +
    (p.kind === 'event-countdown' ? labelSvg('00 : 00 : 00',16,123,w-32,25) : '');
}

export function previewSvg(document, sceneId = document.entrySceneId, images = new Map(), { serifWoff2, validationMode = 'publish', locale = 'vi', ariaLabel } = {}) {
  validateDocument(document, { mode: validationMode, requiredBindings: [] });
  const scene = document.scenes.find(s => s.id === sceneId), size = { ...document.artboard.baseSize };
  const nodes = new Map(document.elements.map(element => [element.id, element]));
  const measured = new Map((scene.flow?document.elements.filter(e=>e.type==='text'&&scene.elementIds.includes(e.id)):[]).map(e=>{
    const value=e.props.textBinding?document.bindings[e.props.textBinding].value:e.props.text;
    return [e.id,wrap(value,e.layout.width,e.props.fontSize,e.props.fontToken,Boolean(serifWoff2)).length*e.props.fontSize*(e.props.lineHeight||1.4)];
  }));
  const flow = stationeryFlow(scene, document.elements, measured);
  size.height += flow.growth;
  const content = scene.elementIds.map(id => {
    const original = nodes.get(id); if (original.visible === false) return '';
    const node = flow.layouts.has(id) ? { ...original, layout: flow.layouts.get(id) } : original;
    const { x, y, width: w, height: h, rotation } = node.layout, p = node.props;
    const rotate = rotation ? ` transform="rotate(${rotation} ${w / 2} ${h / 2})"` : '';
    let body = '';
    const vector = vectorParts(node);
    if(node.assembly){
      body=assemblySvg(node,images);
    } else if (vector) {
      const preserve = node.type !== 'sticker' || ['paper-wave', 'lace', 'bunting', 'washi-tape'].includes(p.stickerId) ? 'none' : 'xMidYMid meet';
      body = `<svg width="${w}" height="${h}" viewBox="0 0 100 100" preserveAspectRatio="${preserve}">${vector.map(part =>
        `<path stroke-linecap="round" stroke-linejoin="round" ${Object.entries(part).filter(([, value]) => value != null).map(([key, value]) => `${key}="${escape(value)}"`).join(' ')}/>`).join('')}</svg>`;
    } else if (node.type === 'shape') body = p.kind === 'ellipse'
      ? `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${p.color}" stroke="${p.strokeColor}" stroke-width="${p.strokeWidth || 0}"/>`
      : `<rect width="${w}" height="${h}" rx="${p.radius || 0}" fill="${p.color}" stroke="${p.strokeColor}" stroke-width="${p.strokeWidth || 0}"/>`;
    else if (node.type === 'line') body = `<path d="M0 1H${w}" stroke="${p.color}" stroke-width="${p.strokeWidth || 1}"/>`;
    else if (node.type === 'text') {
      const text = p.textBinding ? document.bindings[p.textBinding].value : p.text;
      const lines = wrap(text, w, p.fontSize, p.fontToken,Boolean(serifWoff2)), anchor = p.align === 'center' ? 'middle' : p.align === 'right' ? 'end' : 'start';
      const tx = anchor === 'middle' ? w / 2 : anchor === 'end' ? w : 0;
      body = `<text x="${tx}" y="${p.fontSize}" fill="${p.color}" font-family="${p.fontToken === 'serif' ? 'Georgia,serif' : 'Arial,sans-serif'}" font-size="${p.fontSize}" font-weight="${node.accessibility.role === 'heading' ? '700' : '400'}" text-anchor="${anchor}">${lines.map((line, i) => `<tspan x="${tx}" dy="${i ? p.fontSize * (p.lineHeight || 1.4) : 0}">${p.dropCap && !i ? `<tspan font-size="${p.fontSize*1.65}">${escape(line[0] || '')}</tspan>${escape(line.slice(1))}` : escape(line)}</tspan>`).join('')}</text>`;
    } else if (node.type === 'sticker') body = `<text x="${w / 2}" y="${h * .77}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${Math.min(w, h) * .8}" fill="${p.color}">${escape(STICKERS[p.stickerId])}</text>`;
    else if (['button', 'envelope', 'gift-box', 'sound-button'].includes(node.type)) {
      const envelope = node.type === 'envelope', box = node.type === 'gift-box', photoCaption=envelope&&p.preset==='photo-caption-v3';
      body = `<rect y="${photoCaption?h-60:0}" width="${w}" height="${photoCaption?60:h}" rx="${envelope ? 12 : 16}" fill="${p.color}"/>`;
      if (envelope && !['compact-v2','photo-caption-v3'].includes(p.preset)) body += `<rect x="${w / 2 - 39}" y="${h / 2 - 39}" width="78" height="52" rx="4" fill="#FFFFFF"/><path d="M${w / 2 - 39} ${h / 2 - 39}l39 28 39-28" fill="none" stroke="${p.color}" stroke-width="2"/><path d="M${w / 2 - 39} ${h / 2 + 13}l25-21m53 21-25-21" fill="none" stroke="${p.color}" stroke-width="1"/>`;
      if (box) body += `<rect x="${w / 2 - 29}" y="${h / 2 - 35}" width="58" height="44" rx="3" fill="#FFFFFF"/><path d="M${w / 2} ${h / 2 - 39}v50m-33-37h66" stroke="${p.color}" stroke-width="7"/><path d="M${w / 2} ${h / 2 - 36}c-34-25-25-42-9-19l9 19 9-19c16-23 25-6-9 19" fill="none" stroke="#FFFFFF" stroke-width="3"/>`;
      body += `<text x="${w / 2}" y="${photoCaption?h-24:(envelope && !['compact-v2','photo-caption-v3'].includes(p.preset)) || box ? h - 24 : h / 2 + 6}" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="${envelope || box ? 17 : 16}" text-anchor="middle">${escape(p.label)}</text>`;
    } else if (node.type === 'image') {
      const photoHeight = p.caption ? Math.max(1, h - 32) : h;
      const media=images.get(p.assetId);
      body = flow.surfaces.has(id)&&media?.width&&media?.height&&/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(media.url)
        ? paperSlices(media.width,media.height,w,photoHeight).map(s=>`<svg x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" viewBox="${s.sx} ${s.sy} ${s.sw} ${s.sh}" preserveAspectRatio="none"><image href="${escape(media.url)}" width="${media.width}" height="${media.height}"/></svg>`).join('')
        : photoSvg(p, media, w, photoHeight, node.id);
      if (p.caption) body += `<rect y="${photoHeight}" width="${w}" height="32" fill="#FFF7EE"/><text x="6" y="${photoHeight+16}" font-family="Arial,sans-serif" font-size="14" fill="#32243B">${wrap(p.caption,w-12,14,'body').slice(0,2).map((line,i)=>`<tspan x="6" dy="${i*14}">${escape(line)}</tspan>`).join('')}</text>`;
    } else if (node.type === 'interaction') body = interactionSvg(node, images);
    else if (node.type === 'reply') body = `<rect width="${w}" height="${h}" rx="20" fill="#FFFFFF"/><text x="18" y="35" fill="#32243B" font-size="20" font-family="Arial,sans-serif">${escape(p.title)}</text><rect x="18" y="70" width="${w - 36}" height="42" rx="8" fill="#F7F4FA"/><rect x="18" y="130" width="${w - 36}" height="88" rx="8" fill="#F7F4FA"/>`;
    const surface = node.effects?.surface;
    if (surface?.id === 'S01' || surface?.id === 'S04') {
      const shadow = surface.id === 'S01';
      body = `<filter id="surface-${id}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${shadow ? 4 : 0}" dy="${shadow ? 7 : 0}" stdDeviation="${shadow ? 5 : 3}" flood-color="${surface.color || (shadow ? '#32243B' : '#F3DA97')}" flood-opacity="${shadow ? .25 : .85}"/></filter><g filter="url(#surface-${id})">${body}</g>`;
    }
    if (surface?.id === 'S02') body += `<rect x="-3" y="-3" width="${w+6}" height="${h+6}" fill="none" stroke="${surface.color || '#6D488A'}"/><rect width="${w}" height="${h}" fill="none" stroke="${surface.color || '#6D488A'}"/>`;
    if (surface?.id === 'S03') body += `<rect width="${w}" height="${h}" fill="url(#canvas-paper-grain)"/>`;
    body=recipeSurface(body,node,id);
    return `<g transform="translate(${x} ${y})" opacity="${node.opacity ?? 1}"><g${rotate}>${body}</g></g>`;
  }).join('');
  const grain = scene.effects?.surface?.id === 'S03' || content.includes('url(#canvas-paper-grain)');
  const pattern = grain ? '<defs><pattern id="canvas-paper-grain" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".6" fill="#452962" opacity=".10"/></pattern></defs>' : '';
  const sceneGrain = scene.effects?.surface?.id === 'S03' ? '<rect width="100%" height="100%" fill="url(#canvas-paper-grain)"/>' : '';
  const cotton=scene.effects?.surface?.definition?.animation?.styles?.texture==='paper-grain-v1'||content.includes('url(#momevia-cotton-grain)');
  const grainMarkup=PAPER_GRAIN_SVG.replace(/^<svg[^>]*>|<\/svg>$/g,'').replaceAll('id="n"','id="momevia-cotton-noise"').replaceAll('url(#n)','url(#momevia-cotton-noise)');
  const cottonPattern=cotton?`<defs><pattern id="momevia-cotton-grain" width="128" height="128" patternUnits="userSpaceOnUse">${grainMarkup}</pattern></defs>`:'';
  const cottonScene=scene.effects?.surface?.definition?.animation?.styles?.texture==='paper-grain-v1'?'<rect width="100%" height="100%" fill="url(#momevia-cotton-grain)"/>':'';
  const embeddedSerif = serifWoff2 && content.includes('Georgia,serif') &&
    /^[a-z0-9+/=]+$/i.test(serifWoff2);
  const font = embeddedSerif ? `<style>@font-face{font-family:"Momevia Cover";src:url(data:font/woff2;base64,${serifWoff2}) format("woff2")}</style>` : '';
  const artwork = embeddedSerif
    ? content.replaceAll('font-family="Georgia,serif"', 'font-family="Momevia Cover,Times New Roman,serif"')
    : content;
  const language = locale === 'en' ? 'en' : 'vi';
  const label = ariaLabel || (language === 'en' ? 'Momevia gift preview' : 'Bản xem trước mẫu quà Momevia');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}" lang="${language}" xml:lang="${language}" role="img" aria-label="${escape(label.normalize('NFC'))}">${font}${pattern}${cottonPattern}<rect width="100%" height="100%" fill="${scene.background.color}"/>${sceneGrain}${cottonScene}${artwork.normalize('NFC')}</svg>\n`;
}

