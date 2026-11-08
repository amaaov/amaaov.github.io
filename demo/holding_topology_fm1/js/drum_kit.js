/** Analog-style kick / snare / hat for court atlas grooves. */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export const DEFAULT_DRUM_ENVELOPES = {
  kick: { attack: 0.008, decay: 0.12, sustain: 0.12, release: 0.22 },
  snare: { attack: 0.004, decay: 0.055, sustain: 0.06, release: 0.1 },
  hat: { attack: 0.0015, decay: 0.018, sustain: 0.02, release: 0.032 },
};

const PART_SALT = {
  kick: 0x6b69636b,
  snare: 0x736e6172,
  hat: 0x68617431,
};

function unitRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashPatternSeed(source) {
  let hash = 2166136261;
  const text = String(source ?? "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function envelopeForPart(seed, part) {
  const random = unitRandom((seed >>> 0) ^ (PART_SALT[part] ?? 1));
  if (part === "kick") {
    return {
      attack: clamp(0.003 + random() * 0.02, 0.002, 0.035),
      decay: clamp(0.05 + random() * 0.2, 0.04, 0.32),
      sustain: clamp(0.04 + random() * 0.22, 0.02, 0.35),
      release: clamp(0.12 + random() * 0.35, 0.08, 0.55),
    };
  }
  if (part === "snare") {
    return {
      attack: clamp(0.001 + random() * 0.012, 0.001, 0.02),
      decay: clamp(0.025 + random() * 0.12, 0.02, 0.18),
      sustain: clamp(0.02 + random() * 0.14, 0.01, 0.22),
      release: clamp(0.05 + random() * 0.18, 0.04, 0.28),
    };
  }
  return {
    attack: clamp(0.0008 + random() * 0.006, 0.0005, 0.012),
    decay: clamp(0.008 + random() * 0.05, 0.006, 0.08),
    sustain: clamp(0.008 + random() * 0.05, 0.004, 0.08),
    release: clamp(0.015 + random() * 0.07, 0.01, 0.12),
  };
}

/** Unique kick/snare/hat ADSR from patch seed and optional siteswap/pattern text. */
export function drumEnvelopesFromSeed(seed, patternSource = "") {
  const mix = (seed >>> 0) ^ hashPatternSeed(patternSource);
  return {
    kick: envelopeForPart(mix, "kick"),
    snare: envelopeForPart(mix, "snare"),
    hat: envelopeForPart(mix, "hat"),
  };
}

export function createDrumKit(audioContext, destination) {
  const bus = audioContext.createGain();
  bus.gain.value = 1.05;
  bus.connect(destination);
  let envelopes = {
    kick: { ...DEFAULT_DRUM_ENVELOPES.kick },
    snare: { ...DEFAULT_DRUM_ENVELOPES.snare },
    hat: { ...DEFAULT_DRUM_ENVELOPES.hat },
  };

  return {
    bus,
    getEnvelopes() {
      return {
        kick: { ...envelopes.kick },
        snare: { ...envelopes.snare },
        hat: { ...envelopes.hat },
      };
    },
    setEnvelopes(next) {
      if (!next) {
        return;
      }
      for (const part of ["kick", "snare", "hat"]) {
        if (next[part]) {
          envelopes[part] = {
            ...DEFAULT_DRUM_ENVELOPES[part],
            ...next[part],
          };
        }
      }
    },
    trigger(part, time = audioContext.currentTime, velocity = 100) {
      const level = clamp(velocity / 127, 0.2, 1);
      const envelope = envelopes[part] ?? envelopes.hat;
      if (part === "kick") {
        triggerKick(audioContext, bus, time, level, envelope);
      } else if (part === "snare") {
        triggerSnare(audioContext, bus, time, level, envelope);
      } else {
        triggerHat(audioContext, bus, time, level, envelope);
      }
    },
  };
}

function peakTime(attack) {
  return Math.max(0.0008, attack);
}

function triggerKick(audioContext, bus, time, level, envelope) {
  const attack = peakTime(envelope.attack);
  const body = Math.max(0.04, envelope.decay + envelope.release * 0.55);
  const osc = audioContext.createOscillator();
  const amp = audioContext.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(145, time);
  osc.frequency.exponentialRampToValueAtTime(42, time + Math.min(0.2, body * 0.55));
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(0.9 * level, time + attack);
  amp.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, 0.9 * level * clamp(envelope.sustain, 0.02, 0.5)),
    time + attack + Math.max(0.02, envelope.decay),
  );
  amp.gain.exponentialRampToValueAtTime(0.0001, time + attack + body);
  osc.connect(amp);
  amp.connect(bus);
  osc.start(time);
  osc.stop(time + attack + body + 0.04);
}

function triggerSnare(audioContext, bus, time, level, envelope) {
  const attack = peakTime(envelope.attack);
  const noiseDur = Math.max(0.05, envelope.decay + envelope.release);
  const noise = noiseBurst(audioContext, time, noiseDur);
  const filter = audioContext.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1800;
  filter.Q.value = 0.7;
  const amp = audioContext.createGain();
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(0.55 * level, time + attack);
  amp.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, 0.55 * level * clamp(envelope.sustain, 0.02, 0.4)),
    time + attack + Math.max(0.015, envelope.decay * 0.7),
  );
  amp.gain.exponentialRampToValueAtTime(0.0001, time + noiseDur);
  const tone = audioContext.createOscillator();
  const toneAmp = audioContext.createGain();
  tone.type = "triangle";
  tone.frequency.setValueAtTime(190, time);
  tone.frequency.exponentialRampToValueAtTime(120, time + Math.min(0.12, noiseDur));
  toneAmp.gain.setValueAtTime(0.0001, time);
  toneAmp.gain.exponentialRampToValueAtTime(0.35 * level, time + attack);
  toneAmp.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.06, envelope.release));
  noise.connect(filter);
  filter.connect(amp);
  amp.connect(bus);
  tone.connect(toneAmp);
  toneAmp.connect(bus);
  tone.start(time);
  tone.stop(time + noiseDur + 0.02);
}

function triggerHat(audioContext, bus, time, level, envelope) {
  const attack = peakTime(envelope.attack);
  const dur = Math.max(0.02, envelope.decay + envelope.release);
  const noise = noiseBurst(audioContext, time, dur);
  const filter = audioContext.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 7000;
  const amp = audioContext.createGain();
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(0.28 * level, time + attack);
  amp.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, 0.28 * level * clamp(envelope.sustain, 0.01, 0.3)),
    time + attack + Math.max(0.006, envelope.decay),
  );
  amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  noise.connect(filter);
  filter.connect(amp);
  amp.connect(bus);
}

function noiseBurst(audioContext, time, duration) {
  const frames = Math.max(1, Math.floor(audioContext.sampleRate * duration));
  const buffer = audioContext.createBuffer(1, frames, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < frames; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.start(time);
  return source;
}
