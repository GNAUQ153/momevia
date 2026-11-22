// Native loading=lazy may fetch several screens ahead. Keep offscreen card
// artwork out of the network until it is within 100px, with real text intact.
export function mountCoverLoading(root){
 const selector='img[data-cover-lazy]',observed=new Set();
 const promote=img=>{
  img.loading='eager';if(img.getBoundingClientRect().top<innerHeight)img.fetchPriority='high';
  const binding=img.getAttribute('data-i18n-data-src');if(binding)img.setAttribute('data-i18n-src',binding);
  img.removeAttribute('data-i18n-data-src');img.src=img.getAttribute('data-src');img.removeAttribute('data-src');img.removeAttribute('data-cover-lazy');
  observed.delete(img);intersection?.unobserve(img);
 };
 const intersection=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)promote(entry.target);},{rootMargin:'100px 0px'}):null;
 const scan=node=>{const imgs=node.matches?.(selector)?[node]:[...(node.querySelectorAll?.(selector)||[])];for(const img of imgs)if(!observed.has(img)){observed.add(img);if(intersection)intersection.observe(img);else promote(img);}};
 const mutation=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)scan(node);for(const img of observed)if(!img.isConnected){intersection?.unobserve(img);observed.delete(img);}});
 mutation.observe(root,{childList:true,subtree:true});scan(root);
 return ()=>{mutation.disconnect();intersection?.disconnect();observed.clear();};
}
