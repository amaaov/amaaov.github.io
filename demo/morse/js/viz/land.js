/**
 * Landscape QR visualization: hills, ridges, trees, and rocks driven by modules.
 */

export const LAND_PALETTE = {
  stage: "#070b0a",
  skyTop: "#1a2e28",
  skyMid: "#243d34",
  skyHorizon: "#3a5648",
  farRidge: "#2a4036",
  midHill: "#3d5a42",
  nearHill: "#4a6b48",
  field: "#5c7a4e",
  fieldLight: "#6e8f5c",
  rock: "#5a564c",
  rockLite: "#7a7466",
  tree: "#2d4530",
  treeCanopy: "#3f6a3e",
  trunk: "#4a3a2a",
  snow: "#c5d4c0",
  mist: "rgba(180, 210, 190, 0.12)",
};

function noise(row, col, salt = 0) {
  const n =
    Math.sin((row + 1) * 12.9898 + (col + 1) * 78.233 + salt * 41.17) *
    43758.5453;
  return n - Math.floor(n);
}

function dark(matrix, row, col) {
  const size = matrix?.length || 0;
  if (row < 0 || col < 0 || row >= size || col >= size) return false;
  return Boolean(matrix[row][col]);
}

function neighborCount(matrix, row, col) {
  let count = 0;
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (!dr && !dc) continue;
      if (dark(matrix, row + dr, col + dc)) count += 1;
    }
  }
  return count;
}

/** Feature class for a dark module — varies the landscape silhouette. */
export function landFeature(matrix, row, col) {
  if (!dark(matrix, row, col)) {
    return neighborCount(matrix, row, col) >= 3 ? "meadow" : "clear";
  }
  const n = neighborCount(matrix, row, col);
  const roll = noise(row, col, 1);
  if (n >= 5 || roll < 0.18) return "mountain";
  if (n >= 3 || roll < 0.4) return "hill";
  if (roll < 0.62) return "tree";
  if (roll < 0.82) return "rock";
  return "ridge";
}

export function landLayout(matrix, width, height) {
  const size = matrix.length;
  const span = Math.min(width, height);
  const pad = span * 0.04;
  const field = span - pad * 2;
  const cell = field / size;
  const originX = (width - field) / 2;
  const originY = (height - field) / 2;
  return { size, span, pad, field, cell, originX, originY };
}

function cellXY(layout, row, col) {
  return {
    x: layout.originX + (col + 0.5) * layout.cell,
    y: layout.originY + (row + 0.5) * layout.cell,
  };
}

function fillPoly(context, points) {
  if (!points.length) return;
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    context.lineTo(points[i][0], points[i][1]);
  }
  context.closePath();
  context.fill();
}

function drawSky(context, layout) {
  const { originX, originY, field } = layout;
  const sky = context.createLinearGradient(0, originY, 0, originY + field);
  sky.addColorStop(0, LAND_PALETTE.skyTop);
  sky.addColorStop(0.55, LAND_PALETTE.skyMid);
  sky.addColorStop(1, LAND_PALETTE.skyHorizon);
  context.fillStyle = sky;
  context.fillRect(originX, originY, field, field);
}

function drawMountain(context, x, y, cell, tint) {
  const h = cell * (1.1 + tint * 0.4);
  const w = cell * 0.95;
  context.fillStyle = LAND_PALETTE.farRidge;
  fillPoly(context, [
    [x, y - h * 0.55],
    [x + w * 0.55, y + h * 0.35],
    [x - w * 0.55, y + h * 0.35],
  ]);
  context.fillStyle = LAND_PALETTE.snow;
  context.globalAlpha = 0.35;
  fillPoly(context, [
    [x, y - h * 0.55],
    [x + w * 0.18, y - h * 0.2],
    [x - w * 0.12, y - h * 0.15],
  ]);
  context.globalAlpha = 1;
}

function drawHill(context, x, y, cell, near) {
  const rx = cell * (0.55 + near * 0.15);
  const ry = cell * (0.32 + near * 0.1);
  context.fillStyle = near ? LAND_PALETTE.nearHill : LAND_PALETTE.midHill;
  context.beginPath();
  context.ellipse(x, y + cell * 0.1, rx, ry, 0, Math.PI, 0, true);
  context.fill();
}

function drawTree(context, x, y, cell) {
  const h = cell * 0.7;
  context.fillStyle = LAND_PALETTE.trunk;
  context.fillRect(x - cell * 0.05, y - h * 0.1, cell * 0.1, h * 0.45);
  context.fillStyle = LAND_PALETTE.treeCanopy;
  context.beginPath();
  context.moveTo(x, y - h * 0.75);
  context.lineTo(x + cell * 0.32, y - h * 0.05);
  context.lineTo(x - cell * 0.32, y - h * 0.05);
  context.closePath();
  context.fill();
  context.fillStyle = LAND_PALETTE.tree;
  context.beginPath();
  context.moveTo(x, y - h * 0.95);
  context.lineTo(x + cell * 0.22, y - h * 0.35);
  context.lineTo(x - cell * 0.22, y - h * 0.35);
  context.closePath();
  context.fill();
}

function drawRock(context, x, y, cell) {
  context.fillStyle = LAND_PALETTE.rock;
  context.beginPath();
  context.ellipse(x, y + cell * 0.08, cell * 0.28, cell * 0.18, -0.2, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = LAND_PALETTE.rockLite;
  context.globalAlpha = 0.45;
  context.beginPath();
  context.ellipse(x - cell * 0.05, y, cell * 0.12, cell * 0.08, 0.3, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
}

function drawRidge(context, x, y, cell) {
  context.strokeStyle = LAND_PALETTE.midHill;
  context.lineWidth = Math.max(1.2, cell * 0.12);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(x - cell * 0.4, y + cell * 0.1);
  context.quadraticCurveTo(x, y - cell * 0.25, x + cell * 0.4, y + cell * 0.05);
  context.stroke();
}

function drawMeadow(context, x, y, cell) {
  context.fillStyle = LAND_PALETTE.fieldLight;
  context.globalAlpha = 0.35;
  context.beginPath();
  context.ellipse(x, y + cell * 0.12, cell * 0.4, cell * 0.18, 0, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
}

/**
 * Paint a QR-derived landscape onto a canvas context.
 */
export function paintLand(context, width, height, matrix) {
  const size = matrix?.length || 0;
  if (!size) {
    context.clearRect(0, 0, width, height);
    return;
  }
  const layout = landLayout(matrix, width, height);
  context.fillStyle = LAND_PALETTE.stage;
  context.fillRect(0, 0, width, height);
  drawSky(context, layout);

  // Soft mist band near horizon (upper third)
  context.fillStyle = LAND_PALETTE.mist;
  context.fillRect(
    layout.originX,
    layout.originY + layout.field * 0.28,
    layout.field,
    layout.field * 0.18,
  );

  // Ground wash in lower field
  const ground = context.createLinearGradient(
    0,
    layout.originY + layout.field * 0.45,
    0,
    layout.originY + layout.field,
  );
  ground.addColorStop(0, "rgba(74,107,72,0.25)");
  ground.addColorStop(1, "rgba(61,90,66,0.55)");
  context.fillStyle = ground;
  context.fillRect(
    layout.originX,
    layout.originY + layout.field * 0.45,
    layout.field,
    layout.field * 0.55,
  );

  // Draw back-to-front (top rows first) so foreground overlaps
  for (let row = 0; row < size; row += 1) {
    const depth = row / Math.max(1, size - 1);
    for (let col = 0; col < size; col += 1) {
      const feature = landFeature(matrix, row, col);
      if (feature === "clear") continue;
      const { x, y } = cellXY(layout, row, col);
      const cell = layout.cell * (0.85 + depth * 0.25);
      if (feature === "mountain") drawMountain(context, x, y, cell, 1 - depth);
      else if (feature === "hill") drawHill(context, x, y, cell, depth > 0.55);
      else if (feature === "tree") drawTree(context, x, y, cell);
      else if (feature === "rock") drawRock(context, x, y, cell);
      else if (feature === "ridge") drawRidge(context, x, y, cell);
      else if (feature === "meadow") drawMeadow(context, x, y, cell);
    }
  }
}

function polySvg(points, fill) {
  const d =
    points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ") + " Z";
  return `<path d="${d}" fill="${fill}"/>`;
}

export function landToSvg(matrix, { cellSize = 14 } = {}) {
  const size = matrix?.length || 0;
  if (!size) {
    return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"/>`;
  }
  const field = size * cellSize;
  const edge = field;
  const layout = landLayout(matrix, edge, edge);
  const parts = [];

  parts.push(
    `<defs><linearGradient id="land-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${LAND_PALETTE.skyTop}"/><stop offset="55%" stop-color="${LAND_PALETTE.skyMid}"/><stop offset="100%" stop-color="${LAND_PALETTE.skyHorizon}"/></linearGradient><linearGradient id="land-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(74,107,72,0.25)"/><stop offset="100%" stop-color="rgba(61,90,66,0.55)"/></linearGradient></defs>`,
  );
  parts.push(`<rect width="${edge}" height="${edge}" fill="${LAND_PALETTE.stage}"/>`);
  parts.push(
    `<rect x="${layout.originX}" y="${layout.originY}" width="${field}" height="${field}" fill="url(#land-sky)"/>`,
  );
  parts.push(
    `<rect x="${layout.originX}" y="${layout.originY + field * 0.28}" width="${field}" height="${field * 0.18}" fill="${LAND_PALETTE.mist}"/>`,
  );
  parts.push(
    `<rect x="${layout.originX}" y="${layout.originY + field * 0.45}" width="${field}" height="${field * 0.55}" fill="url(#land-ground)"/>`,
  );

  for (let row = 0; row < size; row += 1) {
    const depth = row / Math.max(1, size - 1);
    for (let col = 0; col < size; col += 1) {
      const feature = landFeature(matrix, row, col);
      if (feature === "clear") continue;
      const { x, y } = cellXY(layout, row, col);
      const cell = layout.cell * (0.85 + depth * 0.25);
      if (feature === "mountain") {
        const h = cell * 1.3;
        const w = cell * 0.95;
        parts.push(
          polySvg(
            [
              [x, y - h * 0.55],
              [x + w * 0.55, y + h * 0.35],
              [x - w * 0.55, y + h * 0.35],
            ],
            LAND_PALETTE.farRidge,
          ),
        );
        parts.push(
          polySvg(
            [
              [x, y - h * 0.55],
              [x + w * 0.18, y - h * 0.2],
              [x - w * 0.12, y - h * 0.15],
            ],
            LAND_PALETTE.snow,
          ).replace("/>", ' opacity="0.35"/>'),
        );
      } else if (feature === "hill") {
        const rx = cell * (0.55 + (depth > 0.55 ? 0.15 : 0));
        const ry = cell * (0.32 + (depth > 0.55 ? 0.1 : 0));
        const fill = depth > 0.55 ? LAND_PALETTE.nearHill : LAND_PALETTE.midHill;
        parts.push(
          `<ellipse cx="${x}" cy="${y + cell * 0.1}" rx="${rx}" ry="${ry}" fill="${fill}"/>`,
        );
      } else if (feature === "tree") {
        const h = cell * 0.7;
        parts.push(
          `<rect x="${x - cell * 0.05}" y="${y - h * 0.1}" width="${cell * 0.1}" height="${h * 0.45}" fill="${LAND_PALETTE.trunk}"/>`,
          polySvg(
            [
              [x, y - h * 0.75],
              [x + cell * 0.32, y - h * 0.05],
              [x - cell * 0.32, y - h * 0.05],
            ],
            LAND_PALETTE.treeCanopy,
          ),
          polySvg(
            [
              [x, y - h * 0.95],
              [x + cell * 0.22, y - h * 0.35],
              [x - cell * 0.22, y - h * 0.35],
            ],
            LAND_PALETTE.tree,
          ),
        );
      } else if (feature === "rock") {
        parts.push(
          `<ellipse cx="${x}" cy="${y + cell * 0.08}" rx="${cell * 0.28}" ry="${cell * 0.18}" fill="${LAND_PALETTE.rock}" transform="rotate(-11 ${x} ${y})"/>`,
        );
      } else if (feature === "ridge") {
        parts.push(
          `<path d="M${x - cell * 0.4} ${y + cell * 0.1} Q${x} ${y - cell * 0.25} ${x + cell * 0.4} ${y + cell * 0.05}" fill="none" stroke="${LAND_PALETTE.midHill}" stroke-width="${Math.max(1.2, cell * 0.12)}" stroke-linecap="round"/>`,
        );
      } else if (feature === "meadow") {
        parts.push(
          `<ellipse cx="${x}" cy="${y + cell * 0.12}" rx="${cell * 0.4}" ry="${cell * 0.18}" fill="${LAND_PALETTE.fieldLight}" opacity="0.35"/>`,
        );
      }
    }
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${edge}" height="${edge}" viewBox="0 0 ${edge} ${edge}">`,
    ...parts,
    `</svg>`,
  ].join("");
}

export function landAscii(matrix) {
  const size = matrix?.length || 0;
  if (!size) return "";
  const glyphs = {
    mountain: "▲",
    hill: "◠",
    tree: "↟",
    rock: "◉",
    ridge: "⌢",
    meadow: "░",
    clear: "·",
  };
  return matrix
    .map((row, r) =>
      row.map((_, c) => glyphs[landFeature(matrix, r, c)] || "·").join(""),
    )
    .join("\n");
}
