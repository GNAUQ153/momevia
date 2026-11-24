import { message, setText, text } from '../../core/i18n.js';
import { RSVP_STATUSES, isRsvpStatus } from '../../shared/rsvp.js';

// Chỉ dùng mã nhận hiện có trong URL API; không lưu hoặc chia sẻ thông tin khách khác.
export function mountRsvp(host, initial, { submit, signal, onClosed }) {
  let state = initial;
  host.innerHTML = `<section class="rsvp-panel" aria-labelledby="rsvp-heading">
    <h2 id="rsvp-heading">${text('rsvp.title')}</h2>
    <p>${text('rsvp.hint')}</p>
    <p data-rsvp-current role="status"></p>
    <form data-rsvp-form>
      <label class="field"><span>${text('rsvp.choice')}</span><select name="status" required>
        <option value="">${text('rsvp.choose')}</option>
        ${RSVP_STATUSES.map(status => `<option value="${status}">${text(`rsvp.status.${status}`)}</option>`).join('')}
      </select></label>
      <button class="btn btn--outline" type="submit">${text('rsvp.save')}</button>
      <p data-rsvp-feedback role="status"></p>
    </form>
  </section>`;
  const form = host.querySelector('form');
  const select = form.elements.status;
  const button = form.querySelector('button');
  const current = host.querySelector('[data-rsvp-current]');
  const feedback = host.querySelector('[data-rsvp-feedback]');
  // Dùng key riêng để trạng thái luôn được dịch đúng khi đổi VI/EN.
  function messageStatus(status) { return isRsvpStatus(status) ? status : 'unanswered'; }
  function renderCurrent() {
    setText(current, message(`rsvp.status.${messageStatus(state.status)}`));
    if (!state.canRespond) {
      select.disabled = true;
      button.disabled = true;
      setText(feedback, message('rsvp.closed'));
    }
  }
  // Giữ form hiển thị khi đóng để người nhận biết vì sao không còn thao tác được.
  function refresh() {
    select.value = isRsvpStatus(state.status) ? state.status : '';
    renderCurrent();
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!state.canRespond || button.disabled || !isRsvpStatus(select.value)) return;
    button.disabled = select.disabled = true;
    setText(feedback, message('rsvp.saving'));
    try {
      state = await submit(select.value);
      if (signal.aborted || !host.isConnected) return;
      refresh();
      setText(feedback, message('rsvp.saved'));
    } catch (error) {
      if (signal.aborted || !host.isConnected) return;
      onClosed(error);
      if (error.status === 409 && !signal.aborted) {
        state = { ...state, canRespond: false };
        refresh();
      } else if (!signal.aborted) setText(feedback, error.translation || message('rsvp.error.save'));
    } finally {
      if (!signal.aborted && host.isConnected && state.canRespond) button.disabled = select.disabled = false;
    }
  }, { signal });
  refresh();
}
