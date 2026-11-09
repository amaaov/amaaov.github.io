/**
 * Nature and dub engines for Holding Topology — Amazon canopy + Jamaica riddim.
 *
 * Families (modes via modeIndex):
 * - bubble: Minnaert pops vs waterfall rush
 * - bird: chirp / trill / bark / owl
 * - forest: canopy bed vs gust wind
 * - dolphin: whistle contours
 * - dub_bass: funk slap vs reggae dub
 * - fire: campfire crackle vs forest blaze
 *
 * Web Audio graphs approximate the device `ht_engines.c` sample paths.
 */

export const NATURE_ENGINES = ["bubble", "bird", "forest", "dolphin", "dub_bass", "fire"];

export const BIRD_MODES = ["chirp", "trill", "bark", "owl"];
export const DOLPHIN_CONTOURS = ["upsweep", "downsweep", "convex", "sine"];
export const FIRE_MODES = ["camp", "forest_fire"];

export function natureModeIndex(engine, midi = 60, seed = 1) {
  const note = Math.round(midi);
  if (engine === "bird") {
    return (note + (seed & 7)) % 4;
  }
  if (engine === "dolphin") {
    return (note + seed) % 4;
  }
  if (
    engine === "bubble" ||
    engine === "forest" ||
    engine === "dub_bass" ||
    engine === "fire"
  ) {
    return (note + seed) & 1;
  }
  return 0;
}

export function fireModeName(modeIndex) {
  return FIRE_MODES[((modeIndex % 2) + 2) % 2];
}

export function birdModeName(modeIndex) {
  return BIRD_MODES[((modeIndex % 4) + 4) % 4];
}

export function dolphinContourName(modeIndex) {
  return DOLPHIN_CONTOURS[((modeIndex % 4) + 4) % 4];
}

/** Pure helper — one bubble event tone (decaying sine with pitch fall). */
export function bubbleGrainSample(phase, envelope, freqHz, sampleRate = 44100) {
  const nextPhase = (phase + freqHz / sampleRate) % 1;
  const sample = Math.sin(nextPhase * Math.PI * 2) * envelope;
  return { sample, phase: nextPhase, envelope: envelope * 0.9975, freqHz: freqHz * 0.99972 };
}

/** Pure helper — dolphin contour shape 0…1 over cycle. */
export function dolphinContourShape(cycle, contourIndex) {
  const c = ((cycle % 1) + 1) % 1;
  const mode = ((contourIndex % 4) + 4) % 4;
  if (mode === 0) {
    return c;
  }
  if (mode === 1) {
    return 1 - c;
  }
  if (mode === 2) {
    return 1 - 4 * (c - 0.5) * (c - 0.5);
  }
  return 0.5 + 0.5 * Math.sin(c * Math.PI * 2);
}

/** Pure helper — dub/funk filter envelope amount from note age. */
export function dubBassFilterEnv(ageSeconds, dubMode) {
  if (dubMode) {
    return Math.min(1, Math.max(0, ageSeconds * 2.2));
  }
  if (ageSeconds < 0.06) {
    return 1;
  }
  return Math.min(1, Math.max(0.18, 1 - (ageSeconds - 0.06) * 3.5));
}

/** Pure helper — crackle event rate (events per sample proxy). */
export function fireCrackleRate(midiHz, blaze) {
  const base = blaze ? 0.0022 : 0.00045;
  return base + midiHz * (blaze ? 0.0000015 : 0.0000006);
}

function createNoiseBuffer(audioContext) {
  const length = Math.floor(audioContext.sampleRate * 1.5);
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  let state = 0xC0FFEE >>> 0;
  for (let index = 0; index < length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    data[index] = ((state & 0xffff) / 32768) - 1;
  }
  return buffer;
}

/**
 * Continuous nature voice: noise + osc + FM + filters, gated like pipe/string.
 */
export function createNatureVoice(audioContext, engine = "forest") {
  let model = NATURE_ENGINES.includes(engine) ? engine : "forest";
  let modeIndex = 0;
  let noteOnAt = 0;

  const noise = audioContext.createBufferSource();
  noise.buffer = createNoiseBuffer(audioContext);
  noise.loop = true;

  const noiseGain = audioContext.createGain();
  const osc = audioContext.createOscillator();
  const osc2 = audioContext.createOscillator();
  const oscGain = audioContext.createGain();
  const osc2Gain = audioContext.createGain();
  const fmGain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  const filter2 = audioContext.createBiquadFilter();
  const amp = audioContext.createGain();
  const output = audioContext.createGain();
  const lfo = audioContext.createOscillator();
  const lfoGain = audioContext.createGain();

  noiseGain.gain.value = 0.0001;
  osc.type = "sine";
  osc2.type = "sawtooth";
  osc.frequency.value = 440;
  osc2.frequency.value = 220;
  oscGain.gain.value = 0.0001;
  osc2Gain.gain.value = 0.0001;
  fmGain.gain.value = 0;
  filter.type = "bandpass";
  filter.frequency.value = 1200;
  filter.Q.value = 0.7;
  filter2.type = "lowpass";
  filter2.frequency.value = 4000;
  filter2.Q.value = 0.5;
  amp.gain.value = 0.0001;
  output.gain.value = 0.55;
  lfo.type = "sine";
  lfo.frequency.value = 0.22;
  lfoGain.gain.value = 0;

  noise.connect(noiseGain);
  noiseGain.connect(filter);
  osc.connect(fmGain);
  fmGain.connect(osc2.frequency);
  osc2.connect(osc2Gain);
  osc.connect(oscGain);
  oscGain.connect(filter);
  osc2Gain.connect(filter);
  filter.connect(filter2);
  filter2.connect(amp);
  amp.connect(output);
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);

  noise.start();
  osc.start();
  osc2.start();
  lfo.start();

  function applyModel(hz, sharp, now) {
    const waterfall = modeIndex & 1;
    const dub = modeIndex & 1;
    if (model === "bubble") {
      noiseGain.gain.setTargetAtTime(waterfall ? 0.45 : 0.18, now, 0.05);
      oscGain.gain.setTargetAtTime(waterfall ? 0.35 : 0.7, now, 0.05);
      osc2Gain.gain.setTargetAtTime(0.0001, now, 0.05);
      fmGain.gain.setTargetAtTime(0, now, 0.05);
      osc.type = "sine";
      osc.frequency.setTargetAtTime(hz * (waterfall ? 1.2 : 2.4), now, 0.04);
      filter.type = "bandpass";
      filter.frequency.setTargetAtTime(600 + sharp * 2400, now, 0.08);
      filter.Q.setTargetAtTime(waterfall ? 0.6 : 2.2, now, 0.08);
      filter2.frequency.setTargetAtTime(5000 + sharp * 3000, now, 0.08);
      lfo.frequency.setTargetAtTime(waterfall ? 0.35 : 0.12, now, 0.1);
      lfoGain.gain.setTargetAtTime(waterfall ? 900 : 280, now, 0.1);
      output.gain.value = 0.5;
      return;
    }
    if (model === "bird") {
      const bird = birdModeName(modeIndex);
      noiseGain.gain.setTargetAtTime(bird === "bark" ? 0.22 : 0.02, now, 0.04);
      oscGain.gain.setTargetAtTime(0.0001, now, 0.04);
      osc2Gain.gain.setTargetAtTime(0.85, now, 0.04);
      osc.type = "sine";
      osc2.type = "sine";
      const base = bird === "owl" ? hz * 0.45 : hz * 1.4;
      osc.frequency.setTargetAtTime(base * 2.15, now, 0.03);
      osc2.frequency.setTargetAtTime(base, now, 0.03);
      fmGain.gain.setTargetAtTime(bird === "bark" ? base * 0.35 : base * 0.12, now, 0.05);
      filter.type = "bandpass";
      filter.frequency.setTargetAtTime(base * 1.8, now, 0.05);
      filter.Q.setTargetAtTime(bird === "trill" ? 3.5 : 1.4, now, 0.05);
      filter2.frequency.setTargetAtTime(8000, now, 0.08);
      lfo.frequency.setTargetAtTime(bird === "trill" ? 12 : bird === "owl" ? 0.4 : 3.5, now, 0.05);
      lfoGain.gain.setTargetAtTime(bird === "trill" ? 180 : 90, now, 0.05);
      output.gain.value = 0.48;
      return;
    }
    if (model === "forest") {
      const gust = modeIndex & 1;
      noiseGain.gain.setTargetAtTime(gust ? 0.7 : 0.45, now, 0.08);
      oscGain.gain.setTargetAtTime(0.0001, now, 0.08);
      osc2Gain.gain.setTargetAtTime(0.0001, now, 0.08);
      fmGain.gain.setTargetAtTime(0, now, 0.08);
      filter.type = "bandpass";
      filter.frequency.setTargetAtTime(gust ? 1400 + sharp * 1800 : 700 + sharp * 900, now, 0.12);
      filter.Q.setTargetAtTime(gust ? 0.9 : 0.45, now, 0.1);
      filter2.type = "lowpass";
      filter2.frequency.setTargetAtTime(gust ? 5500 : 2800, now, 0.12);
      lfo.frequency.setTargetAtTime(gust ? 0.55 : 0.18, now, 0.15);
      lfoGain.gain.setTargetAtTime(gust ? 1200 : 480, now, 0.15);
      output.gain.value = 0.42;
      return;
    }
    if (model === "dolphin") {
      noiseGain.gain.setTargetAtTime(0.01, now, 0.05);
      oscGain.gain.setTargetAtTime(0.55, now, 0.05);
      osc2Gain.gain.setTargetAtTime(0.35, now, 0.05);
      osc.type = "sine";
      osc2.type = "sine";
      const shape = dolphinContourShape(0.35, modeIndex);
      const f = hz * (3.2 + 5.5 * shape);
      osc.frequency.setTargetAtTime(f, now, 0.04);
      osc2.frequency.setTargetAtTime(f * 2, now, 0.04);
      fmGain.gain.setTargetAtTime(f * 0.04, now, 0.05);
      filter.type = "bandpass";
      filter.frequency.setTargetAtTime(f * 1.2, now, 0.06);
      filter.Q.setTargetAtTime(2.2, now, 0.06);
      filter2.frequency.setTargetAtTime(9000, now, 0.08);
      lfo.frequency.setTargetAtTime(1.2, now, 0.1);
      lfoGain.gain.setTargetAtTime(220, now, 0.1);
      output.gain.value = 0.5;
      return;
    }
    if (model === "fire") {
      const blaze = modeIndex & 1;
      noiseGain.gain.setTargetAtTime(blaze ? 0.85 : 0.55, now, 0.08);
      oscGain.gain.setTargetAtTime(0.0001, now, 0.08);
      osc2Gain.gain.setTargetAtTime(0.0001, now, 0.08);
      fmGain.gain.setTargetAtTime(0, now, 0.08);
      filter.type = "bandpass";
      filter.frequency.setTargetAtTime(blaze ? 900 + sharp * 1600 : 500 + sharp * 900, now, 0.1);
      filter.Q.setTargetAtTime(blaze ? 0.7 : 1.4, now, 0.08);
      filter2.type = "lowpass";
      filter2.frequency.setTargetAtTime(blaze ? 6500 : 3200, now, 0.1);
      lfo.frequency.setTargetAtTime(blaze ? 1.4 : 0.35, now, 0.12);
      lfoGain.gain.setTargetAtTime(blaze ? 900 : 220, now, 0.12);
      output.gain.value = blaze ? 0.52 : 0.4;
      return;
    }
    /* dub_bass */
    noiseGain.gain.setTargetAtTime(0.0001, now, 0.05);
    oscGain.gain.setTargetAtTime(dub ? 0.55 : 0.35, now, 0.05);
    osc2Gain.gain.setTargetAtTime(dub ? 0.28 : 0.5, now, 0.05);
    osc.type = "sine";
    osc2.type = dub ? "sawtooth" : "square";
    osc.frequency.setTargetAtTime(hz, now, 0.03);
    osc2.frequency.setTargetAtTime(hz * (dub ? 1.0 : 1.002), now, 0.03);
    fmGain.gain.setTargetAtTime(0, now, 0.05);
    filter.type = "lowpass";
    const age = Math.max(0, now - noteOnAt);
    const fenv = dubBassFilterEnv(age, Boolean(dub));
    filter.frequency.setTargetAtTime(
      dub ? 90 + fenv * 220 + sharp * 120 : 180 + fenv * 1400 + sharp * 400,
      now,
      0.04,
    );
    filter.Q.setTargetAtTime(dub ? 0.7 : 2.8 + sharp * 2, now, 0.05);
    filter2.frequency.setTargetAtTime(dub ? 600 : 2200, now, 0.08);
    lfo.frequency.setTargetAtTime(0.15, now, 0.1);
    lfoGain.gain.setTargetAtTime(dub ? 40 : 0, now, 0.1);
    output.gain.value = 0.62;
  }

  return {
    output,
    get engine() {
      return model;
    },
    setKind(next, now = audioContext.currentTime) {
      if (NATURE_ENGINES.includes(next)) {
        model = next;
      }
      applyModel(osc.frequency.value || 220, 0.4, now);
    },
    setMode(index, now = audioContext.currentTime) {
      modeIndex = index | 0;
      applyModel(osc.frequency.value || 220, 0.4, now);
    },
    noteOn(midi, velocity = 100, mode = 0, now = audioContext.currentTime) {
      const hz = 440 * 2 ** ((midi - 69) / 12);
      modeIndex = mode | 0;
      noteOnAt = now;
      applyModel(hz, Math.min(1, velocity / 127), now);
      const peak = 0.15 + (velocity / 127) * 0.55;
      amp.gain.cancelScheduledValues(now);
      amp.gain.setValueAtTime(Math.max(amp.gain.value, 0.0001), now);
      amp.gain.linearRampToValueAtTime(peak, now + (model === "dub_bass" ? 0.02 : 0.01));
      if (model === "bird" || model === "dolphin") {
        const dur = model === "dolphin" ? 0.85 : 0.45;
        amp.gain.linearRampToValueAtTime(peak * 0.7, now + dur * 0.55);
        amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      } else if (model === "bubble") {
        amp.gain.exponentialRampToValueAtTime(peak * 0.55, now + 0.2);
      }
    },
    noteOff(now = audioContext.currentTime) {
      amp.gain.cancelScheduledValues(now);
      const slow =
        model === "forest" || model === "dub_bass" || model === "fire";
      amp.gain.setTargetAtTime(0.0001, now, slow ? 0.18 : 0.06);
    },
    setLevel(level, now = audioContext.currentTime) {
      amp.gain.setTargetAtTime(Math.max(0.0001, level), now, 0.05);
    },
  };
}
