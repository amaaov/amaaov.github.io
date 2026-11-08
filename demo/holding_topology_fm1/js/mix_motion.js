/**
 * Generative live mix motion — track levels/pans that drift over time,
 * with stronger motion under cosmology weather.
 *
 * Silence modes:
 * - open: normal play
 * - tail: dry voices drop; delay/reverb feedback hangs the phrase
 * - gap: rare full mute (kept short by the episode wait ceiling)
 */

import { mixSnapshotForSection, sectionAtBeat } from "./mix_composition.js";

export function normalizeSilenceMode(value) {
  if (value === true || value === "gap") {
    return value === true ? "tail" : "gap";
  }
  if (value === "tail") {
    return "tail";
  }
  return "open";
}

export function liveMixSnapshot(composition, {
  beat = 0,
  elapsedSeconds = 0,
  weather = null,
  seed = 1,
  silent = false,
  silenceMode = null,
} = {}) {
  if (!composition) {
    return null;
  }
  const { section } = sectionAtBeat(composition, beat);
  const base = mixSnapshotForSection(composition, section);
  if (!base) {
    return null;
  }
  const mode = silenceMode ? normalizeSilenceMode(silenceMode) : normalizeSilenceMode(silent);
  const storm = weather?.storm ?? 0;
  const chaos = weather?.chaos ?? 0;
  const moon = weather?.moon ?? 0;
  const motion = 0.12 + storm * 0.55 + chaos * 0.25;
  const reverbLift = (weather?.feedback ?? 0) * 0.35;

  return base.map((row, index) => {
    const phase = elapsedSeconds * (0.11 + motion * 0.4) + index * 1.7 + (seed % 97) * 0.01;
    const breathe = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(phase));
    const panSwing = Math.sin(phase * 0.73 + index) * (0.08 + motion * 0.45);
    let levelMul = breathe * (0.75 + storm * 0.15 + moon * 0.08);
    let reverbSend = clamp((row.reverbSend || 0) * (0.85 + reverbLift) * (0.7 + 0.3 * breathe), 0, 1.4);
    let chainSend = clamp((row.chainSend || 0) * (0.8 + storm * 0.35), 0, 1.3);
    let active = row.active;
    if (mode === "tail") {
      // Keep sends open so the delay/reverb chain still has something to chew.
      levelMul *= 0.12;
      reverbSend = clamp(Math.max(reverbSend, 0.55) * 1.15, 0, 1.5);
      chainSend = clamp(Math.max(chainSend, 0.45) * 1.2, 0, 1.4);
    } else if (mode === "gap") {
      levelMul = 0.02;
      reverbSend = 0.02;
      chainSend = 0.02;
      active = false;
    }
    return {
      ...row,
      active: active && row.active,
      level: clamp((row.level || 0) * levelMul, 0, 1.2),
      pan: clamp((row.pan || 0) + panSwing, -1, 1),
      reverbSend,
      chainSend,
    };
  });
}

export function liveMixGlobals(composition, {
  weather = null,
  silent = false,
  silenceMode = null,
} = {}) {
  const mix = composition?.mix ?? {};
  const storm = weather?.storm ?? 0;
  const feedbackWeather = weather?.feedback ?? 0;
  const mode = silenceMode ? normalizeSilenceMode(silenceMode) : normalizeSilenceMode(silent);
  const returnLevel = mix.chain?.returnLevel ?? 0.25;
  const crossFeedback = mix.chain?.crossFeedback ?? 0.35;
  if (mode === "tail") {
    return {
      reverb: clamp((mix.reverb ?? 0.3) + 0.28 + feedbackWeather * 0.2, 0.35, 0.95),
      feedback: clamp(crossFeedback + 0.18 + storm * 0.1, 0.28, 0.78),
      filterHz: clamp((mix.chain?.filterHz ?? 4200) * (0.75 - storm * 0.1), 700, 4800),
      wet: clamp(0.4 + returnLevel * 0.55, 0.28, 0.85),
      dry: 0.22,
      courtGate: 0.85,
      mode,
    };
  }
  if (mode === "gap") {
    return {
      reverb: 0.04,
      feedback: 0.05,
      filterHz: clamp((mix.chain?.filterHz ?? 4200) * 0.4, 500, 2800),
      wet: 0.04,
      dry: 0.02,
      courtGate: 0.02,
      mode,
    };
  }
  // Open: delay wet tracks returnLevel — no fixed wet floor that forces echo.
  return {
    reverb: clamp((mix.reverb ?? 0.3) + feedbackWeather * 0.25, 0.05, 0.85),
    feedback: clamp(crossFeedback + feedbackWeather * 0.2 + storm * 0.1, 0.05, 0.75),
    filterHz: clamp((mix.chain?.filterHz ?? 4200) * (1 - storm * 0.25), 600, 5200),
    wet: clamp(returnLevel * 1.15 + storm * 0.08, 0.04, 0.75),
    dry: clamp(0.92 - returnLevel * 0.55, 0.35, 0.95),
    courtGate: 1,
    mode: "open",
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
