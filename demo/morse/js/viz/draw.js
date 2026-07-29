/**
 * Canvas renderers for QR modules, Go-board, rug, landscape, and petri styles.
 */

import {
  RUG_PALETTE,
  arabesquePetal,
  cellCenter,
  diamondPoints,
  endLatches,
  fringeSpecs,
  mosaicTone,
  motifKind,
  rugLayout,
  starPoints,
  toneFill,
  toneSoft,
  weaveNoise,
} from "./rug.js";
import { paintLand } from "./land.js";
import { paintPetri } from "./petri.js";

export function clearCanvas(canvas) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
}

export function drawQrModules(canvas, matrix, { quiet = 4 } = {}) {
  const context = canvas.getContext("2d");
  const modules = matrix.length + quiet * 2;
  const scale = Math.max(2, Math.floor(Math.min(canvas.width, canvas.height) / modules));
  const drawn = modules * scale;
  const offsetX = Math.floor((canvas.width - drawn) / 2);
  const offsetY = Math.floor((canvas.height - drawn) / 2);

  context.fillStyle = "#f4f7f2";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#0b100f";
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix.length; col += 1) {
      if (!matrix[row][col]) continue;
      context.fillRect(
        offsetX + (col + quiet) * scale,
        offsetY + (row + quiet) * scale,
        scale,
        scale,
      );
    }
  }
}

export function drawGoBoard(canvas, matrix, { margin = 1 } = {}) {
  const context = canvas.getContext("2d");
  const size = matrix.length;
  const cells = size + margin * 2;
  const span = Math.min(canvas.width, canvas.height);
  const cell = span / cells;
  const originX = (canvas.width - span) / 2 + margin * cell;
  const originY = (canvas.height - span) / 2 + margin * cell;

  context.fillStyle = "#0b100f";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const board = span - margin * cell * 0.2;
  const boardX = (canvas.width - board) / 2;
  const boardY = (canvas.height - board) / 2;
  const wood = context.createLinearGradient(boardX, boardY, boardX + board, boardY + board);
  wood.addColorStop(0, "#c4a574");
  wood.addColorStop(0.45, "#b08955");
  wood.addColorStop(1, "#8d6a3e");
  context.fillStyle = wood;
  context.fillRect(boardX, boardY, board, board);

  context.strokeStyle = "rgba(40, 28, 12, 0.55)";
  context.lineWidth = Math.max(1, cell * 0.06);
  for (let index = 0; index < size; index += 1) {
    const x = originX + index * cell + cell / 2;
    const y = originY + index * cell + cell / 2;
    context.beginPath();
    context.moveTo(originX + cell / 2, y);
    context.lineTo(originX + (size - 1) * cell + cell / 2, y);
    context.stroke();
    context.beginPath();
    context.moveTo(x, originY + cell / 2);
    context.lineTo(x, originY + (size - 1) * cell + cell / 2);
    context.stroke();
  }

  const radius = cell * 0.42;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const black = Boolean(matrix[row][col]);
      const x = originX + col * cell + cell / 2;
      const y = originY + row * cell + cell / 2;
      drawStone(context, x, y, radius, black ? "black" : "white");
    }
  }
}

function drawStone(context, x, y, radius, color) {
  const shade = context.createRadialGradient(
    x - radius * 0.3,
    y - radius * 0.35,
    radius * 0.08,
    x,
    y,
    radius,
  );
  if (color === "black") {
    shade.addColorStop(0, "#3a3a3a");
    shade.addColorStop(0.55, "#141414");
    shade.addColorStop(1, "#050505");
  } else {
    shade.addColorStop(0, "#ffffff");
    shade.addColorStop(0.45, "#f0f0f0");
    shade.addColorStop(1, "#c8c8c8");
  }
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = shade;
  context.fill();
  if (color === "white") {
    context.strokeStyle = "rgba(40, 28, 12, 0.35)";
    context.lineWidth = Math.max(1, radius * 0.08);
    context.stroke();
  }
}

function fillPolygon(context, points) {
  if (!points.length) return;
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index][0], points[index][1]);
  }
  context.closePath();
  context.fill();
}

function drawMotif(context, kind, cx, cy, cell, tone, row = 0, col = 0) {
  const wobble = weaveNoise(row, col, 9) * cell * 0.12;
  const radius = cell * (tone === 0 ? 0.3 : 0.4) * (1 + weaveNoise(row, col, 10) * 0.08);
  context.fillStyle = toneSoft(tone);

  if (kind === "dot" || kind === "seed") {
    context.beginPath();
    context.ellipse(
      cx,
      cy,
      radius * (kind === "seed" ? 0.55 : 0.38),
      radius * (kind === "seed" ? 0.48 : 0.34),
      weaveNoise(row, col, 11) * 0.4,
      0,
      Math.PI * 2,
    );
    context.fill();
    if (kind === "seed") {
      context.globalAlpha = 0.35;
      context.fillStyle = RUG_PALETTE.walnut;
      context.beginPath();
      context.ellipse(cx, cy, radius * 0.22, radius * 0.18, 0.2, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
    return;
  }

  if (kind === "lozenge" || kind === "hook") {
    fillPolygon(context, diamondPoints(cx, cy, radius, wobble));
    context.globalAlpha = 0.45;
    context.fillStyle = tone === 1 ? RUG_PALETTE.indigoDeep : RUG_PALETTE.madderDeep;
    fillPolygon(context, diamondPoints(cx, cy, radius * 0.45, wobble * 0.5));
    context.globalAlpha = 1;
    if (kind === "hook") {
      context.strokeStyle = RUG_PALETTE.ochre;
      context.globalAlpha = 0.55;
      context.lineWidth = Math.max(1, cell * 0.08);
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(cx - radius * 0.2, cy + wobble);
      context.quadraticCurveTo(
        cx + radius * 0.35,
        cy - radius * 0.65,
        cx + radius * 0.85,
        cy - radius * 0.05,
      );
      context.stroke();
      context.globalAlpha = 1;
    }
    return;
  }

  if (kind === "star") {
    fillPolygon(context, starPoints(cx, cy, radius, radius * 0.45, 8, wobble / cell));
    context.globalAlpha = 0.4;
    context.fillStyle = RUG_PALETTE.ivoryWarm;
    fillPolygon(context, diamondPoints(cx, cy, radius * 0.28, wobble));
    context.globalAlpha = 1;
    return;
  }

  // gül — soft nested diamonds (hand-knot feel)
  fillPolygon(context, diamondPoints(cx, cy, radius, wobble));
  context.fillStyle = RUG_PALETTE.ochre;
  context.globalAlpha = 0.55;
  fillPolygon(context, diamondPoints(cx, cy, radius * 0.58, wobble * 0.6));
  context.fillStyle = RUG_PALETTE.indigoDeep;
  context.globalAlpha = 0.7;
  fillPolygon(context, diamondPoints(cx, cy, radius * 0.3, wobble * 0.3));
  context.globalAlpha = 1;
}

function drawArabesqueLayer(context, matrix, layout) {
  const { size, cell, centerX, centerY } = layout;
  context.lineCap = "round";
  context.lineJoin = "round";

  for (const ring of [0.24, 0.4, 0.56]) {
    const length = layout.field * ring * 0.4;
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
      context.save();
      context.translate(centerX, centerY);
      context.rotate(angle);
      context.strokeStyle = tone === 2 ? RUG_PALETTE.ochre : RUG_PALETTE.walnut;
      context.globalAlpha = 0.28 + tone * 0.12;
      context.lineWidth = Math.max(1.4, cell * (0.14 + tone * 0.05));
      context.beginPath();
      context.moveTo(x0, y0);
      context.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x1, y1);
      context.stroke();
      context.beginPath();
      context.moveTo(x0, y0);
      context.bezierCurveTo(cp1x, -cp1y, cp2x, -cp2y, x1, -y1);
      context.stroke();
      context.restore();
    }
  }
  context.globalAlpha = 1;
}

function drawMedallion(context, matrix, layout) {
  const { size, cell, centerX, centerY, field } = layout;
  const radius = field * 0.17;
  const mid = Math.floor(size / 2);
  const tone = mosaicTone(matrix, mid, mid);
  const wobble = cell * 0.15;

  context.fillStyle = RUG_PALETTE.indigoDeep;
  context.globalAlpha = 0.85;
  context.beginPath();
  context.ellipse(centerX, centerY, radius * 1.1, radius * 1.05, 0.08, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  context.fillStyle = toneFill(Math.max(1, tone));
  context.globalAlpha = 0.8;
  fillPolygon(
    context,
    starPoints(centerX, centerY, radius * 0.82, radius * 0.38, 10, 0.4),
  );
  context.fillStyle = RUG_PALETTE.ivoryWarm;
  context.globalAlpha = 0.65;
  fillPolygon(context, diamondPoints(centerX, centerY, radius * 0.32, wobble));
  context.fillStyle = RUG_PALETTE.madder;
  context.globalAlpha = 0.75;
  fillPolygon(context, diamondPoints(centerX, centerY, radius * 0.16, wobble * 0.5));
  context.globalAlpha = 1;

  for (let petal = 0; petal < 8; petal += 1) {
    const angle = (petal / 8) * Math.PI * 2;
    const [x0, y0, cp1x, cp1y, cp2x, cp2y, x1, y1] = arabesquePetal(
      radius * 0.9,
      cell * 1.5,
    );
    context.save();
    context.translate(centerX, centerY);
    context.rotate(angle);
    context.strokeStyle = RUG_PALETTE.ochre;
    context.lineWidth = Math.max(1, cell * 0.11);
    context.globalAlpha = 0.4;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(x0 + radius * 0.18, y0);
    context.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x1, y1);
    context.stroke();
    context.restore();
  }
  context.globalAlpha = 1;
}

function drawCornerGuls(context, matrix, layout) {
  const { size, cell, originX, originY, field, border } = layout;
  const inset = border + cell * 1.4;
  const spots = [
    [originX + inset, originY + inset, 1, 1],
    [originX + field - inset, originY + inset, 1, size - 2],
    [originX + inset, originY + field - inset, size - 2, 1],
    [originX + field - inset, originY + field - inset, size - 2, size - 2],
  ];
  for (const [x, y, row, col] of spots) {
    const tone = Math.max(1, mosaicTone(matrix, row, col));
    drawMotif(context, "gül", x, y, cell * 1.7, tone, row, col);
  }
}

/** Filled end-guard bands on warp ends only (top/bottom). No side rules. */
function drawWovenBands(context, layout) {
  const { originX, originY, field, border } = layout;
  const bands = [
    [0, border * 0.55, RUG_PALETTE.indigoDeep],
    [border * 0.45, border * 0.35, RUG_PALETTE.madderDeep],
    [border * 0.7, border * 0.28, RUG_PALETTE.walnut],
  ];
  for (const [inset, thickness, color] of bands) {
    context.fillStyle = color;
    context.globalAlpha = 0.9;
    context.fillRect(originX, originY + inset, field, thickness);
    context.fillRect(
      originX,
      originY + field - inset - thickness,
      field,
      thickness,
    );
  }
  context.globalAlpha = 1;
}

/**
 * Vintage handwoven Turkish rug: soft madder/indigo pile, irregular motifs, end fringe.
 * QR modules drive tone/motif. No outer side rules — textile body only.
 */
export function drawQrRug(canvas, matrix, { fringe = 0.1 } = {}) {
  const context = canvas.getContext("2d");
  const size = matrix.length;
  if (!size) {
    clearCanvas(canvas);
    return;
  }

  const layout = rugLayout(matrix, canvas.width, canvas.height, { fringe });
  const { originX, originY, field, cell, border } = layout;

  context.fillStyle = RUG_PALETTE.stage;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const pile = context.createRadialGradient(
    layout.centerX,
    layout.centerY,
    field * 0.1,
    layout.centerX,
    layout.centerY,
    field * 0.72,
  );
  pile.addColorStop(0, RUG_PALETTE.madderSoft);
  pile.addColorStop(0.45, RUG_PALETTE.madder);
  pile.addColorStop(1, RUG_PALETTE.madderDeep);
  context.fillStyle = pile;
  context.fillRect(originX, originY, field, field);

  drawWovenBands(context, layout);

  context.fillStyle = RUG_PALETTE.madderDeep;
  context.globalAlpha = 0.55;
  context.fillRect(
    originX + border,
    originY + border,
    field - border * 2,
    field - border * 2,
  );
  context.globalAlpha = 1;

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const tone = mosaicTone(matrix, row, col);
      const { x, y } = cellCenter(layout, row, col);
      const kind = motifKind(matrix, row, col);
      const bedR = cell * (0.48 + weaveNoise(row, col, 12) * 0.06);
      context.fillStyle = toneSoft(tone);
      context.globalAlpha = tone === 0 ? 0.22 : 0.5;
      fillPolygon(
        context,
        diamondPoints(x, y, bedR, weaveNoise(row, col, 13) * cell * 0.1),
      );
      context.globalAlpha = 1;
      drawMotif(context, kind, x, y, cell, tone, row, col);
    }
  }

  drawArabesqueLayer(context, matrix, layout);
  drawMedallion(context, matrix, layout);
  drawCornerGuls(context, matrix, layout);

  // End-guard latch hooks only (woven into top/bottom borders)
  for (const latch of endLatches(layout)) {
    const tone = mosaicTone(matrix, latch.row, latch.col);
    context.fillStyle = toneFill(Math.max(1, tone));
    context.globalAlpha = 0.7;
    fillPolygon(
      context,
      diamondPoints(latch.x, latch.y, cell * 0.26, cell * 0.04),
    );
    context.strokeStyle = RUG_PALETTE.ochre;
    context.globalAlpha = 0.4;
    context.lineWidth = Math.max(0.8, cell * 0.06);
    context.lineCap = "round";
    context.beginPath();
    const dir = latch.side === "top" ? 1 : -1;
    context.moveTo(latch.x - cell * 0.32, latch.y);
    context.quadraticCurveTo(latch.x, latch.y + dir * cell * 0.32, latch.x + cell * 0.32, latch.y);
    context.stroke();
    context.globalAlpha = 1;
  }

  context.lineCap = "round";
  for (const tassel of fringeSpecs(layout, matrix)) {
    context.strokeStyle = tassel.color;
    context.globalAlpha = 0.85;
    context.lineWidth = tassel.width;
    context.beginPath();
    context.moveTo(tassel.x0, tassel.y0);
    context.quadraticCurveTo(
      (tassel.x0 + tassel.x1) / 2 + tassel.width * 0.6,
      (tassel.y0 + tassel.y1) / 2,
      tassel.x1,
      tassel.y1,
    );
    context.stroke();
  }
  context.globalAlpha = 1;
}

export function drawQrLand(canvas, matrix) {
  paintLand(canvas.getContext("2d"), canvas.width, canvas.height, matrix);
}

export function drawQrPetri(canvas, matrix) {
  paintPetri(canvas.getContext("2d"), canvas.width, canvas.height, matrix);
}
