export function giftShareUrl(baseUrl, slug) {
  return new URL(`/g/${encodeURIComponent(slug)}`, baseUrl).href;
}

export function giftOwnerLinks(baseUrl, { slug, inviteToken }) {
  const url = giftShareUrl(baseUrl, slug);
  return inviteToken ? { url, inviteUrl: `${url}?invite=${encodeURIComponent(inviteToken)}` } : { url };
}
