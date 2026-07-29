/**
 * Petri-dish QR visualization: agar, mycelium threads, bacterial colonies.
 */

export const PETRI_PALETTE = {
  stage: "#070b0a",
  dish: "#1c2420",
  rim: "#8aa090",
  rimInner: "#c5d4c4",
  agar: "#d8c48a",
  agarDeep: "#c4ae6e",
  agarShine: "rgba(255, 250, 230, 0.18)",
  mycelium: "#6b5a3e",
  myceliumLite: "#8a7654",
  colony: "#2a3528",
  colonyMid: "#3d4f38",
  colonyLite: "#5a6e4e",
  spore: "#4a3a28",
  glass: "rgba(200, 220, 210, 0.08)",
};

function noise(row, col, salt = 0) {
  const n =
    Math.sin((row + 1) * 19.123 + (col + 1) * 47.891 + salt * 29.7) * 43758.5453;
  return n - Math.floor(n);
}

function dark(matrix, row, col) {
  const size = matrix?.length || 0;
  if (row < 0 || col < 0 || row >= size || col >= size) return false;
  return Boolean(matrix[row][col]);
}

export function petriLayout(matrix, width, height) {
  const size = matrix.length;
  const span = Math.min(width, height);
  const radius = span * 0.46;
  const cx = width / 2;
  const cy = height / 2;
  const grid = radius * 1.55;
  const cell = grid / size;
  const originX = cx - grid / 2;
  const originY = cy - grid / 2;
  return { size, span, radius, cx, cy, grid, cell, originX, originY };
}

function cellXY(layout, row, col) {
  const jx = (noise(row, col, 2) - 0.5) * layout.cell * 0.2;
  const jy = (noise(row, col, 3) - 0.5) * layout.cell * 0.2;
  return {
    x: layout.originX + (col + 0.5) * layout.cell + jx,
    y: layout.originY + (row + 0.5) * layout.cell + jy,
  };
}

function insideDish(layout, x, y) {
  const dx = x - layout.cx;
  const dy = y - layout.cy;
  return dx * dx + dy * dy <= layout.radius * layout.radius * 0.92;
}

function colonyStyle(matrix, row, col) {
  if (!dark(matrix, row, col)) return "sparse";
  const roll = noise(row, col, 4);
  if (roll < 0.35) return "dense";
  if (roll < 0.7) return "blob";
  return "spore";
}

function drawDish(context, layout) {
  const { cx, cy, radius } = layout;
  context.fillStyle = PETRI_PALETTE.dish;
  context.beginPath();
  context.arc(cx, cy, radius * 1.06, 0, Math.PI * 2);
  context.fill();

  const agar = context.createRadialGradient(cx - radius * 0.2, cy - radius * 0.25, radius * 0.1, cx, cy, radius);
  agar.addColorStop(0, PETRI_PALETTE.agar);
  agar.addColorStop(0.7, PETRI_PALETTE.agarDeep);
  agar.addColorStop(1, "#b39a5c");
  context.fillStyle = agar;
  context.beginPath();
  context.arc(cx, cy, radius * 0.96, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = PETRI_PALETTE.rim;
  context.lineWidth = Math.max(3, radius * 0.045);
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = PETRI_PALETTE.rimInner;
  context.globalAlpha = 0.45;
  context.lineWidth = Math.max(1.5, radius * 0.018);
  context.beginPath();
  context.arc(cx, cy, radius * 0.93, 0, Math.PI * 2);
  context.stroke();
  context.globalAlpha = 1;

  // Glass highlight arc
  context.strokeStyle = PETRI_PALETTE.agarShine;
  context.lineWidth = Math.max(2, radius * 0.03);
  context.lineCap = "round";
  context.beginPath();
  context.arc(cx, cy, radius * 0.88, -2.4, -1.1);
  context.stroke();
}

function drawHypha(context, x0, y0, x1, y1, cell) {
  const mx = (x0 + x1) / 2 + (noise(x0 | 0, y0 | 0, 5) - 0.5) * cell * 0.8;
  const my = (y0 + y1) / 2 + (noise(x1 | 0, y1 | 0, 6) - 0.5) * cell * 0.8;
  context.strokeStyle = PETRI_PALETTE.mycelium;
  context.globalAlpha = 0.45;
  context.lineWidth = Math.max(0.7, cell * 0.06);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(x0, y0);
  context.quadraticCurveTo(mx, my, x1, y1);
  context.stroke();
  context.strokeStyle = PETRI_PALETTE.myceliumLite;
  context.globalAlpha = 0.25;
  context.lineWidth = Math.max(0.5, cell * 0.035);
  context.beginPath();
  context.moveTo(x0, y0);
  context.quadraticCurveTo(mx + cell * 0.1, my - cell * 0.1, x1, y1);
  context.stroke();
  context.globalAlpha = 1;
}

function drawColony(context, x, y, cell, style) {
  if (style === "sparse") {
    context.fillStyle = PETRI_PALETTE.myceliumLite;
    context.globalAlpha = 0.2;
    context.beginPath();
    context.arc(x, y, cell * 0.12, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    return;
  }
  if (style === "spore") {
    context.fillStyle = PETRI_PALETTE.spore;
    context.globalAlpha = 0.75;
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2;
      context.beginPath();
      context.arc(
        x + Math.cos(a) * cell * 0.12,
        y + Math.sin(a) * cell * 0.12,
        cell * 0.1,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    context.globalAlpha = 1;
    return;
  }
  const r = cell * (style === "dense" ? 0.42 : 0.32);
  context.fillStyle = PETRI_PALETTE.colony;
  context.beginPath();
  context.ellipse(x, y, r, r * 0.85, noise(x | 0, y | 0, 7) * 1.2, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = PETRI_PALETTE.colonyMid;
  context.globalAlpha = 0.55;
  context.beginPath();
  context.ellipse(x - r * 0.15, y - r * 0.1, r * 0.55, r * 0.45, 0.2, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = PETRI_PALETTE.colonyLite;
  context.globalAlpha = 0.35;
  context.beginPath();
  context.arc(x + r * 0.1, y - r * 0.15, r * 0.22, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
}

/**
 * Paint a QR-derived petri dish colony onto a canvas context.
 */
export function paintPetri(context, width, height, matrix) {
  const size = matrix?.length || 0;
  if (!size) {
    context.clearRect(0, 0, width, height);
    return;
  }
  const layout = petriLayout(matrix, width, height);
  context.fillStyle = PETRI_PALETTE.stage;
  context.fillRect(0, 0, width, height);
  drawDish(context, layout);

  // Clip to dish interior for colonies/hyphae
  context.save();
  context.beginPath();
  context.arc(layout.cx, layout.cy, layout.radius * 0.94, 0, Math.PI * 2);
  context.clip();

  // Mycelial threads between nearby dark modules
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!dark(matrix, row, col)) continue;
      const a = cellXY(layout, row, col);
      if (!insideDish(layout, a.x, a.y)) continue;
      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, -1],
      ]) {
        if (!dark(matrix, row + dr, col + dc)) continue;
        if (noise(row, col, 8 + dr + dc) < 0.35) continue;
        const b = cellXY(layout, row + dr, col + dc);
        if (!insideDish(layout, b.x, b.y)) continue;
        drawHypha(context, a.x, a.y, b.x, b.y, layout.cell);
      }
    }
  }

  // Colonies / sparse agar marks
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const { x, y } = cellXY(layout, row, col);
      if (!insideDish(layout, x, y)) continue;
      drawColony(context, x, y, layout.cell, colonyStyle(matrix, row, col));
    }
  }

  context.restore();

  // Soft glass overlay
  context.fillStyle = PETRI_PALETTE.glass;
  context.beginPath();
  context.arc(layout.cx, layout.cy, layout.radius * 0.96, 0, Math.PI * 2);
  context.fill();
}

export function petriToSvg(matrix, { cellSize = 14 } = {}) {
  const size = matrix?.length || 0;
  if (!size) {
    return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"/>`;
  }
  const field = size * cellSize;
  const edge = field;
  const layout = petriLayout(matrix, edge, edge);
  const { cx, cy, radius, cell } = layout;
  const parts = [];

  parts.push(`<rect width="${edge}" height="${edge}" fill="${PETRI_PALETTE.stage}"/>`);
  parts.push(
    `<defs><radialGradient id="petri-agar" cx="38%" cy="32%" r="70%"><stop offset="0%" stop-color="${PETRI_PALETTE.agar}"/><stop offset="70%" stop-color="${PETRI_PALETTE.agarDeep}"/><stop offset="100%" stop-color="#b39a5c"/></radialGradient><clipPath id="petri-clip"><circle cx="${cx}" cy="${cy}" r="${radius * 0.94}"/></clipPath></defs>`,
  );
  parts.push(
    `<circle cx="${cx}" cy="${cy}" r="${radius * 1.06}" fill="${PETRI_PALETTE.dish}"/>`,
  );
  parts.push(
    `<circle cx="${cx}" cy="${cy}" r="${radius * 0.96}" fill="url(#petri-agar)"/>`,
  );
  parts.push(
    `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${PETRI_PALETTE.rim}" stroke-width="${Math.max(3, radius * 0.045)}"/>`,
  );
  parts.push(
    `<circle cx="${cx}" cy="${cy}" r="${radius * 0.93}" fill="none" stroke="${PETRI_PALETTE.rimInner}" stroke-width="${Math.max(1.5, radius * 0.018)}" opacity="0.45"/>`,
  );
  parts.push(
    `<path d="M${cx + Math.cos(-2.4) * radius * 0.88} ${cy + Math.sin(-2.4) * radius * 0.88} A${radius * 0.88} ${radius * 0.88} 0 0 1 ${cx + Math.cos(-1.1) * radius * 0.88} ${cy + Math.sin(-1.1) * radius * 0.88}" fill="none" stroke="${PETRI_PALETTE.agarShine}" stroke-width="${Math.max(2, radius * 0.03)}" stroke-linecap="round"/>`,
  );

  const hyphae = [];
  const colonies = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const a = cellXY(layout, row, col);
      if (!insideDish(layout, a.x, a.y)) continue;
      if (dark(matrix, row, col)) {
        for (const [dr, dc] of [
          [0, 1],
          [1, 0],
          [1, 1],
          [1, -1],
        ]) {
          if (!dark(matrix, row + dr, col + dc)) continue;
          if (noise(row, col, 8 + dr + dc) < 0.35) continue;
          const b = cellXY(layout, row + dr, col + dc);
          if (!insideDish(layout, b.x, b.y)) continue;
          const mx = (a.x + b.x) / 2 + (noise(row, col, 5) - 0.5) * cell * 0.8;
          const my = (a.y + b.y) / 2 + (noise(row, col, 6) - 0.5) * cell * 0.8;
          hyphae.push(
            `<path d="M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}" fill="none" stroke="${PETRI_PALETTE.mycelium}" stroke-width="${Math.max(0.7, cell * 0.06)}" stroke-linecap="round" opacity="0.45"/>`,
          );
        }
      }
      const style = colonyStyle(matrix, row, col);
      if (style === "sparse") {
        colonies.push(
          `<circle cx="${a.x}" cy="${a.y}" r="${cell * 0.12}" fill="${PETRI_PALETTE.myceliumLite}" opacity="0.2"/>`,
        );
      } else if (style === "spore") {
        for (let i = 0; i < 3; i += 1) {
          const ang = (i / 3) * Math.PI * 2;
          colonies.push(
            `<circle cx="${a.x + Math.cos(ang) * cell * 0.12}" cy="${a.y + Math.sin(ang) * cell * 0.12}" r="${cell * 0.1}" fill="${PETRI_PALETTE.spore}" opacity="0.75"/>`,
          );
        }
      } else {
        const r = cell * (style === "dense" ? 0.42 : 0.32);
        colonies.push(
          `<ellipse cx="${a.x}" cy="${a.y}" rx="${r}" ry="${r * 0.85}" fill="${PETRI_PALETTE.colony}" transform="rotate(${noise(row, col, 7) * 40} ${a.x} ${a.y})"/>`,
          `<ellipse cx="${a.x - r * 0.15}" cy="${a.y - r * 0.1}" rx="${r * 0.55}" ry="${r * 0.45}" fill="${PETRI_PALETTE.colonyMid}" opacity="0.55"/>`,
        );
      }
    }
  }

  parts.push(`<g clip-path="url(#petri-clip)">${hyphae.join("")}${colonies.join("")}</g>`);
  parts.push(
    `<circle cx="${cx}" cy="${cy}" r="${radius * 0.96}" fill="${PETRI_PALETTE.glass}"/>`,
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${edge}" height="${edge}" viewBox="0 0 ${edge} ${edge}">`,
    ...parts,
    `</svg>`,
  ].join("");
}

export function petriAscii(matrix) {
  const size = matrix?.length || 0;
  if (!size) return "";
  const rad = size * 0.48;
  const mid = size / 2;
  return matrix
    .map((row, r) =>
      row
        .map((_, c) => {
          const dx = c + 0.5 - mid;
          const dy = r + 0.5 - mid;
          if (dx * dx + dy * dy > rad * rad) return " ";
          if (!dark(matrix, r, c)) return "·";
          const style = colonyStyle(matrix, r, c);
          if (style === "dense") return "●";
          if (style === "blob") return "◉";
          return "✧";
        })
        .join(""),
    )
    .join("\n");
}
