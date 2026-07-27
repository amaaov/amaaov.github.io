import { normalizePlasmaType } from "./plasma-types.js";
import { cheapNoise } from "./plasma-noise.js";
import { hslToRgb } from "./plasma-styles-color.js";
import {
  sampleAmaterasu,
  sampleBurn,
  sampleKaleidoscope,
  sampleSand,
  sampleSusanoo,
  sampleTsukuyomi,
  shadeAmaterasu,
  shadeBurn,
  shadeKaleidoscope,
  shadeSand,
  shadeSusanoo,
  shadeTsukuyomi,
} from "./plasma-styles-extra.js";

/** Type-specific field sample and color. Shared params come from plasmaParams. */

export function plasmaField(nx, ny, params) {
  const type = normalizePlasmaType(params.type);
  if (type === "clouds") return sampleClouds(nx, ny, params);
  if (type === "oil-water") return sampleOil(nx, ny, params);
  if (type === "campfire") return sampleCampfire(nx, ny, params);
  if (type === "lens") return sampleLens(nx, ny, params);
  if (type === "water") return sampleWater(nx, ny, params);
  if (type === "letter-burn") return sampleBurn(nx, ny, params);
  if (type === "tsukuyomi") return sampleTsukuyomi(nx, ny, params);
  if (type === "amaterasu") return sampleAmaterasu(nx, ny, params);
  if (type === "susanoo") return sampleSusanoo(nx, ny, params);
  if (type === "kaleidoscope") return sampleKaleidoscope(nx, ny, params);
  if (type === "sand") return sampleSand(nx, ny, params);
  return sampleClassic(nx, ny, params);
}

export function plasmaShade(value, params, nx = 0, ny = 0) {
  const type = normalizePlasmaType(params.type);
  if (type === "clouds") return shadeClouds(value, params);
  if (type === "oil-water") return shadeOil(value, params);
  if (type === "campfire") return shadeFire(value, params);
  if (type === "letter-burn") return shadeBurn(value, params, nx, ny);
  if (type === "lens") return shadeLens(value, params);
  if (type === "water") return shadeWater(value, params);
  if (type === "tsukuyomi") return shadeTsukuyomi(value, params);
  if (type === "amaterasu") return shadeAmaterasu(value, params);
  if (type === "susanoo") return shadeSusanoo(value, params);
  if (type === "kaleidoscope") return shadeKaleidoscope(value, params);
  if (type === "sand") return shadeSand(value, params, nx, ny);
  return shadeClassic(value, params);
}

export { hslToRgb };

function rotated(nx, ny, drift) {
  const cos = Math.cos(drift);
  const sin = Math.sin(drift);
  return { rx: nx * cos - ny * sin, ry: nx * sin + ny * cos };
}

function sampleClassic(nx, ny, params) {
  const { time, spatial, swirl, drift, pulse, ghost, codeWave } = params;
  const { rx, ry } = rotated(nx, ny, drift);
  const radius = Math.hypot(rx, ry) * 2;
  const phase = time + codeWave * 1.15;
  const wave =
    Math.sin(rx * spatial + phase) +
    Math.sin(ry * spatial * 0.87 - phase * 0.85) +
    Math.sin((rx + ry) * spatial * 0.55 + phase * swirl) +
    Math.sin(radius * spatial * 0.7 - phase * 1.1) +
    Math.sin((rx * rx + ry * ry) * spatial * 1.4 + phase * 0.4) * (0.35 + ghost) +
    Math.sin(rx * spatial * 0.35 - ry * spatial * 0.5 + codeWave) * 0.45;
  return (wave / (4.8 + ghost)) * pulse;
}

function sampleClouds(nx, ny, params) {
  const { time, spatial, drift, pulse, codeWave, progress } = params;
  const soft = spatial * 0.4;
  const wind = time * 0.28 + progress * 0.9;
  const warp = (cheapNoise(nx, ny, time, 3) - 0.5) * 0.16;
  const { rx, ry } = rotated(nx + warp + wind * 0.04, ny * 0.92 - warp * 0.3, drift * 0.18);
  const phase = time * 0.32 + codeWave * 0.45;
  const radius = Math.hypot(rx, ry);
  const fluff = cheapNoise(rx, ry, time * 0.5, 11);
  const plasma =
    Math.sin(rx * soft + phase + wind) +
    Math.sin(ry * soft * 0.88 - phase * 0.75) +
    Math.sin((rx + ry) * soft * 0.52 + phase * 0.55) +
    Math.sin((rx - ry) * soft * 0.4 - phase * 0.35) +
    Math.sin(radius * soft * 0.7 - phase * 0.95) +
    Math.sin(rx * soft * 1.35 - ry * soft * 0.7 + wind * 0.6) * 0.75 +
    fluff * 0.55;
  const field = plasma / 5.4;
  const billow = Math.abs(field);
  return (
    smoothstep(0.12, 0.52, billow) * (0.7 + pulse * 0.3) + field * 0.18
  );
}

function sampleOil(nx, ny, params) {
  const { time, spatial, swirl, drift, pulse, ghost, codeWave } = params;
  const warp =
    Math.sin(ny * 3 + time * 0.7) * 0.08 +
    Math.sin(nx * 2.4 - time * 0.5 + codeWave) * 0.07;
  const { rx, ry } = rotated(nx + warp, ny - warp * 0.6, drift);
  const wave =
    Math.sin(rx * spatial * 1.1 + time) +
    Math.sin(ry * spatial * 1.3 - time * swirl) +
    Math.sin((rx * ry) * spatial * 2.2 + time * 0.6) * (1.1 + ghost) +
    Math.sin((rx + ry) * spatial * 0.4 - codeWave);
  return (wave / 4.4) * pulse;
}

function sampleCampfire(nx, ny, params) {
  const { time, spatial, pulse, codeWave } = params;
  const heat = Math.max(0, 0.55 - ny);
  const rise = ny * 2.2 + Math.sin(nx * 8 + time * 2.2) * 0.12;
  const ember = cheapNoise(nx * 1.4, ny * 1.4, time * 1.6, 5);
  const wave =
    Math.sin(nx * spatial * 1.6 + time * 2.4 + rise) +
    Math.sin(nx * spatial * 0.9 - time * 1.7 + codeWave) +
    Math.sin((nx * nx) * spatial * 3 - time * 1.1) * 0.7 +
    heat * 1.4 +
    ember * 0.35;
  return (wave / 4.6) * pulse * (0.55 + heat);
}

function sampleLens(nx, ny, params) {
  const { time, spatial, drift, pulse, ghost, codeWave } = params;
  const { rx, ry } = rotated(nx, ny, drift * 0.2);
  const radius = Math.hypot(rx, ry);
  const ring = Math.sin(radius * spatial * 2.8 - time * 1.3 + codeWave);
  const flare = Math.sin(rx * spatial * 0.5 + time * 0.4) * Math.cos(ry * 4 + time);
  const spark = Math.sin(1 / (radius + 0.12) + time * 0.8) * (0.4 + ghost);
  return ((ring * 1.2 + flare + spark) / 3.2) * pulse;
}

function sampleWater(nx, ny, params) {
  const { time, spatial, swirl, pulse, codeWave } = params;
  const caustic = cheapNoise(nx, ny, time, 2);
  const mirror =
    ny < 0 ? ny : -ny * 0.92 + Math.sin(nx * 10 + time) * 0.03 + (caustic - 0.5) * 0.05;
  const wave =
    Math.sin(nx * spatial + time * 0.9 + mirror * 2) +
    Math.sin(mirror * spatial * 1.4 - time * swirl) +
    Math.sin((nx + mirror) * spatial * 0.6 + codeWave) +
    Math.sin(nx * 14 + time * 2.5) * 0.25 +
    caustic * 0.2;
  return (wave / 3.9) * pulse;
}

function smoothstep(edge0, edge1, value) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function shadeClassic(value, params) {
  const wave = Math.sin(value * Math.PI * (params.contrast || 1));
  const hue =
    (params.hueBase + (wave * 0.5 + 0.5) * 140 + params.progress * 40) % 360;
  const saturation = 0.55 + Math.min(0.4, ((params.contrast || 1) - 0.55) * 0.5);
  const lightness = 0.28 + (wave * 0.5 + 0.5) * 0.42;
  return hslToRgb(hue, saturation, lightness);
}

function shadeClouds(value, params) {
  const density = Math.min(1, Math.max(0, value));
  const plasmaTone = Math.sin(density * Math.PI * 1.2) * 0.5 + 0.5;
  if (density < 0.22) {
    const sky =
      0.48 + density * 0.55 + plasmaTone * 0.04 + (params.pulse - 0.82) * 0.04;
    return hslToRgb(206 + plasmaTone * 8, 0.42 + density * 0.1, sky);
  }
  return hslToRgb(
    215 + plasmaTone * 12,
    0.06 + density * 0.08,
    0.62 + density * 0.3 + plasmaTone * 0.06,
  );
}

function shadeOil(value, params) {
  const wave = Math.sin(value * Math.PI * 1.4);
  const hue = (params.hueBase + (wave * 0.5 + 0.5) * 280 + params.time * 12) % 360;
  return hslToRgb(hue, 0.7, 0.32 + (wave * 0.5 + 0.5) * 0.4);
}

function shadeFire(value, params) {
  const wave = Math.min(1, Math.max(0, value * 0.55 + 0.45));
  const hue = 8 + wave * 48 + (params.pulse - 0.82) * 20;
  return hslToRgb(hue, 0.85, 0.18 + wave * 0.45);
}

function shadeLens(value, params) {
  const wave = Math.abs(value);
  const hue = (190 + params.hueBase * 0.1 + wave * 80) % 360;
  const lightness = 0.2 + Math.min(0.7, wave * 0.85 + (params.ghost || 0) * 0.15);
  return hslToRgb(hue, 0.45, lightness);
}

function shadeWater(value, params) {
  const wave = value * 0.5 + 0.5;
  const hue = (175 + params.hueBase * 0.08 + wave * 35) % 360;
  return hslToRgb(hue, 0.55, 0.22 + wave * 0.4);
}
