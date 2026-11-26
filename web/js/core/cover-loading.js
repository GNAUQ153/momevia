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

export function loadCoverImage(img) {
  // Carousel có thể đã chủ động tải ảnh trước callback của observer.
  if (!img.hasAttribute('data-cover-lazy')) return;
  const initialFold = img.getBoundingClientRect().top + scrollY < innerHeight;
  img.loading = initialFold ? 'eager' : 'lazy';
  img.fetchPriority = initialFold ? 'high' : 'auto';
  for (const name of ['srcset', 'src']) {
    const binding = img.getAttribute('data-i18n-data-' + name);
    if (binding) img.setAttribute('data-i18n-' + name, binding);
    img.removeAttribute('data-i18n-data-' + name);
    const value = img.getAttribute('data-' + name);
    if (value !== null) img.setAttribute(name, value);
    img.removeAttribute('data-' + name);
  }
  img.removeAttribute('data-cover-lazy');
}

export function mountCoverLoading(root) {
  const selector = 'img[data-cover-lazy]';
  const observed = new Set();
  let disposed = false;
  const belongs = img => img.isConnected && root.contains(img);
  const forget = img => {
    if (observed.delete(img)) intersection?.unobserve(img);
  };
  const promote = img => {
    if (disposed || !observed.has(img)) return;
    forget(img);
    // Không tải ảnh từ route cũ hoặc ghi đè ưu tiên của Carousel.
    if (belongs(img)) loadCoverImage(img);
  };
  const intersection = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(entries => {
        if (disposed) return;
        for (const entry of entries) {
          if (entry.isIntersecting) promote(entry.target);
        }
      }, { rootMargin: '100px 0px' })
    : null;
  const scan = node => {
    if (disposed) return;
    const imgs = node.matches?.(selector)
      ? [node]
      : [...(node.querySelectorAll?.(selector) || [])];
    for (const img of imgs) {
      if (!belongs(img) || observed.has(img) || !img.hasAttribute('data-cover-lazy')) continue;
      observed.add(img);
      if (intersection) intersection.observe(img);
      else promote(img);
    }
  };
  const mutation = new MutationObserver(records => {
    if (disposed) return;
    for (const img of observed) {
      if (!belongs(img) || !img.hasAttribute('data-cover-lazy')) forget(img);
    }
    for (const record of records) {
      for (const node of record.addedNodes) scan(node);
    }
  });
  mutation.observe(root, { childList: true, subtree: true });
  scan(root);
  return () => {
    if (disposed) return;
    disposed = true;
    mutation.disconnect();
    intersection?.disconnect();
    observed.clear();
  };
}
