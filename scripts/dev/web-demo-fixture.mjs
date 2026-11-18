import assert from 'node:assert/strict';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { createElement } from '../../web/js/shared/canvas/index.js';
import { JsonRepository } from '../../src/shared/storage.mjs';

// The launcher owns a fresh loopback JSON profile. All writes use HTTP except the
// synthetic legacy expiration timestamp, which is backdated in that profile only.
export async function seedWebDemo({ base, accounts, appDir }) {
  function client() {
    let cookie;
    return async (path, { body, bytes, expected = 200 } = {}) => {
      const method = body || bytes ? 'POST' : 'GET';
      const response = await fetch(`${base}/api${path}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: {
          ...(cookie ? { cookie } : {}),
          ...(method === 'POST' ? { origin: base } : {}),
          ...(body ? { 'content-type': 'application/json' } : {}),
          ...(bytes ? { 'content-type': 'image/png', 'x-mutation-id': randomUUID() } : {}),
        },
        body: body ? JSON.stringify(body) : bytes,
      });
      assert.equal(response.status, expected, `${method} ${path.split('?')[0]}`);
      const issued = response.headers.get('set-cookie');
      if (issued) cookie = issued.split(';')[0];
      return response.headers.get('content-type')?.includes('application/json') ? response.json() : Buffer.from(await response.arrayBuffer());
    };
  }

  const admin = client(), creator = client(), sender = client(), guest = client();
  const post = (actor, path, body, expected = 200) => actor(path, { body, expected });
  const designPath = id => `/designs/designs/${id}`;
  const workspacePath = id => `/catalog/creator/workspaces/${id}`;
  const apiReview = (id, version) => `/catalog/admin/templates/${id}/versions/${version}`;
  const browserReview = (id, version) => `${base}/admin/review/${id}/${version}`;
  const health = await guest('/designs/health');
  assert.equal(health.profile.mode, 'json');
  assert.equal((await guest('/checkout/payments/methods')).demoPurchaseAvailable, true);
  assert.equal((await post(admin, '/auth/login', accounts.admin)).user.role, 'admin');
  for (const [actor, profile] of [[creator, accounts.creator], [sender, accounts.sender]]) {
    const { user } = await post(actor, '/auth/register', { ...profile, confirmPassword: profile.password }, 201);
    if (actor === creator) await post(admin, `/auth/admin/users/${user.id}/role`, { role: 'creator' });
  }

  async function portrait({ sky, ground, icing, accent, moon }) {
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="540" viewBox="0 0 840 540">
    <defs><linearGradient id="sky" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="${sky}"/><stop offset="1" stop-color="#FFF0DB"/></linearGradient>
    <linearGradient id="icing" x2="1" y2="1"><stop stop-color="#FFF4DA"/><stop offset="1" stop-color="${icing}"/></linearGradient></defs>
    <rect width="840" height="540" fill="url(#sky)"/><circle cx="655" cy="122" r="63" fill="${moon}" opacity=".94"/>
    <path d="M0 331 Q 110 233 266 332 T 539 325 T840 282 V540 H0Z" fill="${ground}" opacity=".59"/>
    <path d="M0 394 Q 226 311 393 402 T 840 337 V540 H0Z" fill="${ground}"/>
    <path d="M86 121h40m-20-20v40m562 109h46m-23-23v46m-468-79h32m-16-16v32m315-118h34m-17-17v34" stroke="#fff8e9" stroke-width="5" stroke-linecap="round"/>
    <circle cx="170" cy="206" r="8" fill="${accent}"/><circle cx="582" cy="160" r="7" fill="#fff5d9"/><circle cx="735" cy="159" r="8" fill="${accent}"/><circle cx="267" cy="112" r="6" fill="#fff5d9"/>
    <ellipse cx="429" cy="428" rx="228" ry="39" fill="#45244D" opacity=".16"/>
    <rect x="264" y="320" width="324" height="100" rx="24" fill="url(#icing)"/><rect x="305" y="255" width="242" height="88" rx="24" fill="url(#icing)"/>
    <path d="M267 349c23-14 44 12 66 0s44 12 66 0 44 12 66 0 44 12 66 0 39 6 53-4m-274-59c23-13 43 12 66 0s43 12 66 0 44 12 66 0l16-2" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>
    <path d="M377 256v-55m51 55v-73m51 73v-55" stroke="${accent}" stroke-width="13" stroke-linecap="round"/>
    <path d="M377 188c-27-18 15-42 8-45 20 29 6 44-8 45m52-18c-29-14 15-44 7-51 28 28 12 48-7 51m51 18c-26-16 12-39 8-45 22 29 8 43-8 45" fill="#FFBF50"/>
    <path d="M231 423h394" stroke="#fff6dc" stroke-width="17" stroke-linecap="round"/></svg>`;
    return sharp(Buffer.from(markup)).png().toBuffer();
  }
  const demoImage = await portrait({ sky: '#BAA2EB', ground: '#7E76B3', icing: '#FFC9D0', accent: '#BA547C', moon: '#FCE4A6' });
  const privateImage = await portrait({ sky: '#FFD3BA', ground: '#BB746B', icing: '#FFB581', accent: '#973A67', moon: '#FFF0A9' });

  async function save(actor, draft) {
    await post(actor, designPath(draft.id) + '/save', {
      expectedRevision: draft.revision, mutationId: randomUUID(), title: draft.title, document: draft.document,
    });
    return (await actor(designPath(draft.id))).design;
  }

  async function upload(actor, id, bytes) {
    return (await actor(designPath(id) + '/assets', { bytes, expected: 201 })).asset.id;
  }

  async function prepareTemplate(title, subtitle, palette) {
    const { id } = await post(creator, '/catalog/creator/workspaces', { title, subtitle, mutationId: randomUUID() }, 201);
    const draft = (await creator(designPath(id))).design;
    const photo = await upload(creator, id, await palette);
    const doc = draft.document;
    const frameId = 'birthday-photo';
    doc.elements.find(item => item.id === 'text-recipient').layout.y = 98;
    Object.assign(doc.elements.find(item => item.id === 'open-gift').layout, { y: 508, height: 140 });
    Object.assign(doc.elements.find(item => item.id === 'text-intro').layout, { y: 697, height: 73 });
    doc.assets.push({ assetId: photo, kind: 'image' });
    doc.elements.push(
      createElement('text', { id: 'birthday-kicker', layout: { x: 34, y: 42, width: 322, height: 42 }, props: { text: 'MỪNG SINH NHẬT', fontSize: 17, align: 'center', color: '#6136DF' } }),
      createElement('image', { id: frameId, name: 'Khung ảnh sinh nhật', layout: { x: 28, y: 213, width: 334, height: 246 }, props: { assetId: photo, radius: 22 }, accessibility: { alt: 'Bánh sinh nhật và khung trời màu pastel' } }),
    );
    doc.scenes[0].elementIds.push('birthday-kicker', frameId);
    return save(creator, draft);
  }

  async function submit(template) {
    return (await post(creator, workspacePath(template.id) + '/submit', {
      expectedRevision: template.revision, bindings: ['recipientName', 'senderName', 'message'], photoId: 'birthday-photo',
      rights: 'Minh họa do bộ fixture demo Momevia tạo riêng. Cho phép dùng và phân phối trong mẫu và quà demo.',
    })).version;
  }

  let template = await prepareTemplate('Sinh nhật dưới trăng tím', 'Thiệp ba cảnh với khung ảnh sinh nhật, lời chúc và hồi đáp.', demoImage);
  const v1 = await submit(template);
  await post(admin, apiReview(template.id, v1.id), { action: 'approve', rightsConfirmed: true });
  const pendingTemplate = await prepareTemplate('Điều ước lúc hoàng hôn', 'Bản đang chờ Admin xem và thử thay ảnh.', privateImage);
  const pendingVersion = await submit(pendingTemplate);
  const creatorDraft = await prepareTemplate('Một tuổi mới rực rỡ', 'Nháp Creator để mở canvas, nhân bản và gửi duyệt.', demoImage);

  const senderDraft = (await post(sender, '/designs/designs', {
    source: { kind: 'template', templateId: template.id, templateVersionId: v1.id },
    title: 'Sinh nhật của An Nhiên', mutationId: randomUUID(),
  }, 201)).design;
  const photo = await upload(sender, senderDraft.id, privateImage);
  const frame = senderDraft.document.elements.find(element => element.id === senderDraft.policy.photoId);
  senderDraft.document.assets = [{ assetId: photo, kind: 'image' }];
  frame.props.assetId = photo;
  const privateMessage = 'An Nhiên ơi, chúc bạn một tuổi mới thật tự do, đủ can đảm để làm điều mình thích và luôn có người cùng thổi nến. Hẹn gặp bạn ở bữa tiệc nhé!';
  for (const [key, value] of Object.entries({ recipientName: 'An Nhiên', senderName: 'Minh Khôi', message: privateMessage })) {
    senderDraft.document.bindings[key].value = value;
  }
  const saved = await save(sender, senderDraft);
  const publish = (draft, access) => post(sender, '/gifts/gifts/from-design', {
    designId: draft.id, expectedRevision: draft.revision, expectedDocumentHash: draft.documentHash, idempotencyKey: randomUUID(), access,
  }, 201);
  const mainGift = (await publish(saved, { open: 'link', send: 'invite', read: 'sender' })).gift;
  const privateGift = (await publish(saved, { open: 'invite', send: 'disabled', read: 'sender' })).gift;
  const revokedGift = (await publish(saved, { open: 'link', send: 'link', read: 'link' })).gift;
  await post(sender, `/gifts/gifts/mine/${revokedGift.slug}/revoke`, {});
  await post(guest, `/gifts/gifts/${mainGift.slug}/replies${new URL(mainGift.inviteUrl).search}`, {
    name: 'An Nhiên', message: 'Cảm ơn Khôi! Mình nhận được thiệp và chiếc bánh hoàng hôn rồi.',
  }, 201);

  const catalog = (await guest('/catalog/templates')).templates;
  const builtInFree = catalog.find(item => item.price === 0 && !item.versionId);
  const legacy = (await post(sender, '/gifts/gifts', {
    templateId: builtInFree.id, recipientName: 'Bạn demo', senderName: 'Minh Khôi', message: 'Món quà demo đã hết hạn.',
  }, 201)).gift;
  const giftsRepo = new JsonRepository(path.join(appDir, 'services/gifts/data/gifts.json'));
  giftsRepo.update(legacy.id, { createdAt: new Date(Date.now() - 172800000).toISOString(), expiresAt: new Date(Date.now() - 86400000).toISOString() });

  const reportBody = { name: 'Khách demo', email: 'visitor@momevia.test', topic: 'Báo cáo nội dung', message: 'Báo cáo demo để thử bước tiếp nhận và xử lý trong Admin.' };
  await post(guest, '/support/requests', { ...reportBody, reportKind: 'gift', reportId: mainGift.slug }, 201);
  const resolved = await post(guest, '/support/requests', { ...reportBody, reportKind: 'template', reportId: template.id }, 201);
  const ticket = (await admin('/support/admin/requests')).requests.find(item => item.code === resolved.ticket.code);
  await post(admin, `/support/admin/requests/${ticket.id}/resolve`, { action: 'claim' });
  await post(admin, `/support/admin/requests/${ticket.id}/resolve`, { action: 'resolve', resolution: 'Đã xác minh phạm vi hiển thị của mẫu demo.' });

  const paid = catalog.find(item => item.id === 'polaroid' && item.price > 0) || catalog.find(item => item.price > 0);
  const paidDraft = (await post(sender, '/designs/designs', { source: { kind: 'template', templateId: paid.id }, title: 'Nháp demo · Thử cấp quyền mẫu có giá', mutationId: randomUUID() }, 201)).design;
  for (const [key, value] of Object.entries({ recipientName: 'Châu Anh', senderName: 'Minh Khôi', message: 'Thử cấp quyền mô phỏng rồi gửi thiệp sinh nhật này.' })) {
    paidDraft.document.bindings[key].value = value;
  }
  await save(sender, paidDraft);

  template.document.scenes[0].background.color = '#FDE7DB';
  template.document.elements.find(element => element.id === 'birthday-kicker').props.text = 'MỪNG TUỔI MỚI';
  template = await save(creator, template);
  const v2 = await submit(template);
  await post(admin, apiReview(template.id, v2.id), { action: 'revise', reason: 'Giữ tiêu đề có tương phản cao hơn để đọc tốt trên màn hình hẹp.' });
  assert.equal((await guest(`/catalog/templates/${template.id}`)).template.versionId, v1.id);
  assert.equal((await guest(`/gifts/gifts/${mainGift.slug}`)).gift.documentSnapshot.bindings.message.value, privateMessage);
  assert.equal((await sender(`/gifts/gifts/mine/${mainGift.slug}/replies`)).replies.length, 1);
  await guest(`/gifts/gifts/${privateGift.slug}`, { expected: 403 });
  await guest(`/gifts/gifts/${privateGift.slug}${new URL(privateGift.inviteUrl).search}`);
  await guest(`/gifts/gifts/${revokedGift.slug}`, { expected: 410 });
  await guest(`/gifts/gifts/${legacy.slug}`, { expected: 410 });
  const paidStatus = await post(sender, designPath(paidDraft.id) + '/preflight', { expectedRevision: paidDraft.revision + 1 });
  assert.equal(paidStatus.authorization.status, 'needs_template_license');

  return {
    base, creator: base + '/creator', creatorDraft: base + '/design/' + creatorDraft.id,
    admin: base + '/admin', pending: browserReview(pendingTemplate.id, pendingVersion.id),
    studio: base + '/studio', template: base + '/template/' + template.id,
    senderDraft: base + '/design/' + senderDraft.id + '?mode=quick',
    paidDraft: base + '/design/' + paidDraft.id + '?mode=quick',
    paidTemplate: base + '/template/' + paid.id, paidTemplateId: paid.id,
    share: base + '/success/' + mainGift.slug, gift: mainGift.url, invite: mainGift.inviteUrl,
    privateGift: privateGift.url, privateInvite: privateGift.inviteUrl, revoked: revokedGift.url, expired: legacy.url,
  };
}
