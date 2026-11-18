// Bộ hình vector nguyên bản cho Momevia: chỉ dùng Shape/Line/Text của Canvas Runtime.
// Không dùng emoji, ảnh stock hay thư viện/bản quyền bên ngoài. Tất cả layer đều chỉnh sửa được.
export const COLLECTION_2027 = Object.freeze({
  'winter-wishes-2026': {
    motif: 'winter-tree', name: 'Giáng sinh an lành', bg: '#153D3B', paper: '#F8F1E7', ink: '#FFF8E9',
    accent: '#DDBE78', detail: '#D46B66', button: '#B84651', headline: 'Mùa đông ấm áp\nnhờ có bạn.',
    note: 'Một điều ước nhỏ, gửi giữa mùa Giáng sinh.', font: 'serif',
  },
  'new-year-spark-2027': {
    motif: 'new-year', name: 'Chào năm 2027', bg: '#101F42', paper: '#FDF6E6', ink: '#F8EAC8',
    accent: '#E4BF72', detail: '#93B7DD', button: '#4A6CB5', headline: 'Bước sang 2027,\nước mơ tỏa sáng.',
    note: 'Gửi lời chúc cho một khởi đầu đáng nhớ.', font: 'serif',
  },
  'spring-blessing-2027': {
    motif: 'tet-flower', name: 'Xuân sum vầy', bg: '#921F32', paper: '#FFF3DF', ink: '#FFF2DC',
    accent: '#F4CA71', detail: '#F7B3AD', button: '#BD3E37', headline: 'Tết đến bên nhau,\nphúc lành đầy nhà.',
    note: 'Đón xuân 2027 với những lời thương.', font: 'serif',
  },
  'velvet-valentine-2027': {
    motif: 'valentine-note', name: 'Lá thư Valentine', bg: '#722D46', paper: '#FFF0EA', ink: '#FFE7E4',
    accent: '#E5A4AD', detail: '#EFC6B2', button: '#A44365', headline: 'Một lá thư nhỏ,\nmột lời thương lớn.',
    note: 'Đôi điều chỉ muốn gửi riêng người ấy.', font: 'serif',
  },
  'birthday-radiance': {
    motif: 'birthday-cake', name: 'Sinh nhật rực rỡ', bg: '#6A539E', paper: '#FFF6EB', ink: '#FFF7E8',
    accent: '#F8D58A', detail: '#F2B5B8', button: '#7553B1', headline: 'Hôm nay là\nngày của bạn!',
    note: 'Thêm một tuổi, thêm muôn điều rực rỡ.', font: 'heading',
  },
  'thank-you-bloom': {
    motif: 'thanks-flower', name: 'Lời cảm ơn nở hoa', bg: '#DDECDD', paper: '#FFFDF7', ink: '#345548',
    accent: '#779D7D', detail: '#C69AAA', button: '#436A56', headline: 'Cảm ơn bạn\nvì những điều đẹp.',
    note: 'Lời biết ơn có thể nở hoa mỗi ngày.', font: 'serif',
  },
  'proud-of-you': {
    motif: 'congrats', name: 'Tự hào về bạn', bg: '#152D49', paper: '#FFFBF0', ink: '#F7E9C6',
    accent: '#E6C57A', detail: '#85ACC1', button: '#40678C', headline: 'Thật tự hào\nvề bạn hôm nay.',
    note: 'Mọi cố gắng đều xứng đáng được ghi nhớ.', font: 'serif',
  },
  'faraway-hug': {
    motif: 'distance', name: 'Một cái ôm từ xa', bg: '#DDEBF5', paper: '#FFFEFA', ink: '#395776',
    accent: '#83A8C7', detail: '#B4CDE1', button: '#3F6386', headline: 'Cách nhau một chút,\nthương nhau thật nhiều.',
    note: 'Gấp lời nhớ thành một chiếc máy bay giấy.', font: 'serif',
  },
  'gentle-apology': {
    motif: 'apology', name: 'Một lời xin lỗi', bg: '#E8DDD2', paper: '#FFFBF3', ink: '#5F4E43',
    accent: '#899783', detail: '#C69C91', button: '#765D55', headline: 'Mình muốn nói\nmột lời xin lỗi.',
    note: 'Một lời chân thành, mở đầu cho sự thấu hiểu.', font: 'serif',
  },
  'calm-light': {
    motif: 'calm-dawn', name: 'Bình yên gửi bạn', bg: '#D9E6E3', paper: '#FDFDF7', ink: '#365E5F',
    accent: '#E7BC95', detail: '#93B8AE', button: '#4A7774', headline: 'Mong bạn luôn\nbình an và dịu dàng.',
    note: 'Hôm nay chậm lại một chút cũng không sao.', font: 'serif',
  },
});

// Tranh minh họa trên bìa là các layer vector riêng biệt, không gộp ảnh phẳng.
export function paintCollectionCover(motif, { shape, line, text, flower, stem }, p) {
  const circle = (id, x, y, size, color) => shape(0, id, [x, y, size, size], color);
  const rect = (id, x, y, w, h, color, rotation = 0, radius = 12) =>
    shape(0, id, [x, y, w, h, rotation], color, 'rectangle', { radius });
  const ray = (id, x, y, len, angle, color = p.accent, width = 2) =>
    line(0, id, [x, y, len, 2, angle], color, width);
  const twinkle = (id, x, y, size = 14, color = p.accent) => {
    ray(`${id}-horizontal`, x - size, y, size * 2, 0, color);
    ray(`${id}-vertical`, x, y - size, size * 2, 90, color);
  };
  if (motif === 'winter-tree') {
    circle('winter-halo', 77, 25, 236, '#245651');
    for (let i = 0; i < 17; i++) circle(`winter-snow-${i}`, 17 + (i * 79) % 349, 25 + (i * 43) % 268, 3 + (i % 3) * 2, '#F5EFE4');
    rect('winter-trunk', 182, 248, 26, 58, '#A77A57');
    for (let i = 0; i < 4; i++) shape(0, `winter-branch-${i}`, [131 - i * 18, 84 + i * 38, 126 + i * 36, 67], i % 2 ? '#235B50' : '#307568');
    ray('winter-garland-a', 120, 180, 149, 4, p.accent, 3);
    ray('winter-garland-b', 107, 231, 175, -6, p.accent, 3);
    twinkle('winter-star', 196, 51, 17);
    for (let i = 0; i < 8; i++) circle(`winter-ornament-${i}`, 152 + i * 37 % 99, 128 + i * 29 % 134, 7, i % 2 ? p.accent : p.detail);
  } else if (motif === 'new-year') {
    circle('newyear-moon', 132, 67, 128, '#21345C');
    text(0, 'newyear-year', '2027', [78, 127, 234, 90], 67, p.accent, 'serif');
    for (let j = 0; j < 3; j++) {
      const cx = [75, 300, 195][j], cy = [106, 95, 265][j];
      for (let i = 0; i < 10; i++) {
        const a = i * 36 * Math.PI / 180, r = 28 + j * 4;
        ray(`firework-${j}-${i}`, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 15, i * 36, j % 2 ? p.detail : p.accent);
      }
    }
    rect('newyear-cityline', 22, 288, 346, 3, p.accent, 0, 1);
  } else if (motif === 'tet-flower') {
    circle('tet-ring', 65, 30, 260, '#AD3443');
    for (let i = 0; i < 3; i++) ray(`tet-branch-${i}`, 26 + i * 72, 271 - i * 42, 208, -40, p.accent, 3);
    flower(0, 'tet-bloom-one', 84, 80, 57, p.accent);
    flower(0, 'tet-bloom-two', 284, 152, 45, p.detail);
    flower(0, 'tet-bloom-three', 145, 246, 39, p.accent);
    rect('tet-envelope', 188, 240, 101, 69, '#E7AB57', -9, 5);
    rect('tet-envelope-seal', 223, 252, 29, 29, '#A92F3E', -9, 8);
  } else if (motif === 'valentine-note') {
    circle('valentine-halo', 54, 17, 281, '#864259');
    rect('valentine-letter-shadow', 78, 63, 235, 217, '#A6576C', 7, 14);
    rect('valentine-letter-paper', 78, 55, 235, 217, p.paper, -6, 12);
    for (let i = 0; i < 3; i++) ray(`valentine-letter-rule-${i}`, 118, 119 + i * 35, 150, 0, '#DCB3BA');
    circle('valentine-seal-ring', 165, 217, 59, p.detail);
    circle('valentine-seal-core', 178, 230, 33, '#A24462');
    for (let i = 0; i < 5; i++) circle(`valentine-petal-${i}`, 36 + i * 76, 22 + (i % 2) * 257, 13, p.accent);
  } else if (motif === 'birthday-cake') {
    circle('birthday-halo', 61, 15, 267, '#7D67B0');
    rect('cake-plate', 79, 281, 232, 12, '#F6E2C5', 0, 6);
    rect('cake-bottom', 107, 202, 176, 73, '#EBA9BB', 0, 15);
    rect('cake-top', 126, 147, 137, 58, '#FFF1D3', 0, 15);
    rect('cake-icing', 126, 144, 137, 16, '#F6C9D0');
    for (let i = 0; i < 3; i++) {
      rect(`cake-candle-${i}`, 155 + i * 35, 107, 9, 39, '#F2D080', 0, 3);
      shape(0, `cake-flame-${i}`, [155 + i * 35, 86, 10, 17], '#F7E8AE');
    }
    for (let i = 0; i < 18; i++) rect(`cake-confetti-${i}`, 10 + (i * 71) % 352, 18 + (i * 51) % 270, 5 + i % 3, 11, i % 2 ? p.detail : p.accent, ((i * 28) % 150) - 75, 2);
  } else if (motif === 'thanks-flower') {
    circle('thanks-halo', 83, 42, 230, '#EAF2E7');
    for (let i = 0; i < 4; i++) stem(0, `thanks-stem-${i}`, 116 + i * 55, 140 - i % 2 * 33, 148, '#6C9874');
    flower(0, 'thanks-bloom-a', 111, 99, 40, p.detail);
    flower(0, 'thanks-bloom-b', 231, 68, 51, '#E9C2A8');
    flower(0, 'thanks-bloom-c', 299, 139, 42, p.detail);
    ray('thanks-footline', 122, 302, 150, 0, p.accent);
  } else if (motif === 'congrats') {
    circle('congrats-halo', 78, 28, 234, '#1D3F5C');
    for (let i = 0; i < 6; i++) {
      shape(0, `award-leaf-l-${i}`, [64 + i * 13, 266 - i * 36, 17, 36, -34], p.accent);
      shape(0, `award-leaf-r-${i}`, [309 - i * 13, 266 - i * 36, 17, 36, 34], p.accent);
    }
    circle('award-medal', 143, 74, 104, p.accent);
    circle('award-medal-core', 158, 89, 74, '#254462');
    twinkle('award-star', 195, 125, 23);
    rect('award-ribbon-left', 155, 180, 35, 94, p.detail, 14, 2);
    rect('award-ribbon-right', 200, 181, 35, 94, '#D6A65A', -14, 2);
  } else if (motif === 'distance') {
    circle('faraway-sky', 49, 21, 297, '#E7F4F8');
    for (let i = 0; i < 4; i++) {
      const x = 28 + i * 93, y = 57 + (i % 2) * 117;
      circle(`faraway-cloud-a-${i}`, x, y, 60, '#FFFFFF');
      circle(`faraway-cloud-b-${i}`, x + 28, y + 13, 50, '#FFFFFF');
    }
    ray('plane-left', 134, 224, 143, -30, '#618DAE', 4);
    ray('plane-right', 134, 224, 118, 29, '#618DAE', 4);
    ray('plane-fold', 196, 260, 60, -60, '#618DAE', 3);
    for (let i = 0; i < 7; i++) circle(`plane-trail-${i}`, 60 + i * 14, 273 - (i % 2) * 6, 4, p.accent);
  } else if (motif === 'apology') {
    circle('apology-halo', 51, 20, 286, '#F5EFE7');
    rect('apology-paper-shadow', 78, 61, 246, 231, '#D9C7BC', 8, 12);
    rect('apology-paper', 75, 52, 246, 231, '#FFFDF9', -5, 12);
    ray('apology-line-one', 112, 126, 170, 0, '#D7C4B7');
    ray('apology-line-two', 112, 165, 153, 0, '#D7C4B7');
    ray('apology-line-three', 112, 205, 126, 0, '#D7C4B7');
    stem(0, 'apology-olive', 72, 140, 143, p.accent);
    for (let i = 0; i < 3; i++) circle(`olive-dot-${i}`, 62 + i * 14, 202 + i * 25, 10, '#899783');
  } else if (motif === 'calm-dawn') {
    circle('calm-sky', 49, 23, 286, '#EBF2EA');
    circle('calm-sun-halo', 99, 62, 194, '#F4E9D4');
    circle('calm-sun', 120, 85, 154, p.accent);
    rect('calm-horizon', 39, 211, 310, 19, '#ABCFC4', 0, 8);
    for (let i = 0; i < 6; i++) ray(`calm-water-${i}`, 72 + (i % 3) * 68, 246 + (i % 2) * 24, 76, 0, i % 2 ? p.detail : '#93B8AE', 3);
    for (let i = 0; i < 6; i++) circle(`calm-floating-${i}`, 32 + i * 56, 29 + (i % 3) * 34, 5, p.detail);
  }
}
