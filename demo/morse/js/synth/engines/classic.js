import { createVoiceShell, startOscillator } from "./shared.js";

export function startClassicVoice(destination, params) {
  const {
    engine = "sine",
    frequency = 700,
    modIndex = 2,
    brightness = 1800,
  } = params;
  const voice = createVoiceShell(params);
  voice.connect(destination);
  const { context, gain } = voice;

  if (engine === "fm") {
    const carrier = startOscillator(context, { frequency });
    const modulator = startOscillator(context, { frequency: frequency * 2 });
    const modGain = context.createGain();
    modGain.gain.value = frequency * modIndex;
    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(gain);
    voice.push(carrier, modulator, modGain);
  } else if (engine === "am") {
    const carrier = startOscillator(context, { frequency });
    const modulator = startOscillator(context, {
      frequency: Math.max(1, frequency / 20),
    });
    const modGain = context.createGain();
    const am = context.createGain();
    modGain.gain.value = Math.min(0.5, 0.15 + modIndex * 0.05);
    am.gain.value = 0.5;
    modulator.connect(modGain);
    modGain.connect(am.gain);
    carrier.connect(am);
    am.connect(gain);
    voice.push(carrier, modulator, modGain, am);
  } else if (engine === "subtractive") {
    const oscillator = startOscillator(context, {
      type: "sawtooth",
      frequency,
    });
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = brightness;
    filter.Q.value = 4;
    oscillator.connect(filter);
    filter.connect(gain);
    voice.push(oscillator, filter);
  } else {
    const type = ["sine", "square", "triangle", "sawtooth"].includes(engine)
      ? engine
      : "sine";
    const oscillator = startOscillator(context, { type, frequency });
    oscillator.connect(gain);
    voice.push(oscillator);
  }

  return voice;
}
