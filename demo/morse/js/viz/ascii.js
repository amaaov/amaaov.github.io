/**
 * Text renderings of QR matrix views (QR, GO, RUG, LAND, PETRI).
 */

import { landAscii } from "./land.js";
import { petriAscii } from "./petri.js";

export function matrixToAscii(matrix, { kind = "qr", quiet = 4 } = {}) {
  if (!Array.isArray(matrix) || !matrix.length) return "";

  if (kind === "go") {
    return matrix
      .map((row) => row.map((dark) => (dark ? "●" : "○")).join(" "))
      .join("\n");
  }

  if (kind === "rug") {
    const size = matrix.length;
    const last = size - 1;
    const glyph = (row, col) => {
      const raw = Boolean(matrix[row][col]);
      const foldedRow = Math.min(row, last - row);
      const foldedCol = Math.min(col, last - col);
      const mirrored =
        Boolean(matrix[foldedRow][foldedCol]) ||
        Boolean(matrix[foldedCol]?.[foldedRow]);
      if (raw && mirrored) return "◆";
      if (raw || mirrored) return "◇";
      return "·";
    };
    return matrix
      .map((row, rowIndex) => row.map((_, col) => glyph(rowIndex, col)).join(""))
      .join("\n");
  }

  if (kind === "land") return landAscii(matrix);
  if (kind === "petri") return petriAscii(matrix);

  const size = matrix.length;
  const full = size + quiet * 2;
  const lines = [];
  for (let row = 0; row < full; row += 1) {
    let line = "";
    for (let col = 0; col < full; col += 1) {
      const moduleRow = row - quiet;
      const moduleCol = col - quiet;
      const dark =
        moduleRow >= 0 &&
        moduleCol >= 0 &&
        moduleRow < size &&
        moduleCol < size &&
        matrix[moduleRow][moduleCol];
      line += dark ? "██" : "  ";
    }
    lines.push(line);
  }
  return lines.join("\n");
}
