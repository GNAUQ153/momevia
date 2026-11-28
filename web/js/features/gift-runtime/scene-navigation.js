import { displayCopy } from '../../shared/locale.js';

// Điều hướng cảnh được giữ ổn định giữa các lần render để không làm mất focus.
// Chỉ thao tác DOM; không thay đổi dữ liệu Canvas hay quy tắc truy cập quà.
export function sceneProgress(scenes, activeSceneId) {
  const total = Array.isArray(scenes) ? scenes.length : 0;
  const index = Array.isArray(scenes) ? scenes.findIndex(scene => scene.id === activeSceneId) : -1;
  return { index: index >= 0 ? index + 1 : 0, total };
}

export function createSceneNavigation(navigation, progress, { onSelect, signal,compact=false }) {
  let buttons = [];
  let ids = [];
  const selector=compact?navigation.ownerDocument.createElement('select'):null;
  if(selector){
    selector.className='gift-runtime-scene-select';
    selector.addEventListener('change',()=>onSelect(selector.value),{signal});
    navigation.replaceChildren(selector);
  }

  navigation.addEventListener('click', event => {
    const button = event.target?.closest?.('button[data-scene-id]');
    if (button && navigation.contains(button)) onSelect(button.dataset.sceneId);
  }, { signal });

  navigation.addEventListener('keydown', event => {
    const index = buttons.indexOf(event.target);
    if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const target = event.key === 'Home' ? 0
      : event.key === 'End' ? buttons.length - 1
      : Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
    buttons[target]?.focus();
  }, { signal });

  function keepCurrentVisible(button) {
    if (!button || !navigation.clientWidth) return;
    const left = button.offsetLeft;
    const right = left + button.offsetWidth;
    if (left < navigation.scrollLeft) navigation.scrollLeft = left;
    else if (right > navigation.scrollLeft + navigation.clientWidth)
      navigation.scrollLeft = right - navigation.clientWidth;
  }

  return {
    sync(scenes, activeSceneId) {
      const nextIds = scenes.map(scene => scene.id);
      if (nextIds.length !== ids.length || nextIds.some((id, index) => id !== ids[index])) {
        buttons = scenes.map(scene => {
          const button = navigation.ownerDocument.createElement(compact?'option':'button');
          if(!compact)button.type = 'button';else button.value=scene.id;
          button.dataset.sceneId = scene.id;
          return button;
        });
        if(selector)selector.replaceChildren(...buttons);else navigation.replaceChildren(...buttons);
        ids = nextIds;
      }
      const { index, total } = sceneProgress(scenes, activeSceneId);
      scenes.forEach((scene, position) => {
        buttons[position].textContent = displayCopy(`${position + 1}. ${scene.name}`);
        if(!compact)buttons[position].setAttribute('aria-current', position + 1 === index ? 'step' : 'false');
      });
      progress.max = Math.max(1, total);
      progress.value = index;
      progress.hidden = total <= 1;
      if(selector){selector.value=activeSceneId;selector.setAttribute('aria-label',navigation.getAttribute('aria-label')||'');navigation.hidden=total<=1;}
      else keepCurrentVisible(buttons[index - 1]);
    },
  };
}
