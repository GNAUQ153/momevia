import { message } from '../../core/i18n.js';
import { CELEBRATION_IDS, celebrationSettings } from '../../shared/canvas/effects.js';
import { node, field, select, button } from './dom.js';

export function celebrationFields(scene) {
  const settings = celebrationSettings(scene.effects);
  return node('fieldset', { class: 'editor-celebration-settings' },
    node('legend', {}, message('editor.celebrations.title')),
    ...CELEBRATION_IDS.map(id => {
      const config = settings[id], prefix = `celebration.${id}.`;
      return node('fieldset', { class: 'editor-celebration-row', 'data-celebration-row': id },
        node('legend', {}, message(`editor.celebrations.${id}`)),
        field(message('editor.celebrations.enabled'), node('input', { type: 'checkbox', checked: config.enabled, 'data-editor-field': prefix+'enabled' })),
        select(message('editor.celebrations.speed'), prefix+'speed', config.speed,
          ['slow','normal','fast'].map(speed => [speed,message(`editor.celebrations.speed.${speed}`)])),
        select(message('editor.celebrations.density'), prefix+'density', config.density,
          ['sparse','normal','dense'].map(density => [density,message(`editor.celebrations.density.${density}`)])),
        field(message('editor.celebrations.loop'), node('input', { type: 'checkbox', checked: config.loop, 'data-editor-field': prefix+'loop' })),
        button(message('editor.celebrations.preview'), 'celebration-preview', { 'data-celebration': id, disabled: !config.enabled }),
      );
    }),
  );
}
