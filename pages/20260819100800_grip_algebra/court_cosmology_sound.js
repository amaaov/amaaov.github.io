import { HOLD_SIGN, MIXED_SIGN, RELEASE_SIGN } from "./holding.js";
import { MASTER_SLIDERS } from "./court_sound_master.js";
import { SYNTH_PREFIXES, VOICE_SLIDERS } from "./court_sound_synth.js";
import { tapeSpeedRate } from "./court_sound_fx.js";

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function voiceControlName(prefix, key) {
  return `sound${prefix}${key[0].toUpperCase()}${key.slice(1)}`;
}

function voiceSliders(sign) {
  const prefix = SYNTH_PREFIXES[sign];
  return VOICE_SLIDERS.map((slider) => ({
    name: voiceControlName(prefix, slider.key),
    key: slider.key,
    min: slider.min,
    max: slider.max,
    step: slider.step,
  }));
}

const VOICE_GROUPS = [
  { sign: HOLD_SIGN, index: 0 },
  { sign: RELEASE_SIGN, index: 1 },
  { sign: MIXED_SIGN, index: 2 },
];

export function cosmologyVoiceOffsets(weather, voiceIndex = 0) {
  if (!weather) {
    return {};
  }
  const side = voiceIndex - 1;
  return {
    pitch: (weather.moon - 0.5) * 8 + side * weather.storm * 4,
    fine: weather.modulation * 80 + side * weather.stars * 18,
    cutoff: weather.storm * 0.22 - weather.sun * 0.1 + voiceIndex * 0.04,
    resonance: weather.storm * 0.2,
    level: weather.lowSignal * 0.06,
    pulseWidth: weather.storm * 0.08,
    fold: weather.storm * 0.18,
    filterEnv: weather.moon * 0.15,
    attack: weather.storm * 0.25,
    decay: (1 - weather.sun) * 0.2,
    sustain: -weather.storm * 0.12,
    release: weather.storm * 0.4,
    glide: weather.chaos * 0.2,
    detune: weather.chaos * 0.25,
  };
}

export function cosmologyAmountFromForm(form, name) {
  const value = Number(form?.elements?.namedItem(name)?.value);
  return Number.isFinite(value) ? clamp(value, 0, 1) : 1;
}

export function scaleCosmologyOffsets(offsets, amount) {
  if (!offsets) {
    return null;
  }
  const depth = clamp(amount, 0, 1);
  if (depth === 1) {
    return offsets;
  }
  const scaled = {};
  for (const [key, value] of Object.entries(offsets)) {
    scaled[key] = value * depth;
  }
  return scaled;
}

export function cosmologyMasterOffsets(weather) {
  if (!weather) {
    return {};
  }
  return {
    eqLows: weather.lowSignal * 0.2,
    eqMids: weather.storm * 0.1 - 0.04,
    eqHighs: weather.sun * 0.14 - weather.storm * 0.08,
    drive: weather.storm * 0.22,
    compress: weather.storm * 0.16,
    scatter: weather.storm * 0.24,
    delay: weather.moon * 0.14,
    feedback: weather.feedback * 0.22,
    tape: weather.lowSignal * 4.8,
    speed: (weather.tempoBend - 1) * 1.2,
    lfoRate: weather.chaos * 0.22,
    lfoDepth: weather.storm * 0.2,
  };
}

function writeSlider(control, slider, base, offset) {
  let next = clamp(base + offset, slider.min, slider.max);
  if (slider.key === "speed") {
    next = tapeSpeedRate(next);
  }
  const written = (slider.step ?? 0.01) >= 1
    ? String(Math.round(next))
    : next.toFixed(2);
  control.dataset.skyOffset = String(offset);
  if (control.value !== written) {
    control.value = written;
    return true;
  }
  return false;
}

function restoreSlider(control) {
  if (control.dataset.skyBase === undefined) {
    return false;
  }
  control.value = control.dataset.skyBase;
  delete control.dataset.skyBase;
  delete control.dataset.skyOffset;
  return true;
}

function applySliderGroup(form, sliders, offsets) {
  let changed = false;
  for (const slider of sliders) {
    const control = form?.elements?.namedItem(slider.name);
    if (!control) {
      continue;
    }
    if (!offsets) {
      changed = restoreSlider(control) || changed;
      continue;
    }
    if (control.dataset.skyBase === undefined) {
      control.dataset.skyBase = String(control.value);
    }
    const base = Number(control.dataset.skyBase);
    const offset = offsets[slider.key] ?? 0;
    if (!Number.isFinite(base)) {
      continue;
    }
    changed = writeSlider(control, slider, base, offset) || changed;
  }
  return changed;
}

export function applyCosmologySoundControls(form, weather) {
  let changed = false;
  for (const group of VOICE_GROUPS) {
    const offsets = weather ? cosmologyVoiceOffsets(weather, group.index) : null;
    const amount = cosmologyAmountFromForm(form, `sound${SYNTH_PREFIXES[group.sign]}Cosmology`);
    changed = applySliderGroup(form, voiceSliders(group.sign), scaleCosmologyOffsets(offsets, amount)) || changed;
  }
  const masterAmount = cosmologyAmountFromForm(form, "soundMasterCosmology");
  changed = applySliderGroup(
    form,
    MASTER_SLIDERS,
    scaleCosmologyOffsets(weather ? cosmologyMasterOffsets(weather) : null, masterAmount),
  ) || changed;
  return changed;
}

export function retuneCosmologyBase(control) {
  if (!control?.dataset || control.dataset.skyBase === undefined) {
    return;
  }
  const live = Number(control.value);
  const offset = Number(control.dataset.skyOffset ?? 0);
  if (!Number.isFinite(live)) {
    return;
  }
  const minimum = control.min === "" ? live : Number(control.min);
  const maximum = control.max === "" ? live : Number(control.max);
  const base = clamp(live - (Number.isFinite(offset) ? offset : 0), minimum, maximum);
  control.dataset.skyBase = String(base);
}
