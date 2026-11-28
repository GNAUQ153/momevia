import test from 'node:test';import assert from 'node:assert/strict';
import {fittedPage,bodyFit,prosePages,pageChunks} from '../../web/js/features/gift-runtime/page-fit.js';
test('shared pages respect both screen bounds, including short landscape screens and toolbar space',()=>{
 for(const [width,height]of[[320,568],[390,844],[1440,900],[844,390]]){
  const p=fittedPage({width:Math.min(width,400),authoredWidth:390,authoredHeight:844,viewportHeight:height,stageTop:80,chromeAfter:60});
  assert(p.height<=height-152);assert(p.height<=844*p.scale);
  const fit=bodyFit({width,height:p.height,contentHeight:1800});assert(Math.abs(fit.scale*1800-p.height)<1e-8);assert(fit.left>=0);
 }
});
test('sender prose inside an interactive sealed letter shares the same lossless reading parts',()=>{
 const textContent='Lời thư có dấu. '.repeat(60),body={textContent};
 const result=pageChunks([{model:{type:'interaction',props:{bodyBinding:'message'}},node:{querySelectorAll:()=>[body]}}]);
 assert(result.count>1);assert.equal(result.entries[0].pages.join(''),textContent);assert.equal(body.textContent,textContent);
});
test('long Unicode prose is split losslessly at words and keeps repeated spaces/newlines',()=>{
 const source=('Nguyễn Ánh — lời chúc.  Hai khoảng cách.\n').repeat(100),parts=prosePages(source);assert(parts.length>1);assert.equal(parts.join(''),source);assert(parts.every(p=>p.length<=320));
 assert.deepEqual(prosePages('Ngắn'),['Ngắn']);assert.equal(prosePages('x'.repeat(1800)).join(''),'x'.repeat(1800));
});
