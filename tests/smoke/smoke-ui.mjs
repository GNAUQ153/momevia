import assert from 'node:assert/strict';

const base = process.env.PUBLIC_BASE_URL || 'http://localhost:4100';
const paths = [
  '/login',
  '/register',
  '/explore',
  '/policies/general',
  '/policies/payment',
  '/policies/privacy',
  '/policies/content',
  '/js/catalog-filter.js',
  '/js/legal.js',
  '/css/auth-pages.css',
  '/css/catalog-filters.css',
  '/css/pagination.css',
  '/css/legal.css',
];

for (const path of paths) {
  const response = await fetch(`${base}${path}`);
  assert.equal(response.status, 200, `Không tải được ${path}`);
  const content = await response.text();
  assert(content.length > 50, `Tài nguyên rỗng: ${path}`);
  console.log(`PASS  ${path}`);
}
console.log(`\n${paths.length}/${paths.length} route và tài nguyên truy cập được.`);
