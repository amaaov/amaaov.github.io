/**
 * Holding Topology court-sound FX helpers for the FM-1 spine.
 * Pure maps shared by the Web Audio mix and firmware contract tests.
 */

export const TAPE_LOOP_MAXIMUM_SECONDS = 30;
export const TAPE_SPEED_MINIMUM = -2;
export const TAPE_SPEED_MAXIMUM = 2;
export const TAPE_SPEED_STICKY = 0.08;

export const LFO_DESTINATIONS = ["pitch", "cutoff", "width", "level", "pan"];
export const LFO_SHAPES = ["sine", "triangle", "square", "pulse"];

export const DEFAULT_ENVELOPE = {
  attack: 0.045,
  decay: 0.18,
  sustain: 0.62,
  release: 0.35,
  filterEnv: 0.28,
};

export const DEFAULT_MASTER_FX = {
  eqLows: 0.55,
  eqMids: 0.6,
  eqHighs: 0.5,
  compress: 0.45,
  scatter: 0.2,
  tape: 4,
  tapeDry: 0.75,
  speed: 1,
};

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function unitHash(seed) {
  const next = Math.sin(seed * 12.9898) * 43758.5453;
  return next - Math.floor(next);
}

export function tapeSpeedRate(unit) {
  const raw = Number(unit);
  if (!Number.isFinite(raw)) {
    return 1;
  }
  const clamped = clamp(raw, TAPE_SPEED_MINIMUM, TAPE_SPEED_MAXIMUM);
  return Math.abs(clamped) <= TAPE_SPEED_STICKY ? 0 : clamped;
}

export function tapeLoopSeconds(seconds) {
  if (!(seconds > 0)) {
    return 0;
  }
  return clamp(seconds, 0, TAPE_LOOP_MAXIMUM_SECONDS);
}

export function tapePlan(effects = {}, { silent = false, keepPlayback = false } = {}) {
  const seconds = tapeLoopSeconds(effects.tape);
  const held = Boolean(effects.held);
  const recording = seconds > 0 && !held && !silent && Boolean(effects.recording);
  const live = seconds > 0 && (!silent || held || keepPlayback);
  return {
    tapeSpeed: tapeSpeedRate(effects.speed ?? 1),
    tapeLoopSeconds: seconds,
    tapeWet: live ? clamp(effects.tapeDry ?? 1, 0, 1) : 0,
    tapeDry: 1,
    tapeRecording: recording,
    tapeHeld: held,
  };
}

export function writeTapeLoop(ring, writeIndex, input, { recording, loopSamples }) {
  if (!recording) {
    return writeIndex;
  }
  const length = Math.min(ring.length, Math.max(1, Math.floor(loopSamples)));
  let write = writeIndex;
  if (write >= length) {
    write = 0;
  }
  for (let index = 0; index < input.length; index += 1) {
    ring[write] = input[index];
    write += 1;
    if (write >= length) {
      write = 0;
    }
  }
  return write;
}

export function fillTapeLoop(ring, playIndex, loopSamples, speed, reverse, output) {
  const length = Math.min(ring.length, Math.max(1, Math.floor(loopSamples)));
  const step = (reverse ? -1 : 1) * speed;
  if (step === 0) {
    output.fill(0);
    return playIndex;
  }
  let read = playIndex;
  for (let index = 0; index < output.length; index += 1) {
    const sampleIndex = ((Math.floor(read) % length) + length) % length;
    output[index] = ring[sampleIndex] ?? 0;
    read += step;
  }
  return ((read % length) + length) % length;
}

export function scatterSliceSeconds(amount, pointerX = 0.5, scroll = 0.5, timeSeconds = 0) {
  if (amount <= 0) {
    return 0.05;
  }
  const base = 0.2 - amount * 0.16;
  const wander = (pointerX - 0.5) * 0.04 + (scroll - 0.5) * 0.03;
  const slot = Math.floor(timeSeconds * 3.2 + pointerX * 5);
  const half = unitHash(slot * 11.3 + amount * 4) > 0.62 ? 0.5 : 1;
  return clamp((base + wander) * half, 0.018, 0.22);
}

export function scatterPlan(amount, timeSeconds = 0, pointerX = 0.5, scroll = 0.5) {
  if (amount <= 0) {
    return { time: 0.05, gain: 0, feedback: 0, duck: 0 };
  }
  return {
    time: scatterSliceSeconds(amount, pointerX, scroll, timeSeconds),
    gain: 0.72 + amount * 0.26,
    feedback: 0.86 + amount * 0.12,
    duck: 0.4 + amount * 0.45,
  };
}

export function envelopeLevel(age, { attack, decay, sustain, release }, released) {
  const safeAge = Math.max(0, age);
  if (released) {
    return release <= 0 ? 0 : sustain * Math.max(0, 1 - safeAge / release);
  }
  if (attack > 0 && safeAge < attack) {
    return safeAge / attack;
  }
  const afterAttack = safeAge - Math.max(0, attack);
  if (decay > 0 && afterAttack < decay) {
    return 1 - (1 - sustain) * (afterAttack / decay);
  }
  return sustain;
}

/** ENV knob → ADSR morph (siteswap dwell stays a soft bias from the same knob). */
export function envelopeFromEnvKnob(value) {
  const amount = clamp(Number(value) || 0, 0, 1);
  return {
    attack: 0.008 + amount * 0.42,
    decay: 0.06 + (1 - amount) * 0.35,
    sustain: 0.28 + amount * 0.55,
    release: 0.12 + amount * 0.85,
    filterEnv: 0.12 + amount * 0.7,
  };
}

export function lfoDestinationFromKnob(value) {
  const index = Math.min(
    LFO_DESTINATIONS.length - 1,
    Math.floor(clamp(value, 0, 0.999) * LFO_DESTINATIONS.length),
  );
  return LFO_DESTINATIONS[index];
}

export function lfoShapeFromKnob(value) {
  const index = Math.min(
    LFO_SHAPES.length - 1,
    Math.floor(clamp(value, 0, 0.999) * LFO_SHAPES.length),
  );
  return LFO_SHAPES[index];
}

export function oscillatorTypeForLfoShape(shape) {
  if (shape === "triangle") {
    return "triangle";
  }
  if (shape === "square" || shape === "pulse") {
    return "square";
  }
  return "sine";
}

export function scatterFromFxKnob(value) {
  return clamp(Number(value) || 0, 0, 1) * 0.85;
}

export function compressAmount(unit) {
  return clamp(Number(unit) || 0, 0, 1);
}

export function eqShelfGain(unit) {
  return (clamp(Number(unit) || 0.5, 0, 1) - 0.5) * 18;
}
