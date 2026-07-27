import { patternUnitWeight } from "./clock-pattern.js";
import { plasmaField, plasmaShade } from "./plasma-styles.js";
import { normalizePlasmaType } from "./plasma-types.js";

const TWO_PI = Math.PI * 2;

/**
 * Synth + Morse progress drive a continuous plasma field.
 * No sector splits: code and keying reshape the whole wave.
 */
export function plasmaParams(
  settings,
  progress,
  beats,
  activeBeatIndex,
  now,
  { type = "classic", letterMask = 0, letterDust = 0 } = {},
) {
  const frequency = Number(settings.frequency) || 700;
  const filterHz = Number(settings.filterHz) || 3200;
  const drive = Math.min(1, Math.max(0, Number(settings.drive) || 0));
  const resonance = Math.min(8, Math.max(0.1, Number(settings.resonance) || 0.7));
  const wpm = Math.max(5, Number(settings.wpm) || 18);
  const lfoRate = Math.max(0.05, Number(settings.lfo1Rate) || 0.4);
  const delayMix = Math.min(1, Math.max(0, Number(settings.delayMix) || 0));
  const feedback = Math.min(1, Math.max(0, Number(settings.feedback) || 0));
  const clampedProgress = Math.min(1, Math.max(0, Number(progress) || 0));
  const mark =
    activeBeatIndex >= 0 && beats?.[activeBeatIndex]
      ? beats[activeBeatIndex]
      : null;
  const tone = mark ? (mark.kind === "dah" ? 1 : 0.62) : 0;
  const markCount = beats?.length || 0;

  return {
    type: normalizePlasmaType(type),
    letterMask: Math.min(1, Math.max(0, Number(letterMask) || 0)),
    letterDust: Math.min(1, Math.max(0, Number(letterDust) || 0)),
    time:
      (Number(now) || 0) * 0.001 * (0.35 + wpm / 40) +
      clampedProgress * TWO_PI * (0.9 + drive),
    drift: clampedProgress * TWO_PI,
    progress: clampedProgress,
    spatial: 2.2 + (filterHz / 8000) * 5.5,
    swirl: 0.6 + lfoRate * 1.8 + feedback * 1.4,
    contrast: 0.55 + drive * 0.9 + (resonance - 0.7) * 0.15,
    hueBase: ((frequency - 200) / 900) * 360 + engineHueShift(settings.engine),
    ghost: delayMix * 0.55 + feedback * 0.35,
    pulse: 0.82 + tone * 0.45,
    codeWave: codeWaveAt(clampedProgress, beats, markCount),
  };
}

export function plasmaSample(nx, ny, params) {
  return plasmaField(nx, ny, params);
}

export function plasmaColor(value, params, nx = 0, ny = 0) {
  return plasmaShade(value, params, nx, ny);
}

/** Continuous pattern morph from tone weights along progress (not pie slices). */
function codeWaveAt(progress, beats, markCount) {
  if (!beats?.length) return Math.sin(progress * TWO_PI);
  const total = patternUnitWeight(beats) || 1;
  let cursor = 0;
  let wave = 0;
  for (let index = 0; index < beats.length; index += 1) {
    const span = (beats[index].weight || 1) / total;
    const center = cursor + span * 0.5;
    const width = span * 0.85 + 0.04;
    const falloff = Math.exp(
      -((progress - center) * (progress - center)) / (2 * width * width),
    );
    wave += falloff * (beats[index].kind === "dah" ? 1 : 0.45);
    cursor += span;
  }
  return wave + Math.sin(progress * TWO_PI * Math.max(1, markCount * 0.35)) * 0.25;
}

function engineHueShift(engine) {
  const text = String(engine || "sine");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 33 + text.charCodeAt(index)) % 360;
  }
  return hash;
}
