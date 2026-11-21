import { attr, message, setText, text } from '../../core/i18n.js';
import { focusVisibleTarget } from '../../core/motion.js';

// Các bước chỉ mô tả giao diện: không đọc hoặc thay đổi nội dung thiệp.
export const RECIPIENT_STAGES = Object.freeze(['sealed', 'surprise', 'opened']);

export function recipientJourneyMarkup() {
  return `<div class="recipient-journey" role="group" ${attr('aria-label', 'gift.legacy.journey.label')}>
    <ol class="recipient-journey__steps">
      ${RECIPIENT_STAGES.map((stage, index) => `<li data-recipient-stage="${stage}"${index === 0 ? ' aria-current="step"' : ''}>
        <span class="recipient-journey__number" aria-hidden="true">${index + 1}</span>
        <span>${text(`gift.legacy.journey.${stage}`)}</span>
      </li>`).join('')}
    </ol>
    <p class="recipient-journey__status" data-recipient-status role="status" aria-live="polite" aria-atomic="true">${text('gift.legacy.journey.sealedStatus')}</p>
  </div>`;
}

// Chỉ tiến tới bước liền sau; ngăn click lặp làm thay đổi trạng thái đã mở.
export function advanceRecipientStage(card, next) {
  if (!card || !RECIPIENT_STAGES.includes(next)) return false;
  const current = card.classList.contains('is-open') ? 'opened'
    : card.classList.contains('is-surprise') ? 'surprise' : 'sealed';
  const currentIndex = RECIPIENT_STAGES.indexOf(current);
  if (RECIPIENT_STAGES[currentIndex + 1] !== next) return false;

  card.classList.toggle('is-surprise', next === 'surprise');
  card.classList.toggle('is-open', next === 'opened');
  const wrapper = card.closest('.recipient-wrapper');
  for (const item of wrapper?.querySelectorAll('[data-recipient-stage]') ?? []) {
    if (item.dataset.recipientStage === next) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  }
  const status = wrapper?.querySelector('[data-recipient-status]');
  if (status) setText(status, message(`gift.legacy.journey.${next}Status`));
  const target = card.querySelector(next === 'opened' ? '.recipient-opened h1' : '.recipient-surprise h2');
  focusVisibleTarget(target);
  return true;
}
