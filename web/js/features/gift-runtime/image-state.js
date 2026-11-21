import { message, setText } from '../../core/i18n.js';

/**
 * Gắn vòng đời tải ảnh vào đúng phần tử của một cảnh.
 * URL phải được kiểm tra bởi renderer trước khi gọi hàm này.
 * Đăng ký listeners trước khi đặt src để không bỏ lỡ lỗi từ ảnh trong cache.
 */
export function mountRuntimeImage(image, frame, { url, signal, priority = false } = {}) {
  let state = 'loading';
  frame.dataset.imageState = state;

  const active = () => !signal?.aborted && image.parentNode === frame;
  const loaded = () => {
    if (!active() || state !== 'loading') return;
    state = 'ready';
    frame.dataset.imageState = state;
  };
  const failed = () => {
    if (!active() || state !== 'loading') return;
    state = 'error';
    frame.dataset.imageState = state;
    image.remove();
    const fallback = frame.ownerDocument.createElement('span');
    fallback.className = 'gift-runtime-placeholder';
    fallback.setAttribute('role', 'status');
    setText(fallback, message('gift.runtime.imageError'));
    frame.append(fallback);
  };

  image.addEventListener('load', loaded, signal ? { signal } : undefined);
  image.addEventListener('error', failed, signal ? { signal } : undefined);
  image.loading = priority ? 'eager' : 'lazy';
  image.decoding = 'async';
  if (priority) image.fetchPriority = 'high';
  frame.append(image);
  image.src = url;

  // Một số trình duyệt báo ảnh cache đã hoàn thành trước lần render tiếp theo.
  if (image.complete) {
    if (image.naturalWidth > 0) loaded();
    else failed();
  }

  return { get state() { return state; } };
}
