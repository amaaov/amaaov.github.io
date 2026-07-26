import {
  clamp,
  createVoiceShell,
  startOscillator,
  voiceEnvelope,
} from "./shared.js";

const PATCHES = [
  { attack: 0.008, decay: 0.06, sustain: 0.7, release: 0.05, peak: 0.5 },
  { attack: 0.04, decay: 0.18, sustain: 0.85, release: 0.2, peak: 0.38 },
  { attack: 0.002, decay: 0.08, sustain: 0.12, release: 0.06, peak: 0.55 },
];

/** Dry triangle+sine stack — thin plastic GM-ish lead/pad/pluck. */
export function startSoftCanvasVoice(destination, params) {
  const {
    frequency = 700,
    patch = 0,
    thin = 0.45,
    air = 0.25,
  } = params;
  const shape = PATCHES[clamp(Math.round(patch), 0, PATCHES.length - 1)];
  const voice = createVoiceShell({
    ...params,
    ...voiceEnvelope(params, shape),
    peak: shape.peak,
  });
  voice.connect(destination);
  const { context, gain } = voice;
  const thinAmount = clamp(thin, 0, 1);
  const airAmount = clamp(air, 0, 1);

  const triangle = startOscillator(context, { type: "triangle", frequency });
  const sine = startOscillator(context, {
    type: "sine",
    frequency: frequency * (patch >= 2 ? 2 : 1),
  });
  const triGain = context.createGain();
  const sineGain = context.createGain();
  triGain.gain.value = 0.55;
  sineGain.gain.value = 0.35 + (1 - thinAmount) * 0.2;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 700 + (1 - thinAmount) * 2200;
  filter.Q.value = 0.6;

  triangle.connect(triGain);
  sine.connect(sineGain);
  triGain.connect(filter);
  sineGain.connect(filter);
  filter.connect(gain);

  if (airAmount > 0.02) {
    const airTone = startOscillator(context, {
      type: "sine",
      frequency: frequency * 2.01,
    });
    const airFilter = context.createBiquadFilter();
    airFilter.type = "highpass";
    airFilter.frequency.value = 1800;
    const airGain = context.createGain();
    airGain.gain.value = airAmount * 0.12;
    airTone.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(gain);
    voice.push(airTone, airFilter, airGain);
  }

  voice.push(triangle, sine, triGain, sineGain, filter);
  return voice;
}
