/**
 * Decode byte-mode QR matrices (ECC-L, versions 1–10) produced by encodeQrMatrix.
 * Assumes clean modules; does not run Reed–Solomon repair.
 */

const ECC_PER_BLOCK = [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18];
const BLOCKS = [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4];
const DATA_CODEWORDS = [0, 19, 34, 55, 80, 108, 136, 156, 194, 232, 274];
const ALIGN = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

function sizeOf(version) {
  return 17 + version * 4;
}

function versionFromSize(size) {
  if ((size - 17) % 4 !== 0) return 0;
  const version = (size - 17) / 4;
  return version >= 1 && version <= 10 ? version : 0;
}

function maskAt(pattern, row, col) {
  switch (pattern) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    case 7:
      return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
    default:
      return false;
  }
}

function markFinder(fixed, row, col) {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const rr = row + dy;
      const cc = col + dx;
      if (rr < 0 || cc < 0 || rr >= fixed.length || cc >= fixed.length) continue;
      fixed[rr][cc] = true;
    }
  }
}

function buildFixed(version) {
  const size = sizeOf(version);
  const fixed = Array.from({ length: size }, () => Array(size).fill(false));
  markFinder(fixed, 0, 0);
  markFinder(fixed, 0, size - 7);
  markFinder(fixed, size - 7, 0);
  for (let index = 0; index < 9; index += 1) {
    fixed[8][index] = true;
    fixed[index][8] = true;
  }
  for (let index = 0; index < 8; index += 1) {
    fixed[8][size - 1 - index] = true;
    fixed[size - 1 - index][8] = true;
  }
  for (const row of ALIGN[version]) {
    for (const col of ALIGN[version]) {
      if (fixed[row][col]) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          fixed[row + dy][col + dx] = true;
        }
      }
    }
  }
  for (let index = 8; index < size - 8; index += 1) {
    fixed[6][index] = true;
    fixed[index][6] = true;
  }
  fixed[size - 8][8] = true;
  return fixed;
}

function readFormatMask(grid) {
  const mapA = [
    [8, 0],
    [8, 1],
    [8, 2],
    [8, 3],
    [8, 4],
    [8, 5],
    [8, 7],
    [8, 8],
    [7, 8],
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
    [1, 8],
    [0, 8],
  ];
  let bits = 0;
  for (let index = 0; index < 15; index += 1) {
    if (grid[mapA[index][0]][mapA[index][1]]) bits |= 1 << index;
  }
  bits ^= 0b101010000010010;
  const ecc = (bits >> 13) & 0b11;
  const mask = (bits >> 10) & 0b111;
  if (ecc !== 0b01) return -1;
  return mask;
}

function extractCodewords(grid, fixed, mask) {
  const size = grid.length;
  const bits = [];
  let up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (let step = 0; step < size; step += 1) {
      const row = up ? size - 1 - step : step;
      for (const delta of [0, 1]) {
        const cc = col - delta;
        if (fixed[row][cc]) continue;
        let dark = Boolean(grid[row][cc]);
        if (maskAt(mask, row, cc)) dark = !dark;
        bits.push(dark ? 1 : 0);
      }
    }
    up = !up;
  }
  const words = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    let value = 0;
    for (let bit = 0; bit < 8; bit += 1) value = (value << 1) | bits[index + bit];
    words.push(value);
  }
  return words;
}

function deinterleaveData(codewords, version) {
  const blockCount = BLOCKS[version];
  const eccLen = ECC_PER_BLOCK[version];
  const shortLen = Math.floor(DATA_CODEWORDS[version] / blockCount);
  const longCount = DATA_CODEWORDS[version] % blockCount;
  const lengths = Array.from(
    { length: blockCount },
    (_, block) => shortLen + (block >= blockCount - longCount ? 1 : 0),
  );
  const dataBlocks = lengths.map(() => []);
  let offset = 0;
  const maxData = Math.max(...lengths);
  for (let index = 0; index < maxData; index += 1) {
    for (let block = 0; block < blockCount; block += 1) {
      if (index < lengths[block]) dataBlocks[block].push(codewords[offset++]);
    }
  }
  offset += eccLen * blockCount;
  return dataBlocks.flat();
}

function parseBytePayload(dataWords, version) {
  const bits = [];
  for (const word of dataWords) {
    for (let bit = 7; bit >= 0; bit -= 1) bits.push((word >> bit) & 1);
  }
  let cursor = 0;
  const read = (width) => {
    if (cursor + width > bits.length) return null;
    let value = 0;
    for (let index = 0; index < width; index += 1) {
      value = (value << 1) | bits[cursor];
      cursor += 1;
    }
    return value;
  };
  const mode = read(4);
  if (mode !== 0b0100) return null;
  const length = read(version < 10 ? 8 : 16);
  if (length == null || length < 0) return null;
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    const value = read(8);
    if (value == null) return null;
    bytes[index] = value;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function finderLooksValid(grid) {
  const size = grid.length;
  const corners = [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ];
  for (const [row, col] of corners) {
    if (!grid[row][col] || !grid[row][col + 6] || !grid[row + 6][col]) return false;
    if (!grid[row + 3][col + 3]) return false;
  }
  return true;
}

export function decodeQrMatrix(grid) {
  if (!Array.isArray(grid) || !grid.length || grid.length !== grid[0]?.length) {
    return null;
  }
  const version = versionFromSize(grid.length);
  if (!version || !finderLooksValid(grid)) return null;
  const mask = readFormatMask(grid);
  if (mask < 0) return null;
  const fixed = buildFixed(version);
  const codewords = extractCodewords(grid, fixed, mask);
  const needed = DATA_CODEWORDS[version] + ECC_PER_BLOCK[version] * BLOCKS[version];
  if (codewords.length < needed) return null;
  const dataWords = deinterleaveData(codewords, version);
  return parseBytePayload(dataWords, version);
}
