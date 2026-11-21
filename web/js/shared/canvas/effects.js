const group = (label, prefix, names) => Object.freeze({
  label,
  presets: Object.freeze(Object.fromEntries(names.map((name,i) => [prefix + '0' + (i+1), name]))),
});

export const effectFamilies = Object.freeze({
  surface: group('Kiểu bề mặt', 'S', ['Bóng đổ giấy','Viền kép','Vân giấy mịn','Viền sáng dịu']),
  entrance: group('Khi xuất hiện', 'E', ['Hiện dần','Nổi nhẹ từ dưới','Đánh máy từng cụm chữ','Vẽ dần đường nét','Ảnh ghép từ các mảnh','Ảnh hiện từ hạt tan']),
  emphasis: group('Nhấn mạnh', 'A', ['Tim đập hai nhịp','Nghiêng ảnh rồi trả về','Vệt sáng lướt','Gạch chân lan','Ảnh xoay một vòng']),
  transition: group('Khi vào cảnh', 'T', ['Hòa mờ giữa hai cảnh','Đẩy trang ngang','Lật trang giấy','Mở rèm đôi','Tan biến nhẹ','Nở rộ mở trang']),
  ambience: group('Không khí', 'B', ['Pháo giấy một lượt','Cánh hoa rơi','Sao trôi','Đom đóm','Bong bóng bay','Bướm bay','Pháo hoa rực rỡ','Hoa nở rộ']),
  reaction: group('Khi kích hoạt', 'R', ['Mở nắp phong bì','Bật nắp hộp quà','Bung tia sao khi chạm','Ngọn nến bừng sáng']),
});
const movingControls = ['button','envelope','gift-box','interaction'];
export const elementEffectFamilies = Object.freeze(['surface','entrance','emphasis','reaction']);
export const sceneEffectFamilies = Object.freeze(['surface','transition','ambience']);

export function effectsFor(family, element) {
  const options = Object.entries(effectFamilies[family].presets);
  if (!element) return family === 'surface' ? options.filter(([id]) => id === 'S03') : options;
  const {type,props} = element;
  const allowed = {
    S01: ['image','shape','interaction','envelope','gift-box'].includes(type),
    S02: ['image','shape','interaction'].includes(type),
    S03: ['shape','interaction','envelope','reply'].includes(type),
    S04: ['image','shape','sticker','line'].includes(type),
    E03: type === 'text', E04: type === 'line', E05: type === 'image', E06: type === 'image',
    A02: ['image','shape','interaction'].includes(type), A04: type === 'text', A05: type === 'image',
    R01: type === 'envelope', R02: type === 'gift-box',
    R03: movingControls.includes(type) && !['event-countdown','photo-comparison'].includes(props.kind),
    R04: type === 'interaction' && props.kind === 'light-a-candle',
  };
  return options.filter(([id]) => allowed[id] ?? true);
}
export const effectSpeed = Object.freeze({slow:450, normal:320, fast:180});
export const CELEBRATION_IDS = Object.freeze(['B05','B06','B07','B08']);
export const defaultCelebrations = () => Object.fromEntries(CELEBRATION_IDS.map(id => [id,
  { enabled: false, speed: 'normal', density: 'sparse', loop: true }]));
// Reading older one-shot settings never changes their saved document or behavior.
export function celebrationSettings(effects = {}) {
  const settings = defaultCelebrations();
  for (const id of CELEBRATION_IDS) if (effects.celebrations?.[id]) settings[id] = { ...settings[id], ...effects.celebrations[id] };
  const old = effects.ambience;
  if (old && CELEBRATION_IDS.includes(old.id) && !effects.celebrations?.[old.id])
    settings[old.id] = { ...settings[old.id], enabled: true, loop: false, speed: old.speed || 'normal', density: old.density || 'normal' };
  return settings;
}
