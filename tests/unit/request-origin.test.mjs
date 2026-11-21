import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAllowedOrigins, requireRequestOrigin } from '../../src/shared/request-origin.mjs';

const config = {
  baseUrl: 'http://127.0.0.1:4110',
  allowedOrigins: parseAllowedOrigins('https://qa-4110.asse.devtunnels.ms/'),
};
const check = (origin, settings = config, headers = {}) => requireRequestOrigin({ headers: { ...headers,
  ...(origin === undefined ? {} : { origin }) } }, settings);

test('loopback aliases accept the same protocol/port and explicitly configured tunnel only', () => {
  for (const origin of [undefined, 'http://127.0.0.1:4110', 'http://localhost:4110', 'http://[::1]:4110',
    'https://qa-4110.asse.devtunnels.ms']) assert.doesNotThrow(() => check(origin), origin);
  for (const origin of ['null', '', 'http://localhost:4111', 'https://localhost:4110', 'https://evil.example',
    'http://localhost.evil.example:4110', 'https://other-4110.asse.devtunnels.ms',
    'https://qa-4110.asse.devtunnels.ms.evil.example', 'https://qa-4110.asse.devtunnels.ms/path',
    'https://user@qa-4110.asse.devtunnels.ms', 'https://qa-4110.asse.devtunnels.ms/a/..',
    'https://qa-4110.asse.devtunnels.ms\\a\\..', 'https:/qa-4110.asse.devtunnels.ms',
    ' https://qa-4110.asse.devtunnels.ms']) {
    assert.throws(() => check(origin), { status: 403 }, origin);
  }
});

test('public origins remain exact and ignore spoofed forwarding headers', () => {
  assert.doesNotThrow(() => check('http://localhost:4110'));
  assert.throws(() => check('https://evil.example', config, {
    host: 'evil.example', 'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'https',
    forwarded: 'host=evil.example;proto=https',
  }), { status: 403 });
  const publicConfig = { baseUrl: 'https://momevia.example', allowedOrigins: [] };
  assert.doesNotThrow(() => check(publicConfig.baseUrl, publicConfig));
  assert.throws(() => check('http://localhost:4110', publicConfig), { status: 403 });
  assert.throws(() => check('https://other.example', publicConfig), { status: 403 });
});

test('origin configuration normalizes exact origins and rejects wildcards or non-origin URLs', () => {
  assert.deepEqual(parseAllowedOrigins(), []);
  assert.deepEqual(parseAllowedOrigins(' https://EXAMPLE.test:443/,https://example.test, http://localhost:4110 '),
    ['https://example.test', 'http://localhost:4110']);
  for (const value of ['*', 'https://*.example.test', 'null', 'ftp://example.test',
    'https://user:pass@example.test', 'https://example.test/path', 'https://example.test?x=1',
    'https://example.test#x', 'https://example.test/a/..', 'https://example.test\\a\\..',
    'https:/example.test']) assert.throws(() => parseAllowedOrigins(value), /ALLOWED_ORIGINS/, value);
});
