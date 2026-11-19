// Tín hiệu giữa các tab chỉ chứa phiên bản đã lưu; không phát tán nội dung thiệp.
// Server revision/CAS vẫn là nguồn sự thật duy nhất về quyền ghi.
const PREFIX = 'momevia:canvas:revision:v1:';

export function revisionNoticeKey(userId, designId) {
  if (typeof userId !== 'string' || !userId || typeof designId !== 'string' || !designId) {
    throw new TypeError('Thiếu danh tính chủ sở hữu hoặc mã thiết kế.');
  }
  return `${PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(designId)}`;
}

export function readRevisionNotice(raw) {
  try {
    const notice = JSON.parse(raw);
    if (!notice || typeof notice !== 'object' || Array.isArray(notice) ||
        notice.version !== 1 || typeof notice.actor !== 'string' ||
        notice.actor.length < 8 || notice.actor.length > 128 ||
        !Number.isSafeInteger(notice.revision) || notice.revision < 1) return null;
    return { actor: notice.actor, revision: notice.revision };
  } catch {
    return null;
  }
}

export function createTabRevisionSync({
  userId,
  designId,
  storage,
  eventTarget = globalThis.window,
  createId = () => globalThis.crypto.randomUUID(),
  onRevision = () => { },
}) {
  const key = revisionNoticeKey(userId, designId);
  const actor = createId();
  if (typeof actor !== 'string' || actor.length < 8 || actor.length > 128) {
    throw new TypeError('Mã định danh tab không hợp lệ.');
  }
  let disposed = false;
  const onStorage = event => {
    if (disposed || event.key !== key ||
        (event.storageArea && event.storageArea !== storage)) return;
    const notice = readRevisionNotice(event.newValue);
    if (!notice || notice.actor === actor) return;
    onRevision(notice.revision);
  };
  eventTarget?.addEventListener?.('storage', onStorage);
  return {
    key,
    announce(revision) {
      if (disposed || !Number.isSafeInteger(revision) || revision < 1) return false;
      try {
        storage?.setItem(key, JSON.stringify({ version: 1, actor, revision }));
        return Boolean(storage);
      } catch {
        // Bộ nhớ riêng tư bị chặn: autosave lên máy chủ vẫn hoạt động.
        return false;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      eventTarget?.removeEventListener?.('storage', onStorage);
    },
  };
}
