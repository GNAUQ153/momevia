// Coverage measures erased area, so retracing a stroke cannot increase progress.
export function scratchPercent(pixels) {
  if (!pixels.length) return 0;
  let remaining = 0;
  for (let i = 3; i < pixels.length; i += 4) remaining += pixels[i];
  return Math.max(0, Math.min(100, (1 - remaining / (pixels.length / 4 * 255)) * 100));
}
export const finishScratchOnRelease = percent => percent > 90;
