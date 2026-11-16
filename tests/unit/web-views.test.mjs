import test from 'node:test';
import assert from 'node:assert/strict';
import { createComponents } from '../../web/js/ui/components.js';
import { createHomeViews } from '../../web/js/pages/home.js';
import { createCatalogViews } from '../../web/js/pages/catalog.js';
import { createGiftViews } from '../../web/js/pages/gifts.js';
import { createCreatorViews } from '../../web/js/pages/creator.js';
import { createAdminViews } from '../../web/js/pages/admin.js';
import { createAuthViews } from '../../web/js/pages/auth.js';
import { createSystemViews } from '../../web/js/pages/system.js';

function views(user = null) {
  const template={id:'sample',title:'A <sample>',subtitle:'Note',theme:'rose',style:'Tình cảm',price:0,creator:'QA',featured:true};
  const state={user,templates:[template],favorites:new Set(['sample']),filter:'Tất cả',search:'',freeOnly:false,catalogPage:1,favoritePage:1,providers:{google:false,zalo:false}};
  const components=createComponents({state});
  const context={state,...components,location:new URL('https://example.test'),buttonLink:(href,label)=>`<a href="${href}">${label}</a>`,requireLogin:()=>false};
  return {template,context,...createHomeViews(context),...createCatalogViews(context),...createGiftViews(context),
    ...createCreatorViews(context),...createAdminViews(context),...createAuthViews(context),...createSystemViews(context)};
}

test('Các trang tách module giữ nội dung, escape HTML và các form/action hiện hữu', () => {
  const v=views({id:'u',name:'QA',role:'sender'});
  assert.match(v.home(),/A &lt;sample&gt;/);
  assert.match(v.aboutPage(),/Momevia/);
  assert.match(v.explore(),/catalog-grid/);
  assert.match(v.templateDetail(v.template),/toggle-favorite/);
  assert.match(v.favoritesPage(),/A &lt;sample&gt;/);
  assert.match(views().authPage('register'),/confirmPassword/);
  assert.match(views().authPage('login'),/email-login-form/);
  assert.match(v.authPage('login'),/Bạn đã đăng nhập/);
  assert.match(v.adminPage([],[]),/Yêu cầu hỗ trợ/);
  assert.match(v.dashboard([],[]),/QA/);
  assert.match(v.successPage({slug:'safe-slug',url:'https://example.test/g/safe-slug'}),/safe-slug/);
  assert.match(v.errorPage('Error <unsafe>'),/&lt;unsafe&gt;/);
  assert.match(v.loadingPage(),/loading/);
});

test('Trang Creator chỉ hiện form cho Creator/Admin và không khôi phục nút tự đổi role', () => {
  const sender=views({id:'s',name:'QA',role:'sender'}).creatorPage();
  assert(!sender.includes('id="creator-template-form"'));
  assert(!sender.includes('become-creator'));
  assert.match(sender,/quản trị viên/);
  for(const role of ['creator','admin']) assert.match(views({id:'u',name:'QA',role}).creatorPage(),/id="creator-template-form"/);
});
