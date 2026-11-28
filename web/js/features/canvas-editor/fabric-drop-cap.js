import { renderElement, applyLayout } from '../gift-runtime/renderer.js';
import { LIMITS } from '../../shared/canvas/registry.js';

// Measure the same floated first letter that the recipient renderer uses.
// Each grapheme keeps its measured position, including Vietnamese combining marks.
function glyphParts(fabric, model, options) {
  const copy = structuredClone(model);
  copy.props.text = model.text ?? copy.props.text ?? '';
  delete copy.props.textBinding;
  copy.layout = { ...copy.layout, x: 0, y: 0, rotation: 0 };
  const bindings = Object.fromEntries(['recipientName', 'senderName', 'message'].map(key => [key, { type: 'text', value: '' }]));
  const element = renderElement(copy, { document: { bindings } });
  applyLayout(element, copy, { width: options.width, height: options.height });
  element.style.height = 'auto';
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;visibility:hidden';
  host.append(element);
  document.body.append(host);
  try {
    const style = getComputedStyle(element);
    const initial = getComputedStyle(element, '::first-letter');
    const origin = element.getBoundingClientRect();
    const text = element.firstChild;
    const parts = [new fabric.Rect({ left: 0, top: 0, width: options.width, height: options.height,
      fill: 'transparent', strokeWidth: 0, originX: 'left', originY: 'top' })];
    const segments = [...new Intl.Segmenter(document.documentElement.lang, { granularity: 'grapheme' }).segment(text.data)];
    const runs = [];
    for (const segment of segments) {
      const range = document.createRange();
      range.setStart(text, segment.index);
      range.setEnd(text, segment.index + segment.segment.length);
      const rect = range.getBoundingClientRect();
      if (!rect.width || !rect.height || segment.segment.includes('\n')) continue;
      const fontSize = parseFloat(rect.height > parseFloat(style.fontSize) * 1.8 ? initial.fontSize : style.fontSize);
      const previous = runs.at(-1);
      if (previous && previous.fontSize === fontSize && Math.abs(previous.top - rect.top) < 0.5) {
        previous.text += segment.segment;
        previous.left = Math.min(previous.left, rect.left);
      } else runs.push({ text: segment.segment, left: rect.left, top: rect.top, fontSize });
    }
    // Keep each rendered line together for kerning, shaping and bounded object counts.
    for (const run of runs) {
      if (!run.text.trim()) continue;
      const glyph = new fabric.FabricText(run.text, {
        left: run.left - origin.left, top: run.top - origin.top,
        fontFamily: style.fontFamily,
        fontSize: run.fontSize,
        fontWeight: style.fontWeight, fill: style.color, originX: 'left', originY: 'top',
      });
      glyph.momeviaFillBinding = true;
      parts.push(glyph);
    }
    return parts;
  } finally {
    host.remove();
  }
}

const dropCapBindings = new WeakMap();

export function bindDropCapFabricObject(fabric, group) {
  if (!group.momeviaDropCapModelJSON || dropCapBindings.has(group)) return;
  // Fabric enlivens objects containing a `type` field. Authoring data stays opaque
  // to that object loader and is decoded only by this binding.
  const current = JSON.parse(group.momeviaDropCapModelJSON);
  const options = group.momeviaDropCapBounds;
  const state = { editor: null };
  dropCapBindings.set(group, state);
  Object.defineProperty(group, 'momeviaDropCapModel', { configurable: true, get: () => current });
  group.text = current.text ?? current.props.text ?? '';
  group.set('objectCaching', false);
  const rebuild = () => {
    const transform = group.calcTransformMatrix();
    group.removeAll().forEach(object => object.dispose());
    for (const glyph of glyphParts(fabric, current, options)) {
      glyph.set({ left: glyph.left - options.width / 2, top: glyph.top - options.height / 2 });
      fabric.util.applyTransformToObject(glyph,
        fabric.util.multiplyTransformMatrices(transform, glyph.calcOwnMatrix()));
      group.add(glyph);
    }
    // Replace the record so existing undo snapshots never share mutable text/style.
    group.momeviaDropCapModelJSON = JSON.stringify(current);
    group.setCoords();
    group.canvas?.requestRenderAll();
  };
  Object.defineProperty(group, 'momeviaDropCapStyle', { configurable: true, value: (field, value) => {
    current.props[field] = value;
    rebuild();
  } });
  const finishEditing = (commit = true) => {
    const editor = state.editor;
    if (!editor) return;
    state.editor = null;
    const canvas = editor.canvas;
    if (editor.isEditing) editor.exitEditing();
    if (commit) {
      group.text = editor.text.slice(0, LIMITS.text);
      current.text = group.text;
      current.props.text = group.text;
      rebuild();
    }
    group.set('visible', true);
    canvas?.remove(editor);
    editor.dispose();
    canvas?.requestRenderAll();
    if (commit) canvas?.fire('object:modified', { target: group });
  };
  Object.defineProperty(group, 'enterEditing', { configurable: true, value: () => {
    const canvas = group.canvas;
    if (!current.textEditable || !group.selectable || !canvas || state.editor) return;
    const token = current.props.fontToken === 'serif' ? '--font-serif'
      : current.props.fontToken === 'heading' ? '--font-display' : '--font-body';
    const editor = new fabric.Textbox(group.text, {
      left: group.left, top: group.top, width: options.width,
      originX: group.originX, originY: group.originY,
      scaleX: group.scaleX, scaleY: group.scaleY, angle: group.angle,
      fontFamily: getComputedStyle(document.documentElement).getPropertyValue(token).trim() || 'Arial',
      fontSize: current.props.fontSize || 24,
      lineHeight: current.props.lineHeight || 1.4,
      textAlign: current.props.align || 'left', fill: current.props.color || '#32243B',
      hiddenTextareaContainer: canvas.upperCanvasEl.parentElement,
    });
    state.editor = editor;
    editor.on('editing:exited', () => finishEditing());
    group.set('visible', false);
    canvas.add(editor);
    canvas.setActiveObject(editor);
    editor.enterEditing();
    editor.hiddenTextarea.maxLength = LIMITS.text;
    editor.selectAll();
    canvas.requestRenderAll();
  } });
  group.on('mousedblclick', () => group.enterEditing());
  const dispose = group.dispose.bind(group);
  Object.defineProperty(group, 'dispose', { configurable: true, value: () => {
    finishEditing(false);
    dropCapBindings.delete(group);
    dispose();
  } });
}

export async function dropCapFabricObject(fabric, model, options) {
  await document.fonts.ready;
  const rootStyle = getComputedStyle(document.documentElement);
  await Promise.allSettled(['--font-serif', '--font-display', '--font-body'].map(token =>
    document.fonts.load('20px ' + rootStyle.getPropertyValue(token).trim())));
  const group = new fabric.Group(glyphParts(fabric, model, options), options);
  group.set({ ...options, width: options.width, height: options.height });
  group.layoutManager = new fabric.LayoutManager(new fabric.FixedLayout());
  group.momeviaBaseHeight = options.height;
  group.momeviaDropCapModelJSON = JSON.stringify(model);
  group.momeviaDropCapBounds = { width: options.width, height: options.height };
  bindDropCapFabricObject(fabric, group);
  return group;
}
