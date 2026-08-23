import { HOLD_SIGN, MIXED_SIGN, RELEASE_SIGN } from "./holding.js";
import { DEFAULT_MASTER, appendMasterDrawer, masterFromForm } from "./court_sound_master.js";
import {
  appendDrawerFlags,
  appendSoundField,
  appendSoundFlag,
  appendSoundSelect,
  lfoHertz,
  refreshSoundMark,
  refreshSoundMarks,
  soundIcon,
} from "./court_sound_marks.js";
import { formatTapeReading, formatTapeSpeedReading, tapeSpeedRate } from "./court_sound_fx.js";

export { lfoHertz };

export const FILTER_TYPES = ["lowpass", "highpass", "bandpass"];
export const LFO_DESTINATIONS = ["pitch", "cutoff", "width", "level", "pan"];
export const SOUND_WAVES = ["sine", "triangle", "pulse", "noise"];

export const SYNTH_PREFIXES = {
  [HOLD_SIGN]: "Hold",
  [RELEASE_SIGN]: "Release",
  [MIXED_SIGN]: "Mixed",
};

export const DEFAULT_VOICE = {
  pulseWidth: 0.28,
  fold: 0.08,
  pitch: 0,
  fine: 0,
  level: 1,
  cutoff: 0.32,
  resonance: 0.18,
  filterEnv: 0.2,
  attack: 0.12,
  decay: 0.22,
  sustain: 1,
  release: 0.45,
  glide: 0,
  detune: 0.4,
  filter: "lowpass",
};

export const DEFAULT_SYNTH = {
  ...DEFAULT_VOICE,
  ...DEFAULT_MASTER,
};

export const VOICE_SLIDERS = [
  { key: "pulseWidth", min: 0.05, max: 0.5, step: 0.01, digits: 2 },
  { key: "fold", min: 0, max: 1, step: 0.01, digits: 2 },
  { key: "pitch", min: -48, max: 48, step: 1, digits: 0 },
  { key: "fine", min: -100, max: 100, step: 1, digits: 0 },
  { key: "level", min: 0, max: 1, step: 0.01, digits: 2 },
  { key: "cutoff", min: 0, max: 1, step: 0.01, digits: 2 },
  { key: "resonance", min: 0, max: 1, step: 0.01, digits: 2 },
  { key: "filterEnv", min: 0, max: 1, step: 0.01, digits: 2 },
  { key: "attack", min: 0, max: 2, step: 0.01, digits: 2 },
  { key: "decay", min: 0, max: 2, step: 0.01, digits: 2 },
  { key: "sustain", min: 0, max: 1, step: 0.01, digits: 2 },
  { key: "release", min: 0, max: 3, step: 0.01, digits: 2 },
  { key: "glide", min: 0, max: 1, step: 0.01, digits: 2 },
  { key: "detune", min: 0, max: 1, step: 0.01, digits: 2 },
];

const LABELS = {
  en: {
    pulseWidth: "pulse width",
    fold: "fold",
    pitch: "pitch",
    fine: "fine",
    level: "level",
    cutoff: "cutoff",
    resonance: "resonance",
    filterEnv: "filter env",
    attack: "attack",
    decay: "decay",
    sustain: "sustain",
    release: "release",
    glide: "glide",
    detune: "detune",
    filter: "filter",
    wave: "wave",
    lowpass: "lowpass",
    highpass: "highpass",
    bandpass: "bandpass",
    sine: "sine",
    triangle: "triangle",
    pulse: "pulse",
    noise: "noise",
    [HOLD_SIGN]: "κ",
    [RELEASE_SIGN]: "α",
    [MIXED_SIGN]: "Amphoteron",
    master: "master",
    solo: "solo",
    cosmology: "cosmology",
  },
  ru: {
    pulseWidth: "ширина импульса",
    fold: "фолд",
    pitch: "высота",
    fine: "цент",
    level: "уровень",
    cutoff: "срез",
    resonance: "резонанс",
    filterEnv: "огибающая фильтра",
    attack: "атака",
    decay: "спад",
    sustain: "сустейн",
    release: "релиз",
    glide: "скольжение",
    detune: "расстройка",
    filter: "фильтр",
    wave: "волна",
    lowpass: "низкие",
    highpass: "высокие",
    bandpass: "полоса",
    sine: "синус",
    triangle: "треугольник",
    pulse: "импульс",
    noise: "шум",
    [HOLD_SIGN]: "κ",
    [RELEASE_SIGN]: "α",
    [MIXED_SIGN]: "Амфотерон",
    master: "мастер",
    solo: "соло",
    cosmology: "космология",
  },
};

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function controlName(prefix, key) {
  return `sound${prefix}${key[0].toUpperCase()}${key.slice(1)}`;
}

function sharedName(key) {
  return `sound${key[0].toUpperCase()}${key.slice(1)}`;
}

function readNumber(form, names, fallback, minimum, maximum) {
  for (const name of names) {
    const value = Number(form.elements.namedItem(name)?.value);
    if (Number.isFinite(value)) {
      return clamp(value, minimum, maximum);
    }
  }
  return fallback;
}

export function pitchedFrequency(base, { pitch = 0, fine = 0, lfoSemitones = 0 } = {}) {
  return base * 2 ** ((pitch + fine / 100 + lfoSemitones) / 12);
}

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const A4_HERTZ = 440;
const A4_MIDI = 69;

const VOICE_PITCH_BASE = {
  soundHold: 46,
  soundRelease: 52,
  soundMixed: 41,
};

export function noteFromFrequency(hertz) {
  if (!(hertz > 0) || !Number.isFinite(hertz)) {
    return { name: "—", cents: 0, hertz: 0 };
  }
  const midiExact = A4_MIDI + 12 * Math.log2(hertz / A4_HERTZ);
  let midi = Math.round(midiExact);
  let cents = Math.round((midiExact - midi) * 100);
  if (cents === -50) {
    midi -= 1;
    cents = 50;
  }
  const name = `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
  return { name, cents, hertz };
}

export function formatPitchReading(hertz) {
  const note = noteFromFrequency(hertz);
  const cents = note.cents === 0 ? "" : ` ${note.cents > 0 ? "+" : "−"}${Math.abs(note.cents)}¢`;
  const rounded = Math.round(note.hertz * 10) / 10;
  const shown = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${note.name}${cents} ${shown} Hz`;
}

export function voicePitchReading(controlName, pitch, fine = 0) {
  const prefix = String(controlName).replace(/Pitch$|Fine$/, "");
  const base = VOICE_PITCH_BASE[prefix] ?? 46;
  return formatPitchReading(pitchedFrequency(base, { pitch, fine }));
}

export function pulseHarmonics(width, harmonicCount = 32) {
  const duty = clamp(width, 0.05, 0.5);
  const real = new Float32Array(harmonicCount + 1);
  const imaginary = new Float32Array(harmonicCount + 1);
  for (let harmonic = 1; harmonic <= harmonicCount; harmonic += 1) {
    imaginary[harmonic] = (2 / (harmonic * Math.PI)) * Math.sin(harmonic * Math.PI * duty);
  }
  return { real, imaginary };
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

export function cutoffHertz(unit) {
  return 28 * (90 ** clamp(unit, 0, 1));
}

export function resonanceQ(unit) {
  return 0.5 + clamp(unit, 0, 1) * 11.5;
}

export function voiceFromForm(form, prefix) {
  const voice = { ...DEFAULT_VOICE };
  for (const slider of VOICE_SLIDERS) {
    voice[slider.key] = readNumber(
      form,
      [controlName(prefix, slider.key), sharedName(slider.key)],
      DEFAULT_VOICE[slider.key],
      slider.min,
      slider.max,
    );
  }
  const filter = form.elements.namedItem(controlName(prefix, "filter"))?.value
    ?? form.elements.namedItem("soundFilter")?.value;
  if (FILTER_TYPES.includes(filter)) {
    voice.filter = filter;
  }
  return voice;
}

export function synthsFromForm(form) {
  return {
    [HOLD_SIGN]: voiceFromForm(form, SYNTH_PREFIXES[HOLD_SIGN]),
    [RELEASE_SIGN]: voiceFromForm(form, SYNTH_PREFIXES[RELEASE_SIGN]),
    [MIXED_SIGN]: voiceFromForm(form, SYNTH_PREFIXES[MIXED_SIGN]),
  };
}

export function synthFromForm(form) {
  return {
    ...voiceFromForm(form, SYNTH_PREFIXES[HOLD_SIGN]),
    ...masterFromForm(form),
  };
}

function appendVoiceDrawer(rack, sign, locale) {
  const words = LABELS[locale] ?? LABELS.en;
  const prefix = SYNTH_PREFIXES[sign];
  const drawer = document.createElement("details");
  drawer.id = `sound-drawer-${prefix.toLowerCase()}`;
  drawer.className = `sound-drawer sound-drawer--${prefix.toLowerCase()}`;
  drawer.dataset.remember = "open";
  const summary = document.createElement("summary");
  summary.append(soundIcon(document, "wave"), words[sign]);
  const flags = appendDrawerFlags(summary);
  appendSoundFlag(flags, {
    name: `sound${prefix}Solo`,
    label: words.solo,
  });
  const body = document.createElement("div");
  body.className = "sound-synth";
  appendSoundField(body, {
    name: `sound${prefix}Cosmology`,
    key: "cosmology",
    label: words.cosmology,
    min: 0,
    max: 1,
    step: 0.01,
    digits: 2,
    value: 1,
  });
  const waveName = {
    [HOLD_SIGN]: "soundWaveHold",
    [RELEASE_SIGN]: "soundWaveRelease",
    [MIXED_SIGN]: "soundWaveMixed",
  }[sign];
  const waveValue = {
    [HOLD_SIGN]: "sine",
    [RELEASE_SIGN]: "triangle",
    [MIXED_SIGN]: "pulse",
  }[sign];
  appendSoundSelect(body, {
    name: waveName,
    key: "wave",
    label: words.wave,
    value: waveValue,
    options: SOUND_WAVES.map((value) => ({ value, label: words[value] })),
  });
  for (const slider of VOICE_SLIDERS) {
    appendSoundField(body, {
      name: controlName(prefix, slider.key),
      key: slider.key,
      label: words[slider.key],
      min: slider.min,
      max: slider.max,
      step: slider.step,
      digits: slider.digits,
      value: DEFAULT_VOICE[slider.key],
      mark: slider.key === "pitch"
        ? (DEFAULT_VOICE.pitch - slider.min) / (slider.max - slider.min)
        : DEFAULT_VOICE[slider.key],
      reading: slider.key === "pitch"
        ? voicePitchReading(controlName(prefix, "pitch"), DEFAULT_VOICE.pitch, DEFAULT_VOICE.fine)
        : undefined,
    });
    if (slider.key === "resonance") {
      appendSoundSelect(body, {
        name: controlName(prefix, "filter"),
        key: "filter",
        label: words.filter,
        value: DEFAULT_VOICE.filter,
        options: FILTER_TYPES.map((value) => ({ value, label: words[value] })),
      });
    }
  }
  drawer.append(summary, body);
  rack.append(drawer);
}

export function mountSoundSynthControls(panel, locale = "en") {
  const rack = panel?.querySelector(".sound-rack") ?? panel?.querySelector(".sound-synth");
  if (!rack || rack.dataset.soundSynthReady) {
    return;
  }
  rack.dataset.soundSynthReady = "true";
  rack.className = `${rack.className} sound-rack`.trim();
  const language = locale.startsWith("ru") ? "ru" : "en";
  appendVoiceDrawer(rack, HOLD_SIGN, language);
  appendVoiceDrawer(rack, RELEASE_SIGN, language);
  appendVoiceDrawer(rack, MIXED_SIGN, language);
  appendMasterDrawer(rack, language);
  refreshSoundMarks(panel);
}

export function writeSoundDisplays(root) {
  if (!root?.querySelectorAll) {
    return;
  }
  for (const input of root.querySelectorAll("input[type=range]")) {
    const label = typeof input.closest === "function" ? input.closest("label") : null;
    const output = label?.querySelector?.("output");
    if (output) {
      if (/Pitch$/.test(input.name) || /Fine$/.test(input.name)) {
        const prefix = input.name.replace(/Pitch$|Fine$/, "");
        const pitch = Number(root.querySelector(`[name="${prefix}Pitch"]`)?.value);
        const fine = Number(root.querySelector(`[name="${prefix}Fine"]`)?.value) || 0;
        const pitchOutput = root.querySelector(`[name="${prefix}Pitch"]`)
          ?.closest?.("label")
          ?.querySelector?.("output");
        if (pitchOutput && Number.isFinite(pitch)) {
          pitchOutput.textContent = voicePitchReading(`${prefix}Pitch`, pitch, fine);
        }
        if (/Fine$/.test(input.name)) {
          output.textContent = String(Math.round(Number(input.value)));
        }
      } else if (input.name === "soundTape") {
        const locale = root.lang
          ?? root.closest?.("[lang]")?.getAttribute?.("lang")
          ?? globalThis.document?.documentElement?.lang
          ?? "en";
        output.textContent = formatTapeReading(Number(input.value), locale);
      } else if (input.name === "soundSpeed") {
        const stuck = tapeSpeedRate(Number(input.value));
        if (input.value !== String(stuck)) {
          input.value = String(stuck);
        }
        output.textContent = formatTapeSpeedReading(stuck);
      } else {
        const step = Number(input.step);
        output.textContent = Number.isInteger(step) || step >= 1
          ? String(Math.round(Number(input.value)))
          : Number(input.value).toFixed(2);
      }
    }
    refreshSoundMark(label, input);
  }
  refreshSoundMarks(root);
}
