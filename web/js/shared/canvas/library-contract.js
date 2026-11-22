// Portable recipes are data, never JavaScript, HTML, SVG markup or CSS source.
export const LIBRARY_KINDS = ['element_type', 'element', 'animation', 'effect', 'preset', 'template', 'artwork'];
export const CORE_EFFECT_IDS = Object.freeze({ surface: ['S01','S02','S03','S04'], entrance: ['E01','E02','E03','E04','E05','E06'],
  emphasis: ['A01','A02','A03','A04','A05'], transition: ['T01','T02','T03','T04','T05','T06'],
  ambience: ['B01','B02','B03','B04','B05','B06','B07','B08'], reaction: ['R01','R02','R03','R04'] });
const check = (ok, message) => { if (!ok) throw Object.assign(new Error(`Canvas library: ${message}`), { status: 422, code: 'INVALID_LIBRARY_DEFINITION' }); };
export const libraryId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const number = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const color = v => typeof v === 'string' && /^#[\da-fA-F]{6}$/.test(v);
function object(v, keys) { check(v && Object.getPrototypeOf(v) === Object.prototype, 'object required'); check(Object.keys(v).every(k => keys.includes(k)), 'unsupported field'); }
export function validateVector(v) {
  object(v, ['paths']); check(Array.isArray(v.paths) && v.paths.length > 0 && v.paths.length <= 12, '1–12 vector paths required');
  for (const p of v.paths) {
    object(p, ['d', 'fill', 'stroke', 'strokeWidth', 'dash']);
    check(typeof p.d === 'string' && p.d.length <= 18000 && /^[MmZzLlHhVvCcSsQqTtAa\d\s.,eE+\-]*$/.test(p.d), 'invalid SVG path data');
    for (const k of ['fill','stroke']) if (p[k] !== undefined) check(['color','strokeColor','none'].includes(p[k]) || color(p[k]), 'invalid vector paint');
    if (p.strokeWidth !== undefined) check(p.strokeWidth === 'strokeWidth' || number(p.strokeWidth, 0, 40), 'invalid stroke width');
    if (p.dash !== undefined) check(typeof p.dash === 'string' && /^[\d. ]{1,40}$/.test(p.dash), 'invalid dash');
  }
  return v;
}
export function validateAnimation(v, family) {
  object(v, ['engine','builtinId','keyframes','duration','easing','iterations','styles','glyphs','colors','count','drift','title']);
  if (v.title !== undefined) check(typeof v.title === 'string' ? v.title.length <= 160 : v.title &&
    typeof v.title === 'object' && Object.values(v.title).every(t => typeof t === 'string' && t.length <= 160), 'invalid animation title');
  check(['builtin','keyframes','surface','particles'].includes(v.engine), 'unknown animation engine');
  if (v.engine === 'builtin') check(CORE_EFFECT_IDS[family]?.includes(v.builtinId), 'builtin engine/family mismatch');
  if (v.engine === 'keyframes') {
    check(family !== 'surface', 'keyframes require a moving family');
    check(Array.isArray(v.keyframes) && v.keyframes.length >= 2 && v.keyframes.length <= 16, '2–16 keyframes required');
    let offset = 0;
    for (const f of v.keyframes) {
      object(f, ['opacity','transform','offset']);
      if (f.opacity !== undefined) check(number(f.opacity, 0, 1), 'invalid opacity');
      if (f.offset !== undefined) { check(number(f.offset, offset, 1), 'keyframe offsets must increase'); offset = f.offset; }
      if (f.transform !== undefined) check(typeof f.transform === 'string' && f.transform.length <= 300 &&
        /^(?:(?:translate[XYZ]?|scale[XYZ]?|rotate[XYZ]?|perspective)\([-\d.,% pxdeg]+\)\s*)+$/.test(f.transform), 'invalid transform');
    }
  }
  if (v.duration !== undefined) check(number(v.duration, 100, 10000), 'duration must be 100–10000ms');
  if (v.iterations !== undefined) check(Number.isInteger(v.iterations) && number(v.iterations, 1, 5), 'iterations must be 1–5');
  if (v.easing !== undefined) check(['linear','ease','ease-in','ease-out','ease-in-out'].includes(v.easing), 'invalid easing');
  if (v.engine === 'surface') {
    check(family === 'surface', 'surface engine/family mismatch'); object(v.styles, ['color','backgroundColor','borderColor','borderWidth','borderRadius','shadowColor','shadowBlur']);
    for (const [k, value] of Object.entries(v.styles)) check(k.includes('Color') || k === 'color' ? color(value) : number(value, 0, 128), 'invalid surface style');
  }
  if (v.engine === 'particles') {
    check(family === 'ambience', 'particles require ambience');
    check(Array.isArray(v.glyphs) && v.glyphs.length > 0 && v.glyphs.length <= 8 && v.glyphs.every(t => typeof t === 'string' && t.length > 0 && t.length <= 8), 'invalid particle glyphs');
    check(Array.isArray(v.colors) && v.colors.length > 0 && v.colors.length <= 8 && v.colors.every(color), 'invalid particle colors');
    check(Number.isInteger(v.count) && number(v.count, 1, 24), 'particle count must be 1–24');
    if (v.drift !== undefined) check(number(v.drift, -300, 300), 'invalid particle drift');
  }
  return v;
}
export function allowsEffect(targets, model) {
  if (!model) return targets.scenes === true;
  return (targets.types || []).includes(model.type) && (!targets.kinds?.length || targets.kinds.includes(model.props.kind)) &&
    !(targets.excludeKinds || []).includes(model.props.kind);
}
export function builtinEffectApplies(id, model) {
  if (!model) return id === 'S03' || /^[TB]/.test(id);
  const { type, props } = model;
  const rules = {
    S01: ['image','shape','interaction','envelope','gift-box'].includes(type), S02: ['image','shape','interaction'].includes(type),
    S03: ['shape','interaction','envelope','reply'].includes(type), S04: ['image','shape','sticker','line'].includes(type),
    E03: type === 'text', E04: type === 'line', E05: type === 'image', E06: type === 'image',
    A02: ['image','shape','interaction'].includes(type), A04: type === 'text', A05: type === 'image',
    R01: type === 'envelope', R02: type === 'gift-box', R04: type === 'interaction' && props.kind === 'light-a-candle',
    R03: ['button','envelope','gift-box','interaction'].includes(type) && !['event-countdown','photo-comparison'].includes(props.kind),
  };
  return rules[id] ?? true;
}
export function validatePortableEffect(v, family, model) {
  object(v, ['id','revision','family','title','targets','animation']);
  check(libraryId(v.id) && Number.isSafeInteger(v.revision) && v.revision > 0 && v.family === family, 'invalid portable effect identity');
  object(v.targets, ['scenes','types','kinds','excludeKinds']);
  if (v.targets.scenes !== undefined) check(typeof v.targets.scenes === 'boolean', 'invalid scene applicability');
  for (const key of ['types','kinds','excludeKinds']) if (v.targets[key] !== undefined)
    check(Array.isArray(v.targets[key]) && v.targets[key].length <= 32 && v.targets[key].every(libraryId), 'invalid applicability');
  check(allowsEffect(v.targets, model), 'effect does not support this target');
  if (family === 'reaction') check(model && ['button','envelope','gift-box','interaction'].includes(model.type), 'reaction requires an interactive element');
  validateAnimation(v.animation, family);
  if (v.animation.engine === 'builtin') check(builtinEffectApplies(v.animation.builtinId, model), 'builtin animation does not support this target');
  return v;
}
