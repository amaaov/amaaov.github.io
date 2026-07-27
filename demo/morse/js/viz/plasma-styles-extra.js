import { cheapNoise } from "./plasma-noise.js";
import { hslToRgb } from "./plasma-styles-color.js";

/** Letter burn, mythic trio, and sand drawing field/shade helpers. */

export function sampleBurn(nx, ny, params) {
  const mask = Number(params.letterMask) || 0;
  const dust = Number(params.letterDust) || 0;
  const { time, spatial, pulse, codeWave, progress } = params;
  const heat = Math.max(0, 0.5 - ny);
  const ashNoise = cheapNoise(nx * 2, ny * 2, time * 1.4, 40);
  const flame =
    Math.sin(nx * spatial * 1.5 + time * 2.6 + ny * 3) +
    Math.sin(nx * 11 - time * 1.9 + codeWave) * 0.7 +
    heat;
  const ember = ashNoise * dust;
  const core = mask * (0.9 + pulse * 0.35);
  const ashTrail = dust * (0.55 + ashNoise * 0.3);
  return (
    (flame / 3.2) * (0.25 + core * 0.5 + ashTrail) +
    core * 0.65 +
    ashTrail * 0.9 +
    ember * 0.45 +
    progress * mask * 0.08
  );
}

export function shadeBurn(value, params, nx = 0, ny = 0) {
  const mask = Number(params.letterMask) || 0;
  const dust = Number(params.letterDust) || 0;
  const wave = Math.min(1, Math.max(0, value * 0.5 + 0.4));
  const speck = cheapNoise(nx * 3, ny * 3, params.time || 0, 44);
  if (dust > mask * 0.85 && dust > 0.15) {
    const ash = 0.2 + dust * 0.35 + wave * 0.15 + speck * 0.1;
    return hslToRgb(25 + wave * 20, 0.15 + dust * 0.25, ash);
  }
  const hue = 6 + wave * 42 + mask * 12 + speck * 8;
  const lightness = 0.14 + wave * 0.4 + mask * 0.18 + dust * 0.1;
  return hslToRgb(hue, 0.88, lightness);
}

export function sampleTsukuyomi(nx, ny, params) {
  const { time, spatial, drift, pulse, ghost, codeWave, progress } = params;
  const cos = Math.cos(drift * 0.15);
  const sin = Math.sin(drift * 0.15);
  const rx = nx * cos - ny * sin;
  const ry = nx * sin + ny * cos;
  const radius = Math.hypot(rx, ry);
  const veilNoise = cheapNoise(rx, ry, time * 0.4, 90);
  const moon = Math.exp(-((radius - 0.22) ** 2) / 0.018);
  const veil =
    Math.sin(radius * spatial * 1.6 - time * 0.55 + codeWave) +
    Math.sin(rx * 3.2 + time * 0.35) * Math.cos(ry * 2.8 - time * 0.4) +
    veilNoise * 0.35;
  const genjutsu = Math.sin(1 / (radius + 0.18) + time * 0.25 + progress * 4);
  return (
    ((veil * 0.7 + genjutsu * (0.45 + ghost) + moon * 2.2) / 3.4) *
    (0.75 + pulse * 0.3)
  );
}

export function shadeTsukuyomi(value, params) {
  const wave = Math.min(1, Math.max(0, value * 0.55 + 0.45));
  const moonGlow = Math.max(0, value);
  const hue = 330 + wave * 40 + (params.progress || 0) * 15;
  const saturation = 0.55 + moonGlow * 0.25;
  const lightness = 0.08 + wave * 0.28 + moonGlow * 0.22;
  return hslToRgb(hue % 360, saturation, lightness);
}

export function sampleAmaterasu(nx, ny, params) {
  const { time, spatial, pulse, codeWave, progress } = params;
  const heat = Math.max(0, 0.62 - ny);
  const rise = ny * 2.4 + Math.sin(nx * 9 + time * 2.8) * 0.1;
  const flicker = cheapNoise(nx, ny, time * 1.8, 50);
  const blackFire =
    Math.sin(nx * spatial * 1.7 + time * 2.8 + rise) +
    Math.sin(nx * spatial * 0.85 - time * 2.1 + codeWave) +
    Math.sin((nx * nx + 0.2) * spatial * 3.4 - time * 1.4) * 0.85 +
    heat * 1.6 +
    flicker * 0.4;
  const sear = Math.sin(nx * 22 + time * 4.2 + progress * 3) * heat;
  return ((blackFire + sear) / 5) * pulse * (0.5 + heat);
}

export function shadeAmaterasu(value, params) {
  const wave = Math.min(1, Math.max(0, value * 0.6 + 0.35));
  const edge = Math.max(0, wave - 0.55) * 2.2;
  const hue = 350 + edge * 25 + (params.pulse - 0.82) * 15;
  const saturation = 0.35 + edge * 0.55;
  const lightness = 0.03 + wave * 0.12 + edge * 0.28;
  return hslToRgb(hue % 360, saturation, lightness);
}

export function sampleSusanoo(nx, ny, params) {
  const { time, spatial, drift, pulse, ghost, codeWave, progress } = params;
  const cos = Math.cos(drift * 0.25);
  const sin = Math.sin(drift * 0.25);
  const rx = nx * cos - ny * sin;
  const ry = nx * sin + ny * cos;
  const radius = Math.hypot(rx, ry);
  const spark = cheapNoise(rx, ry, time * 1.5, 69);
  const rib = Math.sin(radius * spatial * 2.2 - time * 0.9 + codeWave);
  const bolt = Math.sin(rx * 14 + time * 3.5) * Math.cos(ry * 9 - time * 2.2);
  const armor = Math.sin(1 / (radius + 0.14) + time * 0.55 + progress * 5);
  const storm = Math.sin((rx + ry) * spatial * 0.7 - time * 1.1) * (0.5 + ghost);
  return ((rib * 1.1 + bolt * 0.9 + armor * 1.3 + storm + spark * 0.35) / 3.8) * pulse;
}

export function shadeSusanoo(value, params) {
  const wave = Math.abs(value);
  const bolt = Math.min(1, wave * 1.4);
  const hue = 210 + bolt * 70 + (params.progress || 0) * 20;
  const saturation = 0.55 + bolt * 0.35;
  const lightness = 0.12 + bolt * 0.48 + (params.ghost || 0) * 0.1;
  return hslToRgb(hue % 360, saturation, lightness);
}

export function sampleKaleidoscope(nx, ny, params) {
  const { time, spatial, pulse, codeWave, progress, swirl } = params;
  const segments = 6 + Math.floor((progress || 0) * 2);
  const radius = Math.hypot(nx, ny);
  let angle = Math.atan2(ny, nx) + time * 0.15 + (codeWave || 0) * 0.08;
  const wedge = (Math.PI * 2) / segments;
  angle = ((angle % wedge) + wedge) % wedge;
  if (angle > wedge * 0.5) angle = wedge - angle;
  const mx = Math.cos(angle) * radius;
  const my = Math.sin(angle) * radius;
  const phase = time * 0.9 + codeWave * 0.7;
  const wave =
    Math.sin(mx * spatial * 1.2 + phase) +
    Math.sin(my * spatial * 1.05 - phase * 0.8) +
    Math.sin((mx + my) * spatial * 0.55 + phase * (0.6 + swirl * 0.2)) +
    Math.sin(radius * spatial * 1.4 - phase * 1.1) +
    Math.sin(mx * spatial * 0.35 - my * spatial * 0.5 + progress * 4) * 0.6;
  return (wave / 4.6) * pulse;
}

export function shadeKaleidoscope(value, params) {
  const wave = Math.sin(value * Math.PI * 1.35);
  const unit = wave * 0.5 + 0.5;
  const hue =
    (params.hueBase + unit * 300 + (params.time || 0) * 18 + (params.progress || 0) * 60) %
    360;
  return hslToRgb(hue, 0.72, 0.28 + unit * 0.42);
}

function fingerGroove(nx, ny, originY, phase, width, bend) {
  const path =
    originY +
    Math.sin(nx * bend + phase) * 0.32 +
    Math.sin(nx * bend * 0.45 - phase * 0.7) * 0.18;
  const dist = ny - path;
  const trough = Math.exp(-(dist * dist) / (width * width));
  const ridge = (Math.abs(dist) / width) * trough;
  return ridge * 0.55 - trough * 0.9;
}

export function sampleSand(nx, ny, params) {
  const { time, spatial, drift, pulse, codeWave, progress } = params;
  const paint = time * 0.35 + (progress || 0) * 2.4 + (codeWave || 0) * 0.4;
  const bed =
    Math.sin(nx * spatial * 0.22 + drift * 0.2) * 0.12 +
    Math.sin(ny * spatial * 0.18 - time * 0.05) * 0.1;
  const grain = cheapNoise(nx * 3.2, ny * 3.2, time * 0.2, 80) * 0.12;
  const strokeA = fingerGroove(nx, ny, -0.15, paint, 0.14, 1.7);
  const strokeB = fingerGroove(nx * 0.92 + 0.1, ny, 0.22, paint * 1.15 + 1.7, 0.12, 1.35);
  const strokeC = fingerGroove(ny * 0.85, nx, 0.05, paint * 0.8 + 3.1, 0.11, 1.5);
  const swirl =
    Math.sin(Math.hypot(nx, ny) * 3.2 - paint) *
    Math.exp(-Math.hypot(nx, ny) * 1.4) *
    0.22;
  return (bed + grain + (strokeA + strokeB + strokeC) * pulse + swirl) / 1.8;
}

export function shadeSand(value, params, nx = 0, ny = 0) {
  const unit = value * 0.5 + 0.5;
  const grain = cheapNoise(nx * 4.5, ny * 4.5, (params.time || 0) * 0.15, 84) * 0.04;
  // Grooves read darker/wetter; ridges catch light like displaced sand.
  const hue = 36 + unit * 10 + (params.hueBase || 0) * 0.02;
  const saturation = 0.22 + (1 - unit) * 0.12;
  const lightness = 0.42 + unit * 0.28 + grain + (params.pulse - 0.82) * 0.04;
  return hslToRgb(hue, saturation, lightness);
}
