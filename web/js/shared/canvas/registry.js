// This module is shared verbatim by Node and the browser. No environment or I/O.
import {MOTION_LIMITS} from './motion-stack.js';
import { stickerArt } from './artwork.js';
import { canonicalText } from '../locale.js';
import { libraryEntry } from './library-state.js';
const descriptors = {
  'sound-button': { label: canonicalText('editor.element.sound-button'), renderer: 'sound-button', defaults: {label: canonicalText('sfx.listen'),color:'#6136DF'}, inspector:['label','color','optional'], accessibility:{},actions:[],capability:'basic' },
  text: { label: canonicalText('editor.element.text'), renderer: 'text', defaults: { text: canonicalText('editor.element.defaultGreeting'), fontToken: 'body', fontSize: 24, align: 'left', color: '#32243B' }, inspector: ['text', 'textBinding', 'fontToken', 'fontSize', 'align', 'color', 'fontStyle'], accessibility: { role: 'paragraph' }, actions: [], capability: 'basic' },
  image: { label: canonicalText('editor.element.image'), renderer: 'image', defaults: { assetId: null, fit: 'cover', focalPoint: { x: 0.5, y: 0.5 }, radius: 16 }, inspector: ['assetId', 'fit', 'focalPoint', 'radius', 'mask', 'maskPath', 'optional', 'caption', 'placeholder'], accessibility: { alt: canonicalText('editor.element.photoAlt') }, actions: [], capability: 'basic' },
  shape: { label: canonicalText('editor.element.shape'), renderer: 'shape', defaults: { kind: 'rectangle', color: '#D9C8FF', strokeColor: '#6136DF', strokeWidth: 0, radius: 12 }, inspector: ['kind', 'color', 'strokeColor', 'strokeWidth', 'radius'], accessibility: { decorative: true }, actions: [], capability: 'basic' },
  line: { label: canonicalText('editor.element.line'), renderer: 'line', defaults: { color: '#6136DF', strokeWidth: 3 }, inspector: ['color', 'strokeWidth', 'pattern'], accessibility: { decorative: true }, actions: [], capability: 'basic' },
  sticker: { label: canonicalText('editor.element.sticker'), renderer: 'sticker', defaults: { stickerId: 'heart', color: '#F45278' }, inspector: ['stickerId', 'color', 'strokeColor'], accessibility: { decorative: true }, actions: [], capability: 'basic' },
  button: { label: canonicalText('editor.element.button'), renderer: 'button', defaults: { label: canonicalText('gift.runtime.continue'), color: '#6136DF' }, inspector: ['label', 'color','variant','placement','radius'], accessibility: { label: canonicalText('gift.runtime.continue') }, actions: ['goToScene', 'replay', 'openEventMap', 'saveEventCalendar'], capability: 'basic' },
  envelope: { label: canonicalText('editor.element.envelope'), renderer: 'envelope', defaults: { preset: 'classic', label: canonicalText('templates.copy.openGift'), color: '#76518E' }, inspector: ['label','cardText','assetId','sealAssetId', 'color', 'preset', 'sealColor', 'paperColor','cornerRadius','motionSpeed','paperRelief','objectDepth'], accessibility: { label: canonicalText('templates.copy.openGift') }, actions: ['goToScene', 'replay'], capability: 'basic' },
  'gift-box': { label: canonicalText('editor.element.gift-box'), renderer: 'gift-box', defaults: { preset: 'classic', label: canonicalText('editor.element.openBox'), color: '#B93659' }, inspector: ['label','cardText','assetId', 'color','sealColor','paperColor', 'preset','cornerRadius','motionSpeed','objectDepth'], accessibility: { label: canonicalText('editor.element.openBox') }, actions: ['goToScene', 'replay'], capability: 'basic' },
  reply: { label: canonicalText('editor.element.reply'), renderer: 'reply', defaults: { title: canonicalText('gift.reply.send'), submitLabel: canonicalText('gift.reply.send') }, inspector: ['title', 'submitLabel', 'color', 'replyMode', 'appearance','cornerRadius'], accessibility: { label: canonicalText('editor.element.replyAlt') }, actions: [], capability: 'basic' },
  interaction: { label: canonicalText('editor.element.interaction'), renderer: 'interaction', defaults: { color: '#F5EFFF' }, inspector: ['kind', 'appearance', 'color', 'videoAssetId', 'objectAssetId', 'cornerRadius', 'motionSpeed', 'inkColor', 'accentColor', 'detailColor', 'entries', 'photos', 'eventAt', 'timeZone', 'optional', 'autoplay', 'zoom', 'bodyBinding', 'clockMode', 'clockSource', 'paperRelief','objectDepth', 'question', 'optionA', 'optionB', 'prediction', 'reason', 'endingA', 'endingB'], accessibility: {}, actions: [], capability: 'extended' },
};
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
export const registry = freeze(descriptors);
export const STICKERS = freeze({ heart: '♥', star: '★', flower: '✿', sparkles: '✦', balloon: '', cake: '', gift: '',
  ...Object.fromEntries(Object.keys(stickerArt).map(key => [key, ''])) });
export const FONT_TOKENS = ['body', 'heading', 'serif'];
export const BINDINGS = ['recipientName', 'senderName', 'message'];
export const LIMITS = freeze({ documentBytes: 262144, motionRows: MOTION_LIMITS.rows, motionParts: MOTION_LIMITS.parts, motionTracks: MOTION_LIMITS.tracks, scenes: 32, elements: 400, assets: 64, actionsPerElement: 2, depth: 16, text: 4000, accessibilityText: 240, coordinate: 10000, artboard: 4096 });

const defaultPropKeys = {
  'sound-button': {label:'sfx.listen'},
  text: { text: 'editor.element.defaultGreeting' },
  button: { label: 'gift.runtime.continue' },
  envelope: { label: 'templates.copy.openGift' },
  'gift-box': { label: 'editor.element.openBox' },
  reply: { title: 'gift.reply.send', submitLabel: 'gift.reply.send' },
};
const accessibilityKeys = {
  image: { alt: 'editor.element.photoAlt' },
  reply: { label: 'editor.element.replyAlt' },
};
const resolveFields = (fields, localize) => Object.fromEntries(Object.entries(fields || {}).map(([name, key]) => [name, localize(key)]));

export function createElement(type, options = {}, localize = canonicalText) {
  if (!Object.hasOwn(registry, type)) throw new Error(canonicalText('editor.element.unsupported'));
  const descriptor = registry[type];
  const { id = globalThis.crypto.randomUUID(), layout = {}, props = {}, accessibility = {}, ...other } = options;
  const configured = libraryEntry('element_type', type)?.definition;
  const mergedProps = { ...structuredClone(descriptor.defaults), ...resolveFields(defaultPropKeys[type], localize), ...structuredClone(configured?.defaults || {}), ...props };
  if (type === 'text' && props.textBinding) delete mergedProps.text;
  const mergedAccessibility = { ...descriptor.accessibility, ...resolveFields(accessibilityKeys[type], localize), ...configured?.accessibility,
    ...(mergedProps.label ? { label: mergedProps.label } : {}), ...accessibility };
  return { id, type, elementVersion: 1, layout: { x: 30, y: 100, width: 300, height: type === 'line' ? 10 : type === 'text' ? 90 : 160, rotation: 0, ...layout }, props: mergedProps, accessibility: mergedAccessibility, ...(descriptor.actions.length ? { actions: [{ on: 'activate', type: 'goToScene', targetSceneId: null }] } : {}), ...other };
}
