import test from 'node:test';
import assert from 'node:assert/strict';
import { isInternalRoute, upstreamHeaders, clientIp } from '../services/shared/proxy.mjs';

test('Gateway chặn namespace nội bộ kể cả segment đã mã hóa', () => {
  for (const route of ['/internal', '/internal/', '/internal/templates/a', '/%69nternal/templates/a', '/internal%2Ftemplates/a']) {
    assert.equal(isInternalRoute(route), true, route);
  }
  for (const route of ['/', '/templates', '/templates/internal', '/internalized']) {
    assert.equal(isInternalRoute(route), false, route);
  }
});

test('Gateway thay IP do client tự khai và bỏ header nội bộ', () => {
  const req = {
    headers:{cookie:'session=test',host:'example.test','x-forwarded-for':'1.2.3.4','x-service-key':'spoof','x-real-ip':'5.6.7.8',forwarded:'for=spoof'},
    socket:{remoteAddress:'192.0.2.10'},
  };
  const headers = upstreamHeaders(req, 4103);
  assert.equal(headers['x-forwarded-for'], '192.0.2.10');
  assert.equal(headers.cookie, 'session=test');
  assert.equal(headers.host, '127.0.0.1:4103');
  for (const key of ['x-service-key', 'x-real-ip', 'forwarded']) assert.equal(key in headers, false);
  assert.equal(req.headers['x-service-key'], 'spoof');
});

test('Service chỉ tin một IP hợp lệ do proxy cùng máy chuyển tiếp', () => {
  const request = (peer, forwarded) => ({socket:{remoteAddress:peer},headers:{'x-forwarded-for':forwarded}});
  assert.equal(clientIp(request('127.0.0.1','192.0.2.10')), '192.0.2.10');
  assert.equal(clientIp(request('::1','2001:db8::1')), '2001:db8::1');
  assert.equal(clientIp(request('192.0.2.11','192.0.2.10')), '192.0.2.11');
  for (const value of ['192.0.2.10, 192.0.2.11', 'invalid', undefined]) {
    assert.equal(clientIp(request('127.0.0.1',value)), '127.0.0.1');
  }
});
