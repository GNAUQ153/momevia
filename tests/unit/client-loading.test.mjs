import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {rememberCatalogMetadata} from '../../web/js/core/catalog-bootstrap.js';
import {templateCover} from '../../web/js/features/catalog/template-copy.js';
test('public cover metadata retains DB revisions without an editor library snapshot',()=>{
 try{rememberCatalogMetadata({templates:[{id:'birthday-radiance',coverRevision:'revision-123'}]});assert.match(templateCover('birthday-radiance'),/library\/templates\/birthday-radiance\/cover/);assert.match(templateCover('birthday-radiance'),/revision-123/);
 const deferred=templateCover({id:'birthday-radiance'},{defer:true});assert(deferred.startsWith('data-src='));assert.match(deferred,/data-cover-lazy/);rememberCatalogMetadata({templates:[]});assert.match(templateCover('birthday-radiance'),/assets\/basic-templates/);
 }finally{rememberCatalogMetadata({templates:[]});}
});
test('self-hosted variable fonts retain exact approved binaries and all script fallbacks',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../../web/assets/fonts/app/manifest.json',import.meta.url))),css=fs.readFileSync(new URL('../../web/css/app-fonts.css',import.meta.url),'utf8');assert.equal(manifest.fonts.length,11);
 for(const font of manifest.fonts){const bytes=fs.readFileSync(new URL('../../web/assets/fonts/app/'+font.file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),font.sha256);assert.equal(font.weight,'400 800');assert(css.includes(font.file));}
 for(const family of ['Inter','Plus Jakarta Sans']){assert(css.indexOf(`/* ${family} / vietnamese */`)>css.indexOf(`/* ${family} / latin-ext */`));assert(css.includes(`/* ${family} / latin */`));}
});
