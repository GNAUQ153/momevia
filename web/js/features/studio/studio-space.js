// Phase 5.6: cải thiện trang Không gian của tôi mà không thay đổi API hay nghiệp vụ.
import { icon } from '../../ui/icons.js';

const TYPES = Object.freeze([
  { id: 'all', label: 'Tất cả' },
  { id: 'drafts', label: 'Bản nháp' },
  { id: 'gifts', label: 'Quà đã gửi' },
  { id: 'orders', label: 'Biên nhận' },
]);

export function normalizeStudioSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi-VN')
    .trim();
}

export function matchStudioItem(text, search) {
  const words = normalizeStudioSearch(search).split(/\s+/).filter(Boolean);
  const haystack = normalizeStudioSearch(text);
  return words.every((word) => haystack.includes(word));
}

export function filterStudioEntries(entries, { type = 'all', query = '' } = {}) {
  return entries.filter((item) => (type === 'all' || item.type === type) && matchStudioItem(item.text, query));
}

function createSpaceVisual() {
  return `<div class="studio-space__visual" aria-hidden="true">
    <div class="studio-space__orbit studio-space__orbit--one"></div>
    <div class="studio-space__orbit studio-space__orbit--two"></div>
    <div class="studio-space__visual-card studio-space__visual-card--back">${icon('heart', 24)}<span>Mỗi lời chúc là một kỷ niệm.</span></div>
    <div class="studio-space__visual-card studio-space__visual-card--front">${icon('gift', 36)}<span>Made with Momevia</span></div>
    <div class="studio-space__visual-spark">${icon('sparkles', 27)}</div>
  </div>`;
}

function heroContent() {
  return `<div class="studio-space__hero-bottom">
    <p>Thiết kế một lời nhắn thật riêng, hoàn thiện bản nháp và quản lý những món quà bạn đã gửi — tất cả ở một nơi.</p>
    <div class="studio-space__hero-actions">
      <a class="btn btn--dark" href="/design/new" data-link>${icon('pencil', 18)} Tạo thiết kế mới</a>
      <a class="btn btn--outline" href="/explore" data-link>${icon('layers', 18)} Khám phá mẫu</a>
    </div>
  </div>`;
}

function toolbarContent() {
  return `<nav class="studio-space__jump" aria-label="Đi tới khu vực của bạn">
    <a href="#studio-space-drafts">${icon('pencil', 17)} Bản nháp</a>
    <a href="#studio-space-gifts">${icon('gift', 17)} Đã gửi</a>
    <a href="#studio-space-orders">${icon('credit-card', 17)} Biên nhận</a>
  </nav>
  <div class="studio-space__toolbar">
    <div class="studio-space__toolbar-copy">
      <span class="studio-space__eyebrow">BỘ SƯU TẬP CỦA BẠN</span>
      <h2>Quản lý kỷ niệm của bạn</h2>
      <p>Tiếp tục thiết kế, tìm lại món quà và theo dõi hồi đáp.</p>
    </div>
    <label class="studio-space__search">
      <span class="visually-hidden">Tìm trong các mục đã tải</span>
      ${icon('search', 19)}
      <input type="search" autocomplete="off" maxlength="100" placeholder="Tìm trong các mục đã tải..." data-studio-search />
    </label>
  </div>
  <div class="studio-space__filters" role="group" aria-label="Bộ lọc khu vực">
    ${TYPES.map((type) => `<button type="button" class="studio-space__filter" data-studio-filter="${type.id}" aria-pressed="${type.id === 'all'}">${type.label}</button>`).join('')}
  </div>
  <p class="studio-space__result" role="status" aria-live="polite" data-studio-results>Đang tải nội dung của bạn…</p>
  <div class="studio-space__no-results" data-studio-empty hidden>
    ${icon('search', 29)}
    <strong>Chưa có kết quả phù hợp</strong>
    <p>Thử từ khóa khác hoặc chọn lại Tất cả. Tìm kiếm chỉ áp dụng cho các mục đã tải.</p>
    <button type="button" class="btn btn--outline" data-studio-reset>Xóa bộ lọc</button>
  </div>`;
}

/**
 * Progressive enhancement: nội dung API và mọi nút nghiệp vụ gốc được giữ nguyên.
 * Trả hàm cleanup để trang SPA không để lại listener/observer sau điều hướng.
 */
export function mountStudioSpace(root) {
  const hero = root.querySelector('.page-banner--dashboard');
  const section = root.querySelector('.dashboard-section > .container');
  if (!hero || !section || hero.classList.contains('studio-space__hero')) return () => {};

  const heroInner = hero.querySelector('.container');
  if (!heroInner) return () => {};
  hero.classList.add('studio-space__hero');
  heroInner.classList.add('studio-space__hero-inner');
  heroInner.insertAdjacentHTML('afterbegin', `<span class="studio-space__eyebrow studio-space__eyebrow--light">${icon('sparkles', 16)} KHÔNG GIAN CỦA TÔI</span>`);
  heroInner.insertAdjacentHTML('beforeend', heroContent() + createSpaceVisual());

  root.querySelector('.dashboard-section')?.classList.add('studio-space__main');
  section.classList.add('studio-space__content');
  const toolbar = document.createElement('div');
  toolbar.className = 'studio-space__controls';
  toolbar.innerHTML = toolbarContent();
  section.prepend(toolbar);

  const search = toolbar.querySelector('[data-studio-search]');
  const buttons = [...toolbar.querySelectorAll('[data-studio-filter]')];
  const result = toolbar.querySelector('[data-studio-results]');
  const empty = toolbar.querySelector('[data-studio-empty]');
  const reset = toolbar.querySelector('[data-studio-reset]');
  const sections = TYPES.filter((type) => type.id !== 'all').map((type) => {
    const data = root.querySelector(`#studio-${type.id}-section`);
    const wrapper = data?.closest('section');
    if (wrapper) {
      wrapper.classList.add('studio-space__section');
      wrapper.id = `studio-space-${type.id}`;
    }
    return { ...type, data, wrapper };
  });
  let currentType = 'all';

  const apply = () => {
    let total = 0;
    let waiting = false;
    let loadFailed = false;
    for (const target of sections) {
      if (!target.data || !target.wrapper) continue;
      target.wrapper.hidden = currentType !== 'all' && currentType !== target.id;
      if (target.wrapper.hidden) continue;
      waiting ||= Boolean(target.data.querySelector('[role="status"]'));
      loadFailed ||= Boolean(target.data.querySelector('[role="alert"]'));
      for (const card of target.data.querySelectorAll('.my-gift')) {
        const visible = matchStudioItem(card.textContent, search.value);
        card.hidden = !visible;
        if (visible) total += 1;
      }
    }
    const term = search.value.trim();
    if (loadFailed) {
      result.textContent = 'Một khu vực chưa tải được. Bạn có thể thử lại ngay trong khu vực đó.';
    } else if (waiting) {
      result.textContent = 'Đang tải dữ liệu…';
    } else if (term) {
      result.textContent = `${total} mục đã tải phù hợp với “${term}”.`;
    } else if (currentType !== 'all') {
      result.textContent = `Đang xem ${TYPES.find((type) => type.id === currentType)?.label || 'nội dung'} · ${total} mục đã tải.`;
    } else {
      result.textContent = 'Lọc nhanh những mục đã tải. Các mục khác có thể nằm ở trang tiếp theo.';
    }
    empty.hidden = !((term || currentType !== 'all') && total === 0 && !waiting && !loadFailed);
  };

  const onInput = () => apply();
  const onFilter = (event) => {
    const button = event.target.closest('[data-studio-filter]');
    if (!button || !toolbar.contains(button)) return;
    currentType = button.dataset.studioFilter;
    for (const item of buttons) item.setAttribute('aria-pressed', String(item === button));
    apply();
  };
  const onReset = () => {
    search.value = '';
    currentType = 'all';
    for (const item of buttons) item.setAttribute('aria-pressed', String(item.dataset.studioFilter === 'all'));
    apply();
    search.focus();
  };

  search.addEventListener('input', onInput);
  toolbar.addEventListener('click', onFilter);
  reset.addEventListener('click', onReset);
  const observer = new MutationObserver(() => apply());
  for (const target of sections) {
    if (target.data) observer.observe(target.data, { childList: true, subtree: true });
  }
  apply();

  return () => {
    observer.disconnect();
    search.removeEventListener('input', onInput);
    toolbar.removeEventListener('click', onFilter);
    reset.removeEventListener('click', onReset);
  };
}
