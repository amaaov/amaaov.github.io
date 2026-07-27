/**
 * Cheap plasma grain helpers. Prefer cheapNoise in hot pixel loops;
 * FBM/layered APIs stay for light optional use (1 octave default).
 */

export function hash2(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/** Fast animated grain in ~[0, 1]. A few sins — safe per pixel. */
export function cheapNoise(x, y, time = 0, seed = 0) {
  const salt = seed * 17.13;
  const wave =
    Math.sin(x * 9.1 + y * 7.3 + time + salt) +
    Math.sin(x * 5.4 - y * 11.2 + time * 0.7 + salt * 0.6) * 0.5 +
    Math.sin((x + y) * 3.7 - time * 0.45 + salt * 0.3) * 0.25;
  return wave * 0.35 + 0.5;
}

export function valueNoise(x, y, seed = 0) {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  const localX = x - cellX;
  const localY = y - cellY;
  const fadeX = localX * localX * (3 - 2 * localX);
  const fadeY = localY * localY * (3 - 2 * localY);
  const salt = seed * 19.19;
  const corner00 = hash2(cellX + salt, cellY + salt);
  const corner10 = hash2(cellX + 1 + salt, cellY + salt);
  const corner01 = hash2(cellX + salt, cellY + 1 + salt);
  const corner11 = hash2(cellX + 1 + salt, cellY + 1 + salt);
  const edge0 = corner00 + (corner10 - corner00) * fadeX;
  const edge1 = corner01 + (corner11 - corner01) * fadeX;
  return edge0 + (edge1 - edge0) * fadeY;
}

export function fbmNoise(
  x,
  y,
  { octaves = 1, lacunarity = 2, gain = 0.5, seed = 0 } = {},
) {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  const count = Math.max(1, Math.min(3, octaves | 0));
  for (let index = 0; index < count; index += 1) {
    sum +=
      valueNoise(x * frequency, y * frequency, seed + index * 17) * amplitude;
    norm += amplitude;
    frequency *= lacunarity;
    amplitude *= gain;
  }
  return sum / Math.max(0.001, norm);
}

/** Thin mono stack; defaults to one cheap layer. */
export function layeredNoise(x, y, time, layers = []) {
  if (!layers.length) return cheapNoise(x, y, time, 0);
  let sum = 0;
  let weightSum = 0;
  const limit = Math.min(2, layers.length);
  for (let index = 0; index < limit; index += 1) {
    const layer = layers[index];
    const scale = Number(layer.scale) || 1;
    const speed = Number(layer.speed) || 0;
    const weight = Number(layer.weight);
    const amp = Number.isFinite(weight) ? weight : 1;
    const seed = Number(layer.seed) || index;
    sum +=
      cheapNoise(x * scale, y * scale, time * (0.35 + speed), seed) * amp;
    weightSum += Math.abs(amp);
  }
  return sum / Math.max(0.001, weightSum);
}

export function coloredNoise(x, y, time, channels = {}) {
  return [
    layeredNoise(x, y, time, channels.red || []),
    layeredNoise(x, y, time, channels.green || []),
    layeredNoise(x, y, time, channels.blue || []),
  ];
}

export function mixNoiseRgb(baseRgb, noiseRgb, amount) {
  const mix = Math.min(1, Math.max(0, amount));
  return [
    Math.round(baseRgb[0] * (1 - mix) + noiseRgb[0] * 255 * mix),
    Math.round(baseRgb[1] * (1 - mix) + noiseRgb[1] * 255 * mix),
    Math.round(baseRgb[2] * (1 - mix) + noiseRgb[2] * 255 * mix),
  ];
}
