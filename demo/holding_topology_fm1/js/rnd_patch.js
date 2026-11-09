import { seededRandom } from "../../../pages/20260819100800_grip_algebra/siteswap_generator.js";
import { pickHandStyle } from "../../../pages/20260819100800_grip_algebra/hand_style.js";
import { VOICE_COUNT } from "./control_map.js";
import { degreeToMidi } from "./ht_tuning.js";
import { vowelFromIndex } from "./vowel_formants.js";
import { createGeneratorBank } from "./court_gen.js";
import { createComposition, TRACK_COUNT } from "./mix_composition.js";
import {
  clampEpisodeWaits,
  generateSiteswapEpisode,
  isRestTrick,
} from "./siteswap_episode.js";
import { drumEnvelopesFromSeed } from "./drum_kit.js";

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  blues: [0, 3, 5, 6, 7, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  hirajoshi: [0, 2, 3, 7, 8],
  wholeTone: [0, 2, 4, 6, 8, 10],
  octatonic: [0, 1, 3, 4, 6, 7, 9, 10],
  /** 19-EDO major-ish heptatonic */
  edo19: [0, 3, 6, 8, 11, 14, 17],
  /** 22-EDO diatonic approximation */
  edo22: [0, 4, 7, 9, 13, 16, 19],
  /** 24-EDO quarter-tone “major” skeleton */
  edo24: [0, 4, 8, 10, 14, 18, 20],
  /** Indices into 5-limit just major ratios */
  justMajor: [0, 1, 2, 3, 4, 5, 6],
};

export const PATCH_TYPES = [
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

export const ENGINES = [
  "subtractive",
  "fm",
  "acid",
  "noise",
  "karplus",
  "supersaw",
  "additive",
  "organ",
  "vowel",
  "ring_mod",
  "am",
  "phase_distortion",
  "waveshape",
  "wavetable",
  "granular",
  "pwm",
  "pipe",
  "guitar",
  "violin",
  "piano",
  "saxophone",
  "didgeridoo",
  "vargan",
  "bubble",
  "bird",
  "forest",
  "dolphin",
  "dub_bass",
  "fire",
];

export const GENERATIVE_PATCH_TYPES = new Set([
  "euclid_groove",
  "turing_line",
  "markov_walk",
  "atlas_drums",
]);

export const TIMBRE_PROFILES = [
  "lyra_organ",
  "acid_room",
  "glass_pad",
  "noise_ritual",
  "choir_cave",
  "pulse_grid",
  "karplus_hall",
  "fm_storm",
  "string_court",
  "wind_court",
  "amazon_canopy",
  "jamaica_dub",
];

export const SCALE_NAMES = Object.keys(SCALES);
const OBJECT_CHOICES = [3, 4, 5, 6, 7];

function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}

function between(random, min, max) {
  return min + random() * (max - min);
}

function integerBetween(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function softPick(random, preferred, all, wildness) {
  if (preferred == null || !all.includes(preferred)) {
    return pick(random, all);
  }
  // wildness 0 locks; otherwise preferred is a light pull, not the default outcome.
  if (wildness <= 0) {
    return preferred;
  }
  if (random() < Math.min(0.28, wildness * 0.32)) {
    return preferred;
  }
  return pick(random, all);
}

function softAround(random, center, min, max, wildness) {
  if (center == null || wildness >= 0.75) {
    return between(random, min, max);
  }
  if (wildness <= 0) {
    return clamp(center, min, max);
  }
  // Prefer the full range so successive PLAY rolls do not cluster on knob defaults.
  if (random() < wildness * 0.85) {
    return between(random, min, max);
  }
  const spread = (max - min) * (0.2 + wildness * 0.65);
  return clamp(center + (random() * 2 - 1) * spread, min, max);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Soft colouring only — full ENGINES catalog stays eligible every roll. */
function trackEngineBias(profile, patchType, trackIndex) {
  if (patchType === "vowel_chant" || patchType === "cascade_choir") {
    return ["vowel", "organ", "additive"];
  }
  if (profile === "choir_cave") {
    return trackIndex === 3 ? ["noise", "pwm", "karplus", "granular"] : ["vowel", "organ", "additive"];
  }
  if (profile === "acid_room") {
    return ["acid", "subtractive", "pwm", "supersaw", "fm"];
  }
  if (profile === "noise_ritual") {
    return ["noise", "granular", "waveshape", "pwm", "ring_mod", "am", "pipe", "vargan", "didgeridoo"];
  }
  if (profile === "glass_pad") {
    return ["wavetable", "additive", "phase_distortion", "organ", "fm", "pipe", "violin"];
  }
  if (profile === "pulse_grid") {
    return ["pwm", "subtractive", "fm", "acid", "supersaw"];
  }
  if (profile === "karplus_hall") {
    return ["karplus", "guitar", "piano", "violin", "organ", "pipe"];
  }
  if (profile === "string_court") {
    return ["guitar", "violin", "piano", "karplus", "organ"];
  }
  if (profile === "wind_court") {
    return ["pipe", "saxophone", "didgeridoo", "vargan", "vowel"];
  }
  if (profile === "fm_storm") {
    return ["fm", "phase_distortion", "waveshape", "ring_mod", "am", "saxophone"];
  }
  if (profile === "amazon_canopy") {
    return trackIndex === 0
      ? ["bubble", "forest", "fire", "dub_bass", "subtractive"]
      : ["bird", "dolphin", "forest", "bubble", "fire", "granular", "noise"];
  }
  if (profile === "jamaica_dub") {
    return trackIndex === 0
      ? ["dub_bass", "subtractive", "acid", "organ"]
      : ["dub_bass", "pwm", "organ", "fm", "forest", "noise"];
  }
  if (patchType === "atlas_drums" && trackIndex === 3) {
    return ["noise", "pwm", "subtractive", "waveshape"];
  }
  return ENGINES;
}

function pickVoiceEngine(random, profile, patchType, trackIndex, wildness, forceVowel) {
  if (forceVowel) {
    return "vowel";
  }
  const bias = trackEngineBias(profile, patchType, trackIndex);
  const prefersBias =
    profile === "amazon_canopy" ||
    profile === "jamaica_dub" ||
    profile === "wind_court" ||
    profile === "string_court" ||
    profile === "karplus_hall" ||
    profile === "choir_cave";
  // Nature / court profiles keep bias engines audible (birds, vargan, strings).
  if (prefersBias) {
    if (random() < 0.58 + wildness * 0.22) {
      return pick(random, bias);
    }
    return pick(random, ENGINES);
  }
  // Most rolls draw from the full engine table so every engine can appear.
  if (random() < 0.62 + wildness * 0.28) {
    return pick(random, ENGINES);
  }
  return pick(random, bias);
}

function ensureEngineSpread(voices, random, minDistinct = 3) {
  const active = voices.filter((voice) => voice.active);
  if (active.length === 0) {
    return;
  }
  const used = new Set(active.map((voice) => voice.engine));
  let guard = 0;
  while (used.size < Math.min(minDistinct, active.length, ENGINES.length) && guard < 24) {
    const voice = active[Math.floor(random() * active.length)];
    const engine = pick(random, ENGINES);
    voice.engine = engine;
    used.add(engine);
    guard += 1;
  }
}

function profileMix(random, profile, wildness) {
  if (profile === "lyra_organ") {
    return {
      delayTime: between(random, 0.22, 0.42),
      drive: between(random, 0.25, 0.55),
      totalFeedback: between(random, 0.4, 0.7),
      reverb: between(random, 0.15, 0.35),
      filterHz: between(random, 3500, 7500),
      holdBias: 0.75,
    };
  }
  if (profile === "acid_room") {
    return {
      delayTime: between(random, 0.12, 0.28),
      drive: between(random, 0.45, 0.8),
      totalFeedback: between(random, 0.2, 0.45),
      reverb: between(random, 0.1, 0.25),
      filterHz: between(random, 900, 2800),
      holdBias: 0.2,
    };
  }
  if (profile === "glass_pad") {
    return {
      delayTime: between(random, 0.35, 0.6),
      drive: between(random, 0.1, 0.35),
      totalFeedback: between(random, 0.35, 0.65),
      reverb: between(random, 0.35, 0.65),
      filterHz: between(random, 4500, 9000),
      holdBias: 0.85,
    };
  }
  if (profile === "noise_ritual") {
    return {
      delayTime: between(random, 0.2, 0.5),
      drive: between(random, 0.35, 0.75),
      totalFeedback: between(random, 0.45, 0.75),
      reverb: between(random, 0.25, 0.55),
      filterHz: between(random, 1200, 4000),
      holdBias: 0.35,
    };
  }
  if (profile === "choir_cave") {
    return {
      delayTime: between(random, 0.3, 0.55),
      drive: between(random, 0.15, 0.4),
      totalFeedback: between(random, 0.4, 0.7),
      reverb: between(random, 0.4, 0.7),
      filterHz: between(random, 2500, 5500),
      holdBias: 0.9,
    };
  }
  if (profile === "pulse_grid") {
    return {
      delayTime: between(random, 0.1, 0.25),
      drive: between(random, 0.3, 0.6),
      totalFeedback: between(random, 0.15, 0.4),
      reverb: between(random, 0.08, 0.22),
      filterHz: between(random, 2000, 5000),
      holdBias: 0.15,
    };
  }
  if (profile === "karplus_hall") {
    return {
      delayTime: between(random, 0.25, 0.5),
      drive: between(random, 0.2, 0.5),
      totalFeedback: between(random, 0.3, 0.6),
      reverb: between(random, 0.3, 0.55),
      filterHz: between(random, 3000, 7000),
      holdBias: 0.45,
    };
  }
  if (profile === "string_court") {
    return {
      delayTime: between(random, 0.18, 0.4),
      drive: between(random, 0.15, 0.4),
      totalFeedback: between(random, 0.25, 0.5),
      reverb: between(random, 0.25, 0.5),
      filterHz: between(random, 2800, 6500),
      holdBias: 0.35,
    };
  }
  if (profile === "wind_court") {
    return {
      delayTime: between(random, 0.28, 0.55),
      drive: between(random, 0.25, 0.55),
      totalFeedback: between(random, 0.4, 0.7),
      reverb: between(random, 0.3, 0.6),
      filterHz: between(random, 1600, 4500),
      holdBias: 0.7,
    };
  }
  if (profile === "amazon_canopy") {
    return {
      delayTime: between(random, 0.32, 0.62),
      drive: between(random, 0.12, 0.38),
      totalFeedback: between(random, 0.35, 0.65),
      reverb: between(random, 0.4, 0.72),
      filterHz: between(random, 2200, 6200),
      holdBias: 0.8,
    };
  }
  if (profile === "jamaica_dub") {
    return {
      delayTime: between(random, 0.28, 0.55),
      drive: between(random, 0.2, 0.5),
      totalFeedback: between(random, 0.45, 0.78),
      reverb: between(random, 0.25, 0.5),
      filterHz: between(random, 900, 2800),
      holdBias: 0.55,
    };
  }
  return {
    delayTime: between(random, 0.15, 0.45),
    drive: between(random, 0.35, 0.75),
    totalFeedback: between(random, 0.35, 0.7),
    reverb: between(random, 0.15, 0.45),
    filterHz: between(random, 1800, 6500),
    holdBias: 0.4 + wildness * 0.2,
  };
}

function beatsForPatchType(patchType, random) {
  if (patchType === "stutter") {
    return integerBetween(random, 4, 10);
  }
  if (patchType === "orbit") {
    return integerBetween(random, 20, 36);
  }
  if (patchType === "call_response") {
    return integerBetween(random, 8, 16);
  }
  if (GENERATIVE_PATCH_TYPES.has(patchType)) {
    return integerBetween(random, 16, 32);
  }
  return integerBetween(random, 12, 28);
}

/** Fresh 32-bit seed for boot / PLAY / REC — never a fixed house default. */
export function uniqueSeed() {
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const words = new Uint32Array(2);
    globalThis.crypto.getRandomValues(words);
    return (words[0] ^ words[1] ^ (Date.now() >>> 0)) >>> 0;
  }
  return (
    (Math.floor(Math.random() * 0xffffffff) ^
      (Date.now() >>> 0) ^
      (Math.floor(performance.now() * 1000) >>> 0)) >>>
    0
  );
}

export function firstPlayableTrick(tricks = []) {
  for (const entry of tricks) {
    const source = typeof entry === "string" ? entry : entry?.source;
    if (source && !isRestTrick(source)) {
      return source;
    }
  }
  return "";
}

/** Compact axes used to keep successive PLAY patches distinct. */
export function patchFingerprint(patch) {
  if (!patch) {
    return null;
  }
  const engines = (patch.voices ?? [])
    .filter((voice) => voice.active)
    .map((voice) => voice.engine)
    .slice(0, 5)
    .join(",");
  return {
    objectCount: patch.objectCount,
    patchType: patch.patchType,
    scaleName: patch.scaleName,
    timbreProfile: patch.timbreProfile,
    firstTrick: firstPlayableTrick(patch.tricks),
    bpmBucket: Math.round((patch.bpm ?? 100) / 12),
    engineKey: engines,
    mixBucket: Math.round(((patch.composition?.mix?.reverb ?? 0.3) + (patch.drive ?? 0.4)) * 5),
  };
}

export function patchesDistinctEnough(previous, next) {
  if (!previous || !next) {
    return true;
  }
  let score = 0;
  if (previous.objectCount !== next.objectCount) {
    score += 2;
  }
  if (previous.patchType !== next.patchType) {
    score += 2;
  }
  if (previous.scaleName !== next.scaleName) {
    score += 1;
  }
  if (previous.timbreProfile !== next.timbreProfile) {
    score += 2;
  }
  if (previous.firstTrick !== next.firstTrick) {
    score += 2;
  }
  if (previous.engineKey !== next.engineKey) {
    score += 1;
  }
  if (previous.bpmBucket !== next.bpmBucket) {
    score += 1;
  }
  if (previous.mixBucket !== next.mixBucket) {
    score += 1;
  }
  return score >= 5;
}

/**
 * Build a patch that differs from `avoid` on pattern + timbre + mix axes.
 */
export function createDistinctRndPatch(seed = uniqueSeed(), bias = {}, avoid = null) {
  const prior = avoid ? patchFingerprint(avoid) : null;
  let best = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const nextSeed = (seed ^ Math.imul(attempt + 1, 0x9e3779b9)) >>> 0;
    const candidate = createRndPatch(nextSeed, {
      ...bias,
      // Retries reshuffle object count away from the prior patch.
      objectCount: attempt === 0 ? bias.objectCount : undefined,
      objectCountPrefer: attempt === 0 ? (bias.objectCountPrefer ?? bias.objectCount) : undefined,
      excludeObjectCount: attempt > 0 ? prior?.objectCount : undefined,
      diversify: attempt > 0,
    });
    if (!prior || patchesDistinctEnough(prior, patchFingerprint(candidate))) {
      return candidate;
    }
    best = candidate;
  }
  return best ?? createRndPatch(seed, bias);
}

export function createRndPatch(seed = uniqueSeed(), bias = {}) {
  const random = seededRandom(seed >>> 0);
  const wildness = bias.wildness ?? 0.55;
  const profile = pick(random, TIMBRE_PROFILES);
  const profileSound = profileMix(random, profile, wildness);

  // Knobs may prefer a scale/type lightly; PLAY should still wander hard.
  // wildness 0 locks preferred axes; normal PLAY uses wildness ≥ 0.55.
  const scaleWander = bias.diversify ? 1 : wildness <= 0 ? 0 : Math.min(1, wildness + 0.45);
  const scaleName = softPick(random, bias.scaleName, SCALE_NAMES, scaleWander);
  const degrees = SCALES[scaleName];
  const rootMidi = pick(random, [33, 36, 38, 40, 41, 43, 45, 48, 50]);
  const objectChoices =
    bias.excludeObjectCount != null
      ? OBJECT_CHOICES.filter((count) => count !== bias.excludeObjectCount)
      : OBJECT_CHOICES;
  const preferredObjects = bias.objectCountPrefer ?? bias.objectCount;
  const objectCount =
    bias.objectCount != null && !bias.diversify && bias.lockObjectCount
      ? bias.objectCount
      : softPick(
          random,
          preferredObjects,
          objectChoices.length > 0 ? objectChoices : OBJECT_CHOICES,
          bias.diversify ? 1 : wildness <= 0 ? 0 : Math.min(1, wildness + 0.55),
        );
  const throwBias = bias.throwBias ?? between(random, 0.25, 0.85);
  const typeWander = bias.diversify ? 1 : wildness <= 0 ? 0 : Math.min(1, wildness + 0.55);
  const patchType = softPick(random, bias.patchType, PATCH_TYPES, typeWander);

  const forceVowel = patchType === "vowel_chant" || patchType === "cascade_choir";
  const generative = GENERATIVE_PATCH_TYPES.has(patchType);
  const composition = createComposition(random, {
    wildness,
    voiceCount: VOICE_COUNT,
    patchType,
  });
  const drumsWanted =
    generative ||
    composition.tracks[3]?.active ||
    random() > 0.28;
  if (drumsWanted && composition.tracks[3]) {
    composition.tracks[3].active = true;
    composition.tracks[3].level = Math.max(composition.tracks[3].level, between(random, 0.45, 0.9));
    composition.activeTracks = composition.tracks.filter((track) => track.active).length;
  }
  const activeVoiceCount = integerBetween(
    random,
    forceVowel ? 7 : generative ? 5 : 4,
    patchType === "cascade_choir"
      ? VOICE_COUNT
      : Math.min(VOICE_COUNT, 5 + Math.round(wildness * 7)),
  );

  const voices = Array.from({ length: VOICE_COUNT }, (_, index) => {
    const trackIndex = Math.min(TRACK_COUNT - 1, Math.floor(index / 3));
    const trackActive = composition.tracks[trackIndex]?.active ?? true;
    const degree = pick(random, degrees);
    const roleOctave =
      trackIndex === 0 ? [0] : trackIndex === 1 ? [1, 2] : trackIndex === 2 ? [1, 2] : [0, 1];
    const hold =
      trackActive &&
      index < activeVoiceCount &&
      random() < profileSound.holdBias &&
      (patchType === "drone" ||
        patchType === "vowel_chant" ||
        patchType === "orbit" ||
        trackIndex === 1 ||
        random() > 0.55);
    return {
      index,
      trackIndex,
      engine: pickVoiceEngine(random, profile, patchType, trackIndex, wildness, forceVowel),
      midi: degreeToMidi(rootMidi, degree, scaleName, pick(random, roleOctave)),
      sharp: between(random, 0.08, 0.9),
      modDepth: between(random, 0.1, 0.85),
      selfFeedback: between(random, 0.1, 0.7),
      level: between(random, 0.35, 0.92),
      hold,
      active: trackActive && index < activeVoiceCount,
      vowel: vowelFromIndex(index + Math.floor(random() * 5)),
    };
  });
  if (!forceVowel) {
    ensureEngineSpread(voices, random, 4);
  }
  if (
    !forceVowel &&
    profile === "amazon_canopy" &&
    !voices.some(
      (voice) =>
        voice.active &&
        (voice.engine === "bird" ||
          voice.engine === "dolphin" ||
          voice.engine === "bubble" ||
          voice.engine === "forest"),
    )
  ) {
    const slot = voices.find((voice) => voice.trackIndex === 1) ?? voices.find((voice) => voice.active);
    if (slot) {
      slot.engine = "bird";
      slot.active = true;
    }
  }
  // Guarantee at least one real noise oscillator except on pure vowel patches
  if (!forceVowel && !voices.some((voice) => voice.engine === "noise" && voice.active)) {
    const slot =
      voices.find((voice) => voice.trackIndex === 3) ??
      voices.find((voice) => voice.active) ??
      voices[voices.length - 1];
    if (slot) {
      slot.engine = "noise";
      slot.hold = false;
      slot.active = true;
      if (composition.tracks[slot.trackIndex]) {
        composition.tracks[slot.trackIndex].active = true;
      }
    }
  }

  const lfoSpread = 0.1 + wildness * 0.75;
  const generators = createGeneratorBank((seed >>> 0) ^ Math.floor(random() * 0xffff), wildness);
  const delayTime = softAround(
    random,
    bias.delayTime ?? profileSound.delayTime,
    0.08,
    0.7,
    wildness,
  );
  const drive = softAround(random, bias.drive ?? profileSound.drive, 0.05, 0.9, wildness);
  const totalFeedback = softAround(
    random,
    bias.totalFeedback ?? profileSound.totalFeedback,
    0.08,
    0.85,
    wildness,
  );
  const lfoDepth = softAround(
    random,
    bias.lfoDepth,
    0.08,
    0.85,
    wildness,
  );
  composition.mix.chain.delay = delayTime;
  composition.mix.chain.drive = drive;
  composition.mix.chain.crossFeedback = totalFeedback;
  composition.mix.chain.returnLevel = totalFeedback * between(random, 0.3, 0.55);
  composition.mix.chain.filterHz = profileSound.filterHz;
  composition.mix.reverb = softAround(random, profileSound.reverb, 0.05, 0.75, wildness);
  if (bias.scatter != null) {
    composition.mix.scatter = softAround(random, bias.scatter, 0, 0.85, wildness);
  }
  if (bias.compress != null) {
    composition.mix.compress = softAround(random, bias.compress, 0.15, 0.9, wildness);
  }

  const envAmount = bias.envAmount ?? between(random, 0.25, 0.75);
  const envelope = {
    attack: softAround(random, 0.008 + envAmount * 0.35, 0.005, 0.5, wildness),
    decay: softAround(random, 0.08 + (1 - envAmount) * 0.28, 0.04, 0.55, wildness),
    sustain: softAround(random, 0.3 + envAmount * 0.5, 0.15, 0.95, wildness),
    release: softAround(random, 0.15 + envAmount * 0.7, 0.08, 1.2, wildness),
    filterEnv: softAround(random, 0.15 + envAmount * 0.55, 0.05, 0.9, wildness),
  };

  const bpmCenter =
    bias.bpm ??
    integerBetween(random, patchType === "stutter" ? 120 : profile === "pulse_grid" ? 110 : 72, 180);
  const bpm = Math.round(softAround(random, bpmCenter, 40, 220, wildness * 0.6));
  const tricks = generateSiteswapEpisode(random, objectCount, throwBias, wildness, { bpm });
  const handStyle = pickHandStyle(random, wildness);
  const patternSource = firstPlayableTrick(tricks);
  const drumEnvelopes = drumEnvelopesFromSeed(seed, patternSource);

  const lfoDestinations = ["pitch", "cutoff", "width", "level", "pan"];
  const lfoShapes = ["sine", "triangle", "square", "pulse"];

  return {
    seed: seed >>> 0,
    patchType,
    timbreProfile: profile,
    scaleName,
    rootMidi,
    bpm,
    objectCount,
    tricks,
    handStyle,
    dwellRatio: softAround(random, bias.dwellRatio, 0.3, 0.7, wildness),
    holdTwos: random() > 0.3,
    beatsPerTrick: beatsForPatchType(patchType, random),
    hyperLfo: {
      rateA: between(random, 0.05, 0.35 + lfoSpread * 2),
      rateB: between(random, 0.04, 0.28 + lfoSpread * 1.6),
      mode: pick(random, ["and", "or", "sum", "product"]),
      depth: lfoDepth,
      link: random() > 0.5,
      toA: bias.lfoTo ?? pick(random, lfoDestinations),
      toB: bias.lfoToB ?? pick(random, lfoDestinations),
      shapeA: bias.lfoShape ?? pick(random, lfoShapes),
      shapeB: bias.lfoShapeB ?? pick(random, lfoShapes),
    },
    envelope,
    drumEnvelopes,
    totalFeedback,
    delayTime,
    drive,
    voices,
    fmStructure: pick(random, ["organ", "tree", "pair", "pair"]),
    generators,
    genKind: generators.synth.kind,
    drumsOpen: Boolean(drumsWanted),
    composition,
    tapeLive: {
      recording: false,
      held: false,
    },
  };
}

export function regenerateTricks(patch, seedExtra = 1, throwBias = 0.45) {
  const random = seededRandom((patch.seed + seedExtra) >>> 0);
  const wildness = 0.45 + random() * 0.5;
  return clampEpisodeWaits(
    generateSiteswapEpisode(random, patch.objectCount, throwBias, wildness, {
      bpm: patch.bpm ?? 100,
    }),
    patch.bpm ?? 100,
  );
}

export function regenerateHandStyle(patch, seedExtra = 3) {
  const random = seededRandom((patch.seed + seedExtra) >>> 0);
  const wildness = 0.45 + random() * 0.5;
  return pickHandStyle(random, wildness);
}
