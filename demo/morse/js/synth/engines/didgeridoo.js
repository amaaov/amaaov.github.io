import {
  clamp,
  createNoiseSource,
  createVoiceShell,
  startOscillator,
  voiceEnvelope,
} from "./shared.js";

/** Wire a didgeridoo stack into an existing gain node. */
export function attachDidgeridoo(voice, {
  frequency = 700,
  drone = 0.7,
  buzz = 0.45,
  circular = 0.55,
  formant = 0.5,
} = {}) {
  const { context, gain, now } = voice;
  const fund = clamp(frequency * 0.14, 48, 130);
  const mix = context.createGain();
  mix.gain.value = 0.55 + drone * 0.35;

  const body = startOscillator(context, { type: "sawtooth", frequency: fund });
  const bodyGain = context.createGain();
  bodyGain.gain.value = 0.35 + drone * 0.25;
  body.connect(bodyGain);

  const harmonic = startOscillator(context, {
    type: "triangle",
    frequency: fund * (2.1 + formant * 0.6),
  });
  const harmonicGain = context.createGain();
  harmonicGain.gain.value = 0.12 + formant * 0.2;
  harmonic.connect(harmonicGain);

  const tube = context.createBiquadFilter();
  tube.type = "bandpass";
  tube.frequency.value = fund * (2.4 + formant * 1.8);
  tube.Q.value = 4 + formant * 8;

  const breath = createNoiseSource(context, 1.2);
  const breathFilter = context.createBiquadFilter();
  breathFilter.type = "bandpass";
  breathFilter.frequency.value = fund * 3.2;
  breathFilter.Q.value = 1.2;
  const breathGain = context.createGain();
  breathGain.gain.value = buzz * 0.22;
  breath.connect(breathFilter);
  breathFilter.connect(breathGain);

  const lfo = startOscillator(context, {
    type: "sine",
    frequency: 0.2 + circular * 1.4,
  });
  const lfoDepth = context.createGain();
  lfoDepth.gain.value = circular * 0.18;
  lfo.connect(lfoDepth);
  lfoDepth.connect(breathGain.gain);
  lfoDepth.connect(harmonicGain.gain);

  const wobble = startOscillator(context, {
    type: "sine",
    frequency: 4 + circular * 3,
  });
  const wobbleDepth = context.createGain();
  wobbleDepth.gain.value = fund * 0.012 * circular;
  wobble.connect(wobbleDepth);
  wobbleDepth.connect(body.frequency);

  bodyGain.connect(tube);
  harmonicGain.connect(tube);
  breathGain.connect(tube);
  tube.connect(mix);
  mix.connect(gain);

  body.frequency.setValueAtTime(fund * 1.04, now);
  body.frequency.exponentialRampToValueAtTime(fund, now + 0.08);

  voice.push(
    body,
    bodyGain,
    harmonic,
    harmonicGain,
    tube,
    breath,
    breathFilter,
    breathGain,
    lfo,
    lfoDepth,
    wobble,
    wobbleDepth,
    mix,
  );
}

/** Sustained tube drone with breath buzz and circular-breathing swell. */
export function startDidgeridooVoice(destination, params) {
  const voice = createVoiceShell({
    ...params,
    ...voiceEnvelope(params, {
      attack: 0.04,
      decay: 0.18,
      sustain: 0.78,
      release: 0.16,
    }),
    peak: 0.62,
  });
  voice.connect(destination);
  attachDidgeridoo(voice, params);
  return voice;
}
