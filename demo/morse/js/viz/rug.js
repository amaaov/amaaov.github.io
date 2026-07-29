/**
 * Vintage handwoven Turkish (Anatolian) rug ornament on a QR module matrix.
 * Modules drive mosaic tone and motif; kaleidoscope folds add symmetry.
 * Textile only — end fringe, no outer side rules or UI frames.
 */

export const RUG_PALETTE = {
  stage: "#070b0a",
  /** Aged madder / faded indigo / walnut ivory */
  madder: "#7a3a36",
  madderDeep: "#4e2422",
  madderSoft: "#8f5650",
  indigo: "#3a4658",
  indigoDeep: "#252e3c",
  indigoFaded: "#5a6574",
  ivory: "#d8c8a8",
  ivoryWarm: "#cbb892",
  walnut: "#6b5340",
  ochre: "#a8884a",
  moss: "#4a5544",
  wool: "#b8a888",
};

const TONE_FILL = [
  RUG_PALETTE.ivory,
  RUG_PALETTE.indigo,
  RUG_PALETTE.madder,
];

const TONE_SOFT = [
  "rgba(216,200,168,0.55)",
  "rgba(58,70,88,0.72)",
  "rgba(122,58,54,0.78)",
];

export function moduleDark(matrix, row, col) {
  const size = matrix?.length || 0;
  if (row < 0 || col < 0 || row >= size || col >= size) return false;
  return Boolean(matrix[row][col]);
}

/** Fold into the NW quadrant, then optionally transpose for softer symmetry. */
export function kaleidoDark(matrix, row, col) {
  const last = matrix.length - 1;
  const foldedRow = Math.min(row, last - row);
  const foldedCol = Math.min(col, last - col);
  return (
    moduleDark(matrix, foldedRow, foldedCol) ||
    moduleDark(matrix, foldedCol, foldedRow)
  );
}

/** 0 = ivory ground, 1 = faded indigo, 2 = madder figure. */
export function mosaicTone(matrix, row, col) {
  const raw = moduleDark(matrix, row, col);
  const mirrored = kaleidoDark(matrix, row, col);
  if (raw && mirrored) return 2;
  if (raw || mirrored) return 1;
  return 0;
}

export function toneFill(tone) {
  return TONE_FILL[tone] || TONE_FILL[0];
}

export function toneSoft(tone) {
  return TONE_SOFT[tone] || TONE_SOFT[0];
}

/** Deterministic weave jitter in [-1, 1] from cell coords. */
export function weaveNoise(row, col, salt = 0) {
  const n = Math.sin((row + 1) * 12.9898 + (col + 1) * 78.233 + salt * 37.1) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

export function rugLayout(matrix, canvasWidth, canvasHeight, { fringe = 0.1 } = {}) {
  const size = matrix.length;
  const span = Math.min(canvasWidth, canvasHeight);
  /** Fringe only on the warp ends (top/bottom); sides are plain selvedge flush. */
  const fringePx = Math.max(14, span * fringe);
  const sidePad = Math.max(4, span * 0.02);
  const field = Math.min(span - fringePx * 2, span - sidePad * 2);
  const cell = field / size;
  const originX = (canvasWidth - field) / 2;
  const originY = (canvasHeight - field) / 2;
  const border = Math.max(cell * 1.1, field * 0.055);
  return {
    size,
    span,
    fringePx,
    sidePad,
    field,
    cell,
    originX,
    originY,
    border,
    centerX: originX + field / 2,
    centerY: originY + field / 2,
  };
}

export function cellCenter(layout, row, col) {
  const jitter = layout.cell * 0.08;
  return {
    x: layout.originX + (col + 0.5) * layout.cell + weaveNoise(row, col, 1) * jitter,
    y: layout.originY + (row + 0.5) * layout.cell + weaveNoise(row, col, 2) * jitter,
  };
}

/** Motif class from local QR neighborhood. */
export function motifKind(matrix, row, col) {
  const tone = mosaicTone(matrix, row, col);
  const hash =
    (moduleDark(matrix, row, col) ? 1 : 0) +
    (moduleDark(matrix, row, col + 1) ? 2 : 0) +
    (moduleDark(matrix, row + 1, col) ? 4 : 0) +
    (kaleidoDark(matrix, row, col) ? 8 : 0);
  if (tone === 0) return hash % 2 === 0 ? "seed" : "dot";
  if (tone === 1) return hash % 3 === 0 ? "hook" : "lozenge";
  return hash % 2 === 0 ? "gül" : "star";
}

export function diamondPoints(cx, cy, radius, wobble = 0) {
  const w = wobble;
  return [
    [cx + w * 0.3, cy - radius],
    [cx + radius, cy + w * 0.2],
    [cx - w * 0.25, cy + radius],
    [cx - radius, cy - w * 0.15],
  ];
}

export function starPoints(cx, cy, outer, inner, spikes = 8, wobble = 0) {
  const points = [];
  for (let index = 0; index < spikes * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (Math.PI * index) / spikes - Math.PI / 2;
    const r = radius * (1 + wobble * 0.06 * ((index % 3) - 1));
    points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }
  return points;
}

/**
 * Soft arabesque petal in local coords before rotate.
 * Returns [x0,y0, cp1x,cp1y, cp2x,cp2y, x1,y1].
 */
export function arabesquePetal(length, flare) {
  return [
    0,
    0,
    length * 0.32,
    -flare,
    length * 0.72,
    flare * 0.9,
    length,
    flare * 0.08,
  ];
}

/** Woven end-guard latches — top and bottom only (no side rules). */
export function endLatches(layout) {
  const { size, cell, originX, originY, field, border } = layout;
  const step = Math.max(2, Math.floor(size / 12));
  const items = [];
  const inset = border * 0.5;
  for (let index = step; index < size - step; index += step) {
    items.push({
      side: "top",
      x: originX + (index + 0.5) * cell + weaveNoise(0, index, 3) * cell * 0.1,
      y: originY + inset,
      row: 0,
      col: index,
    });
    items.push({
      side: "bottom",
      x: originX + (index + 0.5) * cell + weaveNoise(size - 1, index, 4) * cell * 0.1,
      y: originY + field - inset,
      row: size - 1,
      col: index,
    });
  }
  return items;
}

/** Warp-end fringe (top/bottom only). Slight irregular length/sway. */
export function fringeSpecs(layout, matrix) {
  const { size, field, originX, originY, fringePx, cell } = layout;
  const count = Math.max(size, Math.floor(size * 1.6));
  const step = field / count;
  const specs = [];
  for (let index = 0; index < count; index += 1) {
    const col = Math.min(size - 1, Math.floor((index / count) * size));
    const topDark = moduleDark(matrix, 0, col);
    const bottomDark = moduleDark(matrix, size - 1, col);
    const x = originX + index * step + step * 0.5;
    const sway = weaveNoise(0, index, 5) * step * 0.45;
    const lenJitter = 0.75 + weaveNoise(1, index, 6) * 0.2;
    specs.push({
      x0: x,
      y0: originY + cell * 0.02,
      x1: x + sway,
      y1: originY - fringePx * lenJitter,
      color: topDark ? RUG_PALETTE.madderSoft : RUG_PALETTE.wool,
      width: Math.max(1, step * (0.28 + weaveNoise(2, index, 7) * 0.08)),
    });
    specs.push({
      x0: x,
      y0: originY + field - cell * 0.02,
      x1: x - sway * 0.8,
      y1: originY + field + fringePx * lenJitter,
      color: bottomDark ? RUG_PALETTE.indigoFaded : RUG_PALETTE.ivoryWarm,
      width: Math.max(1, step * (0.28 + weaveNoise(3, index, 8) * 0.08)),
    });
  }
  return specs;
}

export function pointsToSvg(points) {
  return points.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join(" ") + " Z";
}

export function cubicToSvg(x0, y0, cp1x, cp1y, cp2x, cp2y, x1, y1) {
  return `M${x0} ${y0} C${cp1x} ${cp1y} ${cp2x} ${cp2y} ${x1} ${y1}`;
}
