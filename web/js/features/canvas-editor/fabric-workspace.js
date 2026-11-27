import { applyFabricDiff, FABRIC_EDITABLE_TYPES } from './fabric-adapter.js';
import { applyFabricStylePatch } from './fabric-style-patch.js';
import { validateDocument } from '../../shared/canvas/schema.js';

// Các thao tác của workspace là dữ liệu thuần; Fabric chỉ dùng để hiển thị.
// Bảo toàn scene ID, action, text binding, asset ID và bản quyền Creator.
function sceneOf(document, sceneId) {
  const scene = document?.scenes?.find(item => item.id === sceneId);
  if (!scene) throw new Error('Không tìm thấy cảnh Canvas.');
  return scene;
}

function elementOf(document, scene, id) {
  if (typeof id !== 'string' || !scene.elementIds.includes(id)) {
    throw new Error('Lớp không thuộc cảnh hiện tại.');
  }
  const element = document.elements.find(item => item.id === id);
  if (!element) throw new Error('Lớp không tồn tại.');
  return element;
}

export function canManageFabricLayer(element, policy = null) {
  return Boolean(element && !element.groupId && FABRIC_EDITABLE_TYPES.includes(element.type) &&
    element.locked !== true && !policy?.lockedElements?.[element.id] &&
    policy?.kind !== 'creator-template');
}

export function fabricLayerList(document, sceneId, policy = null) {
  const scene = sceneOf(document, sceneId);
  return [...scene.elementIds].reverse().map(id => {
    const element = elementOf(document, scene, id);
    return {
      id,
      type: element.type,
      title: element.name || element.accessibility?.label || element.type,
      visible: element.visible !== false,
      protected: !canManageFabricLayer(element, policy),
      locked: Boolean(element.groupId) || element.locked === true || Boolean(policy?.lockedElements?.[id]),
    };
  });
}

export function moveFabricLayer(order, id, direction, isMovable) {
  if (!Array.isArray(order) || new Set(order).size !== order.length ||
    (direction !== 'up' && direction !== 'down')) {
    throw new Error('Thứ tự layer hoặc hướng di chuyển không hợp lệ.');
  }
  const position = order.indexOf(id);
  if (position < 0) throw new Error('Lớp không tồn tại trong cảnh.');
  const target = position + (direction === 'up' ? 1 : -1);
  if (target < 0 || target >= order.length) return [...order];
  // Không cho phép đẩy lớp tương tác/Creator bị khóa sang vị trí khác.
  if (!isMovable(id) || !isMovable(order[target])) return [...order];
  const result = [...order];
  [result[position], result[target]] = [result[target], result[position]];
  return result;
}

export function fabricWorkspaceChanged(document, sceneId, patch) {
  const scene = sceneOf(document, sceneId);
  const order = patch?.order || scene.elementIds;
  const visibility = patch?.visibility || {};
  return Boolean(patch?.commands?.length || patch?.layouts?.length || patch?.styles?.length ||
    order.some((id, index) => id !== scene.elementIds[index]) ||
    Object.entries(visibility).some(([id, value]) => {
      const element = elementOf(document, scene, id);
      return (element.visible !== false) !== value;
    }));
}

export function applyFabricCommands(document,sceneId,commands=[],policy=null){
 if(!Array.isArray(commands)||commands.length>100)throw new Error('Invalid Fabric command budget');
 const next=structuredClone(document),scene=sceneOf(next,sceneId),bank=new Map(scene.elementIds.map(id=>[id,structuredClone(elementOf(next,scene,id))]));
 for(const command of commands){
  if(!command||Object.keys(command).some(k=>!['type','id','sourceId'].includes(k)))throw new Error('Invalid Fabric command');
  if(command.type==='clone'){
   const source=bank.get(command.sourceId);
   if(!canManageFabricLayer(source,policy)||typeof command.id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(command.id)||next.elements.some(e=>e.id===command.id))throw new Error('Cannot clone this Fabric layer');
   const copy=structuredClone(source);copy.id=command.id;copy.layout.x+=16;copy.layout.y+=16;next.elements.push(copy);scene.elementIds.push(copy.id);bank.set(copy.id,structuredClone(copy));
  }else if(command.type==='remove'){
   const source=next.elements.find(e=>e.id===command.id);
   if(!scene.elementIds.includes(command.id)||!canManageFabricLayer(source,policy))throw new Error('Cannot remove this Fabric layer');
   next.elements=next.elements.filter(e=>e.id!==command.id);for(const s of next.scenes)s.elementIds=s.elementIds.filter(id=>id!==command.id);
  }else throw new Error('Unknown Fabric command');
 }
 return validateDocument(next);
}

export function applyFabricWorkspacePatch(document, sceneId, patch, policy = null) {
  if (!patch || !Array.isArray(patch.layouts) || !Array.isArray(patch.order) ||
    !patch.visibility || typeof patch.visibility !== 'object' || Array.isArray(patch.visibility)) {
    throw new Error('Bản vá Fabric Studio không hợp lệ.');
  }
  const next = applyFabricCommands(document,sceneId,patch.commands||[],policy);
  const scene = sceneOf(next, sceneId);
  const before = scene.elementIds;
  const order = patch.order;
  if (order.length !== before.length || new Set(order).size !== before.length ||
    order.some(id => !before.includes(id))) {
    throw new Error('Không được thêm, xóa hoặc đổi ID layer từ Fabric Studio.');
  }
  for (let i = 0; i < before.length; i++) {
    const element = elementOf(next, scene, before[i]);
    if (!canManageFabricLayer(element, policy) && order[i] !== before[i]) {
      throw new Error('Không được di chuyển lớp bị khóa hoặc lớp tương tác.');
    }
  }
  scene.elementIds = [...order];
  for (const [id, value] of Object.entries(patch.visibility)) {
    const element = elementOf(next, scene, id);
    if (typeof value !== 'boolean') throw new Error('Trạng thái hiển thị không hợp lệ.');
    if ((element.visible !== false) !== value) {
      if (!canManageFabricLayer(element, policy)) {
        throw new Error('Không được ẩn hoặc hiện lớp bị khóa.');
      }
      element.visible = value;
    }
  }
  // Layout chỉ được áp dụng sau visibility để lớp được mở lại có thể chỉnh sửa.
  const applied = applyFabricDiff(next, sceneId, patch.layouts, policy);
  const styled = applyFabricStylePatch(applied, sceneId, patch.styles ?? [], policy);
  return validateDocument(styled);
}

// Snap theo tâm/biên bản vẽ, không thay đổi nội dung text hoặc action.
export function snapFabricCenter({ x, y, width, height }, artboard, tolerance = 7) {
  const choose = (value, dimension, extent) => {
    const targets = [extent / 2, dimension / 2, dimension - extent / 2];
    const closest = targets.reduce((best, next) => Math.abs(value - next) < Math.abs(value - best) ? next : best);
    return Math.abs(value - closest) <= tolerance ? closest : value;
  };
  if (![x, y, width, height, artboard?.width, artboard?.height, tolerance].every(Number.isFinite) ||
    width <= 0 || height <= 0 || artboard.width <= 0 || artboard.height <= 0 || tolerance < 0) {
    throw new Error('Thông số căn chỉnh Canvas không hợp lệ.');
  }
  const nextX = choose(x, artboard.width, width);
  const nextY = choose(y, artboard.height, height);
  return { x: nextX, y: nextY, snappedX: nextX !== x, snappedY: nextY !== y };
}
