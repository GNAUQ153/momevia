// Artwork Signature: lớp vector riêng, không tham chiếu artwork Classic.
// Các đường dẫn dùng hệ tọa độ 100 × 100, tương thích với Canvas/Fabric hiện tại.
import { createElement } from '../registry.js';

const paint = (d, fill, stroke, strokeWidth) => ({ d, fill, ...(stroke ? { stroke, strokeWidth } : {}) });
const rect = 'M0 0H100V100H0Z';
const circle = 'M50 1A49 49 0 1 1 50 99A49 49 0 1 1 50 1Z';
const round = 'M8 0H92Q100 0 100 8V92Q100 100 92 100H8Q0 100 0 92V8Q0 0 8 0Z';
const layer = (key, name, x, y, width, height, color, paths, rotation = 0) => ({
  key, name, layout: { x, y, width, height, rotation }, color, paths,
});
const photo = (key, x, y, width, height, radius = 0, rotation = 0) => ({
  key, name: 'Ảnh cá nhân', layout: { x, y, width, height, rotation }, photo: true, radius,
});
// Nơ Secret Santa: đường cong lấy từ SVG gốc, chuẩn hóa tỷ lệ viewBox 100 × 62.
const bow = [
  paint('M50 64.52C20 -12.9 -4 29.03 12 74.19C26 93.55 42 80.65 50 64.52Z M50 64.52C80 -12.9 104 29.03 88 74.19C74 93.55 58 80.65 50 64.52Z', 'color', '#8A4A12', 2),
  paint('M50 64.52L38 96.77M50 64.52L62 96.77', 'none', '#8A4A12', 5),
  paint('M50 51.61A8 12.9 0 1 1 50 77.42A8 12.9 0 1 1 50 51.61Z', '#B5651D', '#8A4A12', 2),
];
// Nhánh lá lấy từ hình botanical Garden Tea; giữ dáng, đơn giản hóa ellipse thành path.
const leaf = (x, y, rx, ry, angle) => {
  const a = angle * Math.PI / 180;
  const pt = (u, v) => `${((x + u * Math.cos(a) - v * Math.sin(a)) / 60 * 100).toFixed(3)} ${((y + u * Math.sin(a) + v * Math.cos(a)) / 120 * 100).toFixed(3)}`;
  const k = 0.5522847498;
  return `M${pt(rx,0)}C${pt(rx,k*ry)} ${pt(k*rx,ry)} ${pt(0,ry)}C${pt(-k*rx,ry)} ${pt(-rx,k*ry)} ${pt(-rx,0)}C${pt(-rx,-k*ry)} ${pt(-k*rx,-ry)} ${pt(0,-ry)}C${pt(k*rx,-ry)} ${pt(rx,-k*ry)} ${pt(rx,0)}Z`;
};
const botanical = [
  paint('M50 98.333C46.667 66.667 56.667 33.333 50 5', 'none', 'color', 1.6),
  paint([[19,92,11,4.5,-38],[42,76,11,4.5,38],[18,58,10,4,-38],[42,42,10,4,38],[21,26,8,3.5,-40],[30,8,5,5,0],[36,14,3,3,0]].map(v => leaf(...v)).join(' '), 'color'),
];
const recipes = [
  {
    id: 'secret-santa', title: 'Secret Santa', background: '#08251F',
    opening: 'ribbon-pull',
    layers: [
      layer('letter', 'Giấy thiệp viền vàng', 97, 300, 196, 204, '#F4ECDC', [paint(rect, 'color', '#B5651D', 1), paint('M5 5H95V95H5Z', 'none', '#B5651D', 1)]),
      layer('body', 'Thân hộp quà', 74, 390, 242, 179, '#1F7A66', [paint(rect, 'color'), paint('M0 0H16V100H0Z M84 0H100V100H84Z', '#14574A')]),
      layer('body-ribbon', 'Ruy băng thân hộp', 177, 390, 36, 179, '#C97A2B', [paint(rect, 'color'), paint('M0 0H13V100H0Z M87 0H100V100H87Z', '#9A5416')]),
      layer('lid', 'Nắp hộp quà', 62, 334, 266, 58, '#279076', [paint(rect, 'color'), paint('M0 0H13V100H0Z M87 0H100V100H87Z', '#1A6655')]),
      layer('lid-ribbon', 'Ruy băng nắp hộp', 177, 334, 36, 58, '#C97A2B', [paint(rect, 'color')]),
      layer('bow', 'Nơ vàng', 137, 280, 116, 72, '#C97A2B', bow),
    ],
  },
  {
    id: 'midnight-soiree', title: 'Midnight Soirée', background: '#0F1A2E', opening: 'wax-envelope',
    layers: [
      layer('back', 'Lưng phong thư', 47, 345, 296, 203, '#5A1D2B', [paint(round, 'color')]),
      layer('letter', 'Giấy thư viền champagne', 66, 356, 258, 180, '#F1E8D4', [paint(rect, 'color', '#C9A45C', 1), paint('M4 5H96V95H4Z', 'none', '#C9A45C', 1)]),
      layer('pocket', 'Túi phong thư', 47, 345, 296, 203, '#8A3044', [paint('M0 0L50 56L100 0V100H0Z', 'color'), paint('M0 100L50 56L100 100Z', '#5A1D2B')]),
      layer('flap', 'Nắp phong thư', 47, 345, 296, 114, '#A03A52', [paint('M0 0H100L50 100Z', 'color'), paint('M0 0L50 88L100 0L50 100Z', '#7B2A3A')]),
      layer('seal', 'Con dấu vàng', 166, 430, 58, 58, '#C9A45C', [paint(circle, 'color', '#9C7A35', 3), paint('M50 9A41 41 0 1 1 50 91A41 41 0 1 1 50 9Z', 'none', '#E3C27A', 2)]),
    ],
  },
  {
    id: 'garden-tea', title: 'Garden Tea', background: '#8A9B7D', opening: 'gatefold',
    layers: [
      layer('door-left', 'Cửa trái', 20, 265, 175, 340, '#8A9B7D', [paint(rect, 'color'), paint('M3 4H97V96H3Z', 'none', '#F8EBE6', 1)]),
      layer('door-right', 'Cửa phải', 195, 265, 175, 340, '#6C7F61', [paint(rect, 'color'), paint('M3 4H97V96H3Z', 'none', '#F8EBE6', 1)]),
      layer('sprig-left', 'Nhánh lá trái', 31, 282, 79, 158, '#F8EBE6', botanical),
      layer('sprig-right', 'Nhánh lá phải', 280, 430, 79, 158, '#F8EBE6', botanical, 180),
      layer('seal', 'Dấu hoa', 153, 400, 84, 84, '#F8EBE6', [paint(circle, 'color', '#A9575F', 2), paint('M50 8A42 42 0 1 1 50 92A42 42 0 1 1 50 8Z', 'none', '#A9575F', 1)]),
    ],
  },
  {
    id: 'last-chapter', title: 'The Last Chapter V2', background: '#FFF9E9', opening: 'camera-focus',
    layers: [
      layer('camera', 'Thân máy ảnh', 35, 250, 320, 365, '#222222', [paint(round, 'color'), paint('M4 88H96V94H4Z', '#777777')]),
      layer('lens', 'Vòng ống kính', 77, 296, 236, 236, '#555555', [paint(circle, 'color'), paint('M50 6A44 44 0 1 1 50 94A44 44 0 1 1 50 6Z', 'none', '#999999', 3), paint('M50 15A35 35 0 1 1 50 85A35 35 0 1 1 50 15Z', '#111111')]),
      photo('portrait', 112, 331, 166, 166, 83),
      layer('crosshair', 'Dấu lấy nét', 181, 400, 28, 28, '#FFFFFF', [paint('M50 10V90M10 50H90', 'none', 'color', 5)]),
      layer('dial', 'Thanh lấy nét', 71, 562, 248, 9, '#B91F32', [paint(round, 'color')]),
      layer('dial-knob', 'Núm lấy nét', 71, 552, 29, 29, '#B91F32', [paint(circle, 'color', '#FFFFFF', 2)]),
    ],
  },
  {
    // Máy ảnh trong HTML chứa sẵn ảnh cá nhân. Vẽ lại khung riêng, không nhúng ảnh đó.
    id: 'graduation-mixtape', title: 'Graduation Mixtape', background: '#F0DDC9', opening: 'polaroid-print',
    layers: [
      layer('camera-shell', 'Thân máy ảnh retro', 35, 290, 320, 210, '#B9A99B', [paint(round, 'color', '#65412C', 1), paint('M4 8H96V92H4Z', 'none', '#F0DDC9', 2), paint('M62 12H94V88H62Z', '#A89687')]),
      layer('screen', 'Khung màn hình', 52, 319, 190, 151, '#322C2B', [paint(round, 'color'), paint('M3 4H97V96H3Z', '#FFFDF5')]),
      photo('portrait', 60, 327, 174, 135, 5),
      layer('lens', 'Cụm nút tròn', 259, 350, 77, 77, '#D6C7B9', [paint(circle, 'color', '#65412C', 2), paint('M50 10A40 40 0 1 1 50 90A40 40 0 1 1 50 10Z', 'none', '#65412C', 2), paint('M50 32A18 18 0 1 1 50 68A18 18 0 1 1 50 32Z', '#393939')]),
      layer('shutter', 'Nút chụp ảnh', 266, 310, 42, 17, '#B52D59', [paint(round, 'color')]),
      layer('print', 'Giấy ảnh Polaroid', 95, 525, 200, 210, '#FFFDF5', [paint(rect, 'color', '#E8A2B3', 1), paint('M5 5H95V78H5Z', '#F0DDC9')], -5),
      photo('memory', 105, 535, 180, 155, 0, -5),
    ],
  },
  {
    id: 'graduation-countdown', title: 'Graduation Countdown', background: '#F7D8DF', opening: 'calendar-peel',
    layers: [
      layer('calendar-shadow', 'Bóng giấy lịch', 46, 296, 308, 318, '#B97C89', [paint(rect, 'color')], -5),
      layer('calendar-paper', 'Giấy lịch', 41, 288, 308, 318, '#FFFAF5', [paint(rect, 'color')], -5),
      layer('grid', 'Lưới lịch', 56, 350, 278, 230, '#222222', [paint('M0 0H100V100H0ZM14.286 0V100M28.571 0V100M42.857 0V100M57.143 0V100M71.429 0V100M85.714 0V100M0 20H100M0 40H100M0 60H100M0 80H100', 'none', 'color', 1)], -5),
      layer('peel', 'Sticker bóc lịch', 270, 363, 40, 42, '#E77DA1', [paint(rect, 'color'), paint('M80 100V80H100Z', '#F7D8DF')], -8),
      layer('disco', 'Quả cầu disco', 255, 120, 92, 92, '#B9B9B9', [paint(circle, 'color', '#777777', 2), paint('M10 30H90M3 50H97M10 70H90M30 10V90M50 2V98M70 10V90', 'none', '#777777', 2), paint('M22 19L32 21L19 32L14 27Z', '#FFFFFF')]),
    ],
  },
];

export const signatureIds = Object.freeze(recipes.map(recipe => recipe.id));
export function signatureConcept(id) {
  const recipe = recipes.find(item => item.id === id);
  if (!recipe) throw new Error('Mẫu Signature không hợp lệ.');
  return { id: recipe.id, title: recipe.title, background: recipe.background, opening: recipe.opening };
}

// Mỗi lớp là một đối tượng Canvas độc lập, không khóa và không chứa HTML/script.
// Tạo ID mới mỗi lần chèn để các Sender không chia sẻ trạng thái chỉnh sửa.
export function createSignatureArtwork(id) {
  const recipe = recipes.find(item => item.id === id);
  if (!recipe) throw new Error('Mẫu Signature không hợp lệ.');
  return recipe.layers.map(item => createElement(item.photo ? 'image' : 'shape', {
    id: `signature-${item.key}-${globalThis.crypto.randomUUID()}`,
    name: item.name,
    layout: { ...item.layout },
    ...(item.photo ? { props: { radius: item.radius, optional: true }, accessibility: { alt: item.name } } : {
      props: { kind: `signature-${item.key}`, color: item.color, radius: 0 },
      artwork: { paths: structuredClone(item.paths) },
    }),
  }));
}
