import { isRecoveryEnvelope } from "./recovery-guards.js";
import { createTabRevisionSync } from "./tab-sync.js";

const messages = {
  clean: "Đã lưu",
  dirty: "Chưa lưu",
  saving: "Đang lưu…",
  offline: "Mất kết nối · Giữ bản cục bộ",
  conflict: "Xung đột · Bản cục bộ được giữ",
  "session-expired": "Phiên hết hạn · Đăng nhập lại để lưu",
  error: "Chưa lưu được · Thử lại",
  "asset-pending": "Ảnh đang xử lý…",
  publishing: "Đang xuất bản…",
};

// Every pending request is retained verbatim until acknowledged, including a lost ACK.
export function createSaveSession({
  design,
  store,
  request,
  userId,
  storage = globalThis.localStorage,
  recoveryStorage = globalThis.sessionStorage ?? (globalThis.window ? null : storage),
  onStatus = () => {},
  debounceMs = 900,
  makeId = () => globalThis.crypto.randomUUID(),
  makeTabId = () => globalThis.crypto.randomUUID(),
  tabEventTarget = globalThis.window,
  isOnline = () => globalThis.navigator?.onLine !== false,
}) {
  let revision = design.revision,
    documentHash = design.documentHash;
  let saved = JSON.stringify(store.get()),
    status = "clean",
    disposed = false,
    timer = null,
    pending = null,
    flight = null;
  let recoveryPersisted = false, lastSavedAt = null;
  // sessionStorage được cô lập theo tab; tránh tab B xóa nháp chưa lưu của tab A.
  const key = `momevia:canvas:recovery:v2:${userId}:${design.id}`;
  const legacyKey = `momevia:canvas:recovery:v1:${userId}:${design.id}`;
  let latestOtherRevision = revision;
  function otherTabConflict() {
    return Object.assign(new Error(
      'Thiết kế đã được lưu ở tab khác. Bản chỉnh sửa cục bộ được giữ; hãy xem bản máy chủ trước khi tải lại.',
    ), { status: 409 });
  }
  const tabSync = createTabRevisionSync({
    userId,
    designId: design.id,
    storage,
    eventTarget: tabEventTarget,
    createId: makeTabId,
    onRevision(nextRevision) {
      if (disposed || nextRevision <= revision) return;
      latestOtherRevision = Math.max(latestOtherRevision, nextRevision);
      // Không tạo recovery giả cho tab đang sạch.
      if (dirty() || pending || flight) recovery();
      setStatus('conflict', otherTabConflict());
    },
  });
  function recovery() {
    // Không tuyên bố "đã lưu bản cục bộ" khi trình duyệt từ chối sessionStorage.
    recoveryPersisted = false;
    try {
      if (typeof recoveryStorage?.setItem !== 'function') return;
      recoveryStorage.setItem(
        key,
        JSON.stringify({
          designId: design.id,
          ownerId: userId,
          revision,
          schemaVersion: 1,
          value: store.get(),
          pending,
          savedAt: Date.now(),
        }),
      );
      recoveryPersisted = true;
    } catch {
      /* Storage blocked/full: do not claim local backup is present. */
    }
  }
  function setStatus(next, error) {
    if (disposed) return;
    status = next;
    onStatus({
      status,
      message: messages[status],
      revision,
      documentHash,
      error,
      recoveryPersisted,
      lastSavedAt,
    });
  }
  function dirty() {
    return JSON.stringify(store.get()) !== saved;
  }
  function schedule() {
    clearTimeout(timer);
    /* phase62b: guarded autosave */
    if (disposed || ["conflict", "session-expired", "offline", "error"].includes(status) ||
        (!pending && !dirty())) return;
    if (!isOnline()) {
      setStatus("offline");
      return;
    }
    if (!disposed && !["conflict", "session-expired"].includes(status))
      timer = setTimeout(() => save().catch(() => {}), debounceMs);
  }
  const unsubscribe = store.subscribe(() => {
    recovery();
    /* phase62b: preserve offline/conflict state */
    if (["conflict", "session-expired", "offline", "error"].includes(status)) {
      setStatus(status);
      return;
    }
    if (!["conflict", "session-expired"].includes(status))
      setStatus(flight ? "saving" : dirty() ? "dirty" : "clean");
    schedule();
  });
  async function write(force) {
    if (disposed) throw new Error("Editor đã đóng.");
    if (["conflict", "session-expired"].includes(status))
      throw new Error(messages[status]);
    while (pending || dirty() || force) {
      force = false;
      if (!pending)
        pending = {
          expectedRevision: revision,
          mutationId: makeId(),
          ...structuredClone(store.get()),
        };
      const snapshot = JSON.stringify({
        title: pending.title,
        document: pending.document,
      });
      recovery();
      setStatus("saving");
      try {
        const ack = await request(
          `/designs/designs/${encodeURIComponent(design.id)}/save`,
          pending,
        );
        if (disposed) return;
        if (
          ack.mutationId !== pending.mutationId ||
          !Number.isSafeInteger(ack.savedRevision) ||
          ack.savedRevision < revision
        ) {
          throw new Error(
            "Phản hồi lưu không khớp yêu cầu. Giữ bản cục bộ để thử lại.",
          );
        }
        // ACK cũ không được xóa một xung đột vừa đến từ tab khác.
        if (latestOtherRevision > ack.savedRevision) throw otherTabConflict();
        revision = ack.savedRevision;
        documentHash = ack.documentHash;
        lastSavedAt = Date.now();
        saved = snapshot;
        pending = null;
        tabSync.announce(revision);
        if (dirty()) recovery();
        else {
          try {
            recoveryStorage?.removeItem(key);
            recoveryPersisted = false;
            // Chỉ dọn bản cache V1 cũ sau khi máy chủ đã ACK đầy đủ.
            storage?.removeItem(legacyKey);
          } catch {
            /* Optional cache. */
          }
        }
      } catch (error) {
        if (disposed) throw error;
        recovery();
        setStatus(
          error.status === 409
            ? "conflict"
            : error.status === 401
              ? "session-expired"
              : error.status === 0 || !isOnline()
                ? "offline"
                : "error",
          error,
        );
        throw error;
      }
    }
    setStatus("clean");
    return { revision, documentHash };
  }
  function save({ force = false } = {}) {
    clearTimeout(timer);
    if (flight) return flight;
    flight = write(force).finally(() => {
      flight = null;
    });
    return flight;
  }
  function readRecovery() {
    function read(cache, cacheKey) {
      try {
        const value = JSON.parse(cache?.getItem(cacheKey) || "null");
        return isRecoveryEnvelope(value, { userId, designId: design.id }) ? value : null;
      } catch {
        return null;
      }
    }
    // Cache V2 của tab hiện tại được ưu tiên; V1 chỉ dùng để phục hồi tương thích.
    return read(recoveryStorage, key) || read(storage, legacyKey);
  }
  return {
    save,
    get revision() {
      return revision;
    },
    get documentHash() {
      return documentHash;
    },
    get status() {
      return status;
    },
    get recoveryPersisted() {
      return recoveryPersisted;
    },
    get lastSavedAt() {
      return lastSavedAt;
    },
    get dirty() {
      return dirty() || Boolean(pending) || Boolean(flight);
    },
    readRecovery,
    restore(item) {
      if (!isRecoveryEnvelope(item, { userId, designId: design.id }))
        throw new Error("Dữ liệu phục hồi không hợp lệ hoặc không thuộc tài khoản này.");
      if (
        item.revision !== revision &&
        !(item.pending && item.pending.expectedRevision + 1 === revision)
      ) {
        store.replace(item.value);
        pending = null;
        setStatus("conflict");
        return;
      }
      store.replace(item.value);
      // Không giữ reference mutable từ localStorage hay caller trong phiên lưu.
      pending = item.pending ? structuredClone(item.pending) : null;
      recovery();
      if (latestOtherRevision > revision) {
        setStatus('conflict', otherTabConflict());
        return;
      }
      setStatus("dirty");
      schedule();
    },
    clearRecovery() {
      try { recoveryStorage?.removeItem(key); recoveryPersisted = false; } catch { /* Optional cache. */ }
      try { storage?.removeItem(legacyKey); } catch { /* Optional cache. */ }
    },
    dispose() {
      recoveryIfDirty();
      disposed = true;
      clearTimeout(timer);
      tabSync.dispose();
      unsubscribe();
    },
  };
  function recoveryIfDirty() {
    if (dirty() || pending) recovery();
  }
}
