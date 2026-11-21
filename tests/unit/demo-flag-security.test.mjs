import test from 'node:test';
import assert from 'node:assert/strict';
import { environment } from '../../src/shared/config.mjs';

const original = Object.fromEntries(['JWT_SECRET', 'INTERNAL_SERVICE_KEY', 'DEMO_AUTH_ENABLED', 'NODE_ENV']
  .map(key => [key, process.env[key]]));

test('Demo Auth mặc định phải tắt và tuyệt đối tắt trên production', () => {
  try {
    process.env.JWT_SECRET = 'unit-test-jwt-secret-very-long-1234567890';
    process.env.INTERNAL_SERVICE_KEY = 'unit-test-internal-key-very-long-1234567890';
    delete process.env.DEMO_AUTH_ENABLED;
    process.env.NODE_ENV = 'development';
    assert.equal(environment().demoEnabled, false);
    process.env.DEMO_AUTH_ENABLED = 'false';
    assert.equal(environment().demoEnabled, false);
    process.env.DEMO_AUTH_ENABLED = 'true';
    assert.equal(environment().demoEnabled, true);
    process.env.NODE_ENV = 'production';
    assert.equal(environment().demoEnabled, false);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
