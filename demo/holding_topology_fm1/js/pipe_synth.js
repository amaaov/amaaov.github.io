/**
 * Wind / reed / drone pipes — digital waveguide family for Web Audio.
 *
 * - pipe: Erica-style breath + delay tube (flute-ish)
 * - saxophone: asymmetric reed table + bore delay + formant colour
 * - didgeridoo: lip buzz into long tube + vowel formant mouth
 * - vargan: metallic tongue pluck + mouth cavity bandpass
 *
 * Inspired by JOS waveguide winds, didg source–filter practice, and jaw-harp
 * resonator+mouth models — simplified for native Web Audio nodes.
 */

import { VOWELS, vowelFromIndex } from "./vowel_formants.js";

export const PIPE_KINDS = ["pipe", "saxophone", "didgeridoo", "vargan"];

function loopClampCurve() {
  // Keep waveguide samples finite — runaway FB was NaNing the master bus.
  const samples = 256;
  const curve = new Float32Array(samples);
  for (let index = 0; index < samples; index += 1) {
    const x = (index * 2) / (samples - 1) - 1;
    curve[index] = Math.tanh(x * 1.35) * 0.92;
  }
  return curve;
}

export function createPipeVoice(audioContext, kind = "pipe") {
  let model = PIPE_KINDS.includes(kind) ? kind : "pipe";
  let active = false;

  const breath = audioContext.createGain();
  const buzz = audioContext.createOscillator();
  const buzzGain = audioContext.createGain();
  const reed = audioContext.createWaveShaper();
  const delay = audioContext.createDelay(0.35);
  const boreFilter = audioContext.createBiquadFilter();
  const loopClamp = audioContext.createWaveShaper();
  const feedback = audioContext.createGain();
  const formant1 = audioContext.createBiquadFilter();
  const formant2 = audioContext.createBiquadFilter();
  const formantMix = audioContext.createGain();
  const body = audioContext.createGain();
  const wet = audioContext.createGain();
  const output = audioContext.createGain();

  breath.gain.value = 0;
  buzz.type = model === "didgeridoo" ? "sawtooth" : "sine";
  buzz.frequency.value = 80;
  buzzGain.gain.value = 0;
  reed.curve = reedCurve(model, 0.45);
  reed.oversample = "2x";
  loopClamp.curve = loopClampCurve();
  loopClamp.oversample = "2x";
  delay.delayTime.value = 0.012;
  boreFilter.type = model === "vargan" ? "bandpass" : "lowpass";
  boreFilter.frequency.value = 1800;
  boreFilter.Q.value = model === "vargan" ? 4 : 0.7;
  // Idle feedback must be 0 — otherwise 12 voices × bore loops hang forever.
  feedback.gain.value = 0;
  formant1.type = "bandpass";
  formant2.type = "bandpass";
  formant1.frequency.value = 500;
  formant2.frequency.value = 1500;
  formant1.Q.value = 3.5;
  formant2.Q.value = 4;
  formantMix.gain.value = model === "pipe" ? 0.1 : 0.28;
  body.gain.value = model === "pipe" ? 0.7 : 0.4;
  wet.gain.value = 0;
  // Quiet into amp — several wind voices were slamming the master chain.
  output.gain.value = 0.42;

  const noise = audioContext.createBufferSource();
  noise.buffer = createBreathBuffer(audioContext, model);
  noise.loop = true;

  // Excitation → reed → bore delay → clamp → feedback (gain << 1)
  noise.connect(breath);
  buzz.connect(buzzGain);
  breath.connect(reed);
  buzzGain.connect(reed);
  reed.connect(delay);
  delay.connect(boreFilter);
  boreFilter.connect(loopClamp);
  loopClamp.connect(feedback);
  feedback.connect(delay);

  boreFilter.connect(body);
  boreFilter.connect(formant1);
  boreFilter.connect(formant2);
  formant1.connect(formantMix);
  formant2.connect(formantMix);
  body.connect(wet);
  formantMix.connect(wet);
  wet.connect(output);

  noise.start();
  buzz.start();

  let vowelIndex = 0;

  function feedbackForModel(sharp) {
    // Stay well below unity after clamp + resonant filters.
    if (model === "didgeridoo") {
      return Math.min(0.62, 0.52 + sharp * 0.08);
    }
    if (model === "saxophone") {
      return Math.min(0.58, 0.48 + sharp * 0.08);
    }
    if (model === "vargan") {
      return Math.min(0.5, 0.38 + sharp * 0.1);
    }
    return Math.min(0.55, 0.42 + sharp * 0.1);
  }

  function choke(time) {
    active = false;
    breath.gain.cancelScheduledValues(time);
    buzzGain.gain.cancelScheduledValues(time);
    feedback.gain.cancelScheduledValues(time);
    wet.gain.cancelScheduledValues(time);
    // Hard zero — setTarget leaves a long asymptotic leak into the court delay.
    breath.gain.setValueAtTime(0, time);
    buzzGain.gain.setValueAtTime(0, time);
    feedback.gain.setValueAtTime(0, time);
    wet.gain.setValueAtTime(0, time);
  }

  return {
    get kind() {
      return model;
    },
    output,
    breath,
    buzz,
    buzzGain,
    reed,
    delay,
    boreFilter,
    feedback,
    formant1,
    formant2,
    wet,
    setKind(nextKind) {
      model = PIPE_KINDS.includes(nextKind) ? nextKind : model;
      buzz.type = model === "didgeridoo" ? "sawtooth" : "sine";
    },
    setActive(on, time = audioContext.currentTime) {
      if (!on) {
        choke(time);
        return;
      }
      active = true;
      wet.gain.setTargetAtTime(0.55, time, 0.04);
      feedback.gain.setTargetAtTime(feedbackForModel(0.4), time, 0.04);
    },
    setPitch(hz, sharp = 0.4, time = audioContext.currentTime) {
      if (!active) {
        return;
      }
      const safeHz = Math.max(45, hz);
      const period = pipePeriod(model, safeHz);
      delay.delayTime.setTargetAtTime(period, time, 0.04);
      feedback.gain.setTargetAtTime(feedbackForModel(sharp), time, 0.05);

      if (model === "didgeridoo") {
        buzz.frequency.setTargetAtTime(safeHz * (0.5 + sharp * 0.15), time, 0.05);
        boreFilter.type = "lowpass";
        boreFilter.Q.setTargetAtTime(0.7, time, 0.05);
        boreFilter.frequency.setTargetAtTime(900 + sharp * 1100, time, 0.05);
        setMouthFormants(formant1, formant2, vowelFromIndex(vowelIndex), time);
        formantMix.gain.setTargetAtTime(0.32, time, 0.05);
        body.gain.setTargetAtTime(0.38, time, 0.05);
      } else if (model === "saxophone") {
        boreFilter.type = "lowpass";
        boreFilter.Q.setTargetAtTime(0.75, time, 0.05);
        boreFilter.frequency.setTargetAtTime(safeHz * (2.0 + sharp * 1.8), time, 0.05);
        formant1.frequency.setTargetAtTime(550 + sharp * 200, time, 0.05);
        formant2.frequency.setTargetAtTime(1400 + sharp * 500, time, 0.05);
        formant1.Q.setTargetAtTime(3.2, time, 0.05);
        formant2.Q.setTargetAtTime(3.8, time, 0.05);
        formantMix.gain.setTargetAtTime(0.28 + sharp * 0.12, time, 0.05);
        body.gain.setTargetAtTime(0.48, time, 0.05);
        reed.curve = reedCurve("saxophone", 0.3 + sharp * 0.4);
      } else if (model === "vargan") {
        boreFilter.type = "bandpass";
        boreFilter.frequency.setTargetAtTime(safeHz * (1.0 + sharp * 0.4), time, 0.04);
        boreFilter.Q.setTargetAtTime(4 + sharp * 3, time, 0.05);
        formant1.frequency.setTargetAtTime(safeHz * (3 + sharp * 1.5), time, 0.05);
        formant2.frequency.setTargetAtTime(safeHz * (5 + sharp * 2), time, 0.05);
        formant1.Q.setTargetAtTime(4.5, time, 0.05);
        formant2.Q.setTargetAtTime(5, time, 0.05);
        formantMix.gain.setTargetAtTime(0.35, time, 0.05);
        body.gain.setTargetAtTime(0.35, time, 0.05);
        reed.curve = reedCurve("vargan", 0.45 + sharp * 0.3);
      } else {
        boreFilter.type = "bandpass";
        boreFilter.frequency.setTargetAtTime(safeHz * (1.5 + sharp * 1.6), time, 0.05);
        boreFilter.Q.setTargetAtTime(2.2 + sharp * 2.5, time, 0.05);
        formantMix.gain.setTargetAtTime(0.08, time, 0.05);
        body.gain.setTargetAtTime(0.72, time, 0.05);
        reed.curve = reedCurve("pipe", 0.25 + sharp * 0.4);
      }
    },
    setVowel(name, time = audioContext.currentTime) {
      vowelIndex = Math.max(0, Object.keys(VOWELS).indexOf(name));
      if (active) {
        setMouthFormants(formant1, formant2, name, time);
      }
    },
    pluck(time = audioContext.currentTime, level = 0.5) {
      if (!active) {
        return;
      }
      if (model === "vargan") {
        const peak = 0.28 + level * 0.22;
        breath.gain.cancelScheduledValues(time);
        breath.gain.setValueAtTime(0.0001, time);
        breath.gain.linearRampToValueAtTime(peak, time + 0.003);
        breath.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
        return;
      }
      if (model === "didgeridoo") {
        const peak = 0.08 + level * 0.1;
        breath.gain.cancelScheduledValues(time);
        breath.gain.setValueAtTime(Math.max(breath.gain.value, 0.0001), time);
        breath.gain.linearRampToValueAtTime(peak, time + 0.05);
        breath.gain.setTargetAtTime(0.03 + level * 0.03, time + 0.12, 0.2);
        buzzGain.gain.setTargetAtTime(0.06 + level * 0.06, time, 0.1);
        vowelIndex = (vowelIndex + 1) % Object.keys(VOWELS).length;
        setMouthFormants(formant1, formant2, vowelFromIndex(vowelIndex), time);
        return;
      }
      const peak =
        model === "saxophone" ? 0.14 + level * 0.16 : 0.12 + level * 0.16;
      const attack = model === "saxophone" ? 0.02 : 0.01;
      const sustain =
        model === "saxophone" ? 0.035 + level * 0.04 : 0.025 + level * 0.035;
      breath.gain.cancelScheduledValues(time);
      breath.gain.setValueAtTime(Math.max(breath.gain.value, 0.0001), time);
      breath.gain.linearRampToValueAtTime(peak, time + attack);
      breath.gain.exponentialRampToValueAtTime(
        sustain,
        time + (model === "saxophone" ? 0.18 : 0.12),
      );
    },
  };
}

function pipePeriod(kind, hz) {
  if (kind === "didgeridoo") {
    // Longer bore — fundamental often an octave-ish tube mode.
    return clamp(1 / Math.max(55, hz * 0.5), 0.008, 0.28);
  }
  if (kind === "saxophone") {
    return clamp(1 / Math.max(70, hz), 0.003, 0.1);
  }
  if (kind === "vargan") {
    return clamp(1 / Math.max(90, hz * 2), 0.0025, 0.05);
  }
  return clamp(1 / Math.max(55, hz), 0.0025, 0.08);
}

function setMouthFormants(formant1, formant2, name, time) {
  const vowel = VOWELS[name] ?? VOWELS.a;
  formant1.frequency.setTargetAtTime(vowel.f1, time, 0.08);
  formant2.frequency.setTargetAtTime(vowel.f2, time, 0.08);
  formant1.Q.setTargetAtTime(3.5, time, 0.08);
  formant2.Q.setTargetAtTime(4, time, 0.08);
}

function createBreathBuffer(audioContext, kind) {
  const length = audioContext.sampleRate * 2;
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  let pink = 0;
  for (let index = 0; index < length; index += 1) {
    const white = Math.random() * 2 - 1;
    pink = 0.98 * pink + 0.02 * white;
    if (kind === "vargan") {
      data[index] = white * 0.85;
    } else if (kind === "saxophone") {
      data[index] = white * 0.45 + pink * 0.55;
    } else if (kind === "didgeridoo") {
      data[index] = pink * 0.8 + white * 0.2;
    } else {
      data[index] = white * 0.35 + pink * 0.65;
    }
  }
  return buffer;
}

function reedCurve(kind, amount) {
  const samples = 512;
  const curve = new Float32Array(samples);
  const k = 1 + amount * (kind === "saxophone" ? 36 : 28);
  for (let index = 0; index < samples; index += 1) {
    const x = (index * 2) / (samples - 1) - 1;
    if (kind === "saxophone") {
      // Asymmetric reed: closes harder on one side (even + odd mix).
      const soft = Math.tanh(((Math.PI + k) * x) / (Math.PI + k * Math.abs(x)));
      curve[index] = soft + 0.12 * amount * x * x;
    } else if (kind === "vargan") {
      curve[index] = Math.tanh(x * (2.5 + amount * 4));
    } else {
      curve[index] = Math.tanh(((Math.PI + k) * x) / (Math.PI + k * Math.abs(x)));
    }
  }
  return curve;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
