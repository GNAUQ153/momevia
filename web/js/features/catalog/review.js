import { mountPlayer } from '../gift-runtime/index.js';
import { node, field } from '../canvas-editor/dom.js';

export function mountReview(host, { version, endpoint, api, navigate }) {
  const lifetime = new AbortController();
  const stage = node('div', { class: 'template-preview-player template-review-preview' });
  const coverScene = version.document.scenes.find(scene => scene.id === (version.coverSceneId || version.document.entrySceneId));
  const bindings = { recipientName: 'Tên người nhận thử', senderName: 'Tên người gửi thử', message: 'Lời chúc thử' };
  const controls = version.bindings.map(key => field(bindings[key], node('input', {
    name: key, value: version.document.bindings[key].value, maxlength: key === 'message' ? 1000 : 60,
  })));
  const image = node('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp' });
  const consent = node('input', { type: 'checkbox', name: 'rights' });
  const reason = node('textarea', { maxlength: 500, rows: 3 });
  const status = node('p', { role: 'alert' });
  const photoStatus = node('p', { role: 'status' });
  const actions = node('form', {},
    version.rights ? field('Đã xác nhận quyền phân phối ảnh demo trong mẫu và quà', consent) : null,
    field('Lý do yêu cầu sửa', reason),
    node('button', { type: 'submit', value: 'approve', class: 'btn btn--dark' }, 'Duyệt phiên bản'),
    node('button', { type: 'submit', value: 'revise', class: 'btn btn--outline' }, 'Yêu cầu sửa'),
    status,
  );
  const test = node('form', {}, node('h2', {}, 'Thử cá nhân hóa'),
    ...controls, version.photoId ? field('Thử thay ảnh trên thiết bị', image) : null,
    node('button', { type: 'submit', class: 'btn btn--outline' }, 'Cập nhật bản xem thử'), photoStatus);
  const back = node('a', { href: '/admin', 'data-link': '', class: 'btn btn--outline' }, 'Về hàng đợi');
  host.replaceChildren(node('section', { class: 'section' }, node('div', { class: 'container' },
    back, node('h1', {}, version.title), node('p', {}, `Bản r${version.revision} · ${version.id}`),
    version.hasLockedNames ? node('p', { role: 'status' }, 'Phiên bản có lớp tên bị khóa. Yêu cầu Creator mở quyền sửa tên hoặc đổi lớp đó thành chữ cố định trung tính.') : null,
    version.previousVersionId ? node('section', {}, node('h2', {}, 'Thay đổi từ lần gửi trước'),
      node('ul', {}, ...version.changes.map(change => node('li', {}, change)))) : null,
    version.rights ? node('p', {}, `Nguồn và quyền ảnh demo: ${version.rights}`) : null,
    node('details', {}, node('summary', {}, `Bìa mẫu · ${coverScene.name}`),
      node('img', { class: 'template-review-cover', alt: `Bìa mẫu ${version.title}`, src: `/api${endpoint}/cover` })),
    node('div', { class: 'template-review-grid' }, stage,
      node('div', { class: 'template-review-controls' }, test, version.status === 'pending' ? actions : node('p', {}, 'Phiên bản đã xử lý.'))),
  )));
  let player;
  let photoData;
  function show() {
    const document = structuredClone(version.document);
    const form = new FormData(test);
    for (const key of version.bindings) document.bindings[key].value = form.get(key);
    const photo = document.elements.find(item => item.id === version.photoId);
    const localId = 'review-local-photo';
    if (photo && photoData) {
      const sameAsset = document.elements.some(item => item !== photo && item.type === 'image' && item.props.assetId === photo.props.assetId);
      if (!sameAsset) document.assets = document.assets.filter(asset => asset.assetId !== photo.props.assetId);
      document.assets.push({ assetId: localId, kind: 'image' });
      photo.props.assetId = localId;
    }
    player?.dispose();
    player = mountPlayer(stage, { document, mode: 'preview',
      assetUrl: id => id === localId ? photoData : `/api${endpoint}/assets/${encodeURIComponent(id)}` });
  }
  show();
  test.addEventListener('submit', event => {
    event.preventDefault();
    photoStatus.textContent = '';
    const file = image.files?.[0];
    if (!file) { photoData = undefined; show(); return; }
    if (file.size > 2 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      photoStatus.textContent = 'Chọn ảnh PNG, JPEG hoặc WebP tối đa 2 MB.';
      return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (!lifetime.signal.aborted) { photoData = reader.result; show(); }
    }, { once: true });
    reader.readAsDataURL(file);
  }, { signal: lifetime.signal });
  actions.addEventListener('submit', async event => {
    event.preventDefault();
    const action = event.submitter?.value;
    if (action === 'revise' && !reason.value.trim()) {
      status.textContent = 'Ghi lý do yêu cầu sửa.';
      reason.focus();
      return;
    }
    const buttons = actions.querySelectorAll('button');
    buttons.forEach(button => { button.disabled = true; });
    try {
      await api.post(endpoint, { action, reason: reason.value, rightsConfirmed: consent.checked }, { signal: lifetime.signal });
      if (!lifetime.signal.aborted) navigate('/admin');
    } catch (error) {
      if (!lifetime.signal.aborted) status.textContent = error.message;
    } finally { buttons.forEach(button => { button.disabled = false; }); }
  }, { signal: lifetime.signal });
  return { dispose() { lifetime.abort(); player?.dispose(); } };
}
