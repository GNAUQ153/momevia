import test from 'node:test';
import assert from 'node:assert/strict';
import {isEditingRoute,FLOATING_CREATE_URL,FLOATING_EXPLORE_URL} from '../../web/js/ui/floating-cta.js';

test('floating actions stay on browsing pages and hide only for editing routes',()=>{
 for(const route of ['/','/explore','/template/a','/g/owned-gift','/studio','/creator','/admin','/login','/register','/policies/privacy'])assert.equal(isEditingRoute(route),false,route);
 for(const route of ['/design/new','/design/a','/design/a/','/create/template-id','/admin/library','/admin/library/'])assert.equal(isEditingRoute(route),true,route);
});
test('floating destinations are fixed and contain no gift, recipient or invite context',()=>{
 assert.equal(FLOATING_CREATE_URL,'/design/new');assert.equal(FLOATING_EXPLORE_URL,'/explore');
 for(const value of [FLOATING_CREATE_URL,FLOATING_EXPLORE_URL]){const url=new URL(value,'https://momevia.example');assert.equal(url.search,'');assert.equal(url.hash,'');assert.equal(url.origin,'https://momevia.example');}
});
