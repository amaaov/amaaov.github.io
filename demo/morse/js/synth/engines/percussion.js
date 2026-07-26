import {
  createNoiseSource,
  createVoiceShell,
  startOscillator,
} from "./shared.js";

/** Chaotic keyed percussion: dit and dah mutate differently. */
export function startRhythmVoice(destination, params) {
  const {
    frequency = 700,
    body = 0.55,
    noiseMix = 0.4,
    chaos = 0.35,
    mutate = 0.3,
    token = ".",
  } = params;
  const isDah = token === "-";
  const voice = createVoiceShell({
    ...params,
    attack: 0.002,
    decay: isDah ? 0.18 : 0.07,
    sustain: 0.05,
    release: isDah ? 0.12 : 0.05,
    peak: 0.75,
  });
  voice.connect(destination);
  const { context, gain, now } = voice;
  const jitter = 1 + (Math.random() * 2 - 1) * chaos * 0.4;
  const pitch =
    frequency * (isDah ? 0.35 : 1.6) * jitter * (1 + mutate * Math.random());

  const oscillator = startOscillator(context, {
    type: isDah ? "sine" : "square",
    frequency: pitch,
  });
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(40, pitch * (isDah ? 0.35 : 0.7)),
    now + (isDah ? 0.12 : 0.04),
  );
  const bodyGain = context.createGain();
  bodyGain.gain.value = body;
  oscillator.connect(bodyGain);
  bodyGain.connect(gain);

  const noise = createNoiseSource(context, 0.4);
  const noiseFilter = context.createBiquadFilter();
  noiseFilter.type = isDah ? "lowpass" : "highpass";
  noiseFilter.frequency.value = isDah
    ? 400 + chaos * 800
    : 3000 + mutate * 4000;
  const noiseGain = context.createGain();
  noiseGain.gain.value = noiseMix * (isDah ? 0.35 : 0.7);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(gain);

  voice.push(oscillator, bodyGain, noise, noiseFilter, noiseGain);
  return voice;
}

/** Kit mapping: dit → hat, dah → kick. */
export function startDrumVoice(destination, params) {
  const {
    kickTone = 90,
    hatDecay = 0.08,
    punch = 0.65,
    noiseMix = 0.4,
    token = ".",
  } = params;
  const isDah = token === "-";
  const voice = createVoiceShell({
    ...params,
    attack: 0.001,
    decay: isDah ? 0.16 : hatDecay,
    sustain: 0.01,
    release: isDah ? 0.1 : hatDecay * 0.6,
    peak: 0.85,
  });
  voice.connect(destination);
  const { context, gain, now } = voice;

  if (isDah) {
    const kick = startOscillator(context, {
      type: "sine",
      frequency: kickTone * (1.8 + punch),
    });
    kick.frequency.exponentialRampToValueAtTime(
      Math.max(30, kickTone * 0.55),
      now + 0.12,
    );
    const click = createNoiseSource(context, 0.05);
    const clickFilter = context.createBiquadFilter();
    clickFilter.type = "highpass";
    clickFilter.frequency.value = 2000;
    const clickGain = context.createGain();
    clickGain.gain.setValueAtTime(punch * 0.25, now);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
    click.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(gain);
    kick.connect(gain);
    voice.push(kick, click, clickFilter, clickGain);
  } else {
    const noise = createNoiseSource(context, 0.3);
    const filter = context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 5000 + noiseMix * 6000;
    filter.Q.value = 0.5;
    const tone = startOscillator(context, {
      type: "square",
      frequency: 180 + punch * 400,
    });
    const toneGain = context.createGain();
    toneGain.gain.value = 0.08 * punch;
    noise.connect(filter);
    filter.connect(gain);
    tone.connect(toneGain);
    toneGain.connect(gain);
    voice.push(noise, filter, tone, toneGain);
  }

  return voice;
}
