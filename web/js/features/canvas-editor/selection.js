import { editableSelection } from './clipboard.js';

// Selection chỉ là trạng thái giao diện; không sửa document hoặc lịch sử.
export function activeSelectionIds(document, sceneId, selectedSet, selection) {
  const scene = document?.scenes.find(item => item.id === sceneId) || document?.scenes[0];
  return [...new Set([...selectedSet, ...(selection ? [selection] : [])])]
    .filter(id => scene?.elementIds.includes(id) && document.elements.some(item => item.id === id));
}

export function toggleSelection(previous, id, additive = false, members = [id]) {
  if (!id) return { selection: null, selectedSet: new Set() };
  const selectedSet = new Set(additive ? previous : []);
  const remove = additive && members.every(member => selectedSet.has(member));
  for (const member of members) {
    if (remove) selectedSet.delete(member);
    else selectedSet.add(member);
  }
  return { selection: remove ? [...selectedSet].at(-1) || null : id, selectedSet };
}

export function editableSceneIds(document, scene, policy) {
  const editable = new Set(editableSelection(document.elements, scene.elementIds, policy)
    .filter(element => element.visible !== false).map(element => element.id));
  return scene.elementIds.filter(id => editable.has(id));
}

export function restoredSelectionIds(document, scene, beforeIds) {
  return document.elements.filter(item => !beforeIds.has(item.id) && scene.elementIds.includes(item.id))
    .map(item => item.id);
}
