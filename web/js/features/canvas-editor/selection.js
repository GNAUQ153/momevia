import { editableElement } from './clipboard.js';

// Selection chỉ là trạng thái giao diện; không sửa document hoặc lịch sử.
export function activeSelectionIds(document, sceneId, selectedSet, selection) {
  const scene = document?.scenes.find(item => item.id === sceneId) || document?.scenes[0];
  return [...new Set([...selectedSet, ...(selection ? [selection] : [])])]
    .filter(id => scene?.elementIds.includes(id) && document.elements.some(item => item.id === id));
}

export function toggleSelection(previous, id, additive = false) {
  const selectedSet = new Set(additive && id ? previous : id ? [id] : []);
  if (additive && id) {
    if (selectedSet.has(id)) selectedSet.delete(id);
    else selectedSet.add(id);
  }
  return { selection: additive && id ? [...selectedSet].at(-1) || null : id, selectedSet };
}

export function editableSceneIds(document, scene, policy) {
  return scene.elementIds.filter(id => {
    const element = document.elements.find(item => item.id === id);
    return editableElement(element, policy) && element.visible !== false;
  });
}

export function restoredSelectionIds(document, scene, beforeIds) {
  return document.elements.filter(item => !beforeIds.has(item.id) && scene.elementIds.includes(item.id))
    .map(item => item.id);
}
