import {
  clamp,
  createVoiceShell,
  makeCrushCurve,
  midiOffsetHz,
  startOscillator,
  unitSeconds,
  voiceEnvelope,
} from "./shared.js";

function wireLead(voice, params, { arp = false } = {}) {
  const {
    frequency = 700,
    pulse = 0.65,
    crush = 0.15,
    shine = 0.35,
    arpDepth = 0.7,
    token,
    wpm,
  } = params;
  const { context, gain, now } = voice;
  const mix = clamp(pulse, 0, 1);
  const square = startOscillator(context, { type: "square", frequency });
  const saw = startOscillator(context, {
    type: "sawtooth",
    frequency,
    detune: 6,
  });
  const squareGain = context.createGain();
  const sawGain = context.createGain();
  squareGain.gain.value = 0.2 + mix * 0.7;
  sawGain.gain.value = 0.55 * (1 - mix * 0.7);
  const bus = context.createGain();
  bus.gain.value = 0.7;
  square.connect(squareGain);
  saw.connect(sawGain);
  squareGain.connect(bus);
  sawGain.connect(bus);

  if (arp && token === "-" && arpDepth > 0.05) {
    const depth = clamp(arpDepth, 0, 1);
    const steps = [0, 3, 7, 12].map((semi) => semi * depth);
    const step = (unitSeconds(wpm) * 3) / steps.length;
    for (let index = 0; index < steps.length; index += 1) {
      const hz = midiOffsetHz(frequency, steps[index]);
      const at = now + index * step;
      square.frequency.setValueAtTime(hz, at);
      saw.frequency.setValueAtTime(hz, at);
    }
  }

  const crushAmount = clamp(crush, 0, 1);
  let tone = bus;
  if (crushAmount > 0.02) {
    const shaper = context.createWaveShaper();
    shaper.curve = makeCrushCurve(crushAmount);
    const wet = context.createGain();
    const dry = context.createGain();
    wet.gain.value = crushAmount * 0.85;
    dry.gain.value = 1 - wet.gain.value * 0.5;
    bus.connect(dry);
    bus.connect(shaper);
    shaper.connect(wet);
    const mixBus = context.createGain();
    dry.connect(mixBus);
    wet.connect(mixBus);
    tone = mixBus;
    voice.push(shaper, wet, dry, mixBus);
  }

  const shineAmount = clamp(shine, 0, 1);
  if (shineAmount > 0.02) {
    const delay = context.createDelay(0.08);
    delay.delayTime.value = 0.012 + shineAmount * 0.028;
    const wet = context.createGain();
    wet.gain.value = shineAmount * 0.35;
    const chorus = startOscillator(context, {
      type: "triangle",
      frequency: frequency * 1.005,
      detune: 8,
    });
    const chorusGain = context.createGain();
    chorusGain.gain.value = shineAmount * 0.18;
    tone.connect(gain);
    tone.connect(delay);
    delay.connect(wet);
    wet.connect(gain);
    chorus.connect(chorusGain);
    chorusGain.connect(gain);
    voice.push(delay, wet, chorus, chorusGain);
  } else {
    tone.connect(gain);
  }

  voice.push(square, saw, squareGain, sawGain, bus);
}

/** Bright square/saw lead with crush grit and tiny delay drip. */
export function startKeygenLeadVoice(destination, params) {
  const voice = createVoiceShell({
    ...params,
    ...voiceEnvelope(params, {
      attack: 0.003,
      decay: 0.05,
      sustain: 0.55,
      release: 0.04,
    }),
    peak: 0.55,
  });
  voice.connect(destination);
  wireLead(voice, params, { arp: false });
  return voice;
}

/** Keygen lead with a short arp on dah only. */
export function startSceneArpVoice(destination, params) {
  const voice = createVoiceShell({
    ...params,
    ...voiceEnvelope(params, {
      attack: 0.003,
      decay: 0.04,
      sustain: 0.5,
      release: 0.035,
    }),
    peak: 0.52,
  });
  voice.connect(destination);
  wireLead(voice, params, { arp: true });
  return voice;
}
