// Presentation only: a published document and its authored coordinates never change.
export function fittedPage({width,authoredWidth,authoredHeight,viewportHeight,stageTop,chromeAfter=0,bottomInset=32}){
 const scale=Math.max(.01,width/authoredWidth);
 return {scale,height:Math.max(96,Math.min(authoredHeight*scale,viewportHeight-Math.max(0,stageTop)-chromeAfter-bottomInset))};
}
export function bodyFit({width,height,contentHeight}){
 const scale=Math.min(1,height/Math.max(1,contentHeight));
 return {scale,left:width*(1-scale)/2};
}
// Break only long prose at word boundaries. Forms and widgets keep one live node.
export function prosePages(text,limit=320){
 const original=String(text||'');if(original.length<=limit)return [original];
 const pages=[];let rest=original;
 while(rest.length>limit){let end=rest.lastIndexOf(' ',limit-1);if(end<limit/2)end=limit;else end++;
  pages.push(rest.slice(0,end));rest=rest.slice(end);
 }if(rest)pages.push(rest);return pages;
}
export function pageChunks(nodes){
 const prose=nodes.flatMap(({model,node})=>model.type==='text'&&model.accessibility?.role!=='heading'?[node]
  :model.type==='interaction'&&(model.props.bodyBinding==='message'||model.props.appearance==='object-studio-v5')?[...node.querySelectorAll('.gift-drive-reveal-body')]:[]);
 const entries=prose.filter(node=>node.textContent.length>Number(node.dataset?.studioProse||620)).map(node=>({node,pages:prosePages(node.textContent,Number(node.dataset?.studioProse||320))}));
 return {entries,count:Math.max(1,...entries.map(e=>e.pages.length))};
}
