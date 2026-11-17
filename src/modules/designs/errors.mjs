import { HttpError } from '../../shared/http.mjs';

export function canvasError(status, code, message, details = []) {
  return Object.assign(new HttpError(status, message), { code, details });
}
export function fields(input, allowed) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw canvasError(400, 'INVALID_REQUEST', 'Yêu cầu không hợp lệ.');
  const unknown = Object.keys(input).filter(key => !allowed.includes(key));
  if (unknown.length) throw canvasError(422, 'UNKNOWN_FIELD', 'Trường không được phép.', unknown.map(path => ({ path, code: 'UNKNOWN_FIELD', message: 'Trường do server quản lý hoặc không được hỗ trợ.' })));
}
export function uuid(value, field = 'mutationId') {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw canvasError(422, 'INVALID_ID', `${field} không hợp lệ.`);
  return value;
}
export function revision(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 0xFFFFFFFF) throw canvasError(422, 'INVALID_REVISION', 'Revision không hợp lệ.');
  return value;
}
export function owned(record) {
  if (!record || record.archivedAt) throw canvasError(404, 'DESIGN_NOT_FOUND', 'Không tìm thấy thiết kế.');
  return record;
}
