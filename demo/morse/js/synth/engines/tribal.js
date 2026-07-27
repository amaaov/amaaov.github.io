import { attachDidgeridoo } from "./didgeridoo.js";
import {
  clamp,
  createNoiseSource,
  createVoiceShell,
  startOscillator,
} from "./shared.js";

function attachDjembe(voice, { skin = 0.65, slap = 0.55, bass = false } = {}) {
  const { context, gain, now } = voice;
  const membrane = startOscillator(context, {
    type: "sine",
    frequency: bass ? 95 + skin * 40 : 220 + slap * 180,
  });
  membrane.frequency.exponentialRampToValueAtTime(
    Math.max(40, bass ? 55 : 90),
    now + (bass ? 0.14 : 0.06),
  );
  const membraneGain = context.createGain();
  membraneGain.gain.setValueAtTime(0.55 + skin * 0.35, now);
  membraneGain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + (bass ? 0.22 : 0.09),
  );
  membrane.connect(membraneGain);
  membraneGain.connect(gain);

  const noise = createNoiseSource(context, 0.25);
  const noiseFilter = context.createBiquadFilter();
  noiseFilter.type = bass ? "lowpass" : "bandpass";
  noiseFilter.frequency.value = bass ? 380 + skin * 200 : 2400 + slap * 3200;
  noiseFilter.Q.value = bass ? 0.7 : 1.4;
  const noiseGain = context.createGain();
  noiseGain.gain.setValueAtTime((bass ? 0.2 : 0.45) * (0.4 + slap), now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + (bass ? 0.08 : 0.05));
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(gain);

  voice.push(membrane, membraneGain, noise, noiseFilter, noiseGain);
}

/** Dit → djembe slap, dah → didgeridoo with bass skin hit. */
export function startTribalVoice(destination, params) {
  const {
    drone = 0.65,
    buzz = 0.4,
    circular = 0.5,
    formant = 0.45,
    skin = 0.65,
    slap = 0.55,
    token = ".",
  } = params;
  const isDah = token === "-";
  const voice = createVoiceShell({
    ...params,
    attack: isDah ? 0.03 : 0.001,
    decay: isDah ? 0.2 : 0.07,
    sustain: isDah ? 0.72 : 0.04,
    release: isDah ? 0.14 : 0.05,
    peak: 0.72,
  });
  voice.connect(destination);

  if (isDah) {
    attachDidgeridoo(voice, {
      frequency: params.frequency,
      drone,
      buzz,
      circular,
      formant,
    });
    attachDjembe(voice, { skin, slap: slap * 0.55, bass: true });
  } else {
    attachDjembe(voice, {
      skin: clamp(skin, 0, 1),
      slap: clamp(slap, 0, 1),
      bass: false,
    });
  }

  return voice;
}
