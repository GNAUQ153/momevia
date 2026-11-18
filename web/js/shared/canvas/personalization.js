export const identityBindings = ['recipientName', 'senderName'];
export const bindingLabels = { recipientName: 'Tên người nhận', senderName: 'Tên người gửi', message: 'Lời chúc' };
export function personalizationLabels(personalization) {
  if (!personalization) return [];
  const { bindings, photoFrames, layout } = personalization;
  return [
    ...(bindings.length ? [`Sửa ${bindings.map(key => bindingLabels[key].toLocaleLowerCase('vi')).join(', ')}`] : []),
    ...(photoFrames ? [`Thay ảnh trong ${photoFrames} khung`] : []),
    layout ? 'Có thể thêm ảnh khi chỉnh bố cục' : 'Bố cục cố định',
  ];
}

export function visibleBindingKeys(document) {
  return new Set(document.elements
    .filter(element => element.type === 'text' && element.visible !== false && element.opacity !== 0 && element.props.textBinding)
    .map(element => element.props.textBinding));
}

export function lockedVisibleNames(document, editableBindings) {
  const visible = visibleBindingKeys(document);
  return identityBindings.filter(key => visible.has(key) && !editableBindings.includes(key));
}

// Creator-template permissions prove which bindings could have been entered
// by a Sender. Values in locked bindings came from the template version.
export function clearTemplateBindingDefaults(document, editableBindings = []) {
  let changed = false;
  for (const [key, binding] of Object.entries(document.bindings)) {
    if (editableBindings.includes(key) || binding.value === '') continue;
    binding.value = '';
    changed = true;
  }
  return changed;
}
