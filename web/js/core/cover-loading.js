// Native loading=lazy may fetch several screens ahead. Keep offscreen card
// artwork out of the network until it is within 100px, with real text intact.
export function preserveLoadedCovers(current, candidate) {
 const previous=[...current.querySelectorAll('img')],next=[...candidate.querySelectorAll('img')];
 for(const [index,img]of next.entries()){
  const loaded=previous[index];
  if(!img.hasAttribute('data-cover-lazy')||!loaded||loaded.hasAttribute('data-cover-lazy')
   ||loaded.getAttribute('src')!==img.getAttribute('data-src')
   ||loaded.getAttribute('data-i18n-src')!==img.getAttribute('data-i18n-data-src')
   ||loaded.getAttribute('srcset')!==img.getAttribute('data-srcset')
   ||loaded.getAttribute('data-i18n-srcset')!==img.getAttribute('data-i18n-data-srcset')
   ||loaded.getAttribute('sizes')!==img.getAttribute('sizes'))continue;
  // Match only the loader's presentation state. New cover URLs, translations
  // and every other card attribute still participate in isEqualNode below.
  for(const name of ['src','srcset','sizes','loading','fetchpriority','data-i18n-src','data-i18n-srcset']){
   const value=loaded.getAttribute(name);if(value===null)img.removeAttribute(name);else img.setAttribute(name,value);
  }
  for(const name of ['data-src','data-srcset','data-cover-lazy','data-i18n-data-src','data-i18n-data-srcset'])img.removeAttribute(name);
 }
}

export function loadCoverImage(img){
  const initialFold=img.getBoundingClientRect().top+scrollY<innerHeight;
  img.loading=initialFold?'eager':'lazy';img.fetchPriority=initialFold?'high':'auto';
  for(const name of ['srcset','src']){
   const binding=img.getAttribute('data-i18n-data-'+name);if(binding)img.setAttribute('data-i18n-'+name,binding);
   img.removeAttribute('data-i18n-data-'+name);
   const value=img.getAttribute('data-'+name);if(value!==null)img.setAttribute(name,value);
   img.removeAttribute('data-'+name);
  }
  img.removeAttribute('data-cover-lazy');
}

export function mountCoverLoading(root){
 const selector='img[data-cover-lazy]',observed=new Set();
 const promote=img=>{
  loadCoverImage(img);
  observed.delete(img);intersection?.unobserve(img);
 };
 const intersection=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)promote(entry.target);},{rootMargin:'100px 0px'}):null;
 const scan=node=>{const imgs=node.matches?.(selector)?[node]:[...(node.querySelectorAll?.(selector)||[])];for(const img of imgs)if(!observed.has(img)){observed.add(img);if(intersection)intersection.observe(img);else promote(img);}};
 const mutation=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)scan(node);for(const img of observed)if(!img.isConnected){intersection?.unobserve(img);observed.delete(img);}});
 mutation.observe(root,{childList:true,subtree:true});scan(root);
 return ()=>{mutation.disconnect();intersection?.disconnect();observed.clear();};
}
