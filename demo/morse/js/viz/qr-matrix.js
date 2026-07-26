/**
 * Byte-mode QR matrix (ECC-L, versions 1–10). true = dark module.
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

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let value = 1;
  for (let index = 0; index < 255; index += 1) {
    EXP[index] = value;
    LOG[value] = index;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let index = 255; index < 512; index += 1) EXP[index] = EXP[index - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function rsGenerator(degree) {
  let poly = [1];
  for (let index = 0; index < degree; index += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let position = 0; position < poly.length; position += 1) {
      next[position] ^= poly[position];
      next[position + 1] ^= gfMul(poly[position], EXP[index]);
    }
    poly = next;
  }
  return poly;
}

function rsEcc(data, degree) {
  const generator = rsGenerator(degree);
  const message = data.concat(new Array(degree).fill(0));
  for (let index = 0; index < data.length; index += 1) {
    const factor = message[index];
    if (factor === 0) continue;
    for (let position = 0; position < generator.length; position += 1) {
      message[index + position] ^= gfMul(generator[position], factor);
    }
  }
  return message.slice(data.length);
}

function versionFor(byteLength) {
  for (let version = 1; version <= 10; version += 1) {
    const charCountBits = version < 10 ? 8 : 16;
    const overheadBits = 4 + charCountBits;
    const capacityBytes = DATA_CODEWORDS[version];
    const usable = Math.floor((capacityBytes * 8 - overheadBits) / 8);
    if (byteLength <= usable) return version;
  }
  throw new Error("Payload too long for QR versions 1–10");
}

function toCodewords(bytes, version) {
  const bits = [];
  const push = (value, width) => {
    for (let index = width - 1; index >= 0; index -= 1) bits.push((value >>> index) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, version < 10 ? 8 : 16);
  for (const byte of bytes) push(byte, 8);
  const capacityBits = DATA_CODEWORDS[version] * 8;
  const terminator = Math.min(4, capacityBits - bits.length);
  push(0, terminator);
  while (bits.length % 8 !== 0) bits.push(0);
  const words = [];
  for (let index = 0; index < bits.length; index += 8) {
    let value = 0;
    for (let bit = 0; bit < 8; bit += 1) value = (value << 1) | bits[index + bit];
    words.push(value);
  }
  const pads = [0xec, 0x11];
  for (let index = 0; words.length < DATA_CODEWORDS[version]; index += 1) {
    words.push(pads[index & 1]);
  }
  return words;
}

function interleave(data, version) {
  const blockCount = BLOCKS[version];
  const eccLen = ECC_PER_BLOCK[version];
  const shortLen = Math.floor(DATA_CODEWORDS[version] / blockCount);
  const longCount = DATA_CODEWORDS[version] % blockCount;
  const dataBlocks = [];
  const eccBlocks = [];
  let offset = 0;
  for (let block = 0; block < blockCount; block += 1) {
    const length = shortLen + (block >= blockCount - longCount ? 1 : 0);
    const slice = data.slice(offset, offset + length);
    offset += length;
    dataBlocks.push(slice);
    eccBlocks.push(rsEcc(slice, eccLen));
  }
  const out = [];
  const maxData = Math.max(...dataBlocks.map((block) => block.length));
  for (let index = 0; index < maxData; index += 1) {
    for (const block of dataBlocks) if (index < block.length) out.push(block[index]);
  }
  for (let index = 0; index < eccLen; index += 1) {
    for (const block of eccBlocks) out.push(block[index]);
  }
  return out;
}

function sizeOf(version) {
  return 17 + version * 4;
}

function paintFinder(grid, fixed, row, col) {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const rr = row + dy;
      const cc = col + dx;
      if (rr < 0 || cc < 0 || rr >= grid.length || cc >= grid.length) continue;
      const dark =
        dx >= 0 &&
        dx <= 6 &&
        dy >= 0 &&
        dy <= 6 &&
        (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      grid[rr][cc] = dark;
      fixed[rr][cc] = true;
    }
  }
}

function paintAlignments(grid, fixed, version) {
  for (const row of ALIGN[version]) {
    for (const col of ALIGN[version]) {
      if (fixed[row][col]) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const distance = Math.max(Math.abs(dx), Math.abs(dy));
          grid[row + dy][col + dx] = distance === 0 || distance === 2;
          fixed[row + dy][col + dx] = true;
        }
      }
    }
  }
}

function paintTiming(grid, fixed) {
  for (let index = 8; index < grid.length - 8; index += 1) {
    if (!fixed[6][index]) {
      grid[6][index] = index % 2 === 0;
      fixed[6][index] = true;
    }
    if (!fixed[index][6]) {
      grid[index][6] = index % 2 === 0;
      fixed[index][6] = true;
    }
  }
}

function reserveFormat(fixed) {
  const size = fixed.length;
  for (let index = 0; index < 9; index += 1) {
    fixed[8][index] = true;
    fixed[index][8] = true;
  }
  for (let index = 0; index < 8; index += 1) {
    fixed[8][size - 1 - index] = true;
    fixed[size - 1 - index][8] = true;
  }
}

function placeBits(grid, fixed, codewords) {
  const bits = [];
  for (const word of codewords) {
    for (let bit = 7; bit >= 0; bit -= 1) bits.push((word >> bit) & 1);
  }
  let cursor = 0;
  let up = true;
  for (let col = grid.length - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (let step = 0; step < grid.length; step += 1) {
      const row = up ? grid.length - 1 - step : step;
      for (const delta of [0, 1]) {
        const cc = col - delta;
        if (fixed[row][cc]) continue;
        grid[row][cc] = cursor < bits.length ? bits[cursor] === 1 : false;
        cursor += 1;
      }
    }
    up = !up;
  }
}

function maskAt(pattern, row, col) {
  switch (pattern) {
    case 0: return (row + col) % 2 === 0;
    case 1: return row % 2 === 0;
    case 2: return col % 3 === 0;
    case 3: return (row + col) % 3 === 0;
    case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5: return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6: return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    case 7: return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
    default: return false;
  }
}

function formatBits(mask) {
  let bits = (0b01 << 3) | mask;
  bits <<= 10;
  const generator = 0b10100110111;
  for (let index = 14; index >= 10; index -= 1) {
    if ((bits >>> index) & 1) bits ^= generator << (index - 10);
  }
  return (((0b01 << 3) | mask) << 10 | (bits & 0x3ff)) ^ 0b101010000010010;
}

function writeFormat(grid, mask) {
  const bits = formatBits(mask);
  const size = grid.length;
  const mapA = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  const mapB = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8],
    [size - 5, 8], [size - 6, 8], [size - 7, 8],
    [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5],
    [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1],
  ];
  for (let index = 0; index < 15; index += 1) {
    const dark = ((bits >> index) & 1) === 1;
    grid[mapA[index][0]][mapA[index][1]] = dark;
    grid[mapB[index][0]][mapB[index][1]] = dark;
  }
}

function scorePenalty(grid) {
  const size = grid.length;
  let score = 0;
  for (let row = 0; row < size; row += 1) {
    let run = 1;
    for (let col = 1; col < size; col += 1) {
      if (grid[row][col] === grid[row][col - 1]) {
        run += 1;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else run = 1;
    }
  }
  for (let col = 0; col < size; col += 1) {
    let run = 1;
    for (let row = 1; row < size; row += 1) {
      if (grid[row][col] === grid[row - 1][col]) {
        run += 1;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else run = 1;
    }
  }
  let dark = 0;
  for (const row of grid) for (const cell of row) if (cell) dark += 1;
  score += Math.floor(Math.abs((100 * dark) / (size * size) - 50) / 5) * 10;
  return score;
}

export function encodeQrMatrix(payload) {
  const bytes = [...new TextEncoder().encode(payload)];
  const version = versionFor(bytes.length);
  const codewords = interleave(toCodewords(bytes, version), version);
  const size = sizeOf(version);
  const grid = Array.from({ length: size }, () => Array(size).fill(false));
  const fixed = Array.from({ length: size }, () => Array(size).fill(false));

  paintFinder(grid, fixed, 0, 0);
  paintFinder(grid, fixed, 0, size - 7);
  paintFinder(grid, fixed, size - 7, 0);
  reserveFormat(fixed);
  paintAlignments(grid, fixed, version);
  paintTiming(grid, fixed);
  grid[size - 8][8] = true;
  fixed[size - 8][8] = true;

  const dataFixed = fixed.map((row) => row.slice());
  placeBits(grid, dataFixed, codewords);

  let best = null;
  let bestScore = Infinity;
  for (let pattern = 0; pattern < 8; pattern += 1) {
    const masked = grid.map((row, rowIndex) =>
      row.map((dark, colIndex) => {
        if (fixed[rowIndex][colIndex]) return dark;
        return maskAt(pattern, rowIndex, colIndex) ? !dark : dark;
      }),
    );
    writeFormat(masked, pattern);
    const score = scorePenalty(masked);
    if (score < bestScore) {
      bestScore = score;
      best = masked;
    }
  }
  return best;
}
