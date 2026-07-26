/**
 * Text renderings of the same module matrix used by QR and GO canvas views.
 */

export function matrixToAscii(matrix, { kind = "qr", quiet = 4 } = {}) {
  if (!Array.isArray(matrix) || !matrix.length) return "";

  if (kind === "go") {
    return matrix
      .map((row) => row.map((dark) => (dark ? "●" : "○")).join(" "))
      .join("\n");
  }

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
