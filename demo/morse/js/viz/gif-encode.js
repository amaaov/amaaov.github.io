/**
 * Minimal silent GIF89a encoder for RGBA frame sequences.
 * Palette is built from frequent 5-bit RGB buckets (good enough for the dark clock).
 */

const MAX_COLORS = 256;

/** @param {Array<Uint8ClampedArray|Uint8Array>} frames */
export function encodeAnimatedGif(
  frames,
  { width, height, delayCs = 10 } = {},
) {
  if (!frames?.length) throw new Error("No frames");
  if (!width || !height) throw new Error("Missing size");
  const palette = buildPalette(frames, width, height);
  const colorCount = nextPowerOfTwo(Math.max(2, palette.length / 3));
  const packedPalette = new Uint8Array(colorCount * 3);
  packedPalette.set(palette);

  const parts = [];
  parts.push(asciiBytes("GIF89a"));
  parts.push(u16(width), u16(height));
  parts.push(Uint8Array.of(0x80 | ((bitSize(colorCount) - 1) << 4) | (bitSize(colorCount) - 1)));
  parts.push(Uint8Array.of(0, 0));
  parts.push(packedPalette);
  parts.push(Uint8Array.of(0x21, 0xff, 0x0b));
  parts.push(asciiBytes("NETSCAPE2.0"));
  parts.push(Uint8Array.of(0x03, 0x01, 0, 0, 0));

  for (const frame of frames) {
    const indexed = indexFrame(frame, width, height, packedPalette, colorCount);
    parts.push(Uint8Array.of(0x21, 0xf9, 0x04, 0x04));
    parts.push(u16(Math.max(2, delayCs)));
    parts.push(Uint8Array.of(0, 0));
    parts.push(Uint8Array.of(0x2c, 0, 0, 0, 0));
    parts.push(u16(width), u16(height));
    parts.push(Uint8Array.of(0));
    parts.push(lzwEncode(indexed, bitSize(colorCount)));
  }
  parts.push(Uint8Array.of(0x3b));
  return concat(parts);
}

export function gifBlobFromFrames(frames, options) {
  return new Blob([encodeAnimatedGif(frames, options)], { type: "image/gif" });
}

function buildPalette(frames, width, height) {
  const counts = new Map();
  const step = Math.max(1, Math.floor((width * height) / 4000));
  for (const frame of frames) {
    for (let pixel = 0; pixel < width * height; pixel += step) {
      const offset = pixel * 4;
      const key =
        ((frame[offset] >> 3) << 10) |
        ((frame[offset + 1] >> 3) << 5) |
        (frame[offset + 2] >> 3);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const picked = ranked.slice(0, MAX_COLORS);
  if (!picked.length) picked.push([0, 1]);
  const palette = new Uint8Array(picked.length * 3);
  picked.forEach(([key], index) => {
    palette[index * 3] = ((key >> 10) & 31) << 3;
    palette[index * 3 + 1] = ((key >> 5) & 31) << 3;
    palette[index * 3 + 2] = (key & 31) << 3;
  });
  return palette;
}

function indexFrame(frame, width, height, palette, colorCount) {
  const lookup = buildPaletteLookup(palette, colorCount);
  const indexed = new Uint8Array(width * height);
  for (let pixel = 0; pixel < indexed.length; pixel += 1) {
    const offset = pixel * 4;
    const key =
      ((frame[offset] >> 3) << 10) |
      ((frame[offset + 1] >> 3) << 5) |
      (frame[offset + 2] >> 3);
    indexed[pixel] = lookup[key];
  }
  return indexed;
}

/** Map 15-bit RGB buckets to nearest palette index once per encode. */
function buildPaletteLookup(palette, colorCount) {
  const lookup = new Uint8Array(32768);
  for (let key = 0; key < 32768; key += 1) {
    const red = ((key >> 10) & 31) << 3;
    const green = ((key >> 5) & 31) << 3;
    const blue = (key & 31) << 3;
    let best = 0;
    let bestDistance = Infinity;
    for (let index = 0; index < colorCount; index += 1) {
      const base = index * 3;
      const dr = red - palette[base];
      const dg = green - palette[base + 1];
      const db = blue - palette[base + 2];
      const distance = dr * dr + dg * dg + db * db;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
        if (distance === 0) break;
      }
    }
    lookup[key] = best;
  }
  return lookup;
}

function lzwEncode(indexed, minCodeSize) {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = end + 1;
  const table = new Map();
  const out = [];
  let bitBuffer = 0;
  let bitCount = 0;

  function writeCode(code) {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      out.push(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  }

  function resetTable() {
    table.clear();
    codeSize = minCodeSize + 1;
    nextCode = end + 1;
  }

  writeCode(clear);
  resetTable();
  let prefix = indexed[0];
  for (let index = 1; index < indexed.length; index += 1) {
    const pixel = indexed[index];
    const key = prefix * 4096 + pixel;
    if (table.has(key)) {
      prefix = table.get(key);
      continue;
    }
    writeCode(prefix);
    if (nextCode < 4096) {
      table.set(key, nextCode);
      nextCode += 1;
      if (nextCode === 1 << codeSize && codeSize < 12) codeSize += 1;
    } else {
      writeCode(clear);
      resetTable();
    }
    prefix = pixel;
  }
  writeCode(prefix);
  writeCode(end);
  if (bitCount > 0) out.push(bitBuffer & 0xff);

  const stream = [minCodeSize];
  for (let offset = 0; offset < out.length; offset += 255) {
    const chunk = out.slice(offset, offset + 255);
    stream.push(chunk.length, ...chunk);
  }
  stream.push(0);
  return Uint8Array.from(stream);
}

function bitSize(colorCount) {
  let size = 1;
  while (1 << size < colorCount) size += 1;
  return size;
}

function nextPowerOfTwo(value) {
  let size = 2;
  while (size < value) size <<= 1;
  return Math.min(MAX_COLORS, size);
}

function u16(value) {
  return Uint8Array.of(value & 0xff, (value >> 8) & 0xff);
}

function asciiBytes(text) {
  return Uint8Array.from(text, (character) => character.charCodeAt(0));
}

function concat(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}
