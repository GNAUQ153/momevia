import test from 'node:test';
import assert from 'node:assert/strict';
import {templates,addedSystemTemplates} from '../../src/modules/catalog/seed.mjs';
import {OPEN_ME_TEMPLATE_META,createOpenMeTemplate} from '../../web/js/shared/canvas/open-me-templates.js';
import {systemCardType} from '../../web/js/shared/card-type.js';

test('Prepared card layouts keep stable identities without publishing or pricing new Catalog products',()=>{
  assert.equal(OPEN_ME_TEMPLATE_META.length,3);
  for(const row of OPEN_ME_TEMPLATE_META){
    assert(!row.id.startsWith('qa-'));
    assert.equal(systemCardType(row.id),row.cardType);
    assert(!templates.some(template=>template.id===row.id));
    assert(!addedSystemTemplates.some(template=>template.id===row.id));
    assert(createOpenMeTemplate(row.id));
  }
  assert.equal(systemCardType('winter-wishes-2026'),'greeting');
  assert.equal(createOpenMeTemplate('winter-wishes-2026'),null);
});
