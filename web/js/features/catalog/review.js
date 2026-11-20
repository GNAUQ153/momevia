import { message, setText } from "../../core/i18n.js";
import { mountPlayer } from '../gift-runtime/index.js';
import { assetIds } from '../../shared/canvas/schema.js';
import { node, field } from '../canvas-editor/dom.js';

export function mountReview(host, { version, endpoint, api, navigate }) {
  const lifetime = new AbortController();
  const stage = node('div', { class: 'template-preview-player template-review-preview' });
  const coverScene = version.document.scenes.find(scene => scene.id === (version.coverSceneId || version.document.entrySceneId));
  const bindings = { recipientName: message("admin.review.binding.recipient"), senderName: message("admin.review.binding.sender"), message: message("admin.review.binding.greeting") };
  const controls = version.bindings.map(key => field(bindings[key], node('input', {
    name: key, value: version.document.bindings[key].value, maxlength: key === 'message' ? 1000 : 60,
  })));
  const image = node('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp' });
  const consent = node('input', { type: 'checkbox', name: 'rights' });
  const reason = node('textarea', { maxlength: 500, rows: 3 });
  const status = node('p', { role: 'alert' });
  const photoStatus = node('p', { role: 'status' });
  const actions = node('form', {},
    version.rights ? field(message("admin.review.confirmRights"), consent) : null,
    field(message("admin.review.reason"), reason),
    node('button', { type: 'submit', value: 'approve', class: 'btn btn--dark' }, message("admin.review.approve")),
    node('button', { type: 'submit', value: 'revise', class: 'btn btn--outline' }, message("admin.review.revise")),
    status,
  );
  const test = node('form', {}, node('h2', {}, message("admin.review.try")),
    ...controls, version.photoId ? field(message("admin.review.tryPhoto"), image) : null,
    node('button', { type: 'submit', class: 'btn btn--outline' }, message("admin.review.refresh")), photoStatus);
  const back = node('a', { href: '/admin', 'data-link': '', class: 'btn btn--outline' }, message("admin.review.back"));
  host.replaceChildren(node('section', { class: 'section' }, node('div', { class: 'container' },
    back, node('h1', {}, version.title), node('p', {}, message('admin.review.version', { revision: version.revision, id: version.id })),
    version.hasLockedNames ? node('p', { role: 'status' }, message("admin.review.lockedNames")) : null,
    version.previousVersionId ? node('section', {}, node('h2', {}, message("editor.submission.changes")),
      node('ul', {}, ...version.changes.map(change => node('li', {}, change)))) : null,
    version.rights ? node('p', {}, message('admin.review.photoRights', { rights: version.rights })) : null,
    node('details', {}, node('summary', {}, message('admin.review.cover', { scene: coverScene.name })),
      node('img', { class: 'template-review-cover', alt: message('admin.review.coverAlt', { title: version.title }), src: `/api${endpoint}/cover` })),
    node('div', { class: 'template-review-grid' }, stage,
      node('div', { class: 'template-review-controls' }, test, version.status === 'pending' ? actions : node('p', {}, message("admin.review.alreadyHandled")))),
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
      const sameAsset = assetIds({ elements: document.elements.filter(item => item !== photo) }).includes(photo.props.assetId);
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
    setText(photoStatus, '');
    const file = image.files?.[0];
    if (!file) { photoData = undefined; show(); return; }
    if (file.size > 2 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setText(photoStatus, message('admin.review.photoError'));
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
      setText(status, message('admin.review.reasonRequired'));
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
