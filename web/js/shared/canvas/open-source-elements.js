/*!
MIT License

Copyright (c) 2026 Ashiq Hussain Mir

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
// Reviewed path DATA from Canvix nature.ts, MIT © 2026 Ashiq Hussain Mir.
// No upstream functions, imports, scripts or commands are evaluated.
// Coordinates converted from its 120-unit artboard to Momevia's 100-unit space.
import {createElement} from './registry.js';
export const OPEN_VECTOR_IDS=['natural-open-canvix-tulip','natural-open-canvix-leaf'];
const paths=[
 [
  ['M31.667 36.667Q31.667 16.667 43.333 16.667Q48.333 16.667 50 23.333Q51.667 16.667 56.667 16.667Q68.333 16.667 68.333 36.667Q68.333 50 50 51.667Q31.667 50 31.667 36.667Z','color',2.917],
  ['M50 51.667L50 86.667','none',4.167,'#6BCB77'],
  ['M50 66.667Q35 65 31.667 51.667Q45 51.667 50 61.667Z','#6BCB77',2.5],
  ['M50 73.333Q65 71.667 68.333 58.333Q55 58.333 50 68.333Z','#6BCB77',2.5],
 ],
 [
  ['M18.333 81.667Q15 40 50 18.333Q85 40 81.667 81.667Q50 93.333 18.333 81.667Z','color',2.917],
  ['M50 25L50 85M50 43.333Q38.333 40 33.333 31.667M50 43.333Q61.667 40 66.667 31.667M50 60Q38.333 56.667 33.333 48.333M50 60Q61.667 56.667 66.667 48.333M50 75Q40 71.667 35 65M50 75Q60 71.667 65 65','none',2.083],
 ],
];
export function openVectorCards(translate){return OPEN_VECTOR_IDS.map((id,i)=>({id,title:translate('editor.library.item.'+id),visualKind:'graphics',keywords:i?'lá leaf nature Canvix MIT':'tulip hoa spring Canvix MIT',create:()=>[
 createElement('shape',{name:translate('editor.library.item.'+id),layout:{x:0,y:0,width:210,height:210},props:{kind:'open-canvix-'+(i?'leaf':'tulip'),color:i?'#6BCB77':'#FF6B6B'},artwork:{paths:paths[i].map(([d,fill,strokeWidth,stroke])=>({d,fill,stroke:stroke||'#2D2A32',strokeWidth}))},accessibility:{decorative:true}}),
 ]}));}
