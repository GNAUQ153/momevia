import { escapeHtml } from '../../core/api.js';
import { attr, message, setText, text } from '../../core/i18n.js';
import { isRsvpStatus } from '../../shared/rsvp.js';
import { gardenSprigPaths, gardenFlowerPaths } from '../../shared/canvas/garden-botanical.js';

const svgNS = 'http://www.w3.org/2000/svg';
let instanceSequence = 0;
function ornament(className, paths) {
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', className);
  for (const data of paths) {
    const path = document.createElementNS(svgNS, 'path');
    for (const [key, value] of Object.entries(data)) path.setAttribute(key === 'strokeWidth' ? 'stroke-width' : key, value);
    path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round'); svg.append(path);
  }
  return svg;
}
export function mountGardenRsvp(host, initial, { submit, signal, onClosed, recipientName, eventAt, timeZone, title, color, appearance='garden' }) {
  let state = initial, saving = false, timer;
  const instance = ++instanceSequence, headingId = `garden-rsvp-heading-${instance}`, partyId = `garden-party-size-${instance}`;
  host.innerHTML = `<section class="garden-rsvp-panel" aria-labelledby="${headingId}">
    <header class="garden-rsvp-header">
      <div class="garden-rsvp-art" aria-hidden="true"><span class="garden-rsvp-spark garden-rsvp-spark--one"></span><span class="garden-rsvp-spark garden-rsvp-spark--two"></span><span class="garden-rsvp-spark garden-rsvp-spark--three"></span></div>
      <h2 id="${headingId}">${title ? escapeHtml(title) : text('rsvp.title')}</h2>
      <p class="garden-rsvp-intro">${text('rsvp.garden.intro')}</p>
      <p class="garden-rsvp-date" data-rsvp-date hidden></p>
    </header>
    <div class="garden-rsvp-state"><span class="garden-rsvp-state-dot" aria-hidden="true"></span><p data-rsvp-current role="status"></p></div>
    <form class="garden-rsvp-form">
      <label class="field garden-rsvp-name"><span>${text('gift.reply.name')}</span><input readonly value="${escapeHtml(recipientName || '')}" autocomplete="name"></label>
      <div class="field garden-rsvp-party"><label for="${partyId}">${text('rsvp.garden.partyQuestion')}</label>
        <div class="garden-party-row"><div class="garden-party-stepper">
          <button type="button" data-party-step="-1" ${attr('aria-label', 'rsvp.garden.decrease')}>−</button>
          <input id="${partyId}" class="garden-party-size" name="partySize" type="number" min="1" max="5" step="1" value="1" required>
          <button type="button" data-party-step="1" ${attr('aria-label', 'rsvp.garden.increase')}>+</button>
        </div><span class="garden-party-copy" data-party-copy></span></div>
        <p class="garden-rsvp-help">${text('rsvp.garden.partyHint')}</p>
      </div>
      <label class="field garden-rsvp-note"><span>${text('rsvp.note')}</span><textarea name="note" rows="2" maxlength="140" ${attr('placeholder', 'rsvp.garden.notePlaceholder')}></textarea></label>
      <div class="garden-rsvp-actions">
        <button class="garden-rsvp-choice garden-rsvp-choice--yes" name="status" value="attending" type="submit"><span class="garden-choice-icon" aria-hidden="true">✿</span><span>${text('rsvp.garden.attending')}</span></button>
        <button class="garden-rsvp-choice garden-rsvp-choice--no" name="status" value="declined" type="submit">${text('rsvp.garden.declined')}</button>
        <button class="garden-rsvp-choice garden-rsvp-choice--maybe" name="status" value="tentative" type="submit">${text('rsvp.status.tentative')}</button>
      </div>
      <p class="garden-rsvp-feedback" data-rsvp-feedback role="status"></p>
    </form>
    <footer class="garden-rsvp-footer"><span aria-hidden="true">❧</span><p>${text('rsvp.garden.footer')}</p></footer>
  </section>`;
  if(['paper-soft-v2','garden-soft-v2'].includes(appearance))host.classList.add('gift-rsvp-soft-v2');
  if(['paper-v1','paper-soft-v2'].includes(appearance)){host.classList.add('gift-rsvp-paper');setText(host.querySelector('.garden-rsvp-intro'),message('drive.rsvpIntro'));setText(host.querySelector('.garden-rsvp-footer p'),message('drive.rsvpFooter'));host.querySelector('textarea').setAttribute('placeholder','');}
  const panel = host.querySelector('.garden-rsvp-panel'), art = host.querySelector('.garden-rsvp-art');
  panel.style.setProperty('--garden-rsvp-primary', color || '#3D6045');
  art.append(ornament('garden-rsvp-sprig garden-rsvp-sprig--left', gardenSprigPaths({ leaf: '#789267', shade: '#A0B38B', stem: '#536E46', vein: '#D6E1C6' })),
    ornament('garden-rsvp-sprig garden-rsvp-sprig--right', gardenSprigPaths({ leaf: '#A0B38B', shade: '#789267', stem: '#536E46', vein: '#D6E1C6' })),
    ornament('garden-rsvp-cup', [
      { d: 'M23 36H72V58C72 82 23 82 23 58Z', fill: '#F3D4CF', stroke: '#52714D', strokeWidth: 2 },
      { d: 'M73 42H80C98 42 93 66 72 64M17 83H84', fill: 'none', stroke: '#52714D', strokeWidth: 2 },
      { d: 'M38 27C51 18 33 15 43 6M55 27C67 18 50 15 59 6', fill: 'none', stroke: '#789267', strokeWidth: 1.5, class: 'garden-rsvp-steam' },
      { d: 'M27 40H68', fill: 'none', stroke: '#FFF8E9', strokeWidth: 3 },
    ]), ornament('garden-rsvp-blossom', gardenFlowerPaths()));
  const date = host.querySelector('[data-rsvp-date]');
  if (Number.isFinite(Date.parse(eventAt))) {
    date.hidden = false;
    setText(date, message('rsvp.garden.date', { date: { format: 'date', value: eventAt, options: { timeZone: timeZone || 'Asia/Ho_Chi_Minh', dateStyle: 'medium', timeStyle: 'short' } } }));
  }
  const form = host.querySelector('form'), controls = [...form.querySelectorAll('input:not([readonly]),textarea,button')];
  const feedback = host.querySelector('[data-rsvp-feedback]'), current = host.querySelector('[data-rsvp-current]');
  const expired = () => Number.isFinite(Date.parse(eventAt)) && Date.now() >= Date.parse(eventAt);
  const syncParty = () => {
    const count = Number(form.elements.partySize.value), disabled = saving || !state.canRespond || expired();
    form.querySelector('[data-party-step="-1"]').disabled = disabled || count <= 1;
    form.querySelector('[data-party-step="1"]').disabled = disabled || count >= 5;
    setText(host.querySelector('[data-party-copy]'), Number.isInteger(count) && count >= 1 && count <= 5 ? message('rsvp.garden.people', { count }) : '');
  };
  const refresh = () => {
    const closed = !state.canRespond || expired();
    controls.forEach(control => { control.disabled = saving || closed; });
    panel.dataset.rsvp = isRsvpStatus(state.status) ? state.status : 'unanswered';
    panel.classList.toggle('is-saving', saving); panel.classList.toggle('is-closed', closed);
    for (const button of form.querySelectorAll('button[name="status"]')) button.setAttribute('aria-pressed', String(button.value === state.status));
    setText(current, message(`rsvp.status.${isRsvpStatus(state.status) ? state.status : 'unanswered'}`));
    if (closed) setText(feedback, message('rsvp.closed'));
    syncParty();
  };
  form.elements.partySize.value = String(state.partySize || 1);
  form.elements.note.value = state.note || '';
  form.elements.partySize.addEventListener('input', syncParty, { signal });
  const clearSavedHint = () => { if (!saving && state.canRespond && !expired()) setText(feedback, ''); };
  form.addEventListener('input', clearSavedHint, { signal });
  for (const step of form.querySelectorAll('[data-party-step]')) step.addEventListener('click', () => {
    const next = Math.max(1, Math.min(5, (Number(form.elements.partySize.value) || 1) + Number(step.dataset.partyStep)));
    form.elements.partySize.value = String(next); syncParty(); clearSavedHint();
  }, { signal });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving || !state.canRespond || expired()) return refresh();
    const status = event.submitter?.value;
    if (!isRsvpStatus(status) || !form.reportValidity()) return;
    panel.classList.remove('is-confirmed');
    saving = true; refresh(); setText(feedback, message('rsvp.saving'));
    try {
      state = await submit({ status, partySize: Number(form.elements.partySize.value), note: form.elements.note.value.trim() });
      if (signal.aborted) return;
      setText(feedback, message('rsvp.saved')); panel.classList.add('is-confirmed');
    } catch (error) {
      if (signal.aborted) return;
      onClosed(error);
      if (error.status === 409) state = { ...state, canRespond: false };
      else setText(feedback, error.translation || message('rsvp.error.save'));
    } finally {
      saving = false;
      if (!signal.aborted) {
        refresh();
        if (event.submitter?.isConnected && !event.submitter.disabled && document.activeElement === document.body) event.submitter.focus({ preventScroll: true });
      }
    }
  }, { signal });
  const tick = () => {
    if (signal.aborted) return;
    refresh();
    const left = Date.parse(eventAt) - Date.now();
    if (Number.isFinite(left) && left > 0) timer = setTimeout(tick, Math.min(left, 60000));
  };
  signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  tick();
}
