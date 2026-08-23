import { EMPTY_SIGN, HOLD_SIGN, MIXED_SIGN, RELEASE_SIGN } from "./holding.js";
import {
  DEFAULT_SYNTH,
  DEFAULT_VOICE,
  FILTER_TYPES,
  cutoffHertz,
  envelopeLevel,
  pitchedFrequency,
  resonanceQ,
  synthFromForm,
  synthsFromForm,
} from "./court_sound_synth.js";
import { DEFAULT_MASTER, masterPlan } from "./court_sound_master.js";
import { lfoHertz, lfoWave } from "./court_sound_marks.js";
import {
  delayPathOpen,
  scatterPlan,
  auditionSignFromForm,
  occupancyGateOpen,
  soloedSigns,
  solosFromForm,
  soundingSign,
  SOUND_SIGNS,
  TAPE_LOOP_MAXIMUM_SECONDS,
  TAPE_SPEED_MAXIMUM,
  TAPE_SPEED_MINIMUM,
  tapePlan,
  tapeSpeedRate,
} from "./court_sound_fx.js";

export function soundDocumentOpen(hidden) {
  return hidden !== true;
}

export const SOUND_WAVES = ["sine", "triangle", "pulse", "noise"];

export const DEFAULT_STATE_WAVES = {
  [HOLD_SIGN]: "sine",
  [RELEASE_SIGN]: "triangle",
  [MIXED_SIGN]: "pulse",
};

export const DEFAULT_SOUND_EFFECTS = {
  scatter: 0.35,
  delay: 0.55,
  delayDry: 1,
  feedback: 0.62,
  tape: 8,
  tapeDry: 1,
  speed: 1,
};

const STATE_TONES = {
  [HOLD_SIGN]: [46, 69],
  [RELEASE_SIGN]: [52, 86.667],
  [MIXED_SIGN]: [41, 61.5],
};

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function lfo(timeSeconds, rate, depth, phase) {
  return depth * Math.sin((2 * Math.PI * rate * timeSeconds) + phase);
}

export function handPan(hand) {
  if (hand === 0) {
    return -0.72;
  }
  if (hand === 1) {
    return 0.72;
  }
  return 0;
}

export function occupancyChangeHand(previousFlags, currentFlags, positions) {
  if (!previousFlags || previousFlags.length !== currentFlags.length) {
    return null;
  }
  for (let index = 0; index < currentFlags.length; index += 1) {
    if (previousFlags[index] !== currentFlags[index]) {
      const hand = positions[index]?.hand;
      return hand === 0 || hand === 1 ? hand : null;
    }
  }
  return null;
}


export function soundSettingsFromForm(form) {
  const wave = (name, fallback) => {
    const value = form.elements.namedItem(name)?.value;
    return SOUND_WAVES.includes(value) ? value : fallback;
  };
  const amount = (name, fallback, minimum = 0, maximum = 1) => {
    const value = Number(form.elements.namedItem(name)?.value);
    return Number.isFinite(value) ? clamp(value, minimum, maximum) : fallback;
  };
  return {
    enabled: form.elements.namedItem("courtSound")?.checked === true,
    waves: {
      [HOLD_SIGN]: wave("soundWaveHold", DEFAULT_STATE_WAVES[HOLD_SIGN]),
      [RELEASE_SIGN]: wave("soundWaveRelease", DEFAULT_STATE_WAVES[RELEASE_SIGN]),
      [MIXED_SIGN]: wave("soundWaveMixed", DEFAULT_STATE_WAVES[MIXED_SIGN]),
    },
    effects: {
      scatter: amount("soundScatter", DEFAULT_SOUND_EFFECTS.scatter),
      delay: amount("soundDelay", DEFAULT_SOUND_EFFECTS.delay),
      delayDry: amount("soundDelayDry", DEFAULT_SOUND_EFFECTS.delayDry),
      feedback: amount("soundFeedback", DEFAULT_SOUND_EFFECTS.feedback),
      tape: amount("soundTape", DEFAULT_SOUND_EFFECTS.tape, 0, TAPE_LOOP_MAXIMUM_SECONDS),
      tapeDry: amount("soundTapeDry", DEFAULT_SOUND_EFFECTS.tapeDry),
      speed: tapeSpeedRate(amount(
        "soundSpeed",
        DEFAULT_SOUND_EFFECTS.speed,
        TAPE_SPEED_MINIMUM,
        TAPE_SPEED_MAXIMUM,
      )),
      held: form.elements.namedItem("soundTapeHold")?.checked === true,
    },
    solos: solosFromForm(form),
    synth: synthFromForm(form),
    synths: synthsFromForm(form),
    audition: auditionSignFromForm(form),
  };
}

export function courtSoundPlan({
  state,
  waves = DEFAULT_STATE_WAVES,
  effects = DEFAULT_SOUND_EFFECTS,
  synth: synthInput = DEFAULT_SYNTH,
  synths = null,
  solos = {},
  audition = null,
  eventHand = null,
  pointer = { x: 0.5, y: 0.5 },
  scrollProgress = 0.5,
  timeSeconds = 0,
  stateAgeSeconds = 8,
}) {
  const board = { ...DEFAULT_MASTER, ...synthInput };
  const voiceSign = soundingSign(state, solos, audition);
  const gateOpen = occupancyGateOpen(state, solos);
  const soloMode = soloedSigns(solos).length > 0;
  const toneSign = STATE_TONES[voiceSign] ? voiceSign : state;
  const synth = { ...DEFAULT_VOICE, ...synthInput, ...(synths?.[toneSign] ?? {}) };
  const released = !gateOpen;
  const lfoAmount = lfoWave(timeSeconds, lfoHertz(board.lfoRate), board.lfoShape);
  const depth = clamp(board.lfoDepth, 0, 1);
  const lfoSemitones = board.lfoTo === "pitch" ? lfoAmount * depth * 7 : 0;
  const widthLfo = board.lfoTo === "width" ? lfoAmount * depth * 0.18 : 0;
  const cutoffLfo = board.lfoTo === "cutoff" ? lfoAmount * depth * 0.22 : 0;
  const levelLfo = board.lfoTo === "level" ? lfoAmount * depth * 0.35 : 0;
  const panLfo = board.lfoTo === "pan" ? lfoAmount * depth * 0.4 : 0;
  const envelope = envelopeLevel(stateAgeSeconds, synth, released);
  const silent = envelope <= 0 || !STATE_TONES[toneSign];
  const pulseWidth = clamp(synth.pulseWidth + widthLfo, 0.05, 0.5);
  const filterType = FILTER_TYPES.includes(synth.filter) ? synth.filter : "lowpass";
  const filterQ = resonanceQ(synth.resonance);
  const pointerX = clamp(pointer.x ?? 0.5, 0, 1);
  const lowpassFrequency = clamp(
    cutoffHertz(clamp(
      synth.cutoff + cutoffLfo + envelope * (synth.filterEnv ?? 0) * 0.35,
      0,
      1,
    ))
      + (toneSign === RELEASE_SIGN ? 40 : 0)
      + pointerX * 30,
    24,
    6000,
  );
  const instrument = {
    pulseWidth,
    fold: synth.fold ?? 0,
    filterType,
    filterQ,
    glide: synth.glide,
    release: synth.release,
    envelope,
    master: masterPlan(board),
  };
  const occupancyLive = SOUND_SIGNS.includes(state);
  const tape = tapePlan(effects, {
    silent,
    keepPlayback: occupancyLive || soloMode,
  });
  const pointerY = clamp(pointer.y ?? 0.5, 0, 1);
  const scroll = clamp(scrollProgress, 0, 1);
  const speedRate = Math.abs(tape.tapeSpeed);
  const timeScale = speedRate > 0 ? Math.max(0.25, speedRate) : 1;
  const scatter = scatterPlan(effects.scatter ?? 0, timeSeconds, pointerX, scroll);
  const scatterTime = clamp(scatter.time / timeScale, 0.012, 0.4);
  let delayTime = 0;
  let feedback = 0;
  let wet = 0;
  if (delayPathOpen(effects.delay ?? 0, effects.feedback ?? 0)) {
    delayTime = clamp(
      (0.36 + effects.delay * 0.28 + pointerY * 0.2 + lfo(timeSeconds, 0.07, 0.035, 0.4))
        / timeScale,
      0.02,
      2.2,
    );
    feedback = clamp(
      0.34 + effects.feedback * 0.34 + scroll * 0.14 + lfo(timeSeconds, 0.11, 0.04, 1.2),
      0.18,
      0.84,
    );
    wet = clamp(0.42 + effects.delay * 0.18 + scroll * 0.12, 0.28, 0.72);
  }
  const field = {
    delayTime,
    feedback,
    scatterTime,
    scatterGain: scatter.gain,
    scatterFeedback: scatter.feedback,
    dry: silent ? 0 : clamp(effects.delayDry ?? DEFAULT_SOUND_EFFECTS.delayDry, 0, 1),
    delayToneFrequency: 420,
    ...tape,
    lowpassFrequency,
    wet,
    stereoPhase: Math.PI / 2,
    ...instrument,
    pan: silent
      ? 0
      : clamp(
        handPan(eventHand) + (pointerX - 0.5) * 0.35 + lfo(timeSeconds, 0.13, 0.12, 0.8) + panLfo,
        -1,
        1,
      ),
  };

  if (silent) {
    return {
      silent: true,
      state,
      voices: [],
      ...field,
    };
  }

  const chosenWave = SOUND_WAVES.includes(waves[toneSign])
    ? waves[toneSign]
    : DEFAULT_STATE_WAVES[toneSign];
  const detuneSpread = 18 * synth.detune;
  const soloGain = soloMode && gateOpen ? 1.7 : 1;
  const voices = STATE_TONES[toneSign].map((frequency, index) => {
    const pitched = pitchedFrequency(frequency, {
      pitch: synth.pitch,
      fine: synth.fine,
      lfoSemitones,
    });
    return {
      wave: chosenWave,
      frequency: pitched,
      gain: (0.28 - index * 0.04) * synth.level * envelope * soloGain * Math.max(0, 1 + levelLfo),
      detuneCents: index === 0 ? -detuneSpread : detuneSpread,
      phaseDelaySeconds: index === 0 ? 0 : 0.25 / pitched,
    };
  });

  return {
    silent: false,
    state,
    voices,
    ...field,
  };
}
