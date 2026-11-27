// Chuyển động chỉ dùng các layer Canvas hiện có, không tạo HTML hoặc artwork thay thế.
// Mỗi track có thời lượng chung để các layer kết thúc đồng thời trước khi chuyển cảnh.
const track = (role, frames, origin) => ({ role, frames, origin });
const openings = {
  'ribbon-pull': {
    anchor: 'bow', duration: 850, tracks: [
      track('bow', [{ offset: 0 }, { offset: .32, transform: 'translate(55%, -15%) rotate(18deg)', fade: .8 }, { offset: 1, transform: 'translate(125%, -70%) rotate(40deg)', fade: 0 }]),
      track('lid-ribbon', [{ offset: 0 }, { offset: .32, transform: 'translateX(120%)', fade: 0 }, { offset: 1, fade: 0 }]),
      track('body-ribbon', [{ offset: 0 }, { offset: .4, transform: 'translateX(95%)', fade: 0 }, { offset: 1, fade: 0 }]),
      track('lid', [{ offset: 0 }, { offset: .3 }, { offset: 1, transform: 'translate(-10%, -240%) rotate(-14deg)', fade: 0 }]),
      track('letter', [{ offset: 0 }, { offset: .35 }, { offset: 1, transform: 'translateY(-75%)' }]),
    ],
  },
  'wax-envelope': {
    anchor: 'flap', duration: 780, tracks: [
      track('seal', [{ offset: 0 }, { offset: .3, transform: 'rotate(-25deg) scale(.7)', fade: .7 }, { offset: .55, transform: 'translateY(100%) rotate(-40deg)', fade: 0 }, { offset: 1, fade: 0 }]),
      track('flap', [{ offset: 0 }, { offset: .25 }, { offset: .7, transform: 'perspective(500px) rotateX(150deg)', fade: .2 }, { offset: 1, transform: 'perspective(500px) rotateX(165deg)', fade: 0 }], '50% 0%'),
      track('letter', [{ offset: 0 }, { offset: .45 }, { offset: 1, transform: 'translateY(-78%)' }]),
    ],
  },
  gatefold: {
    anchor: 'door-left', duration: 850, tracks: [
      track('seal', [{ offset: 0 }, { offset: .2, transform: 'scale(.85)', fade: 0 }, { offset: 1, fade: 0 }]),
      track('door-left', [{ offset: 0 }, { offset: .15 }, { offset: 1, transform: 'perspective(620px) rotateY(-100deg)' }], '0% 50%'),
      track('door-right', [{ offset: 0 }, { offset: .15 }, { offset: 1, transform: 'perspective(620px) rotateY(100deg)' }], '100% 50%'),
      track('sprig-left', [{ offset: 0 }, { offset: .15 }, { offset: 1, transform: 'translateX(-100%) scaleX(.1)', fade: 0 }]),
      track('sprig-right', [{ offset: 0 }, { offset: .15 }, { offset: 1, transform: 'translateX(100%) scaleX(.1)', fade: 0 }]),
    ],
  },
  'camera-focus': {
    anchor: 'dial-knob', duration: 760, tracks: [
      track('lens', [{ offset: 0 }, { offset: .45, transform: 'scale(1.07) rotate(9deg)', filter: 'blur(2px)' }, { offset: .8, transform: 'scale(1.02)', filter: 'none' }, { offset: 1 }]),
      track('crosshair', [{ offset: 0 }, { offset: .45, transform: 'scale(1.45)', fade: .6 }, { offset: .8, transform: 'scale(.85)' }, { offset: 1 }]),
      track('dial-knob', [{ offset: 0 }, { offset: .8, transform: 'translateX(365%)' }, { offset: 1, transform: 'translateX(365%)' }]),
    ],
  },
  'polaroid-print': {
    anchor: 'print', duration: 950, tracks: [
      track('shutter', [{ offset: 0 }, { offset: .15, transform: 'scale(.85)' }, { offset: .28 }, { offset: 1 }]),
      track('screen', [{ offset: 0 }, { offset: .15, filter: 'brightness(2)' }, { offset: .28 }, { offset: 1 }]),
      track('print', [{ offset: 0, transform: 'translateY(-65%)', clipPath: 'inset(100% 0 0 0)' }, { offset: .28, transform: 'translateY(-65%)', clipPath: 'inset(100% 0 0 0)' }, { offset: 1, clipPath: 'inset(0 0 0 0)' }]),
    ],
  },
  'calendar-peel': {
    anchor: 'peel', duration: 720, tracks: [
      track('peel', [{ offset: 0 }, { offset: .35, transform: 'perspective(160px) rotateY(-55deg) rotate(-12deg)' }, { offset: 1, transform: 'translate(40%, -120%) rotate(-35deg)', fade: 0 }], '0% 100%'),
      track('calendar-paper', [{ offset: 0 }, { offset: .55, transform: 'scale(1.015)' }, { offset: 1 }]),
      track('disco', [{ offset: 0 }, { offset: .55, transform: 'rotate(18deg)', filter: 'brightness(1.18)' }, { offset: 1 }]),
    ],
  },
};

const isKind = (model, role) => model.type === 'shape' && model.artwork && model.props.kind === `signature-${role}`;

// Nhận diện bằng kind, không dựa vào ID hoặc tên hiển thị (ID thay đổi khi nhân bản).
// Nếu có nhiều cụm hoặc nhiều nút mở không rõ ràng, dùng chuyển cảnh chuẩn.
export function signatureOpening(document, scene) {
  if (scene.id !== document.entrySceneId) return null;
  const ids = new Set(scene.elementIds);
  const models = document.elements.filter(model => ids.has(model.id) && model.visible !== false);
  if (!models.some(model => isKind(model, 'cover-decoration'))) return null;
  const candidates = Object.entries(openings).filter(([, value]) => models.some(model => isKind(model, value.anchor)));
  if (candidates.length !== 1) return null;
  const [kind, recipe] = candidates[0];
  const controls = models.filter(model => model.type === 'button' && model.actions?.length === 1 && model.actions[0].type === 'goToScene' && model.actions[0].targetSceneId !== scene.id);
  const control = controls.find(model => model.id === 'open-gift') || (controls.length === 1 ? controls[0] : null);
  if (!control || control.motions?.enabled === false || control.effects?.reaction) return null;
  const tracks = recipe.tracks.flatMap(item => {
    const matches = models.filter(model => isKind(model, item.role));
    return matches.length === 1 ? [{ ...item, modelId: matches[0].id }] : [];
  });
  // Ảnh Polaroid đi cùng khung đã chỉnh sửa; chọn ảnh ngay sau khung trong thứ tự layer.
  if (kind === 'polaroid-print') {
    const print = tracks.find(item => item.role === 'print');
    const photo = print && document.elements.find(model => model.id === scene.elementIds[scene.elementIds.indexOf(print.modelId) + 1] && model.type === 'image' && model.visible !== false);
    if (photo) tracks.push({ ...print, role: 'printed-photo', modelId: photo.id });
  }
  return tracks.length ? { kind, duration: recipe.duration, controlId: control.id, tracks } : null;
}

// Dùng lifecycle motion chung, giữ rotation/opacity do Sender đặt và dọn khi rời scene.
export function playSignatureOpening(plan, nodes, motion, signal) {
  if (!plan || !motion.enabled() || signal.aborted) return null;
  const byId = new Map(nodes.map(item => [item.model.id, item]));
  const control = byId.get(plan.controlId)?.node;
  const tracks = plan.tracks.filter(item => byId.get(item.modelId)?.node.animate);
  if (!control || !tracks.length) return null;
  control.setAttribute('aria-disabled', 'true');
  const restore = () => control.removeAttribute('aria-disabled');
  signal.addEventListener('abort', restore, { once: true });
  const runs = tracks.map(item => {
    const { model, node } = byId.get(item.modelId);
    const rotation = model.layout.rotation || 0;
    const opacity = model.opacity ?? 1;
    const frames = item.frames.map(({ fade = 1, transform = '', filter = 'none', ...frame }) => ({
      ...frame, transform: `rotate(${rotation}deg)${transform ? ` ${transform}` : ''}`,
      opacity: opacity * fade, filter, ...(item.origin ? { transformOrigin: item.origin } : {}),
    }));
    try {
      return motion.run(node, frames, { duration: plan.duration, fill: 'both', easing: 'cubic-bezier(.22,.61,.36,1)' }, signal, undefined, { retain: true });
    } catch {
      // Trình duyệt không hỗ trợ một track vẫn cho phép người nhận mở thiệp.
      return Promise.resolve();
    }
  });
  return Promise.allSettled(runs).finally(() => {
    signal.removeEventListener('abort', restore);
    restore();
  });
}
