import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthViews } from '../../web/js/pages/auth.js';

for (const mode of ['login', 'register']) {
  test(`${mode}: nhãn provider ngắn gọn, giữ logo và ngữ cảnh trợ năng`, () => {
    for (const enabled of [false, true]) {
      const views = createAuthViews({
        state: { user: null, providers: { google: enabled, zalo: enabled } },
        buttonLink: () => '',
      });
      const html = views.authPage(mode);
      for (const [id, label] of [['google', 'Google'], ['zalo', 'Zalo']]) {
        const pattern = new RegExp(`<(?<tag>a|button)\\b(?<attrs>[^>]*data-auth-provider="${id}"[^>]*)>(?<body>[\\s\\S]*?)<\\/\\k<tag>>`);
        const match = html.match(pattern);
        assert.ok(match, id);
        assert.match(match.groups.body, new RegExp(`auth-provider-logo--${id}`));
        assert.ok(match.groups.body.trim().endsWith(`<span>${label}</span>`));
        const key = !enabled ? 'notEnabled' : mode === 'register' ? 'registerWith' : 'signInWith';
        assert.ok(match.groups.attrs.includes(`auth.providers.${key}`));
        if (!enabled || mode === 'register') {
          assert.equal(match.groups.tag, 'button');
          assert.match(match.groups.attrs, /\bdisabled\b/);
          assert.doesNotMatch(match.groups.attrs, /\bhref=/);
        } else {
          assert.equal(match.groups.tag, 'a');
          assert.ok(match.groups.attrs.includes(`href="/api/auth/${id}"`));
        }
        if (enabled && mode === 'register') assert.ok(match.groups.attrs.includes(`data-auth-provider-url="/api/auth/${id}"`));
      }
    }
  });
}
