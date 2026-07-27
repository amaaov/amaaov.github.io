import { plasmaColor, plasmaParams, plasmaSample } from "./plasma-math.js";
import { clampPlasmaBuffer } from "./plasma-quality.js";
import { normalizePlasmaType } from "./plasma-types.js";

const BLEND_MS = 1100;
const bufferCanvas =
  typeof document !== "undefined" ? document.createElement("canvas") : null;
const maskCanvas =
  typeof document !== "undefined" ? document.createElement("canvas") : null;

let targetType = "classic";
let fromType = "classic";
let blendStarted = 0;
let maskLabel = "";
let maskSize = 0;
let maskPixels = null;

/**
 * Full-field demoscene plasma. Morse progress and synth timbre drive the
 * waves; type switches cross-fade with eased domain morph.
 */
export function drawBeatPlasma(
  canvas,
  {
    beats = [],
    progress = 0,
    activeBeatIndex = -1,
    settings = {},
    plasmaType = "classic",
    label = "",
    maxBuffer = 720,
    now = typeof performance !== "undefined" ? performance.now() : Date.now(),
  } = {},
) {
  const context = canvas.getContext("2d");
  if (!context || !bufferCanvas) return;
  const width = canvas.width;
  const height = canvas.height;
  const side = Math.min(width, height);
  const bufferCap = clampPlasmaBuffer(maxBuffer, 720);
  const bufferSide = Math.max(48, Math.min(bufferCap, side));
  if (bufferCanvas.width !== bufferSide || bufferCanvas.height !== bufferSide) {
    bufferCanvas.width = bufferSide;
    bufferCanvas.height = bufferSide;
  }

  const blend = beginTypeBlend(plasmaType, now);
  const needsMask =
    blend.to === "letter-burn" || (blend.mix < 1 && blend.from === "letter-burn");
  if (needsMask) ensureLetterMask(label, bufferSide);

  const bufferContext = bufferCanvas.getContext("2d");
  const image = bufferContext.createImageData(bufferSide, bufferSide);
  const pixels = image.data;
  const baseOptions = { beats, progress, activeBeatIndex, settings, now };
  const toParams = buildParams(baseOptions, blend.to);
  const blending = blend.mix < 1;
  const fromParams = blending ? buildParams(baseOptions, blend.from) : null;
  const morph = blending ? Math.sin(blend.mix * Math.PI) * 0.045 : 0;
  const toNeedsLetter = blend.to === "letter-burn";
  const fromNeedsLetter = blending && blend.from === "letter-burn";

  for (let y = 0; y < bufferSide; y += 1) {
    const ny = y / bufferSide - 0.5;
    for (let x = 0; x < bufferSide; x += 1) {
      const nx = x / bufferSide - 0.5;
      if (toNeedsLetter) {
        const letter = burnDustAt(x, y, bufferSide, toParams);
        toParams.letterMask = letter.mask;
        toParams.letterDust = letter.dust;
      } else {
        toParams.letterMask = 0;
        toParams.letterDust = 0;
      }
      const toNx = morph ? nx + morph * Math.sin(ny * 6 + toParams.time) : nx;
      const toNy = morph ? ny + morph * Math.cos(nx * 6 - toParams.time) : ny;
      const toColor = plasmaColor(
        plasmaSample(toNx, toNy, toParams),
        toParams,
        toNx,
        toNy,
      );
      let red = toColor[0];
      let green = toColor[1];
      let blue = toColor[2];
      if (fromParams) {
        if (fromNeedsLetter) {
          const fromLetter = burnDustAt(x, y, bufferSide, fromParams);
          fromParams.letterMask = fromLetter.mask;
          fromParams.letterDust = fromLetter.dust;
        } else {
          fromParams.letterMask = 0;
          fromParams.letterDust = 0;
        }
        const fromNx = nx - morph * Math.sin(ny * 6 + fromParams.time);
        const fromNy = ny - morph * Math.cos(nx * 6 - fromParams.time);
        const fromColor = plasmaColor(
          plasmaSample(fromNx, fromNy, fromParams),
          fromParams,
          fromNx,
          fromNy,
        );
        const mix = blend.mix;
        red = Math.round(fromColor[0] + (red - fromColor[0]) * mix);
        green = Math.round(fromColor[1] + (green - fromColor[1]) * mix);
        blue = Math.round(fromColor[2] + (blue - fromColor[2]) * mix);
      }
      const index = (y * bufferSide + x) * 4;
      pixels[index] = red;
      pixels[index + 1] = green;
      pixels[index + 2] = blue;
      pixels[index + 3] = 255;
    }
  }
  bufferContext.putImageData(image, 0, 0);

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#050807";
  context.fillRect(0, 0, width, height);
  const upscaling = bufferSide < side;
  context.imageSmoothingEnabled = upscaling || blend.mix < 1;
  if (upscaling && "imageSmoothingQuality" in context) {
    context.imageSmoothingQuality = "high";
  }
  context.drawImage(
    bufferCanvas,
    (width - side) / 2,
    (height - side) / 2,
    side,
    side,
  );
}

function buildParams({ beats, progress, activeBeatIndex, settings, now }, type) {
  return plasmaParams(settings, progress, beats, activeBeatIndex, now, { type });
}

function beginTypeBlend(requested, now) {
  const next = normalizePlasmaType(requested);
  if (next !== targetType) {
    const elapsed = Math.max(0, now - blendStarted);
    const linear = blendStarted <= 0 ? 1 : Math.min(1, elapsed / BLEND_MS);
    const currentMix = smootherstep(linear);
    fromType = currentMix < 0.5 ? fromType : targetType;
    targetType = next;
    blendStarted = now;
  }
  const elapsed = Math.max(0, now - blendStarted);
  const linear = blendStarted <= 0 ? 1 : Math.min(1, elapsed / BLEND_MS);
  return { from: fromType, to: targetType, mix: smootherstep(linear) };
}

function smootherstep(edge) {
  const t = Math.min(1, Math.max(0, edge));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function ensureLetterMask(label, size) {
  const text = String(label || "").trim().slice(0, 4) || "·";
  if (maskLabel === text && maskSize === size && maskPixels) return;
  if (!maskCanvas) return;
  maskCanvas.width = size;
  maskCanvas.height = size;
  const context = maskCanvas.getContext("2d");
  context.fillStyle = "#000";
  context.fillRect(0, 0, size, size);
  context.fillStyle = "#fff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `bold ${Math.floor(size * 0.55)}px "IBM Plex Mono", monospace`;
  context.fillText(text, size / 2, size / 2 + size * 0.03);
  maskPixels = context.getImageData(0, 0, size, size).data;
  maskLabel = text;
  maskSize = size;
}

function maskAt(x, y, size) {
  if (!maskPixels || maskSize !== size) return 0;
  const clampedX = Math.max(0, Math.min(size - 1, x | 0));
  const clampedY = Math.max(0, Math.min(size - 1, y | 0));
  return maskPixels[(clampedY * size + clampedX) * 4] / 255;
}

/** Intact glyph fades as burn front passes; crumbs fall as dust. */
function burnDustAt(x, y, size, params) {
  const time = Number(params.time) || 0;
  const progress = Number(params.progress) || 0;
  const pulse = Number(params.pulse) || 0.82;
  const cell = hash2(x, y);
  const burnLine = 0.18 + progress * 0.62 + Math.sin(time * 0.7 + cell * 6) * 0.04;
  const yNorm = y / size;
  const intact = maskAt(x, y, size);
  let solid = 0;
  if (intact > 0.15) {
    const ahead = yNorm - burnLine;
    if (ahead > 0.08) solid = intact;
    else if (ahead > -0.05) {
      const edge = (ahead + 0.05) / 0.13;
      const flake = cell > 0.55 + pulse * 0.1 ? 0 : 1;
      solid = intact * edge * flake;
    }
  }

  let dust = 0;
  const fallSpan = size * (0.28 + cell * 0.22);
  for (let step = 0; step < 3; step += 1) {
    const age = (time * (0.55 + cell * 0.9) + progress * 1.6 + step * 0.22) % 1.35;
    const srcY = Math.floor(y - age * fallSpan);
    const sway = Math.sin(time * 1.4 + cell * 12 + step) * (1.5 + age * 3);
    const srcX = Math.floor(x + sway);
    if (srcY < 0 || srcY >= size || srcX < 0 || srcX >= size) continue;
    const source = maskAt(srcX, srcY, size);
    if (source < 0.2) continue;
    const originNorm = srcY / size;
    if (originNorm >= burnLine + cell * 0.18) continue;
    const fade = Math.max(0, 1 - age / 1.2);
    const speck = source * fade * (0.45 + ((cell * 17 + step) % 1) * 0.55);
    dust = Math.max(dust, speck);
  }

  return {
    mask: Math.min(1, solid),
    dust: Math.min(1, dust),
  };
}

function hash2(x, y) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export { plasmaColor, plasmaParams, plasmaSample } from "./plasma-math.js";
export {
  PLASMA_MAX_BUFFER,
  PLASMA_QUALITIES,
  clampPlasmaBuffer,
  normalizePlasmaQuality,
  plasmaQuality,
  plasmaQualityLabel,
} from "./plasma-quality.js";
export { PLASMA_TYPES, normalizePlasmaType, plasmaTypeLabel } from "./plasma-types.js";
