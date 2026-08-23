import {
  LFO_SHAPES,
  appendSoundField,
  appendSoundSelect,
  appendTapeBar,
  soundIcon,
} from "./court_sound_marks.js";
import {
  TAPE_LOOP_MAXIMUM_SECONDS,
  TAPE_SPEED_MAXIMUM,
  TAPE_SPEED_MINIMUM,
  formatTapeReading,
  formatTapeSpeedReading,
} from "./court_sound_fx.js";

export const DEFAULT_MASTER = {
  eqLows: 0.62,
  eqMids: 0.68,
  eqHighs: 0.52,
  drive: 0.28,
  compress: 0.48,
  scatter: 0.35,
  delay: 0.55,
  delayDry: 1,
  feedback: 0.62,
  tape: 8,
  tapeDry: 1,
  speed: 1,
  lfoRate: 0.18,
  lfoDepth: 0.22,
  lfoTo: "cutoff",
  lfoShape: "sine",
};

export const MASTER_SLIDERS = [
  { name: "soundLfoRate", key: "lfoRate", min: 0, max: 1, step: 0.01, digits: 2, lamp: true },
  { name: "soundLfoDepth", key: "lfoDepth", min: 0, max: 1, step: 0.01, digits: 2, lamp: true },
  { name: "soundEqLows", key: "eqLows", min: 0, max: 1, step: 0.01, digits: 2 },
  { name: "soundEqMids", key: "eqMids", min: 0, max: 1, step: 0.01, digits: 2 },
  { name: "soundEqHighs", key: "eqHighs", min: 0, max: 1, step: 0.01, digits: 2 },
  { name: "soundDrive", key: "drive", min: 0, max: 1, step: 0.01, digits: 2 },
  { name: "soundCompress", key: "compress", min: 0, max: 1, step: 0.01, digits: 2 },
  { name: "soundScatter", key: "scatter", min: 0, max: 1, step: 0.01, digits: 2 },
  { name: "soundDelay", key: "delay", min: 0, max: 1, step: 0.01, digits: 2 },
  { name: "soundDelayDry", key: "delayDry", min: 0, max: 1, step: 0.01, digits: 2 },
  { name: "soundFeedback", key: "feedback", min: 0, max: 1, step: 0.01, digits: 2 },
  { name: "soundTape", key: "tape", min: 0, max: TAPE_LOOP_MAXIMUM_SECONDS, step: 0.01, digits: 2 },
  { name: "soundTapeDry", key: "tapeDry", min: 0, max: 1, step: 0.01, digits: 2 },
  { name: "soundSpeed", key: "speed", min: TAPE_SPEED_MINIMUM, max: TAPE_SPEED_MAXIMUM, step: 0.01, digits: 2 },
];

export const MASTER_LABELS = {
  en: {
    eqLows: "lows",
    eqMids: "mids",
    eqHighs: "highs",
    drive: "drive",
    compress: "compress",
    scatter: "scatter",
    delay: "delay",
    delayDry: "delay dry",
    feedback: "feedback",
    tape: "tape",
    tapeDry: "tape dry",
    speed: "speed",
    hold: "hold",
    rec: "rec",
    loop: "loop",
    lfoRate: "LFO rate",
    lfoDepth: "LFO depth",
    lfoTo: "LFO to",
    lfoShape: "LFO shape",
    pitch: "pitch",
    cutoff: "cutoff",
    width: "width",
    level: "level",
    pan: "pan",
    sine: "sine",
    triangle: "triangle",
    square: "square",
    pulse: "pulse",
    master: "master",
    cosmology: "cosmology",
  },
  ru: {
    eqLows: "низ",
    eqMids: "середина",
    eqHighs: "верх",
    drive: "драйв",
    compress: "компрессия",
    scatter: "скаттер",
    delay: "дилей",
    delayDry: "сухой дилей",
    feedback: "фидбек",
    tape: "тейп",
    tapeDry: "сухой тейп",
    speed: "скорость",
    hold: "холд",
    rec: "rec",
    loop: "луп",
    lfoRate: "скорость LFO",
    lfoDepth: "глубина LFO",
    lfoTo: "LFO в",
    lfoShape: "форма LFO",
    pitch: "высота",
    cutoff: "срез",
    width: "ширина",
    level: "уровень",
    pan: "панорама",
    sine: "синус",
    triangle: "треугольник",
    square: "квадрат",
    pulse: "импульс",
    master: "мастер",
    cosmology: "космология",
  },
};

const LFO_DESTINATIONS = ["pitch", "cutoff", "width", "level", "pan"];

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function eqGainDecibels(unit) {
  return (clamp(unit, 0, 1) - 0.5) * 24;
}

export function driveCurve(drive, length = 256) {
  const amount = 1 + clamp(drive, 0, 1) * 24;
  const curve = new Float32Array(length);
  const peak = Math.tanh(amount);
  for (let index = 0; index < length; index += 1) {
    const sample = (index * 2) / (length - 1) - 1;
    curve[index] = Math.tanh(sample * amount) / peak;
  }
  return curve;
}

export function compressorSettings(compress) {
  const amount = clamp(compress, 0, 1);
  return {
    threshold: -10 - amount * 18,
    ratio: 2 + amount * 6,
    knee: 6,
    attack: 0.008,
    release: 0.16,
  };
}

export function masterPlan(masterInput = DEFAULT_MASTER) {
  const master = { ...DEFAULT_MASTER, ...masterInput };
  const compressor = compressorSettings(master.compress);
  return {
    lowGain: eqGainDecibels(master.eqLows),
    midGain: eqGainDecibels(master.eqMids),
    highGain: eqGainDecibels(master.eqHighs),
    drive: master.drive,
    makeup: 0.95 + master.compress * 0.3,
    ...compressor,
  };
}

export function masterFromForm(form) {
  const master = { ...DEFAULT_MASTER };
  for (const slider of MASTER_SLIDERS) {
    const value = Number(form.elements.namedItem(slider.name)?.value);
    master[slider.key] = Number.isFinite(value)
      ? clamp(value, slider.min, slider.max)
      : DEFAULT_MASTER[slider.key];
  }
  const lfoTo = form.elements.namedItem("soundLfoTo")?.value;
  if (LFO_DESTINATIONS.includes(lfoTo)) {
    master.lfoTo = lfoTo;
  }
  const lfoShape = form.elements.namedItem("soundLfoShape")?.value;
  if (LFO_SHAPES.includes(lfoShape)) {
    master.lfoShape = lfoShape;
  }
  return master;
}

export function appendMasterDrawer(rack, locale = "en") {
  const words = MASTER_LABELS[locale.startsWith("ru") ? "ru" : "en"];
  const drawer = document.createElement("details");
  drawer.id = "sound-drawer-master";
  drawer.className = "sound-drawer sound-drawer--master";
  drawer.dataset.remember = "open";
  const summary = document.createElement("summary");
  summary.append(soundIcon(document, "eqMids"), words.master);
  const body = document.createElement("div");
  body.className = "sound-synth";
  appendSoundField(body, {
    name: "soundMasterCosmology",
    key: "cosmology",
    label: words.cosmology,
    min: 0,
    max: 1,
    step: 0.01,
    digits: 2,
    value: 1,
  });
  appendSoundSelect(body, {
    name: "soundLfoShape",
    key: "lfoShape",
    label: words.lfoShape,
    value: DEFAULT_MASTER.lfoShape,
    lamp: true,
    options: LFO_SHAPES.map((value) => ({ value, label: words[value] })),
  });
  appendSoundSelect(body, {
    name: "soundLfoTo",
    key: "lfoTo",
    label: words.lfoTo,
    value: DEFAULT_MASTER.lfoTo,
    lamp: true,
    options: LFO_DESTINATIONS.map((value) => ({ value, label: words[value] })),
  });
  for (const slider of MASTER_SLIDERS) {
    if (slider.key === "tape") {
      appendTapeBar(body, words);
    }
    appendSoundField(body, {
      name: slider.name,
      key: slider.key,
      kind: slider.kind ?? slider.key,
      label: words[slider.key],
      min: slider.min,
      max: slider.max,
      step: slider.step,
      digits: slider.digits,
      value: DEFAULT_MASTER[slider.key],
      lamp: slider.lamp,
      reading: slider.key === "tape"
        ? formatTapeReading(DEFAULT_MASTER.tape, locale)
        : slider.key === "speed"
          ? formatTapeSpeedReading(DEFAULT_MASTER.speed)
          : undefined,
    });
  }
  drawer.append(summary, body);
  rack.append(drawer);
}

export function appendMasterControls(host, locale = "en") {
  appendMasterDrawer(host, locale);
}
