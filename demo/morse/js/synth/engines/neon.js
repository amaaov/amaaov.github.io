import {
  clamp,
  createNoiseSource,
  createVoiceShell,
  makeDriveCurve,
  startOscillator,
} from "./shared.js";

/** Detuned saw stack with mild HP and soft drive. */
export function startNeonSawVoice(destination, params) {
  const {
    frequency = 700,
    detune = 14,
    width = 0.55,
    heat = 0.35,
  } = params;
  const voice = createVoiceShell({ ...params, peak: 0.42 });
  voice.connect(destination);
  const { context, gain } = voice;
  const cents = clamp(detune, 0, 40);
  const spread = clamp(width, 0, 1);
  const count = 6;
  const bus = context.createGain();
  bus.gain.value = 1 / count;

  for (let index = 0; index < count; index += 1) {
    const offset = index - (count - 1) / 2;
    const oscillator = startOscillator(context, {
      type: "sawtooth",
      frequency,
      detune: offset * (8 + cents * 0.45),
    });
    const pan = context.createStereoPanner();
    pan.pan.value = clamp((offset / ((count - 1) / 2)) * spread, -1, 1);
    oscillator.connect(pan);
    pan.connect(bus);
    voice.push(oscillator, pan);
  }

  const highpass = context.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 160 + heat * 120;
  highpass.Q.value = 0.7;
  const shaper = context.createWaveShaper();
  shaper.curve = makeDriveCurve(2 + heat * 18);
  shaper.oversample = "2x";
  const driveMix = context.createGain();
  driveMix.gain.value = 0.15 + heat * 0.55;
  const dry = context.createGain();
  dry.gain.value = 1 - driveMix.gain.value * 0.35;

  bus.connect(highpass);
  highpass.connect(dry);
  highpass.connect(shaper);
  shaper.connect(driveMix);
  dry.connect(gain);
  driveMix.connect(gain);
  voice.push(bus, highpass, shaper, driveMix, dry);
  return voice;
}

/** Saw + noise floor through a bandpass neon tube with filter LFO. */
export function startRainGridVoice(destination, params) {
  const {
    frequency = 700,
    rainFloor = 0.25,
    tube = 1200,
    drip = 0.4,
  } = params;
  const voice = createVoiceShell({ ...params, peak: 0.48 });
  voice.connect(destination);
  const { context, gain, now } = voice;

  const oscillator = startOscillator(context, {
    type: "sawtooth",
    frequency,
  });
  const noise = createNoiseSource(context, 1.5);
  const noiseGain = context.createGain();
  noiseGain.gain.value = clamp(rainFloor, 0, 1) * 0.22;
  const band = context.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = clamp(tube, 200, 4000);
  band.Q.value = 2.5 + drip * 4;
  const lfo = startOscillator(context, {
    type: "sine",
    frequency: 6 + drip * 10,
  });
  const lfoGain = context.createGain();
  lfoGain.gain.value = band.frequency.value * (0.08 + drip * 0.18);
  lfo.connect(lfoGain);
  lfoGain.connect(band.frequency);
  band.frequency.setValueAtTime(band.frequency.value, now);

  oscillator.connect(band);
  noise.connect(noiseGain);
  noiseGain.connect(band);
  band.connect(gain);
  voice.push(oscillator, noise, noiseGain, band, lfo, lfoGain);
  return voice;
}
