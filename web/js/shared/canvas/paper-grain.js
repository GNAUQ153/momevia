// Original, immutable texture v1; selected by an enum, never supplied SVG/CSS.
export const PAPER_GRAIN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".76" numOctaves="3" seed="17" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .11 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>';
export const PAPER_GRAIN_URL = `data:image/svg+xml,${encodeURIComponent(PAPER_GRAIN_SVG)}`;
