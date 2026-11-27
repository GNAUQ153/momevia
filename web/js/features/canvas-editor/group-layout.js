import { LIMITS } from '../../shared/canvas/registry.js';

const radians = degrees => degrees * Math.PI / 180;
function rotate(x, y, degrees) {
  const angle = radians(degrees), c = Math.cos(angle), s = Math.sin(angle);
  return { x: x * c - y * s, y: x * s + y * c };
}

export function bounds(models, rotation = 0, displayLayouts) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const model of models) {
    const box = displayLayouts?.get(model.id) || model.layout;
    const center = rotate(box.x + box.width / 2, box.y + box.height / 2, -rotation);
    const angle = radians(box.rotation - rotation);
    const c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
    const halfWidth = (c * box.width + s * box.height) / 2;
    const halfHeight = (s * box.width + c * box.height) / 2;
    left = Math.min(left, center.x - halfWidth);
    right = Math.max(right, center.x + halfWidth);
    top = Math.min(top, center.y - halfHeight);
    bottom = Math.max(bottom, center.y + halfHeight);
  }
  return { left, top, right, bottom };
}

export function groupLayout(members, displayLayouts) {
  if (members.length === 1) return displayLayouts?.get(members[0].id) || members[0].layout;
  const anchor = members.find(member => member.id === member.groupId);
  const rotation = anchor.layout.rotation;
  const { left, top, right, bottom } = bounds(members, rotation, displayLayouts);
  const width = right - left, height = bottom - top;
  const center = rotate((left + right) / 2, (top + bottom) / 2, rotation);
  return { x: center.x - width / 2, y: center.y - height / 2, width, height, rotation };
}

// Scale both axes around the same top-left corner, including for rotated groups.
export function resizeGroup(members, box, factor) {
  const dimensions = members.flatMap(({ layout }) => [layout.width, layout.height]);
  const scale = Math.max(1 / Math.min(...dimensions),
    Math.min(LIMITS.coordinate / Math.max(box.width, box.height, ...dimensions), factor));
  const width = box.width * scale, height = box.height * scale;
  const dx = (width - box.width) / 2, dy = (height - box.height) / 2;
  const shift = rotate(dx, dy, box.rotation);
  return { ...box, width, height, x: box.x + shift.x - dx, y: box.y + shift.y - dy };
}

export function dragGroupCorner(members, box, dx, dy) {
  const local = rotate(dx, dy, -box.rotation);
  const factor = 1 + (local.x * box.width + local.y * box.height) / (box.width ** 2 + box.height ** 2);
  return resizeGroup(members, box, factor);
}

export function transformedLayout(layout, before, after) {
  const dx = after.x - before.x, dy = after.y - before.y;
  if (before.width === after.width && before.rotation === after.rotation)
    return { ...layout, x: layout.x + dx, y: layout.y + dy };
  const scale = after.width / before.width, angle = after.rotation - before.rotation;
  const center = rotate(layout.x + layout.width / 2 - before.x - before.width / 2,
    layout.y + layout.height / 2 - before.y - before.height / 2, angle);
  const width = layout.width * scale, height = layout.height * scale;
  const rotation = layout.rotation + angle;
  return { x: after.x + after.width / 2 + center.x * scale - width / 2,
    y: after.y + after.height / 2 + center.y * scale - height / 2, width, height,
    rotation: Math.abs(rotation) > 360 ? rotation % 360 : rotation };
}

export function applyGroupLayout(members, before, after) {
  if (members.length === 1) {
    members[0].layout = { ...after };
    return;
  }
  const scale = after.width / before.width;
  for (const member of members) {
    member.layout = transformedLayout(member.layout, before, after);
    if (scale !== 1) {
      for (const [key, min, max] of [['fontSize', 10, 160], ['strokeWidth', 0, 40], ['radius', 0, 512]]) {
        if (Object.hasOwn(member.props, key)) member.props[key] = Math.max(min, Math.min(max, member.props[key] * scale));
      }
    }
  }
}

// Swap whole blocks in stacking order, preserving the order of the layers inside.
export function moveBlockInStack(document, scene, element, direction) {
  const keys = new Map(document.elements.map(item => [item.id, item.groupId || item.id]));
  const stacks = new Map();
  for (const id of scene.elementIds) {
    const key = keys.get(id);
    if (!stacks.has(key)) stacks.set(key, []);
    stacks.get(key).push(id);
  }
  const blocks = [...stacks.keys()];
  const index = blocks.indexOf(keys.get(element.id)), next = index + direction;
  if (next < 0 || next >= blocks.length) return;
  [blocks[index], blocks[next]] = [blocks[next], blocks[index]];
  scene.elementIds = blocks.flatMap(key => stacks.get(key));
}
