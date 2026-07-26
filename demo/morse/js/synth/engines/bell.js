import {
  clamp,
  createVoiceShell,
  startOscillator,
  voiceEnvelope,
} from "./shared.js";

/** Short 3-op FM glass bell with light chorus shimmer. */
export function startCrystalBellVoice(destination, params) {
  const {
    frequency = 700,
    glass = 0.55,
    bellDecay = 0.12,
    shimmer = 0.3,
  } = params;
  const decay = clamp(bellDecay, 0.02, 0.6);
  const voice = createVoiceShell({
    ...params,
    ...voiceEnvelope(params, {
      attack: 0.002,
      decay,
      sustain: 0.08,
      release: decay * 0.9,
    }),
    peak: 0.55,
  });
  voice.connect(destination);
  const { context, gain } = voice;
  const ratio = 3 + clamp(glass, 0, 1) * 0.55;
  const index = 1.2 + glass * 3.5;

  const carrier = startOscillator(context, { type: "sine", frequency });
  const modA = startOscillator(context, {
    type: "sine",
    frequency: frequency * ratio,
  });
  const modB = startOscillator(context, {
    type: "sine",
    frequency: frequency * ratio * 0.5,
  });
  const modBGain = context.createGain();
  modBGain.gain.value = frequency * index * 0.35;
  const modAGain = context.createGain();
  modAGain.gain.value = frequency * index;
  modB.connect(modBGain);
  modBGain.connect(modA.frequency);
  modA.connect(modAGain);
  modAGain.connect(carrier.frequency);
  carrier.connect(gain);

  const shimmerAmount = clamp(shimmer, 0, 1);
  if (shimmerAmount > 0.02) {
    const twin = startOscillator(context, {
      type: "sine",
      frequency: frequency * 1.003,
      detune: 7,
    });
    const twinGain = context.createGain();
    twinGain.gain.value = shimmerAmount * 0.28;
    const delay = context.createDelay(0.05);
    delay.delayTime.value = 0.014 + shimmerAmount * 0.02;
    const delayGain = context.createGain();
    delayGain.gain.value = shimmerAmount * 0.22;
    twin.connect(twinGain);
    twinGain.connect(gain);
    carrier.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(gain);
    voice.push(twin, twinGain, delay, delayGain);
  }

  voice.push(carrier, modA, modB, modAGain, modBGain);
  return voice;
}
