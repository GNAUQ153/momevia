import test from 'node:test';
import assert from 'node:assert/strict';
import {responsiveTextSize,responsiveControlSize} from '../../web/js/shared/canvas/responsive-type.js';
import {createElement} from '../../web/js/shared/canvas/registry.js';
import {createDocument} from '../../web/js/shared/canvas/presets.js';
import {validateDocument,duplicateDocument} from '../../web/js/shared/canvas/schema.js';
test('reading scales preserve the authored hierarchy and browser text preferences without mutating sizes',()=>{
 const caption=createElement('text',{props:{fontSize:14}}),body=createElement('text',{props:{fontSize:21}}),heading=createElement('text',{props:{fontSize:42},accessibility:{role:'heading',level:1}});
 assert.equal(responsiveTextSize(caption,.65),'clamp(0.8125rem, 9.1px, 28px)');
 assert.equal(responsiveTextSize(body,.65),'clamp(0.9375rem, 13.65px, 42px)');
 assert.equal(responsiveTextSize(heading,.65),'clamp(1.25rem, 27.3px, 84px)');
 assert.notEqual(responsiveTextSize(body,.65),responsiveTextSize(body,1.4));assert.equal(body.props.fontSize,21);
 assert.match(responsiveControlSize(.65),/clamp\(\.875rem, 10.4px, 1.5rem\)/);
});
test('button rounding is a validated, editable Canvas property and survives duplication',()=>{
 const doc=createDocument({presetId:'blank'}),button=createElement('button',{props:{radius:20},actions:[{on:'activate',type:'replay'}]});
 doc.elements.push(button);doc.scenes[0].elementIds.push(button.id);assert.doesNotThrow(()=>validateDocument(doc));
 assert.equal(duplicateDocument(doc).elements[0].props.radius,20);
 button.props.radius='arbitrary';assert.throws(()=>validateDocument(doc));
});
