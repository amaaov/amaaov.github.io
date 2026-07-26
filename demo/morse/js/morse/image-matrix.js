/**
 * Sample a QR/GO module grid from ImageData, then decode via decodeQrMatrix.
 */

import { decodeQrMatrix } from "../viz/qr-decode.js";

function lumaAt(data, width, x, y) {
  const index = (y * width + x) * 4;
  return 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
}

function contentBounds(imageData) {
  const { width, height, data } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const corner =
    (lumaAt(data, width, 2, 2) +
      lumaAt(data, width, width - 3, 2) +
      lumaAt(data, width, 2, height - 3) +
      lumaAt(data, width, width - 3, height - 3)) /
    4;
  const goBoard = corner < 48;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const luma = lumaAt(data, width, x, y);
      const hit = goBoard ? luma > 55 && luma < 230 : luma < corner - 25 || luma < 90;
      if (!hit) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX) {
    return { x: 0, y: 0, w: width, h: height, goBoard };
  }
  return {
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    goBoard,
  };
}

function sampleGrid(imageData, size, x0, y0, spanW, spanH) {
  const { width, height, data } = imageData;
  const cellW = spanW / size;
  const cellH = spanH / size;
  const samples = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const cx = Math.min(width - 1, Math.max(0, Math.floor(x0 + (col + 0.5) * cellW)));
      const cy = Math.min(height - 1, Math.max(0, Math.floor(y0 + (row + 0.5) * cellH)));
      samples.push(lumaAt(data, width, cx, cy));
    }
  }
  const sorted = samples.slice().sort((a, b) => a - b);
  const threshold = (sorted[0] + sorted[sorted.length - 1]) / 2;
  const matrix = [];
  let cursor = 0;
  for (let row = 0; row < size; row += 1) {
    const line = [];
    for (let col = 0; col < size; col += 1) {
      line.push(samples[cursor] < threshold);
      cursor += 1;
    }
    matrix.push(line);
  }
  return matrix;
}

function rectsForBounds(bounds, size) {
  const { x, y, w, h, goBoard } = bounds;
  const side = Math.min(w, h);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rects = [
    { x, y, w, h },
    { x: cx - side / 2, y: cy - side / 2, w: side, h: side },
  ];
  if (goBoard) {
    const inset = side / (size + 2);
    rects.push({
      x: cx - side / 2 + inset,
      y: cy - side / 2 + inset,
      w: side - inset * 2,
      h: side - inset * 2,
    });
  } else {
    const quiet = side / (size + 8);
    rects.push({
      x: cx - side / 2 + quiet * 4,
      y: cy - side / 2 + quiet * 4,
      w: side - quiet * 8,
      h: side - quiet * 8,
    });
  }
  return rects;
}

/**
 * Render a boolean matrix to ImageData for tests (flat QR style).
 */
export function matrixToImageData(matrix, modulePx = 6, quiet = 4) {
  const modules = matrix.length + quiet * 2;
  const width = modules * modulePx;
  const data = new Uint8ClampedArray(width * width * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = 244;
    data[index + 1] = 247;
    data[index + 2] = 242;
    data[index + 3] = 255;
  }
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix.length; col += 1) {
      if (!matrix[row][col]) continue;
      for (let dy = 0; dy < modulePx; dy += 1) {
        for (let dx = 0; dx < modulePx; dx += 1) {
          const x = (col + quiet) * modulePx + dx;
          const y = (row + quiet) * modulePx + dy;
          const index = (y * width + x) * 4;
          data[index] = 11;
          data[index + 1] = 16;
          data[index + 2] = 15;
        }
      }
    }
  }
  return { width, height: width, data };
}

export function decodeQrPayloadFromImageData(imageData) {
  if (!imageData?.width || !imageData?.height) return null;
  const bounds = contentBounds(imageData);
  for (let version = 1; version <= 10; version += 1) {
    const size = 17 + version * 4;
    for (const rect of rectsForBounds(bounds, size)) {
      if (rect.w < size || rect.h < size) continue;
      const matrix = sampleGrid(imageData, size, rect.x, rect.y, rect.w, rect.h);
      const payload = decodeQrMatrix(matrix);
      if (payload != null) return payload;
    }
  }
  return null;
}
