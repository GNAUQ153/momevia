import test from 'node:test';
import assert from 'node:assert/strict';
import { mountRuntimeImage } from '../../web/js/features/gift-runtime/image-state.js';

function fixture({ completed = false, naturalWidth = 0, onSource } = {}) {
  const frame = {
    dataset: {},
    children: [],
    ownerDocument: {
      createElement(tag) {
        return {
          tagName: tag.toUpperCase(),
          attributes: {},
          setAttribute(name, value) { this.attributes[name] = value; },
          textContent: '',
        };
      },
    },
    append(child) {
      child.parentNode = this;
      this.children.push(child);
    },
  };
  const listeners = new Map();
  const image = {
    loading: null,
    decoding: null,
    fetchPriority: undefined,
    complete: completed,
    naturalWidth,
    parentNode: null,
    addEventListener(name, fn) { listeners.set(name, fn); },
    remove() {
      const parent = this.parentNode;
      if (parent) parent.children = parent.children.filter(child => child !== this);
      this.parentNode = null;
    },
    set src(value) {
      this.url = value;
      if (onSource) onSource(value, listeners);
    },
  };
  return { frame, image, listeners };
}

test('Ảnh nội dung đầu tiên được ưu tiên; những ảnh khác tải lazy', () => {
  const first = fixture();
  const controller = new AbortController();
  const status = mountRuntimeImage(first.image, first.frame, {
    url: '/api/gifts/g-1/assets/a-1',
    priority: true,
    signal: controller.signal,
  });
  assert.equal(first.image.loading, 'eager');
  assert.equal(first.image.fetchPriority, 'high');
  assert.equal(first.image.decoding, 'async');
  assert.equal(first.frame.dataset.imageState, 'loading');
  first.listeners.get('load')();
  assert.equal(status.state, 'ready');
  assert.equal(first.frame.dataset.imageState, 'ready');
  assert.deepEqual(first.frame.children, [first.image]);

  const later = fixture();
  mountRuntimeImage(later.image, later.frame, { url: '/api/gifts/g-1/assets/a-2' });
  assert.equal(later.image.loading, 'lazy');
  assert.equal(later.image.fetchPriority, undefined);
});

test('Lỗi ảnh phản hồi ngay khi đặt src vẫn hiển thị fallback, không nhân đôi', () => {
  const f = fixture({ onSource(_url, listeners) { listeners.get('error')(); } });
  const status = mountRuntimeImage(f.image, f.frame, { url: '/api/gifts/g-2/assets/missing' });
  assert.equal(status.state, 'error');
  assert.equal(f.frame.dataset.imageState, 'error');
  assert.equal(f.frame.children.length, 1);
  assert.equal(f.frame.children[0].className, 'gift-runtime-placeholder');
  assert.equal(f.frame.children[0].attributes.role, 'status');
  assert.ok(f.frame.children[0].textContent);
  f.listeners.get('error')();
  assert.equal(f.frame.children.length, 1);
});

test('Ảnh đã tải hoặc lỗi từ cache được giải quyết không cần chờ event tiếp theo', () => {
  const ready = fixture({ completed: true, naturalWidth: 720 });
  mountRuntimeImage(ready.image, ready.frame, { url: '/api/gifts/g-3/assets/cached' });
  assert.equal(ready.frame.dataset.imageState, 'ready');
  const broken = fixture({ completed: true, naturalWidth: 0 });
  mountRuntimeImage(broken.image, broken.frame, { url: '/api/gifts/g-3/assets/broken' });
  assert.equal(broken.frame.dataset.imageState, 'error');
});

test('Ảnh thuộc cảnh đã bị hủy không được cập nhật hoặc chèn fallback cũ', () => {
  const f = fixture();
  const controller = new AbortController();
  mountRuntimeImage(f.image, f.frame, { url: '/api/gifts/g-4/assets/a', signal: controller.signal });
  controller.abort();
  f.listeners.get('error')();
  f.listeners.get('load')();
  assert.equal(f.frame.dataset.imageState, 'loading');
  assert.deepEqual(f.frame.children, [f.image]);
});

test('Không có thay đổi trạng thái sau khi ảnh bị tháo khỏi cây DOM', () => {
  const f = fixture();
  mountRuntimeImage(f.image, f.frame, { url: '/api/gifts/g-5/assets/a' });
  f.image.remove();
  f.listeners.get('error')();
  assert.equal(f.frame.dataset.imageState, 'loading');
  assert.deepEqual(f.frame.children, []);
});
