/**
 * Detect conventional ASCII QR / GO boards and decode to payload text.
 */

import { decodeQrMatrix } from "./qr-decode.js";

const DARK = /[█■▪▓#Xx@*1]/u;
const GO_LINE = /^[\s●○◉◎∙·.oO0]+$/u;
const GO_DARK = /[●◉]/u;
const QR_SIZES = [21, 25, 29, 33, 37, 41, 45, 49, 53, 57];

function normalizeLines(text) {
  const raw = String(text ?? "")
    .replaceAll(/\r\n?/gu, "\n")
    .split("\n");
  // Keep space-only quiet-zone rows; only drop truly empty edges.
  while (raw.length && raw[0].length === 0) raw.shift();
  while (raw.length && raw.at(-1).length === 0) raw.pop();
  if (!raw.length) return [];
  const width = Math.max(...raw.map((line) => line.length));
  if (width < 21) return [];
  return raw.map((line) => line.padEnd(width, " "));
}

function looksSquare(rows, cols) {
  return rows >= 21 && cols >= 21 && Math.abs(rows - cols) <= 2;
}

function parseGoMatrix(lines) {
  if (!lines.every((line) => GO_LINE.test(line))) return null;
  if (!lines.some((line) => GO_DARK.test(line) || /[○◎oO0]/u.test(line))) {
    return null;
  }
  const rows = lines.map((line) =>
    [...line.replaceAll(/\s+/gu, "")].map((ch) => GO_DARK.test(ch)),
  );
  if (!rows.length || rows.some((row) => row.length !== rows[0].length)) {
    return null;
  }
  if (!QR_SIZES.includes(rows.length) || rows[0].length !== rows.length) {
    return null;
  }
  return rows;
}

function moduleWidth(line) {
  if (/██/u.test(line) || /  /u.test(line)) return 2;
  return 1;
}

function parseBlockMatrix(lines) {
  if (!lines.some((line) => DARK.test(line))) return null;
  const width = moduleWidth(lines.find((line) => line.trim()) || "");
  const cols = Math.floor(lines[0].length / width);
  if (!looksSquare(lines.length, cols)) return null;

  const matrix = [];
  for (const line of lines) {
    const row = [];
    for (let col = 0; col < cols; col += 1) {
      const cell = line.slice(col * width, col * width + width);
      row.push(DARK.test(cell));
    }
    matrix.push(row);
  }
  return matrix;
}

function cropQuiet(matrix, quiet) {
  const size = matrix.length - quiet * 2;
  if (size < 21 || matrix.length !== matrix[0].length) return null;
  if (!QR_SIZES.includes(size)) return null;
  return matrix
    .slice(quiet, quiet + size)
    .map((row) => row.slice(quiet, quiet + size));
}

function invertMatrix(matrix) {
  return matrix.map((row) => row.map((dark) => !dark));
}

function candidatesFrom(matrix) {
  const out = [matrix, invertMatrix(matrix)];
  for (const quiet of [4, 3, 2, 1]) {
    const cropped = cropQuiet(matrix, quiet);
    if (cropped) {
      out.push(cropped, invertMatrix(cropped));
    }
  }
  return out;
}

/**
 * @returns {string|null} UTF-8 QR payload when the text is an ASCII matrix.
 */
export function decodeAsciiQrPayload(text) {
  const lines = normalizeLines(text);
  if (lines.length < 21) return null;

  const matrices = [];
  const go = parseGoMatrix(lines);
  if (go) matrices.push(go);
  const block = parseBlockMatrix(lines);
  if (block) matrices.push(block);

  for (const matrix of matrices) {
    for (const candidate of candidatesFrom(matrix)) {
      if (!QR_SIZES.includes(candidate.length)) continue;
      const payload = decodeQrMatrix(candidate);
      if (payload != null) return payload;
    }
  }
  return null;
}

export function looksLikeAsciiMatrix(text) {
  const lines = normalizeLines(text);
  if (lines.length < 21) return false;
  if (parseGoMatrix(lines)) return true;
  if (!lines.some((line) => DARK.test(line))) return false;
  const cols = Math.floor(lines[0].length / moduleWidth(lines[0]));
  return looksSquare(lines.length, cols);
}
