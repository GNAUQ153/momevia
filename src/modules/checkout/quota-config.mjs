// Chỉ cho phép thử quota trên MySQL QA cô lập. Chưa hỗ trợ mua thêm lượt trên production.
export function quotaQaEnabled(env = process.env) {
  if (env.PUBLICATION_QUOTA_QA_ENABLED !== 'true') return false;
  const stores = ['IDENTITY_STORAGE', 'CATALOG_STORAGE', 'CHECKOUT_STORAGE', 'GIFTS_STORAGE', 'DESIGNS_STORAGE'];
  if (!['test', 'development'].includes(env.NODE_ENV)
    || Object.keys(env).some(key => key.startsWith('RAILWAY_'))
    || env.PAYMENT_ENV !== 'sandbox' || env.PAYMENT_LIVE_ENABLED === 'true'
    || env.MYSQL_HOST !== '127.0.0.1' || !/^momevia_canvas_qa_[a-z0-9_]+$/.test(env.MYSQL_DATABASE || '')
    || env.CANVAS_QA_MYSQL_ISOLATED !== 'true' || stores.some(key => env[key] !== 'mysql'))
    throw new Error('PUBLICATION_QUOTA_QA_ENABLED chỉ dành cho MySQL QA cô lập; không bật trên production.');
  return true;
}
