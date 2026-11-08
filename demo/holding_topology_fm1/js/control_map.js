/** Shared FM-1 control map for the simulator and firmware spine. */

import {
  envelopeFromEnvKnob,
  lfoDestinationFromKnob,
  lfoShapeFromKnob,
  scatterFromFxKnob,
} from "./ht_fx.js";

export const VOICE_COUNT = 12;

export const DEFAULT_CONTROLS = {
  master: 0.72,
  select: 0.5,
  presets: 0.35,
  algorithm: 0.4,
  knob1: 0.48,
  knob2: 0.42,
  knob3: 0.45,
  knob4: 0.55,
  env: 0.5,
  lfo: 0.4,
  fx: 0.45,
  edit: 0.4,
  glo: 0.55,
  voiceMute: Array.from({ length: VOICE_COUNT }, () => false),
};

/**
 * Every panel control gets one distinct job.
 * Keep labels short (≤8 chars) so 54px buttons and knobs do not overflow.
 */
export const CONTROL_JOBS = {
  MASTER: "Level",
  SELECT: "Trick",
  PRESETS: "Scale",
  ALGORITHM: "Type",
  KNOB1: "FB",
  KNOB2: "Depth",
  KNOB3: "Props",
  KNOB4: "Tempo",
  FX: "Grain",
  SEL: "Cosmos",
  ENV: "ADSR",
  LFO: "Route",
  EDIT: "Drive",
  GLO: "Wild",
  HOME: "Recall",
  SAVE: "Lock",
  ARP: "Rotate",
  SEQ: "Tricks",
  PLAY: "Patch",
  REC: "Tape",
  "OCT-": "−12",
  "OCT+": "+12",
};

export {
  envelopeFromEnvKnob,
  lfoDestinationFromKnob,
  lfoShapeFromKnob,
  scatterFromFxKnob,
};

export function assertUniqueControlJobs(jobs = CONTROL_JOBS) {
  const values = Object.values(jobs);
  return new Set(values).size === values.length;
}

export function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

/** Maps KNOB3 to object count in 3…7. */
export function objectCountFromSiteswapKnob(value) {
  return Math.min(7, 3 + Math.floor(clamp01(value) * 4.999));
}

export function maximumThrowFromSiteswapKnob(value) {
  return 5 + Math.round(clamp01(value) * 12);
}

export const BPM_MIN = 40;
export const BPM_MAX = 220;

export function bpmFromTempoKnob(value) {
  return Math.round(BPM_MIN + clamp01(value) * (BPM_MAX - BPM_MIN));
}

export function tempoKnobFromBpm(bpm) {
  return clamp01((Number(bpm) - BPM_MIN) / (BPM_MAX - BPM_MIN));
}

export function dwellFromEnvKnob(value) {
  return 0.28 + value * 0.4;
}

export function feedbackFromKnob(value) {
  return 0.05 + value * 0.9;
}

export function lfoDepthFromKnob(value) {
  return 0.05 + value * 0.95;
}

export function delayFromFxKnob(value) {
  return 0.08 + value * 0.7;
}

export function driveFromEditKnob(value) {
  return 0.05 + value * 0.9;
}

export function wildnessFromGloKnob(value) {
  return value;
}

export const ALGORITHM_PATCH_TYPES = [
  "looping",
  "drone",
  "jingle",
  "call_response",
  "cascade_choir",
  "vowel_chant",
  "stutter",
  "orbit",
  "euclid_groove",
  "turing_line",
  "markov_walk",
  "atlas_drums",
];

export function patchTypeFromAlgorithm(value) {
  const index = Math.min(
    ALGORITHM_PATCH_TYPES.length - 1,
    Math.floor(clamp01(value) * ALGORITHM_PATCH_TYPES.length),
  );
  return ALGORITHM_PATCH_TYPES[index];
}

export function scaleIndexFromPresets(value, scaleCount) {
  return Math.min(scaleCount - 1, Math.floor(value * scaleCount));
}
