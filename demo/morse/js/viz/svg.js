/**
 * Vector export for QR modules, Go-board, and rug rendering of the same matrix.
 */

import {
  RUG_PALETTE,
  arabesquePetal,
  cellCenter,
  cubicToSvg,
  diamondPoints,
  endLatches,
  fringeSpecs,
  mosaicTone,
  motifKind,
  pointsToSvg,
  rugLayout,
  starPoints,
  toneFill,
  toneSoft,
  weaveNoise,
} from "./rug.js";

export function qrMatrixToSvg(matrix, { quiet = 4, moduleSize = 12 } = {}) {
  const size = matrix.length;
  const modules = size + quiet * 2;
  const edge = modules * moduleSize;
  const dark = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!matrix[row][col]) continue;
      const x = (col + quiet) * moduleSize;
      const y = (row + quiet) * moduleSize;
      dark.push(
        `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}"/>`,
      );
    }
  }
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${edge}" height="${edge}" viewBox="0 0 ${edge} ${edge}" shape-rendering="crispEdges">`,
    `<rect width="${edge}" height="${edge}" fill="#f4f7f2"/>`,
    `<g fill="#0b100f">${dark.join("")}</g>`,
    `</svg>`,
  ].join("");
}

export function goBoardToSvg(matrix, { margin = 1, cellSize = 28 } = {}) {
  const size = matrix.length;
  const cells = size + margin * 2;
  const edge = cells * cellSize;
  const origin = margin * cellSize;
  const boardInset = margin * cellSize * 0.1;
  const board = edge - boardInset * 2;
  const lineWidth = Math.max(1, cellSize * 0.06);
  const radius = cellSize * 0.42;
  const lines = [];
  for (let index = 0; index < size; index += 1) {
    const center = origin + index * cellSize + cellSize / 2;
    const start = origin + cellSize / 2;
    const end = origin + (size - 1) * cellSize + cellSize / 2;
    lines.push(
      `<line x1="${start}" y1="${center}" x2="${end}" y2="${center}"/>`,
      `<line x1="${center}" y1="${start}" x2="${center}" y2="${end}"/>`,
    );
  }
  const stones = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const black = Boolean(matrix[row][col]);
      const x = origin + col * cellSize + cellSize / 2;
      const y = origin + row * cellSize + cellSize / 2;
      const fill = black ? "url(#stone-black)" : "url(#stone-white)";
      const stroke = black
        ? ""
        : ` stroke="rgba(40,28,12,0.35)" stroke-width="${Math.max(1, radius * 0.08)}"`;
      stones.push(
        `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}"${stroke}/>`,
      );
    }
  }
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${edge}" height="${edge}" viewBox="0 0 ${edge} ${edge}">`,
    `<defs>`,
    `<linearGradient id="board-wood" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0%" stop-color="#c4a574"/>`,
    `<stop offset="45%" stop-color="#b08955"/>`,
    `<stop offset="100%" stop-color="#8d6a3e"/>`,
    `</linearGradient>`,
    `<radialGradient id="stone-black" cx="35%" cy="32%" r="65%">`,
    `<stop offset="0%" stop-color="#3a3a3a"/>`,
    `<stop offset="55%" stop-color="#141414"/>`,
    `<stop offset="100%" stop-color="#050505"/>`,
    `</radialGradient>`,
    `<radialGradient id="stone-white" cx="35%" cy="32%" r="65%">`,
    `<stop offset="0%" stop-color="#ffffff"/>`,
    `<stop offset="45%" stop-color="#f0f0f0"/>`,
    `<stop offset="100%" stop-color="#c8c8c8"/>`,
    `</radialGradient>`,
    `</defs>`,
    `<rect width="${edge}" height="${edge}" fill="#0b100f"/>`,
    `<rect x="${boardInset}" y="${boardInset}" width="${board}" height="${board}" fill="url(#board-wood)"/>`,
    `<g stroke="rgba(40,28,12,0.55)" stroke-width="${lineWidth}">${lines.join("")}</g>`,
    `<g>${stones.join("")}</g>`,
    `</svg>`,
  ].join("");
}

function motifSvg(kind, cx, cy, cell, tone, row = 0, col = 0) {
  const wobble = weaveNoise(row, col, 9) * cell * 0.12;
  const radius =
    cell * (tone === 0 ? 0.3 : 0.4) * (1 + weaveNoise(row, col, 10) * 0.08);
  const fill = toneSoft(tone);
  if (kind === "dot" || kind === "seed") {
    const rx = radius * (kind === "seed" ? 0.55 : 0.38);
    const ry = radius * (kind === "seed" ? 0.48 : 0.34);
    const seed =
      kind === "seed"
        ? `<ellipse cx="${cx}" cy="${cy}" rx="${radius * 0.22}" ry="${radius * 0.18}" fill="${RUG_PALETTE.walnut}" opacity="0.35"/>`
        : "";
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" transform="rotate(${weaveNoise(row, col, 11) * 12} ${cx} ${cy})"/>${seed}`;
  }
  if (kind === "lozenge" || kind === "hook") {
    const hook =
      kind === "hook"
        ? `<path d="M${cx - radius * 0.2} ${cy + wobble} Q${cx + radius * 0.35} ${cy - radius * 0.65} ${cx + radius * 0.85} ${cy - radius * 0.05}" fill="none" stroke="${RUG_PALETTE.ochre}" stroke-width="${Math.max(1, cell * 0.08)}" stroke-linecap="round" opacity="0.55"/>`
        : "";
    return [
      `<path d="${pointsToSvg(diamondPoints(cx, cy, radius, wobble))}" fill="${fill}"/>`,
      `<path d="${pointsToSvg(diamondPoints(cx, cy, radius * 0.45, wobble * 0.5))}" fill="${tone === 1 ? RUG_PALETTE.indigoDeep : RUG_PALETTE.madderDeep}" opacity="0.45"/>`,
      hook,
    ].join("");
  }
  if (kind === "star") {
    return [
      `<path d="${pointsToSvg(starPoints(cx, cy, radius, radius * 0.45, 8, wobble / cell))}" fill="${fill}"/>`,
      `<path d="${pointsToSvg(diamondPoints(cx, cy, radius * 0.28, wobble))}" fill="${RUG_PALETTE.ivoryWarm}" opacity="0.4"/>`,
    ].join("");
  }
  return [
    `<path d="${pointsToSvg(diamondPoints(cx, cy, radius, wobble))}" fill="${fill}"/>`,
    `<path d="${pointsToSvg(diamondPoints(cx, cy, radius * 0.58, wobble * 0.6))}" fill="${RUG_PALETTE.ochre}" opacity="0.55"/>`,
    `<path d="${pointsToSvg(diamondPoints(cx, cy, radius * 0.3, wobble * 0.3))}" fill="${RUG_PALETTE.indigoDeep}" opacity="0.7"/>`,
  ].join("");
}

function rotateCubic(cx, cy, angle, x0, y0, cp1x, cp1y, cp2x, cp2y, x1, y1) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const map = (x, y) => [cx + x * cos - y * sin, cy + x * sin + y * cos];
  const p0 = map(x0, y0);
  const p1 = map(cp1x, cp1y);
  const p2 = map(cp2x, cp2y);
  const p3 = map(x1, y1);
  return cubicToSvg(p0[0], p0[1], p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
}

function wovenBandsSvg(layout) {
  const { originX, originY, field, border } = layout;
  const bands = [
    [0, border * 0.55, RUG_PALETTE.indigoDeep],
    [border * 0.45, border * 0.35, RUG_PALETTE.madderDeep],
    [border * 0.7, border * 0.28, RUG_PALETTE.walnut],
  ];
  return bands
    .map(([inset, thickness, color]) =>
      [
        `<rect x="${originX}" y="${originY + inset}" width="${field}" height="${thickness}" fill="${color}" opacity="0.9"/>`,
        `<rect x="${originX}" y="${originY + field - inset - thickness}" width="${field}" height="${thickness}" fill="${color}" opacity="0.9"/>`,
      ].join(""),
    )
    .join("");
}

export function qrRugToSvg(matrix, { fringe = 0.1, cellSize = 14 } = {}) {
  const size = matrix.length;
  if (!size) {
    return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"/>`;
  }
  const field = size * cellSize;
  const fringePx = Math.max(14, field * fringe);
  const edge = field + fringePx * 2;
  const layout = rugLayout(matrix, edge, edge, { fringe });
  const { originX, originY, border, cell, centerX, centerY } = layout;

  const mosaic = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const tone = mosaicTone(matrix, row, col);
      const { x, y } = cellCenter(layout, row, col);
      const bedR = cell * (0.48 + weaveNoise(row, col, 12) * 0.06);
      mosaic.push(
        `<path d="${pointsToSvg(diamondPoints(x, y, bedR, weaveNoise(row, col, 13) * cell * 0.1))}" fill="${toneSoft(tone)}" opacity="${tone === 0 ? 0.22 : 0.5}"/>`,
        motifSvg(motifKind(matrix, row, col), x, y, cell, tone, row, col),
      );
    }
  }

  const arabesques = [];
  for (const ring of [0.24, 0.4, 0.56]) {
    const length = field * ring * 0.4;
    const flare = cell * (2 + ring * 1.8);
    for (let petal = 0; petal < 8; petal += 1) {
      const angle = (petal / 8) * Math.PI * 2 + ring * 0.35;
      const sampleRow = Math.min(
        size - 1,
        Math.max(0, Math.round(size / 2 + Math.sin(angle) * size * ring * 0.45)),
      );
      const sampleCol = Math.min(
        size - 1,
        Math.max(0, Math.round(size / 2 + Math.cos(angle) * size * ring * 0.45)),
      );
      const tone = mosaicTone(matrix, sampleRow, sampleCol);
      if (tone === 0 && petal % 2 === 1) continue;
      const [x0, y0, cp1x, cp1y, cp2x, cp2y, x1, y1] = arabesquePetal(length, flare);
      const color = tone === 2 ? RUG_PALETTE.ochre : RUG_PALETTE.walnut;
      const width = Math.max(1.4, cell * (0.14 + tone * 0.05));
      const opacity = 0.28 + tone * 0.12;
      arabesques.push(
        `<path d="${rotateCubic(centerX, centerY, angle, x0, y0, cp1x, cp1y, cp2x, cp2y, x1, y1)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}"/>`,
        `<path d="${rotateCubic(centerX, centerY, angle, x0, y0, cp1x, -cp1y, cp2x, -cp2y, x1, -y1)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}"/>`,
      );
    }
  }

  const mid = Math.floor(size / 2);
  const medTone = mosaicTone(matrix, mid, mid);
  const medR = field * 0.17;
  const medallion = [
    `<ellipse cx="${centerX}" cy="${centerY}" rx="${medR * 1.1}" ry="${medR * 1.05}" fill="${RUG_PALETTE.indigoDeep}" opacity="0.85" transform="rotate(4.5 ${centerX} ${centerY})"/>`,
    `<path d="${pointsToSvg(starPoints(centerX, centerY, medR * 0.82, medR * 0.38, 10, 0.4))}" fill="${toneFill(Math.max(1, medTone))}" opacity="0.8"/>`,
    `<path d="${pointsToSvg(diamondPoints(centerX, centerY, medR * 0.32, cell * 0.15))}" fill="${RUG_PALETTE.ivoryWarm}" opacity="0.65"/>`,
    `<path d="${pointsToSvg(diamondPoints(centerX, centerY, medR * 0.16, cell * 0.08))}" fill="${RUG_PALETTE.madder}" opacity="0.75"/>`,
  ];
  for (let petal = 0; petal < 8; petal += 1) {
    const angle = (petal / 8) * Math.PI * 2;
    const [x0, y0, cp1x, cp1y, cp2x, cp2y, x1, y1] = arabesquePetal(
      medR * 0.9,
      cell * 1.5,
    );
    medallion.push(
      `<path d="${rotateCubic(centerX, centerY, angle, x0 + medR * 0.18, y0, cp1x, cp1y, cp2x, cp2y, x1, y1)}" fill="none" stroke="${RUG_PALETTE.ochre}" stroke-width="${Math.max(1, cell * 0.11)}" stroke-linecap="round" opacity="0.4"/>`,
    );
  }

  const corners = [
    [originX + border + cell * 1.4, originY + border + cell * 1.4, 1, 1],
    [originX + field - border - cell * 1.4, originY + border + cell * 1.4, 1, size - 2],
    [originX + border + cell * 1.4, originY + field - border - cell * 1.4, size - 2, 1],
    [
      originX + field - border - cell * 1.4,
      originY + field - border - cell * 1.4,
      size - 2,
      size - 2,
    ],
  ].map(([x, y, row, col]) =>
    motifSvg("gül", x, y, cell * 1.7, Math.max(1, mosaicTone(matrix, row, col)), row, col),
  );

  const latches = endLatches(layout).map((latch) => {
    const tone = mosaicTone(matrix, latch.row, latch.col);
    const dir = latch.side === "top" ? 1 : -1;
    return [
      `<path d="${pointsToSvg(diamondPoints(latch.x, latch.y, cell * 0.26, cell * 0.04))}" fill="${toneFill(Math.max(1, tone))}" opacity="0.7"/>`,
      `<path d="M${latch.x - cell * 0.32} ${latch.y} Q${latch.x} ${latch.y + dir * cell * 0.32} ${latch.x + cell * 0.32} ${latch.y}" fill="none" stroke="${RUG_PALETTE.ochre}" stroke-width="${Math.max(0.8, cell * 0.06)}" stroke-linecap="round" opacity="0.4"/>`,
    ].join("");
  });

  const tassels = fringeSpecs(layout, matrix).map((tassel) => {
    const cpx = (tassel.x0 + tassel.x1) / 2 + tassel.width * 0.6;
    const cpy = (tassel.y0 + tassel.y1) / 2;
    return `<path d="M${tassel.x0} ${tassel.y0} Q${cpx} ${cpy} ${tassel.x1} ${tassel.y1}" fill="none" stroke="${tassel.color}" stroke-width="${tassel.width}" stroke-linecap="round" opacity="0.85"/>`;
  });

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${edge}" height="${edge}" viewBox="0 0 ${edge} ${edge}">`,
    `<defs><radialGradient id="rug-pile" cx="50%" cy="50%" r="72%"><stop offset="0%" stop-color="${RUG_PALETTE.madderSoft}"/><stop offset="45%" stop-color="${RUG_PALETTE.madder}"/><stop offset="100%" stop-color="${RUG_PALETTE.madderDeep}"/></radialGradient></defs>`,
    `<rect width="${edge}" height="${edge}" fill="${RUG_PALETTE.stage}"/>`,
    `<rect x="${originX}" y="${originY}" width="${field}" height="${field}" fill="url(#rug-pile)"/>`,
    wovenBandsSvg(layout),
    `<rect x="${originX + border}" y="${originY + border}" width="${field - border * 2}" height="${field - border * 2}" fill="${RUG_PALETTE.madderDeep}" opacity="0.55"/>`,
    `<g>${mosaic.join("")}</g>`,
    `<g>${arabesques.join("")}</g>`,
    `<g>${medallion.join("")}</g>`,
    `<g>${corners.join("")}</g>`,
    `<g>${latches.join("")}</g>`,
    `<g>${tassels.join("")}</g>`,
    `</svg>`,
  ].join("");
}

export { landToSvg } from "./land.js";
export { petriToSvg } from "./petri.js";

export function downloadSvg(svg, filename) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function vizSvgFilename(kind, payload) {
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(/[:.]/gu, "");
  const hint = String(payload || "")
    .replaceAll(/[^A-Za-z0-9._-]+/gu, "")
    .slice(0, 24);
  return `morse-${kind}-${hint || "viz"}-${stamp}.svg`;
}
