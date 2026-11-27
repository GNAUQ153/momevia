import { mysqlTimestampToIso } from '../../infrastructure/mysql/datetime.mjs';

// Chuyển dữ liệu SQL thành đối tượng nghiệp vụ; không truy vấn hoặc ghi dữ liệu.
export const jsonValue = (value) =>
  typeof value === "string" ? JSON.parse(value) : value;
export function iso(value) {
  if (value == null) return null;
  return mysqlTimestampToIso(value);
}
export function designFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    source:
      row.source_kind === "blank"
        ? { kind: "blank" }
        : {
            kind: "template",
            templateId: row.template_id,
            templateVersionId: row.template_version_id,
          },
    provenance: jsonValue(row.provenance),
    policy: jsonValue(row.policy),
    revision: Number(row.revision),
    schemaVersion: Number(row.schema_version),
    document: jsonValue(row.document),
    documentHash: row.document_hash,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    archivedAt: iso(row.archived_at),
  };
}
export function assetFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerId: row.owner_id,
    designId: row.design_id,
    status: row.status,
    mime: row.mime,
    bytes: Number(row.bytes),
    width: Number(row.width),
    height: Number(row.height),
    ...(row.media_kind === 'audio' ? {mediaKind:'audio',durationMs:Number(row.sample_count)/44.1,sampleCount:Number(row.sample_count),sampleRate:Number(row.sample_rate),channels:Number(row.channels)} : {}),
    contentHash: row.content_hash,
    storageKey: row.storage_key,
    createdAt: iso(row.created_at),
  };
}
export function contextFromRow(row) {
  if (!row) return null;
  return {
    contextId: row.context_id,
    ownerId: row.owner_id,
    orderId: row.order_id,
    mutationId: row.mutation_id,
    requestHash: row.request_hash,
    designId: row.design_id,
    designRevision: Number(row.design_revision),
    documentHash: row.document_hash,
    source: {
      kind: "template",
      templateId: row.template_id,
      templateVersionId: row.template_version_id,
    },
    resumePath: `/design/${row.design_id}`,
    createdAt: iso(row.created_at),
  };
}
