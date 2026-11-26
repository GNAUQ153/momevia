import { verifiedReceiptSql } from '../../src/modules/payments/receipt-policy.mjs';

// Các invariant liên bảng mà FK không bảo đảm; không suy diễn quyền lịch sử.
// Mỗi kiểm tra chỉ trả số lượng, không trả ID, email hoặc dữ liệu thiệp.
const checks = [
  ['entitlement_order', `FROM template_entitlements e LEFT JOIN orders o ON o.id=e.order_id
    WHERE o.id IS NULL OR e.user_id<>o.user_id OR e.template_id<>o.template_id`],
  ['design_asset_owner', `FROM design_asset_refs r LEFT JOIN designs d ON d.id=r.design_id
    LEFT JOIN design_assets a ON a.id=r.asset_id
    WHERE d.id IS NULL OR a.id IS NULL OR d.owner_id<>a.owner_id`],
  ['gift_asset_owner', `FROM gift_asset_refs r LEFT JOIN gifts g ON g.id=r.gift_id
    LEFT JOIN design_assets a ON a.id=r.asset_id
    WHERE g.id IS NULL OR a.id IS NULL OR g.user_id<>a.owner_id`],
  ['publication_owner', `FROM gift_publication_requests r LEFT JOIN gifts g ON g.id=r.gift_id
    LEFT JOIN designs d ON d.id=r.design_id LEFT JOIN design_versions v ON v.id=g.design_version_id
    WHERE g.id IS NULL OR d.id IS NULL OR v.id IS NULL OR r.owner_id<>g.user_id
    OR r.owner_id<>d.owner_id OR v.design_id<>d.id OR v.revision<>r.design_revision`],
  ['checkout_context_owner', `FROM checkout_design_contexts c LEFT JOIN orders o ON o.id=c.order_id
    LEFT JOIN designs d ON d.id=c.design_id
    WHERE o.id IS NULL OR d.id IS NULL OR c.owner_id<>o.user_id OR c.owner_id<>d.owner_id
    OR c.template_id<>o.template_id`],
  ['payment_scope_key', `FROM payment_checkout_scope_keys k LEFT JOIN payment_intents p ON p.id=k.intent_id
    LEFT JOIN orders o ON o.id=p.order_id WHERE o.id IS NULL OR k.user_id<>o.user_id
    OR k.template_id<>o.template_id OR k.is_test<>o.is_test OR k.is_test NOT IN (0,1)`],
  ['legacy_payment_key', `FROM payment_checkout_keys k LEFT JOIN payment_intents p ON p.id=k.intent_id
    LEFT JOIN orders o ON o.id=p.order_id WHERE o.id IS NULL OR k.user_id<>o.user_id OR k.template_id<>o.template_id`],
  ['publication_credit', `FROM publication_credits c LEFT JOIN template_entitlements e ON e.id=c.entitlement_id
    LEFT JOIN gifts g ON g.id=c.gift_id WHERE e.id IS NULL OR (c.gift_id IS NULL)<>(c.consumed_at IS NULL)
    OR (c.gift_id IS NOT NULL AND (g.id IS NULL OR g.user_id<>e.user_id OR NOT (g.template_id <=> e.template_id)))`],
  ['publication_repurchase', `FROM publication_repurchases r LEFT JOIN orders old_order ON old_order.id=r.previous_order_id
    LEFT JOIN payment_intents p ON p.id=r.intent_id LEFT JOIN orders new_order ON new_order.id=p.order_id
    WHERE old_order.id IS NULL OR new_order.id IS NULL OR old_order.id=new_order.id
    OR old_order.user_id<>new_order.user_id OR old_order.template_id<>new_order.template_id
    OR old_order.is_test<>1 OR new_order.is_test<>1 OR p.provider<>'momo'`],
  ['receipt_evidence', `FROM payment_receipts r LEFT JOIN orders o ON o.id=r.order_id
    LEFT JOIN payment_intents p ON p.order_id=r.order_id
    WHERE o.id IS NULL OR p.id IS NULL OR NOT COALESCE((${verifiedReceiptSql}), 0)`],
  ['refund_request_owner', `FROM refund_review_requests r LEFT JOIN orders o ON o.id=r.order_id
    WHERE o.id IS NULL OR r.requester_id<>o.user_id`],
];

export const integrityCheckIds = Object.freeze(checks.map(([id]) => id));

export async function readIntegrityCounts(client) {
  // Một SELECT trên InnoDB để các phép đếm dùng cùng snapshot đọc của statement.
  // CAST giữ chính xác COUNT BIGINT, kể cả khi vượt Number.MAX_SAFE_INTEGER.
  const sql = checks.map(([id, body]) => `SELECT '${id}' AS checkId, CAST(COUNT(*) AS CHAR) AS violations ${body}`).join('\nUNION ALL\n');
  const [rows] = await client.execute(sql);
  const byId = new Map();
  for (const row of rows) {
    if (!integrityCheckIds.includes(row.checkId) || byId.has(row.checkId) ||
        typeof row.violations !== 'string' || !/^(0|[1-9]\d*)$/.test(row.violations)) {
      throw new Error('Kết quả integrity audit không hợp lệ.');
    }
    byId.set(row.checkId, row.violations);
  }
  if (byId.size !== checks.length) throw new Error('Thiếu kết quả integrity audit.');
  const results = integrityCheckIds.map(id => ({ id, violations: byId.get(id) }));
  const failedChecks = results.filter(row => row.violations !== '0').map(row => row.id);
  return { status: failedChecks.length ? 'review_required' : 'ok', checks: results, failedChecks };
}

export async function auditIntegrity(client, schema) {
  // Không đọc bảng nghiệp vụ nếu schema chưa được xác minh ở phiên bản mới nhất.
  if (schema?.status !== 'latest' || schema.issues?.length || schema.remaining?.length) {
    return { status: 'skipped_schema', checks: [], failedChecks: [] };
  }
  return readIntegrityCounts(client);
}
