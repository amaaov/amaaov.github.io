import { clamp, createVoiceShell, voiceEnvelope } from "./shared.js";

function fillWhite(data) {
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
}

function fillPink(data) {
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let index = 0; index < data.length; index += 1) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    data[index] =
      (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
}

function fillBrown(data) {
  let last = 0;
  for (let index = 0; index < data.length; index += 1) {
    const white = Math.random() * 2 - 1;
    last = clamp(last + white * 0.02, -1, 1);
    data[index] = last * 3.5;
  }
}

function createColoredNoise(context, color, seconds = 2) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  const kind = clamp(Math.round(color), 0, 2);
  if (kind <= 0) fillWhite(data);
  else if (kind === 1) fillPink(data);
  else fillBrown(data);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.start(context.currentTime);
  return source;
}

/** Pure noise voice — no oscillators. */
export function startNoiseVoice(destination, params) {
  const {
    frequency = 700,
    noiseColor = 0,
    noiseBand = 0,
    noiseWidth = 1.2,
    noiseDensity = 1,
  } = params;
  const voice = createVoiceShell({
    ...params,
    ...voiceEnvelope(params, {
      attack: 0.008,
      decay: 0.06,
      sustain: 0.85,
      release: 0.05,
    }),
    peak: 0.65,
  });
  voice.connect(destination);
  const { context, gain, now } = voice;

  const source = createColoredNoise(context, noiseColor, 2);
  const filter = context.createBiquadFilter();
  const band = noiseBand > 0 ? noiseBand : frequency;
  filter.type = noiseColor >= 1.5 ? "lowpass" : "bandpass";
  filter.frequency.value = clamp(band, 40, 12000);
  filter.Q.value = clamp(noiseWidth, 0.1, 18);

  const density = clamp(noiseDensity, 0, 1);
  const gate = context.createGain();
  if (density >= 0.98) {
    gate.gain.value = 1;
  } else {
    gate.gain.setValueAtTime(0, now);
    const steps = 24;
    for (let index = 0; index < steps; index += 1) {
      const time = now + index * 0.012;
      gate.gain.setValueAtTime(Math.random() < density ? 1 : 0, time);
    }
  }

  source.connect(filter);
  filter.connect(gate);
  gate.connect(gain);
  voice.push(source, filter, gate);
  return voice;
}
