/** Defaults and UI defs for LFOs, ENV, and modulation amounts. */

export const MOD_DEFAULTS = {
  attack: 0.008,
  decay: 0.04,
  sustain: 0.85,
  release: 0.03,
  envToFilter: 0,
  envToPitch: 0,
  lfo1Rate: 4.5,
  lfo1Shape: 0,
  lfo1ToPitch: 0,
  lfo1ToFilter: 0,
  lfo1ToAmp: 0,
  lfo2Rate: 0.35,
  lfo2Shape: 0,
  lfo2ToFilter: 0,
  lfo2ToDelay: 0,
  lfo2ToRes: 0,
  lfo3Rate: 1.2,
  lfo3Shape: 1,
  lfo3ToPitch: 0,
  lfo3ToDrive: 0,
  lfo3ToAmp: 0,
};

export const ENV_UI = [
  ["attack", "ENV attack", 0.001, 0.5, 0.001, 0.008],
  ["decay", "ENV decay", 0.01, 1, 0.01, 0.04],
  ["sustain", "ENV sustain", 0, 1, 0.01, 0.85],
  ["release", "ENV release", 0.01, 1, 0.01, 0.03],
  ["envToFilter", "ENV → filter", 0, 1, 0.01, 0],
  ["envToPitch", "ENV → pitch", 0, 1, 0.01, 0],
];

export const LFO_UI = [
  ["lfo1Rate", "LFO1 rate", 0.05, 30, 0.05, 4.5],
  ["lfo1Shape", "LFO1 shape 0–3", 0, 3, 1, 0],
  ["lfo1ToPitch", "LFO1 → pitch", 0, 1, 0.01, 0],
  ["lfo1ToFilter", "LFO1 → filter", 0, 1, 0.01, 0],
  ["lfo1ToAmp", "LFO1 → amp", 0, 1, 0.01, 0],
  ["lfo2Rate", "LFO2 rate", 0.05, 30, 0.05, 0.35],
  ["lfo2Shape", "LFO2 shape 0–3", 0, 3, 1, 0],
  ["lfo2ToFilter", "LFO2 → filter", 0, 1, 0.01, 0],
  ["lfo2ToDelay", "LFO2 → delay", 0, 1, 0.01, 0],
  ["lfo2ToRes", "LFO2 → res", 0, 1, 0.01, 0],
  ["lfo3Rate", "LFO3 rate", 0.05, 30, 0.05, 1.2],
  ["lfo3Shape", "LFO3 shape 0–3", 0, 3, 1, 1],
  ["lfo3ToPitch", "LFO3 → pitch", 0, 1, 0.01, 0],
  ["lfo3ToDrive", "LFO3 → drive", 0, 1, 0.01, 0],
  ["lfo3ToAmp", "LFO3 → amp", 0, 1, 0.01, 0],
];

const SHAPES = ["sine", "triangle", "square", "sawtooth"];

export function lfoShapeName(value) {
  return SHAPES[Math.min(3, Math.max(0, Math.round(Number(value) || 0)))];
}
