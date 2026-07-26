import {
  createNoiseSource,
  createVoiceShell,
  startOscillator,
  voiceEnvelope,
} from "./shared.js";

/** Earthy hum, soil-colored noise, sparse crackle. */
export function startGroundVoice(destination, params) {
  const {
    frequency = 700,
    soil = 900,
    hum = 0.45,
    crackle = 0.25,
    depth = 0.5,
  } = params;
  const voice = createVoiceShell({
    ...params,
    ...voiceEnvelope(params, {
      attack: 0.05,
      decay: 0.25,
      sustain: 0.7,
      release: 0.2,
    }),
    peak: 0.55,
  });
  voice.connect(destination);
  const { context, gain, now } = voice;

  const drone = startOscillator(context, {
    type: "sine",
    frequency: Math.max(40, frequency * 0.25),
  });
  const droneGain = context.createGain();
  droneGain.gain.value = hum * 0.6;
  drone.connect(droneGain);
  droneGain.connect(gain);

  const noise = createNoiseSource(context, 1.5);
  const soilFilter = context.createBiquadFilter();
  soilFilter.type = "bandpass";
  soilFilter.frequency.value = soil;
  soilFilter.Q.value = 0.7;
  const noiseGain = context.createGain();
  noiseGain.gain.value = 0.25 + (1 - hum) * 0.2;
  noise.connect(soilFilter);
  soilFilter.connect(noiseGain);
  noiseGain.connect(gain);

  const lfo = startOscillator(context, { type: "sine", frequency: 0.15 + depth });
  const lfoGain = context.createGain();
  lfoGain.gain.value = 0.2 * depth;
  lfo.connect(lfoGain);
  lfoGain.connect(noiseGain.gain);

  if (crackle > 0.02) {
    const impulse = context.createBufferSource();
    const length = Math.floor(context.sampleRate * 0.2);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] =
        Math.random() < crackle * 0.02 ? (Math.random() * 2 - 1) * crackle : 0;
    }
    impulse.buffer = buffer;
    const crackleFilter = context.createBiquadFilter();
    crackleFilter.type = "highpass";
    crackleFilter.frequency.value = 1800;
    const crackleGain = context.createGain();
    crackleGain.gain.value = crackle * 0.5;
    impulse.connect(crackleFilter);
    crackleFilter.connect(crackleGain);
    crackleGain.connect(gain);
    impulse.start(now);
    voice.push(impulse, crackleFilter, crackleGain);
  }

  voice.push(drone, droneGain, noise, soilFilter, noiseGain, lfo, lfoGain);
  return voice;
}

/** Heterodyne pair with grit and slow magnetic sweep. */
export function startFluxVoice(destination, params) {
  const {
    frequency = 700,
    beat = 3.5,
    sweep = 0.55,
    grit = 0.35,
    field = 0.5,
  } = params;
  const voice = createVoiceShell({
    ...params,
    ...voiceEnvelope(params, {
      attack: 0.03,
      decay: 0.12,
      sustain: 0.75,
      release: 0.12,
    }),
    peak: 0.5,
  });
  voice.connect(destination);
  const { context, gain, now } = voice;

  const a = startOscillator(context, { type: "sine", frequency });
  const b = startOscillator(context, {
    type: "sine",
    frequency: frequency + beat,
  });
  const mix = context.createGain();
  mix.gain.value = 0.45;
  a.connect(mix);
  b.connect(mix);

  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1 + field * 8;
  const center = frequency * (0.8 + field);
  filter.frequency.setValueAtTime(center * (1 - sweep * 0.4), now);
  filter.frequency.linearRampToValueAtTime(
    center * (1 + sweep * 0.6),
    now + 0.35,
  );

  const noise = createNoiseSource(context, 1);
  const gritGain = context.createGain();
  gritGain.gain.value = grit * 0.18;
  const gritFilter = context.createBiquadFilter();
  gritFilter.type = "highpass";
  gritFilter.frequency.value = 1200 + grit * 2400;
  noise.connect(gritFilter);
  gritFilter.connect(gritGain);
  gritGain.connect(filter);

  mix.connect(filter);
  filter.connect(gain);
  voice.push(a, b, mix, filter, noise, gritFilter, gritGain);
  return voice;
}
