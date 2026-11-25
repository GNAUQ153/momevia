import { contextFromRow } from "./mysql-row-mapping.mjs";
import { canvasTransaction, canvasError, lockOwner, lockedDesign, sameRequest, sameRevision } from "./mysql-transaction.mjs";

// Dùng client được truyền vào; không mở pool hoặc transaction lồng nhau.
export async function attachContext(client, ownerId, orderId, mutationId, requestHash, context) {
  return canvasTransaction(client, async (tx) => {
    await lockOwner(tx, ownerId);
    const design = await lockedDesign(tx, ownerId, context.designId);
    const [requests] = await tx.execute(
      "SELECT * FROM checkout_design_contexts WHERE owner_id=? AND order_id=? AND mutation_id=? FOR UPDATE",
      [ownerId, orderId, mutationId],
    );
    if (requests.length) {
      sameRequest(requests[0].request_hash, requestHash);
      return { ...contextFromRow(requests[0]), replayed: true };
    }
    const [orders] = await tx.execute(
      "SELECT id,user_id,template_id FROM orders WHERE id=? AND user_id=? FOR UPDATE",
      [orderId, ownerId],
    );
    if (!orders.length)
      throw canvasError(404, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng.");
    sameRevision(design, context.designRevision, context.documentHash);
    if (
      design.source.kind !== "template" ||
      orders[0].template_id !== design.source.templateId
    )
      throw canvasError(
        409,
        "CONTEXT_SOURCE_MISMATCH",
        "Đơn hàng không khớp nguồn thiết kế.",
      );
    await tx.execute(
      `INSERT INTO checkout_design_contexts
      (context_id,owner_id,order_id,design_id,design_revision,document_hash,template_id,template_version_id,mutation_id,request_hash)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        context.contextId,
        ownerId,
        orderId,
        design.id,
        design.revision,
        design.documentHash,
        design.source.templateId,
        design.source.templateVersionId,
        mutationId,
        requestHash,
      ],
    );
    return { ...context, replayed: false };
  });
}
export async function listContexts(client, ownerId, orderId) {
  const [rows] = await client.execute(
    `SELECT c.* FROM checkout_design_contexts c
    JOIN orders o ON o.id=c.order_id AND o.user_id=c.owner_id
    WHERE c.owner_id=? AND c.order_id=? ORDER BY c.created_at,c.context_id LIMIT 200`,
    [ownerId, orderId],
  );
  return rows.map(contextFromRow);
}
export async function getContext(client, ownerId, orderId, contextId) {
  const [rows] = await client.execute(
    `SELECT c.* FROM checkout_design_contexts c
    JOIN orders o ON o.id=c.order_id AND o.user_id=c.owner_id
    WHERE c.owner_id=? AND c.order_id=? AND c.context_id=? LIMIT 1`,
    [ownerId, orderId, contextId],
  );
  return contextFromRow(rows[0]);
}
