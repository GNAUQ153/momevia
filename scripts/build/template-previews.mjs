import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASIC_TEMPLATES, templatePreviewDocument } from '../../web/js/shared/canvas/index.js';
import { STICKERS } from '../../web/js/shared/canvas/registry.js';
import { validateDocument } from '../../web/js/shared/canvas/schema.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function wrap(text, width, size, font) {
  const limit = Math.max(5, Math.floor(width / (size * (font === 'serif' ? .51 : .54))));
  return text.split('\n').flatMap(paragraph => {
    const result = []; let line = '';
    for (const word of paragraph.split(/\s+/)) {
      if (line && (line + ' ' + word).length > limit) { result.push(line); line = word; }
      else line += (line ? ' ' : '') + word;
    }
    result.push(line); return result;
  });
}

export function previewSvg(document, sceneId = document.entrySceneId) {
  validateDocument(document, { mode: 'publish' });
  const scene = document.scenes.find(s => s.id === sceneId), size = document.artboard.baseSize;
  const nodes = new Map(document.elements.map(element => [element.id, element]));
  const content = scene.elementIds.map(id => {
    const node = nodes.get(id); if (node.visible === false) return '';
    const { x, y, width: w, height: h, rotation } = node.layout, p = node.props;
    const rotate = rotation ? ` transform="rotate(${rotation} ${w / 2} ${h / 2})"` : '';
    let body = '';
    if (node.type === 'shape') body = p.kind === 'ellipse'
      ? `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${p.color}" stroke="${p.strokeColor}" stroke-width="${p.strokeWidth || 0}"/>`
      : `<rect width="${w}" height="${h}" rx="${p.radius || 0}" fill="${p.color}" stroke="${p.strokeColor}" stroke-width="${p.strokeWidth || 0}"/>`;
    else if (node.type === 'line') body = `<path d="M0 1H${w}" stroke="${p.color}" stroke-width="${p.strokeWidth || 1}"/>`;
    else if (node.type === 'text') {
      const text = p.textBinding ? document.bindings[p.textBinding].value : p.text;
      const lines = wrap(text, w, p.fontSize, p.fontToken), anchor = p.align === 'center' ? 'middle' : p.align === 'right' ? 'end' : 'start';
      const tx = anchor === 'middle' ? w / 2 : anchor === 'end' ? w : 0;
      body = `<text x="${tx}" y="${p.fontSize}" fill="${p.color}" font-family="${p.fontToken === 'serif' ? 'Georgia,serif' : 'Arial,sans-serif'}" font-size="${p.fontSize}" font-weight="${node.accessibility.role === 'heading' ? '700' : '400'}" text-anchor="${anchor}">${lines.map((line, i) => `<tspan x="${tx}" dy="${i ? p.fontSize * (p.lineHeight || 1.4) : 0}">${escape(line)}</tspan>`).join('')}</text>`;
    } else if (node.type === 'sticker') body = `<text x="${w / 2}" y="${h * .77}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${Math.min(w, h) * .8}" fill="${p.color}">${escape(STICKERS[p.stickerId])}</text>`;
    else if (['button', 'envelope', 'gift-box'].includes(node.type)) {
      const envelope = node.type === 'envelope', box = node.type === 'gift-box';
      body = `<rect width="${w}" height="${h}" rx="${envelope ? 12 : 16}" fill="${p.color}"/>`;
      if (envelope) body += `<rect x="${w / 2 - 39}" y="${h / 2 - 39}" width="78" height="52" rx="4" fill="#FFFFFF"/><path d="M${w / 2 - 39} ${h / 2 - 39}l39 28 39-28" fill="none" stroke="${p.color}" stroke-width="2"/><path d="M${w / 2 - 39} ${h / 2 + 13}l25-21m53 21-25-21" fill="none" stroke="${p.color}" stroke-width="1"/>`;
      if (box) body += `<rect x="${w / 2 - 29}" y="${h / 2 - 35}" width="58" height="44" rx="3" fill="#FFFFFF"/><path d="M${w / 2} ${h / 2 - 39}v50m-33-37h66" stroke="${p.color}" stroke-width="7"/><path d="M${w / 2} ${h / 2 - 36}c-34-25-25-42-9-19l9 19 9-19c16-23 25-6-9 19" fill="none" stroke="#FFFFFF" stroke-width="3"/>`;
      body += `<text x="${w / 2}" y="${envelope || box ? h - 24 : h / 2 + 6}" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="${envelope || box ? 17 : 16}" text-anchor="middle">${escape(p.label)}</text>`;
    } else if (node.type === 'reply') body = `<rect width="${w}" height="${h}" rx="20" fill="#FFFFFF"/><text x="18" y="35" fill="#32243B" font-size="20" font-family="Arial,sans-serif">${escape(p.title)}</text><rect x="18" y="70" width="${w - 36}" height="42" rx="8" fill="#F7F4FA"/><rect x="18" y="130" width="${w - 36}" height="88" rx="8" fill="#F7F4FA"/>`;
    return `<g transform="translate(${x} ${y})" opacity="${node.opacity ?? 1}"><g${rotate}>${body}</g></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}" role="img" aria-label="Bản xem trước mẫu quà Momevia"><rect width="100%" height="100%" fill="${scene.background.color}"/>${content}</svg>\n`;
}

export function buildTemplatePreviews() {
  const directory = path.join(root, 'web/assets/basic-templates'); fs.mkdirSync(directory, { recursive: true });
  for (const id of Object.keys(BASIC_TEMPLATES)) fs.writeFileSync(path.join(directory, `${id}.svg`), previewSvg(templatePreviewDocument({ id })), 'utf8');
  console.log(`Built ${Object.keys(BASIC_TEMPLATES).length} editable-template cover previews.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildTemplatePreviews();
