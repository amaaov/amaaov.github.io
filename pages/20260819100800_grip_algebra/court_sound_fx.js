import { EMPTY_SIGN, HOLD_SIGN, MIXED_SIGN, AIRBORNE_SIGN } from "./holding.js";

export const SOUND_SIGNS = [HOLD_SIGN, AIRBORNE_SIGN, MIXED_SIGN];

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function unitHash(seed) {
  const next = Math.sin(seed * 12.9898) * 43758.5453;
  return next - Math.floor(next);
}

export const TAPE_SPEED_MINIMUM = -2;
export const TAPE_SPEED_MAXIMUM = 2;
export const TAPE_SPEED_STICKY = 0.08;

export function tapeSpeedRate(unit) {
  const raw = Number(unit);
  if (!Number.isFinite(raw)) {
    return 1;
  }
  const clamped = clamp(raw, TAPE_SPEED_MINIMUM, TAPE_SPEED_MAXIMUM);
  return Math.abs(clamped) <= TAPE_SPEED_STICKY ? 0 : clamped;
}

export function formatTapeReading(seconds, locale = "en") {
  const russian = String(locale).startsWith("ru");
  if (!(seconds > 0)) {
    return russian ? "0 мс" : "0 ms";
  }
  if (seconds < 1) {
    const milliseconds = Math.round(seconds * 1000);
    return russian ? `${milliseconds} мс` : `${milliseconds} ms`;
  }
  const shown = Number(seconds).toFixed(2);
  return russian ? `${shown} с` : `${shown} s`;
}

export function formatTapeSpeedReading(rate) {
  if (rate === 0) {
    return "0";
  }
  const shown = Math.abs(rate).toFixed(2);
  return rate < 0 ? `−${shown}` : `+${shown}`;
}

export function delayPathOpen(delay, feedback) {
  return delay > 0 && feedback > 0;
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

export function scatterPlan(amount, timeSeconds, pointerX, scroll) {
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

export function voiceSignFromControlName(name) {
  const key = String(name ?? "");
  if (/Solo$/.test(key)) {
    return null;
  }
  if (key === "soundWaveHold" || key.startsWith("soundHold")) {
    return HOLD_SIGN;
  }
  if (key === "soundWaveRelease" || key.startsWith("soundRelease")) {
    return AIRBORNE_SIGN;
  }
  if (key === "soundWaveMixed" || key.startsWith("soundMixed")) {
    return MIXED_SIGN;
  }
  return null;
}

export function rememberSoundAudition(form, name) {
  if (/Solo$/.test(String(name ?? ""))) {
    if (form?.dataset) {
      delete form.dataset.soundAudition;
    }
    return null;
  }
  const sign = voiceSignFromControlName(name);
  if (sign && form?.dataset) {
    form.dataset.soundAudition = sign;
  }
  return sign;
}

export function auditionSignFromForm(form) {
  const sign = form?.dataset?.soundAudition;
  return SOUND_SIGNS.includes(sign) ? sign : null;
}

export function soloedSigns(solos = {}) {
  return SOUND_SIGNS.filter((sign) => solos[sign]);
}

export function occupancyGateOpen(state, solos = {}) {
  const selected = soloedSigns(solos);
  if (selected.length === 0) {
    return SOUND_SIGNS.includes(state);
  }
  return selected.includes(state);
}

export function soundEnvelopePhase(state, solos = {}) {
  const selected = soloedSigns(solos);
  const soloKey = selected.join("+") || "-";
  if (selected.length === 0) {
    return `${soloKey}:${state}`;
  }
  return selected.includes(state) ? `${soloKey}:${state}` : `${soloKey}:release`;
}

export function soundEnvelopeClock(previousPhase, nextPhase, elapsed, {
  gateOpen,
  alreadyClosed = false,
} = {}) {
  if (previousPhase === nextPhase && previousPhase !== null) {
    return null;
  }
  if (previousPhase === null) {
    return {
      phase: nextPhase,
      changedAt: gateOpen ? elapsed : elapsed - 1000,
    };
  }
  return {
    phase: nextPhase,
    changedAt: gateOpen || !alreadyClosed ? elapsed : elapsed - 1000,
  };
}

export function soundingSign(state, solos = {}, audition = null) {
  const selected = soloedSigns(solos);
  if (selected.length > 0) {
    return selected.includes(state) ? state : selected[0];
  }
  if (state === EMPTY_SIGN) {
    return state;
  }
  if (SOUND_SIGNS.includes(audition)) {
    return audition;
  }
  return state;
}

export function solosFromForm(form) {
  return {
    [HOLD_SIGN]: form.elements.namedItem("soundHoldSolo")?.checked === true,
    [AIRBORNE_SIGN]: form.elements.namedItem("soundReleaseSolo")?.checked === true,
    [MIXED_SIGN]: form.elements.namedItem("soundMixedSolo")?.checked === true,
  };
}

export const TAPE_LOOP_MAXIMUM_SECONDS = 30;

export function tapePlan(effects = {}, { silent = false, keepPlayback = false } = {}) {
  const seconds = tapeLoopSeconds(effects.tape);
  const held = Boolean(effects.held);
  const recording = seconds > 0 && !held && !silent;
  const wet = seconds > 0 && (!silent || held || keepPlayback) ? 1 : 0;
  return {
    tapeSpeed: tapeSpeedRate(effects.speed ?? 1),
    tapeLoopSeconds: seconds,
    tapeWet: wet,
    tapeDry: clamp(effects.tapeDry ?? 1, 0, 1),
    tapeRecording: recording,
    tapeHeld: held,
  };
}

export function tapeLoopSeconds(seconds) {
  if (!(seconds > 0)) {
    return 0;
  }
  return clamp(seconds, 0, TAPE_LOOP_MAXIMUM_SECONDS);
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

export function tapeLoopView({
  write = 0,
  play = 0,
  loopSamples = 1,
  filled = 0,
  recording = false,
  held = false,
} = {}) {
  const length = Math.max(1, loopSamples);
  return {
    record: (((write % length) + length) % length) / length,
    play: (((play % length) + length) % length) / length,
    filled: clamp(filled / length, 0, 1),
    recording,
    held,
  };
}

export function writeTapeRing(ring, writeIndex, input) {
  let write = writeIndex;
  const length = ring.length;
  for (let index = 0; index < input.length; index += 1) {
    ring[write] = input[index];
    write += 1;
    if (write >= length) {
      write = 0;
    }
  }
  return write;
}

export function fillTapeOutput(ring, writeIndex, delaySamples, speed, reverse, output) {
  const length = ring.length;
  const step = (reverse ? -1 : 1) * speed;
  if (step === 0) {
    output.fill(0);
    return;
  }
  let read = writeIndex - Math.max(1, delaySamples);
  for (let index = 0; index < output.length; index += 1) {
    const sampleIndex = ((Math.floor(read) % length) + length) % length;
    output[index] = ring[sampleIndex] ?? 0;
    read += step;
  }
}
