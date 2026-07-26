/**
 * Vector export for QR modules and Go-board rendering of the same matrix.
 */

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
