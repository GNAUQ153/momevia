// Sáu cơ chế mở bìa 3D cho bộ 16 thiệp Originals.
// Mỗi lớp là một shape vector độc lập (tọa độ 100 × 100), có thể chỉnh màu, xoay, ẩn trong Editor.
// props.kind = 'signature-<vai trò>' là hợp đồng với gift-runtime/signature-opening.js:
// runtime tìm các vai trò này để chạy hoạt ảnh mở (ruy băng, dấu sáp, cửa đôi, in ảnh, bóc lịch, lấy nét).
// Không chứa HTML, URL hay mã thực thi; nếu Sender xóa lớp thì thiệp vẫn chuyển cảnh bình thường.

const paint = (d, fill, stroke, strokeWidth) => ({
  d,
  fill,
  ...(stroke ? { stroke, strokeWidth } : {}),
});

const RECT = 'M0 0H100V100H0Z';
const ROUND = 'M8 0H92Q100 0 100 8V92Q100 100 92 100H8Q0 100 0 92V8Q0 0 8 0Z';
const CIRCLE = 'M50 1A49 49 0 1 1 50 99A49 49 0 1 1 50 1Z';

// Làm tối/sáng một màu hex để tạo mặt bóng của khối 3D (amount âm = tối hơn).
export function shade(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const channel = shift => {
    const base = (value >> shift) & 255;
    const target = amount < 0 ? 0 : 255;
    return Math.round(base + (target - base) * Math.abs(amount));
  };
  const parts = [16, 8, 0].map(channel);
  return '#' + parts.map(part => part.toString(16).padStart(2, '0')).join('').toUpperCase();
}

const layer = (role, name, box, color, paths) => ({ role, name, box, color, paths });

// Nơ hai cánh dùng chung cho hộp quà.
const bowPaths = edge => [
  paint('M50 64C20 -13 -4 29 12 74C26 94 42 81 50 64Z M50 64C80 -13 104 29 88 74C74 94 58 81 50 64Z', 'color', edge, 2),
  paint('M50 64L38 97M50 64L62 97', 'none', edge, 5),
  paint('M50 52A8 13 0 1 1 50 77A8 13 0 1 1 50 52Z', edge),
];

// Nhánh lá trang trí hai cánh cửa.
const sprigPaths = [
  paint('M50 98C47 67 57 33 50 5', 'none', 'color', 1.6),
  paint('M36 80C20 74 18 62 30 60C40 64 42 72 36 80Z M64 62C80 56 82 44 70 42C60 46 58 54 64 62Z M36 44C22 38 22 28 32 26C40 30 42 38 36 44Z M62 28C74 22 76 14 68 12C60 15 58 22 62 28Z', 'color'),
];

// Hộp quà: kéo nơ, nắp bay lên, lá thư trồi ra (ribbon-pull).
function giftRig(p) {
  const box = p.cta;
  const ribbon = p.detail;
  return [
    layer('letter', 'Lá thư trong hộp', [100, 330, 190, 190], p.paper, [
      paint(RECT, 'color', ribbon, 1),
      paint('M8 8H92V92H8Z', 'none', ribbon, 0.8),
      paint('M24 30H76M24 42H76M24 54H60', 'none', shade(p.ink, 0.55), 1.2),
    ]),
    layer('body', 'Thân hộp quà', [72, 420, 246, 190], box, [
      paint(RECT, 'color'),
      paint('M0 0H14V100H0Z M86 0H100V100H86Z', shade(box, -0.25)),
      paint('M0 0H100V8H0Z', shade(box, -0.35)),
    ]),
    layer('body-ribbon', 'Ruy băng thân hộp', [177, 420, 36, 190], ribbon, [
      paint(RECT, 'color'),
      paint('M0 0H14V100H0Z M86 0H100V100H86Z', shade(ribbon, -0.2)),
    ]),
    layer('lid', 'Nắp hộp quà', [60, 362, 270, 62], shade(box, 0.08), [
      paint(ROUND, 'color'),
      paint('M0 70H100V100H0Z', shade(box, -0.2)),
    ]),
    layer('lid-ribbon', 'Ruy băng nắp hộp', [177, 362, 36, 62], ribbon, [paint(RECT, 'color')]),
    layer('bow', 'Nơ', [135, 304, 120, 74], ribbon, bowPaths(shade(ribbon, -0.35))),
  ];
}

// Phong thư niêm sáp: dấu sáp vỡ, nắp lật 3D, lá thư trượt lên (wax-envelope).
function envelopeRig(p) {
  const body = p.cta;
  return [
    layer('back', 'Lưng phong thư', [45, 372, 300, 206], shade(body, -0.35), [paint(ROUND, 'color')]),
    layer('letter', 'Lá thư', [64, 384, 262, 180], p.paper, [
      paint(RECT, 'color', p.detail, 1),
      paint('M5 6H95V94H5Z', 'none', p.detail, 0.8),
      paint('M22 30H78M22 44H78M22 58H62', 'none', shade(p.ink, 0.55), 1.2),
    ]),
    layer('pocket', 'Túi phong thư', [45, 372, 300, 206], body, [
      paint('M0 0L50 56L100 0V100H0Z', 'color'),
      paint('M0 100L50 56L100 100Z', shade(body, -0.22)),
    ]),
    layer('flap', 'Nắp phong thư', [45, 372, 300, 116], shade(body, 0.12), [
      paint('M0 0H100L50 100Z', 'color'),
      paint('M0 0L50 88L100 0L50 100Z', shade(body, -0.15)),
    ]),
    layer('seal', 'Dấu sáp', [166, 456, 58, 58], p.detail, [
      paint(CIRCLE, 'color', shade(p.detail, -0.3), 3),
      paint('M50 10A40 40 0 1 1 50 90A40 40 0 1 1 50 10Z', 'none', shade(p.detail, 0.35), 2),
      paint('M50 30L55 44L70 45L58 54L62 69L50 60L38 69L42 54L30 45L45 44Z', shade(p.detail, -0.3)),
    ]),
  ];
}

// Hai cánh cửa mở ra hai bên, để lộ khung cảnh phía sau (gatefold).
function gatefoldRig(p) {
  const left = p.cta;
  const right = shade(p.cta, -0.18);
  const doorPaths = (edge) => [
    paint(RECT, 'color'),
    paint('M6 4H94V96H6Z', 'none', edge, 0.8),
    paint('M14 12H86V48H14Z M14 56H86V88H14Z', 'none', edge, 0.6),
  ];
  return [
    layer('window', 'Khung cảnh phía sau', [28, 300, 334, 340], p.paper, [
      paint(ROUND, 'color'),
      paint('M0 70Q50 50 100 70V100H0Z', shade(p.detail, 0.45)),
    ]),
    layer('door-left', 'Cánh cửa trái', [28, 300, 167, 340], left, doorPaths(p.detail)),
    layer('door-right', 'Cánh cửa phải', [195, 300, 167, 340], right, doorPaths(p.detail)),
    layer('sprig-left', 'Nhánh lá trái', [38, 318, 76, 152], p.detail, sprigPaths),
    layer('sprig-right', 'Nhánh lá phải', [276, 470, 76, 152], p.detail, sprigPaths),
    layer('seal', 'Dấu hoa giữa cửa', [153, 428, 84, 84], p.detail, [
      paint(CIRCLE, 'color', shade(p.detail, -0.35), 2),
      paint('M50 8A42 42 0 1 1 50 92A42 42 0 1 1 50 8Z', 'none', shade(p.detail, -0.35), 1),
      paint('M50 26C42 38 42 46 50 50C58 46 58 38 50 26Z M50 74C42 62 42 54 50 50C58 54 58 62 50 74Z M26 50C38 42 46 42 50 50C46 58 38 58 26 50Z M74 50C62 42 54 42 50 50C54 58 62 58 74 50Z', shade(p.detail, -0.35)),
    ]),
  ];
}

// Máy ảnh lấy liền: bấm nút, màn hình lóe sáng, tấm ảnh in trượt ra (polaroid-print).
function polaroidRig(p) {
  const shell = shade(p.detail, -0.1);
  return [
    layer('camera-shell', 'Thân máy ảnh', [35, 296, 320, 210], shell, [
      paint(ROUND, 'color', shade(shell, -0.45), 1),
      paint('M4 8H96V92H4Z', 'none', shade(shell, 0.4), 2),
      paint('M62 12H94V88H62Z', shade(shell, -0.12)),
    ]),
    layer('screen', 'Màn hình', [52, 325, 190, 151], shade(p.night, 0.1), [
      paint(ROUND, 'color'),
      paint('M6 8H94V92H6Z', shade(p.detail, 0.55)),
      paint('M6 70Q30 50 52 66T94 60V92H6Z', shade(p.cta, 0.25)),
    ]),
    layer('lens', 'Ống kính', [259, 356, 77, 77], shade(shell, 0.3), [
      paint(CIRCLE, 'color', shade(shell, -0.5), 2),
      paint('M50 10A40 40 0 1 1 50 90A40 40 0 1 1 50 10Z', 'none', shade(shell, -0.5), 2),
      paint('M50 32A18 18 0 1 1 50 68A18 18 0 1 1 50 32Z', '#2B2B2B'),
    ]),
    layer('shutter', 'Nút chụp', [266, 314, 42, 17], p.cta, [paint(ROUND, 'color')]),
    layer('print', 'Tấm ảnh in', [95, 522, 200, 214], p.paper, [
      paint(RECT, 'color', shade(p.detail, -0.2), 1),
      paint('M6 6H94V78H6Z', shade(p.detail, 0.5)),
      paint('M6 62Q28 44 50 58T94 50V78H6Z', p.cta),
      paint('M70 18A8 8 0 1 1 70 34A8 8 0 1 1 70 18Z', p.detail),
    ]),
  ];
}

// Tờ lịch có nhãn dán: bóc nhãn, tờ lịch rung nhẹ, đồ trang trí xoay (calendar-peel).
function calendarRig(p) {
  const head = p.cta;
  const grid = Array.from({ length: 6 }, (_, i) => `M${(i + 1) * 14.286} 30V100`).join('') +
    Array.from({ length: 3 }, (_, i) => `M0 ${47.5 + i * 17.5}H100`).join('');
  return [
    layer('calendar-shadow', 'Bóng tờ lịch', [50, 300, 300, 316], shade(p.night, 0.25), [paint(ROUND, 'color')]),
    layer('calendar-paper', 'Tờ lịch', [42, 292, 300, 316], p.paper, [
      paint(ROUND, 'color'),
      paint('M0 8Q0 0 8 0H92Q100 0 100 8V24H0Z', head),
      paint('M0 30H100V100H0Z' + grid, 'none', shade(p.ink, 0.7), 0.6),
      paint('M58 66A7 7 0 1 1 72 66A7 7 0 1 1 58 66Z', 'none', head, 1.6),
    ]),
    layer('peel', 'Nhãn dán bóc', [266, 370, 46, 48], p.detail, [
      paint(ROUND, 'color'),
      paint('M78 100V78H100Z', shade(p.detail, -0.25)),
    ]),
    layer('disco', 'Đồ trang trí treo', [292, 226, 72, 72], shade(p.detail, 0.15), [
      paint(CIRCLE, 'color', shade(p.detail, -0.4), 2),
      paint('M10 30H90M3 50H97M10 70H90M30 10V90M50 2V98M70 10V90', 'none', shade(p.detail, -0.4), 1.5),
      paint('M22 19L32 21L19 32L14 27Z', '#FFFFFF'),
    ]),
  ];
}

// Ống kính lấy nét: vòng kính xoay, dấu lấy nét co giãn, núm trượt (camera-focus).
function lensRig(p) {
  const body = shade(p.night, 0.12);
  return [
    layer('camera', 'Thân ống kính', [35, 290, 320, 350], body, [
      paint(ROUND, 'color'),
      paint('M4 86H96V92H4Z', shade(body, 0.25)),
    ]),
    layer('lens', 'Vòng ống kính', [77, 316, 236, 236], shade(body, 0.2), [
      paint(CIRCLE, 'color'),
      paint('M50 6A44 44 0 1 1 50 94A44 44 0 1 1 50 6Z', 'none', p.detail, 2),
      paint('M50 14A36 36 0 1 1 50 86A36 36 0 1 1 50 14Z', shade(p.cta, -0.3)),
      paint('M50 24A26 26 0 1 1 50 76A26 26 0 1 1 50 24Z', shade(p.cta, 0.15)),
      paint('M36 34L40 36L36 38L34 42L32 38L28 36L32 34L34 30Z M64 58L66 59L64 60L63 62L62 60L60 59L62 58L63 56Z', '#FFFFFF'),
    ]),
    layer('crosshair', 'Dấu lấy nét', [181, 420, 28, 28], '#FFFFFF', [
      paint('M50 10V90M10 50H90', 'none', 'color', 5),
    ]),
    layer('dial', 'Thanh lấy nét', [71, 588, 248, 9], p.detail, [paint(ROUND, 'color')]),
    layer('dial-knob', 'Núm lấy nét', [71, 578, 29, 29], p.cta, [
      paint(CIRCLE, 'color', '#FFFFFF', 2),
    ]),
  ];
}

const RIGS = Object.freeze({
  gift: { build: giftRig, effect: 'openGift' },
  envelope: { build: envelopeRig, effect: 'openLetter' },
  gatefold: { build: gatefoldRig, effect: 'bloom' },
  polaroid: { build: polaroidRig, effect: 'photoFlip' },
  calendar: { build: calendarRig, effect: 'surprise' },
  lens: { build: lensRig, effect: 'glow' },
});

export const RIG_IDS = Object.freeze(Object.keys(RIGS));

// Nhãn hiệu ứng hiển thị trong Catalog (templates.meta.effect.*).
export const rigEffect = rig => RIGS[rig]?.effect || 'cardFlip';

export function buildRig(p) {
  const rig = RIGS[p.rig];
  if (!rig) throw new Error('Cơ chế mở thiệp không hợp lệ: ' + p.rig);
  return rig.build(p);
}

// Họa tiết nền bìa theo dịp: tuyết, pháo giấy, cánh hoa, sao, dây đèn.
const flake = (x, y) => `M${x - 1} ${y}H${x + 1}M${x} ${y - 0.5}V${y + 0.5}M${x - 0.7} ${y - 0.35}L${x + 0.7} ${y + 0.35}M${x - 0.7} ${y + 0.35}L${x + 0.7} ${y - 0.35}`;
const dash = (x, y, flip) => `M${x} ${y}L${x + (flip ? -1.2 : 1.2)} ${y + 0.6}`;
const petal = (x, y) => `M${x} ${y}Q${x + 1.2} ${y - 0.8} ${x + 2} ${y}Q${x + 1.2} ${y + 0.6} ${x} ${y}`;
const spark = (x, y) => `M${x - 0.8} ${y}H${x + 0.8}M${x} ${y - 0.4}V${y + 0.4}`;
const SPOTS = [[8, 6], [24, 10], [44, 5], [70, 8], [90, 12], [6, 22], [94, 28], [12, 40], [88, 44], [5, 58], [95, 62], [10, 76], [90, 80], [22, 92], [50, 95], [76, 93]];

export function coverTexture(category) {
  if (category === 'christmas') return SPOTS.map(([x, y]) => flake(x, y)).join('');
  if (category === 'birthday') return SPOTS.map(([x, y], i) => dash(x, y, i % 2)).join('');
  if (category === 'wedding') return SPOTS.map(([x, y]) => petal(x, y)).join('');
  if (category === 'meetup') return 'M0 4Q25 9 50 4T100 4' + SPOTS.slice(0, 8).map(([x, y]) => spark(x, y + 4)).join('');
  return SPOTS.map(([x, y]) => spark(x, y)).join('');
}
