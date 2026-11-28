// Mỗi lớp có tốc độ, kích thước và độ trong riêng để tạo chiều sâu.
export function createSeasonParticles(doc, compact) {
  const layer = doc.createElement('div');
  layer.className = 'festival-particles';
  layer.setAttribute('aria-hidden', 'true');
  const count = compact ? 12 : 30;
  for (let index = 0; index < count; index++) {
    const flake = doc.createElement('i');
    flake.style.setProperty('--left', ((index * 37 + 7) % 101) + '%');
    flake.style.setProperty('--delay', -(index * .87) + 's');
    flake.style.setProperty('--fall', (8 + (index * 3 % 13)) + 's');
    flake.style.setProperty('--drift', (index % 2 ? 1 : -1) * (24 + index % 5 * 12) + 'px');
    flake.dataset.depth = String(index % 3);
    layer.append(flake);
  }
  const sleigh = doc.createElement('span');
  sleigh.className = 'festival-sleigh';
  sleigh.innerHTML = '<svg viewBox="0 0 128 54" fill="none"><path fill="#B91C2C" d="M5 24h28l15 10h28l9-12 7 3-7 16H24Q10 40 5 24Z"/><path stroke="#D4AF37" stroke-width="4" stroke-linecap="round" d="M13 44q1 5 10 5h64q10 0 13-7M28 39v10m44-10v10M88 28l31-8"/><path fill="#FFF8ED" d="M38 21q-6-10 1-14 9-5 15 4l3 9-5 8-8 1Z"/><path fill="#B91C2C" d="M34 13 43 1l15 9-3 6Z"/><circle cx="58" cy="10" r="3" fill="#FFF8ED"/><path fill="#D4AF37" d="m100 20 8-6 7 1 1-8 4 1 2 7 5 3-3 7-8 1-5 9-3-2 2-8-8 1Z"/></svg>';
  if (!compact) layer.append(sleigh);
  return layer;
}
