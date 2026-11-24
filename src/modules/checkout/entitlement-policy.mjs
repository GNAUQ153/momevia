// Điều kiện quyền hiện hành dùng chung cho kiểm tra trước khi mua và transaction xuất bản.
// Chưa đổi quyền lịch sử: nguồn demo/sandbox chỉ được phân loại để đối soát.
export const activeEntitlementSql = `e.revoked_at IS NULL
  AND (o.status='paid' OR (o.status='demo_paid' AND o.is_test=1))
  AND o.user_id=e.user_id AND o.template_id=e.template_id`;

// Chỉ lấy nguồn từ cột chuẩn của đơn hàng, không tin payload JSON hoặc trạng thái do client gửi.
export const entitlementSourceSql = `CASE
  WHEN o.payment_provider='local_demo_only' AND o.is_test=1 THEN 'demo'
  WHEN o.status<>'demo_paid' AND o.payment_provider IN ('payos','momo') AND o.is_test=0 THEN 'live'
  WHEN o.status<>'demo_paid' AND o.payment_provider IN ('payos','momo') AND o.is_test=1 THEN 'sandbox'
  ELSE 'unknown' END`;

export const entitlementStateSql = `CASE
  WHEN e.revoked_at IS NOT NULL THEN 'revoked'
  WHEN ${activeEntitlementSql} THEN 'active'
  ELSE 'inactive' END`;

export function legacyOrderActive(order) {
  return ['demo_paid', 'paid'].includes(order.status);
}

export function legacyOrderGroup(order) {
  return {
    // JSON chỉ có lịch sử đơn, không chứng minh được thanh toán qua provider thật.
    source: order.status === 'demo_paid' && order.paymentProvider === 'local_demo_only' ? 'demo' : 'unknown',
    state: legacyOrderActive(order) ? 'active' : 'inactive',
    total: 1,
  };
}

export function summarizeEntitlements(groups, basis) {
  const sources = Object.fromEntries(['live', 'sandbox', 'demo', 'unknown'].map(source =>
    [source, { active: 0, revoked: 0, inactive: 0 }]));
  for (const row of groups) {
    if (!Object.hasOwn(sources, row.source) || !Object.hasOwn(sources[row.source], row.state))
      throw new Error('Invalid entitlement summary group');
    const total = Number(row.total);
    const sum = sources[row.source][row.state] + total;
    if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(sum))
      throw new Error('Invalid entitlement summary count');
    sources[row.source][row.state] = sum;
  }
  const totals = Object.fromEntries(['active', 'revoked', 'inactive'].map(state => {
    const total = Object.values(sources).reduce((sum, source) => sum + source[state], 0);
    if (!Number.isSafeInteger(total)) throw new Error('Invalid entitlement summary total');
    return [state, total];
  }));
  return { basis, sources, totals };
}
