import { createVoiceShell, startOscillator } from "./shared.js";

/** Punchy lattice: hard envelope, metal ping, resonant sweep. */
export function startTechnoVoice(destination, params) {
  const {
    frequency = 700,
    snap = 0.04,
    metal = 0.4,
    punch = 0.65,
    brightness = 1800,
  } = params;
  const voice = createVoiceShell({
    ...params,
    attack: Math.max(0.002, snap * 0.35),
    decay: snap,
    sustain: 0.15 + punch * 0.25,
    release: snap * 1.4,
    peak: 0.7,
  });
  voice.connect(destination);
  const { context, gain, now } = voice;

  const oscillator = startOscillator(context, {
    type: "sawtooth",
    frequency,
  });
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 2 + punch * 10;
  filter.frequency.setValueAtTime(brightness * (0.35 + punch), now);
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(120, brightness * 0.12),
    now + snap + 0.05,
  );

  if (metal > 0.01) {
    const ping = startOscillator(context, {
      type: "square",
      frequency: frequency * (3 + metal * 4),
    });
    const pingGain = context.createGain();
    pingGain.gain.setValueAtTime(metal * 0.35, now);
    pingGain.gain.exponentialRampToValueAtTime(0.0001, now + snap * 0.8);
    ping.connect(pingGain);
    pingGain.connect(filter);
    voice.push(ping, pingGain);
  }

  oscillator.connect(filter);
  filter.connect(gain);
  voice.push(oscillator, filter);
  return voice;
}
