import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function runReplyIntents(base, slug, owner, other) {
  const endpoint = '/api/gifts/gifts/' + slug;
  const inbox = '/api/gifts/gifts/mine/' + slug + '/replies';
  const call = async (route, status, body, cookie) => {
    const response = await fetch(base + route, { method: body ? 'POST' : 'GET',
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    assert.equal(response.status, status, JSON.stringify(data));
    return data;
  };
  const intent = { intentId: randomUUID(), name: 'Người nhận QA', message: 'Cảm ơn bạn!' };
  const [a, retry] = await Promise.all([
    call(endpoint + '/replies', 201, intent),
    call(endpoint + '/replies', 201, intent),
  ]);
  assert.equal(a.reply.id, retry.reply.id);
  assert.equal((await call(endpoint, 200)).gift.replyCount, 1);
  await call(endpoint + '/replies', 409, { ...intent, message: 'Khác lời' });
  const displayed = await call(inbox, 200, undefined, owner);
  assert.equal(displayed.replies[0].unread, true);
  const otherIntent = await call(endpoint + '/replies', 201, { ...intent, intentId: randomUUID() });
  assert.notEqual(a.reply.id, otherIntent.reply.id);
  const ids = displayed.replies.map(reply => reply.id);
  await call(inbox + '/read', 404, { ids }, other);
  assert.equal((await call(inbox + '/read', 200, { ids }, owner)).unreadCount, 1);
  const after = (await call(inbox, 200, undefined, owner)).replies;
  assert.equal(after.length, 2);
  assert.equal(after.find(reply => reply.id === a.reply.id).unread, false);
  assert.equal(after.find(reply => reply.id === otherIntent.reply.id).unread, true);
  const publicReplies = await call(endpoint + '/replies', 200);
  assert(publicReplies.replies.every(reply => !Object.hasOwn(reply, 'unread') && !Object.hasOwn(reply, 'readStatus')));
  assert.equal((await call(endpoint, 200)).gift.replyCount, 2);
}
