import {
  clamp,
  createVoiceShell,
  midiOffsetHz,
  startOscillator,
  voiceEnvelope,
} from "./shared.js";

const VOICINGS = [
  [0, 7],
  [0, 4, 7],
  [0, 3, 7],
  [0, 4, 7, 14],
  [0, 1, 6, 10],
];

/** Stacked partials with selectable interval set. */
export function startChordVoice(destination, params) {
  const {
    frequency = 700,
    voicing = 1,
    chordVoices = 3,
    spread = 8,
  } = params;
  const voice = createVoiceShell({ ...params, peak: 0.55 });
  voice.connect(destination);
  const intervals = VOICINGS[clamp(Math.round(voicing), 0, VOICINGS.length - 1)];
  const count = clamp(Math.round(chordVoices), 2, intervals.length);
  for (let index = 0; index < count; index += 1) {
    const oscillator = startOscillator(voice.context, {
      type: index % 2 === 0 ? "sine" : "triangle",
      frequency: midiOffsetHz(frequency, intervals[index]),
      detune: (index - (count - 1) / 2) * spread,
    });
    const level = voice.context.createGain();
    level.gain.value = 1 / count;
    oscillator.connect(level);
    level.connect(voice.gain);
    voice.push(oscillator, level);
  }
  return voice;
}

/** Soft cross-modulating voices with slow drift (organismic hold). */
export function startOrganismVoice(destination, params) {
  const {
    frequency = 700,
    swarm = 5,
    chaos = 0.35,
    couple = 0.45,
    hold = 0.85,
  } = params;
  const voice = createVoiceShell({
    ...params,
    ...voiceEnvelope(params, {
      attack: 0.04,
      decay: 0.2,
      sustain: hold,
      release: 0.18,
    }),
    sustain: hold,
    peak: 0.4,
  });
  voice.connect(destination);
  const { context, gain } = voice;
  const count = clamp(Math.round(swarm), 2, 8);
  const carriers = [];

  for (let index = 0; index < count; index += 1) {
    const ratio = 1 + (index - (count - 1) / 2) * (0.03 + chaos * 0.08);
    const carrier = startOscillator(context, {
      type: index % 3 === 0 ? "triangle" : "sine",
      frequency: frequency * ratio,
    });
    const lfo = startOscillator(context, {
      type: "sine",
      frequency: 0.2 + index * 0.13 + chaos * 1.2,
    });
    const lfoGain = context.createGain();
    lfoGain.gain.value = frequency * (0.004 + chaos * 0.03);
    lfo.connect(lfoGain);
    lfoGain.connect(carrier.frequency);
    carriers.push(carrier);
    voice.push(carrier, lfo, lfoGain);
  }

  for (let index = 0; index < carriers.length; index += 1) {
    const next = carriers[(index + 1) % carriers.length];
    const mod = context.createGain();
    mod.gain.value = frequency * couple * 0.08;
    carriers[index].connect(mod);
    mod.connect(next.frequency);
    const level = context.createGain();
    level.gain.value = 1 / count;
    carriers[index].connect(level);
    level.connect(gain);
    voice.push(mod, level);
  }

  return voice;
}
