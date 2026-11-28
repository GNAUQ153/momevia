/* Face placement follows the CSS cube technique in KILLERTIAN/3D-Box-Animation.
 * MIT License, Copyright (c) 2022 Om Sharma.
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
const part=css=>{const e=document.createElement('span');e.className=css;e.setAttribute('aria-hidden','true');return e;};
export function renderGiftVolume(card,bow){
 const world=part('gift-cube-world');
 for(const face of['back','left','right','bottom','front'])world.append(part('gift-cube-face gift-cube-'+face),part('gift-cube-face gift-cube-inner gift-cube-'+face+'-inner'));
 card.className='gift-drive-sliding-card gift-cube-card';world.append(card);
 const lid=part('gift-cube-lid'),top=part('gift-cube-lid-face gift-cube-top'),under=part('gift-cube-under');lid.append(under);
 top.append(part('gift-cube-ribbon-x'),part('gift-cube-ribbon-y'));const tie=part('gift-cube-bow');tie.append(bow);top.append(tie);lid.append(top);
 for(const face of['front','right','back','left'])lid.append(part('gift-cube-lid-face gift-cube-lid-'+face));world.append(lid);return world;
}
