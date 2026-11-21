// Chỉ phản hồi của yêu cầu mới nhất được phép thay đổi giao diện.
// Không hủy thao tác phía máy chủ; dùng cho API đọc dữ liệu, không dùng cho mutation.
export function createLatestRequest() {
  let sequence = 0;
  return Object.freeze({
    async run(request, { onSuccess, onError, onFinally } = {}) {
      const current = ++sequence;
      try {
        const response = await request();
        if (current !== sequence) return false;
        await onSuccess?.(response);
        return true;
      } catch (error) {
        if (current !== sequence) return false;
        onError?.(error);
        return false;
      } finally {
        if (current === sequence) onFinally?.();
      }
    },
    invalidate() {
      sequence++;
    },
  });
}
