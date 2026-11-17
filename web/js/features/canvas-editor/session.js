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
  onStatus = () => {},
  debounceMs = 900,
  makeId = () => globalThis.crypto.randomUUID(),
}) {
  let revision = design.revision,
    documentHash = design.documentHash;
  let saved = JSON.stringify(store.get()),
    status = "clean",
    disposed = false,
    timer = null,
    pending = null,
    flight = null;
  const key = `momevia:canvas:recovery:v1:${userId}:${design.id}`;
  function recovery() {
    try {
      storage?.setItem(
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
    } catch {
      /* Storage blocked/full: server remains authoritative. */
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
    });
  }
  function dirty() {
    return JSON.stringify(store.get()) !== saved;
  }
  function schedule() {
    clearTimeout(timer);
    if (!disposed && !["conflict", "session-expired"].includes(status))
      timer = setTimeout(() => save().catch(() => {}), debounceMs);
  }
  const unsubscribe = store.subscribe(() => {
    recovery();
    if (!["conflict", "session-expired"].includes(status))
      setStatus(flight ? "saving" : dirty() ? "dirty" : "clean");
    schedule();
  });
  async function write() {
    if (disposed) throw new Error("Editor đã đóng.");
    if (["conflict", "session-expired"].includes(status))
      throw new Error(messages[status]);
    while (pending || dirty()) {
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
        revision = ack.savedRevision;
        documentHash = ack.documentHash;
        saved = snapshot;
        pending = null;
        if (dirty()) recovery();
        else {
          try {
            storage?.removeItem(key);
          } catch {
            /* Optional cache. */
          }
        }
      } catch (error) {
        if (disposed) throw error;
        setStatus(
          error.status === 409
            ? "conflict"
            : error.status === 401
              ? "session-expired"
              : error.status === 0 || globalThis.navigator?.onLine === false
                ? "offline"
                : "error",
          error,
        );
        recovery();
        throw error;
      }
    }
    setStatus("clean");
    return { revision, documentHash };
  }
  function save() {
    clearTimeout(timer);
    if (flight) return flight;
    flight = write().finally(() => {
      flight = null;
    });
    return flight;
  }
  function readRecovery() {
    try {
      const item = JSON.parse(storage?.getItem(key) || "null");
      return item?.ownerId === userId &&
        item?.designId === design.id &&
        item?.schemaVersion === 1
        ? item
        : null;
    } catch {
      return null;
    }
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
    get dirty() {
      return dirty() || Boolean(pending) || Boolean(flight);
    },
    readRecovery,
    restore(item) {
      if (item.ownerId !== userId || item.designId !== design.id)
        throw new Error("Bản phục hồi không thuộc tài khoản này.");
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
      pending = item.pending || null;
      recovery();
      setStatus("dirty");
      schedule();
    },
    clearRecovery() {
      try {
        storage?.removeItem(key);
      } catch {
        /* Optional cache. */
      }
    },
    dispose() {
      recoveryIfDirty();
      disposed = true;
      clearTimeout(timer);
      unsubscribe();
    },
  };
  function recoveryIfDirty() {
    if (dirty() || pending) recovery();
  }
}
