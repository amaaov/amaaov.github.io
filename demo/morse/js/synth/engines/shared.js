import { getAudioContext } from "../context.js";

/** Absolute start time for offline-scheduled marks; null = live currentTime. */
let scheduledWhen = null;

export function beginScheduledWhen(when) {
  scheduledWhen = Number(when);
}

export function endScheduledWhen() {
  scheduledWhen = null;
}

export function audioNow(context = getAudioContext()) {
  if (scheduledWhen != null && Number.isFinite(scheduledWhen)) return scheduledWhen;
  return context.currentTime;
}

export function createVoiceShell({
  attack = 0.01,
  decay = 0.08,
  sustain = 0.7,
  release = 0.05,
  peak = 1,
  when,
  context: contextArg,
} = {}) {
  const context = contextArg || getAudioContext();
  const now = when ?? audioNow(context);
  const hold = Math.max(peak * Math.max(0.0001, sustain), 0.0001);
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + Math.max(0.001, attack));
  gain.gain.linearRampToValueAtTime(
    hold,
    now + Math.max(0.001, attack) + Math.max(0.001, decay),
  );

  const nodes = [];

  return {
    context,
    now,
    gain,
    nodes,
    connect(destination) {
      gain.connect(destination);
    },
    push(...extra) {
      nodes.push(...extra);
    },
    stop(stopWhen = audioNow(context)) {
      const stopAt = Math.max(stopWhen, now);
      try {
        gain.gain.cancelScheduledValues(stopAt);
        // Use sustain hold — .value is wrong before OfflineAudioContext renders.
        gain.gain.setValueAtTime(hold, stopAt);
        gain.gain.exponentialRampToValueAtTime(0.0001, stopAt + release);
      } catch {
        /* automation already cleared */
      }
      for (const node of nodes) {
        if (typeof node.stop !== "function") continue;
        try {
          node.stop(stopAt + release + 0.02);
        } catch {
          /* already stopped */
        }
      }
    },
  };
}

export function startOscillator(context, { type = "sine", frequency = 440, detune = 0, when } = {}) {
  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  oscillator.detune.value = detune;
  oscillator.start(when ?? audioNow(context));
  return oscillator;
}

export function createNoiseSource(context, seconds = 2) {
  const sampleRate = context.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * seconds));
  const buffer = context.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.start(audioNow(context));
  return source;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Prefer panel ENV; fall back to engine defaults. */
export function voiceEnvelope(params = {}, defaults = {}) {
  return {
    attack: params.attack ?? defaults.attack ?? 0.01,
    decay: params.decay ?? defaults.decay ?? 0.08,
    sustain: params.sustain ?? defaults.sustain ?? 0.7,
    release: params.release ?? defaults.release ?? 0.05,
  };
}

export function makeDriveCurve(amount) {
  const samples = 256;
  const curve = new Float32Array(samples);
  const k = Math.max(0.1, Number(amount) || 1);
  for (let index = 0; index < samples; index += 1) {
    const x = (index * 2) / samples - 1;
    curve[index] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

/** Quantized transfer for soft bitcrush (amount 0–1). */
export function makeCrushCurve(amount) {
  const samples = 256;
  const curve = new Float32Array(samples);
  const steps = Math.round(4 + (1 - clamp(amount, 0, 1)) * 60);
  for (let index = 0; index < samples; index += 1) {
    const x = (index * 2) / samples - 1;
    curve[index] = Math.round(x * steps) / steps;
  }
  return curve;
}

/** Map a saw (−1…1) through a duty-cycle pulse. */
export function makePwmCurve(duty) {
  const samples = 256;
  const curve = new Float32Array(samples);
  const threshold = 1 - 2 * clamp(duty, 0.05, 0.95);
  for (let index = 0; index < samples; index += 1) {
    const x = (index * 2) / samples - 1;
    curve[index] = x > threshold ? 1 : -1;
  }
  return curve;
}

export function midiOffsetHz(frequency, semitones) {
  return frequency * 2 ** (semitones / 12);
}

/** OfflineAudioContext (and webkit) — avoid cyclic graphs that hang render. */
export function isOfflineContext(context) {
  return Boolean(context && typeof context.startRendering === "function");
}

export function unitSeconds(wpm) {
  return 1.2 / Math.max(5, Number(wpm) || 18);
}
