/**
 * String physical models (Karplus–Strong / waveguide family) for Web Audio.
 *
 * - guitar: short pluck excitation, bright pick filter, long sustain
 * - violin: continuous filtered bow noise into a high-feedback loop
 * - piano: hammer-like burst + dual slightly-stretched delay lines
 * - karplus: generic KS (legacy engine name)
 *
 * Feedback is zero while inactive — live delay loops were hanging the bus.
 */

export const STRING_KINDS = ["guitar", "violin", "piano", "karplus"];

export function createStringVoice(audioContext, kind = "guitar") {
  let model = STRING_KINDS.includes(kind) ? kind : "guitar";
  let active = false;
  const exciter = audioContext.createGain();
  const delayA = audioContext.createDelay(0.2);
  const delayB = audioContext.createDelay(0.2);
  const dampA = audioContext.createBiquadFilter();
  const dampB = audioContext.createBiquadFilter();
  const feedbackA = audioContext.createGain();
  const feedbackB = audioContext.createGain();
  const mix = audioContext.createGain();
  const tone = audioContext.createBiquadFilter();
  const wet = audioContext.createGain();
  const output = audioContext.createGain();

  exciter.gain.value = 0;
  delayA.delayTime.value = 0.01;
  delayB.delayTime.value = 0.0102;
  dampA.type = "lowpass";
  dampB.type = "lowpass";
  dampA.frequency.value = 4200;
  dampB.frequency.value = 3800;
  dampA.Q.value = 0.5;
  dampB.Q.value = 0.5;
  // Dead until activated — high idle feedback made every voice a stuck oscillator.
  feedbackA.gain.value = 0;
  feedbackB.gain.value = 0;
  mix.gain.value = 1;
  tone.type = "lowpass";
  tone.frequency.value = 6000;
  tone.Q.value = 0.7;
  wet.gain.value = 0;
  output.gain.value = 0.48;

  const noise = audioContext.createBufferSource();
  noise.buffer = createExcitationBuffer(audioContext);
  noise.loop = true;
  noise.connect(exciter);

  exciter.connect(delayA);
  delayA.connect(dampA);
  dampA.connect(feedbackA);
  feedbackA.connect(delayA);
  dampA.connect(mix);

  exciter.connect(delayB);
  delayB.connect(dampB);
  dampB.connect(feedbackB);
  feedbackB.connect(delayB);
  dampB.connect(mix);

  mix.connect(tone);
  tone.connect(wet);
  wet.connect(output);
  noise.start();

  let bowing = false;

  function feedbackForModel(sharp) {
    // Cap well below 1 — high KS feedback was cooking the master bus.
    if (model === "violin") {
      return Math.min(0.88, 0.82 + sharp * 0.05);
    }
    if (model === "piano") {
      return Math.min(0.86, 0.8 + sharp * 0.04);
    }
    return Math.min(0.87, 0.8 + sharp * 0.05);
  }

  function choke(time) {
    bowing = false;
    active = false;
    exciter.gain.cancelScheduledValues(time);
    feedbackA.gain.cancelScheduledValues(time);
    feedbackB.gain.cancelScheduledValues(time);
    wet.gain.cancelScheduledValues(time);
    // Hard zero — asymptotic setTarget was leaking waveguides into the mix bus.
    exciter.gain.setValueAtTime(0, time);
    feedbackA.gain.setValueAtTime(0, time);
    feedbackB.gain.setValueAtTime(0, time);
    wet.gain.setValueAtTime(0, time);
  }

  return {
    get kind() {
      return model;
    },
    output,
    delayA,
    delayB,
    dampA,
    dampB,
    feedbackA,
    feedbackB,
    tone,
    wet,
    exciter,
    setKind(nextKind, time = audioContext.currentTime) {
      model = STRING_KINDS.includes(nextKind) ? nextKind : model;
      if (active && model === "piano") {
        feedbackB.gain.setTargetAtTime(feedbackForModel(0.4) * 0.95, time, 0.05);
      } else if (active) {
        feedbackB.gain.setTargetAtTime(0, time, 0.05);
      }
    },
    setActive(on, time = audioContext.currentTime) {
      if (!on) {
        choke(time);
        return;
      }
      active = true;
      wet.gain.setTargetAtTime(0.6, time, 0.04);
      const fb = feedbackForModel(0.4);
      feedbackA.gain.setTargetAtTime(fb, time, 0.04);
      feedbackB.gain.setTargetAtTime(model === "piano" ? fb * 0.95 : 0, time, 0.04);
    },
    setPitch(hz, sharp = 0.4, time = audioContext.currentTime) {
      if (!active) {
        return;
      }
      const safeHz = Math.max(40, hz);
      const period = clamp(1 / safeHz, 0.0022, 0.12);
      const stretch = model === "piano" ? 1.0018 + sharp * 0.0015 : 1.0004;
      delayA.delayTime.setTargetAtTime(period, time, 0.03);
      delayB.delayTime.setTargetAtTime(period * stretch, time, 0.03);

      const dampHz =
        model === "violin"
          ? 1800 + sharp * 2200
          : model === "piano"
            ? 2800 + sharp * 3200
            : 3200 + sharp * 4500;
      dampA.frequency.setTargetAtTime(dampHz, time, 0.05);
      dampB.frequency.setTargetAtTime(dampHz * 0.9, time, 0.05);

      const fb = feedbackForModel(sharp);
      feedbackA.gain.setTargetAtTime(fb, time, 0.05);
      feedbackB.gain.setTargetAtTime(model === "piano" ? fb * 0.95 : 0, time, 0.05);

      tone.frequency.setTargetAtTime(
        model === "violin" ? 3500 + sharp * 2500 : 4500 + sharp * 4000,
        time,
        0.05,
      );

      if (model === "violin" && bowing) {
        exciter.gain.setTargetAtTime(0.03 + sharp * 0.04, time, 0.1);
      }
    },
    pluck(time = audioContext.currentTime, level = 0.5) {
      if (!active) {
        return;
      }
      const peak =
        model === "piano"
          ? 0.4 + level * 0.4
          : model === "violin"
            ? 0.12 + level * 0.18
            : 0.35 + level * 0.4;
      const attack = model === "violin" ? 0.04 : model === "piano" ? 0.004 : 0.008;
      const decay = model === "violin" ? 0.35 : model === "piano" ? 0.045 : 0.07;
      bowing = model === "violin";
      exciter.gain.cancelScheduledValues(time);
      exciter.gain.setValueAtTime(Math.max(exciter.gain.value, 0.0001), time);
      exciter.gain.linearRampToValueAtTime(peak, time + attack);
      if (model === "violin") {
        exciter.gain.linearRampToValueAtTime(0.035 + level * 0.05, time + decay);
      } else {
        exciter.gain.exponentialRampToValueAtTime(0.0001, time + decay);
      }
    },
  };
}

function createExcitationBuffer(audioContext) {
  const length = Math.floor(audioContext.sampleRate * 0.5);
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    const white = Math.random() * 2 - 1;
    const env = Math.exp(-index / (audioContext.sampleRate * 0.08));
    data[index] =
      white * 0.7 +
      Math.sin((index / audioContext.sampleRate) * 700 * Math.PI * 2) * env * 0.15;
  }
  return buffer;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
