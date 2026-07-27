import { getAudioContext } from "../context.js";
import { createAmazonBedLife } from "./amazon-life.js";
import {
  audioNow,
  clamp,
  createNoiseSource,
  isOfflineContext,
  makeDriveCurve,
  startOscillator,
} from "./shared.js";

/**
 * Evolving forest atmosphere: drifting noise bands + soft cross-mod tones.
 * Reacts to tone Hz, filter, drive, resonance, and WPM from the synth panel.
 * Offline WAV render skips cyclic FM and LFO→master wiring that hang browsers.
 */
export function createAmazonAtmosphere(destination, params = {}) {
  const context = params.context || getAudioContext();
  const when = params.when ?? audioNow(context);
  const offline = isOfflineContext(context);
  const output = context.createGain();
  output.connect(destination);

  const noise = createNoiseSource(context, offline ? 1.2 : 3);
  const low = context.createBiquadFilter();
  low.type = "lowpass";
  const mid = context.createBiquadFilter();
  mid.type = "bandpass";
  const mistFilter = context.createBiquadFilter();
  mistFilter.type = "highpass";
  const mistGain = context.createGain();
  const bedGain = context.createGain();
  const grit = context.createWaveShaper();
  grit.oversample = "2x";
  noise.connect(low);
  low.connect(bedGain);
  noise.connect(mid);
  mid.connect(bedGain);
  noise.connect(mistFilter);
  mistFilter.connect(mistGain);
  mistGain.connect(bedGain);
  // Swell rides a series bus — never wire LFO into the master gain AudioParam.
  const swellBus = context.createGain();
  swellBus.gain.value = 1;
  bedGain.connect(grit);
  grit.connect(swellBus);
  swellBus.connect(output);

  const swarm = [];
  for (let index = 0; index < 3; index += 1) {
    const carrier = startOscillator(context, {
      type: index % 2 === 0 ? "sine" : "triangle",
      frequency: 110,
      when,
    });
    const level = context.createGain();
    const lfo = startOscillator(context, {
      type: "sine",
      frequency: 0.12 + index * 0.08,
      when,
    });
    const lfoDepth = context.createGain();
    const couple = context.createGain();
    lfo.connect(lfoDepth);
    lfoDepth.connect(carrier.frequency);
    carrier.connect(level);
    level.connect(swellBus);
    swarm.push({ carrier, level, lfo, lfoDepth, couple });
  }
  // Cyclic FM between carriers hangs OfflineAudioContext in Chromium.
  if (!offline) {
    for (let index = 0; index < swarm.length; index += 1) {
      swarm[index].carrier.connect(swarm[index].couple);
      swarm[index].couple.connect(swarm[(index + 1) % swarm.length].carrier.frequency);
    }
  }

  const driftLfo = startOscillator(context, { type: "sine", frequency: 0.08, when });
  const driftToMid = context.createGain();
  const driftToLow = context.createGain();
  driftLfo.connect(driftToMid);
  driftLfo.connect(driftToLow);
  driftToMid.connect(mid.frequency);
  driftToLow.connect(low.frequency);
  const swellLfo = startOscillator(context, { type: "sine", frequency: 0.05, when });
  const swellDepth = context.createGain();
  if (!offline) {
    swellLfo.connect(swellDepth);
    swellDepth.connect(swellBus.gain);
  }

  const bedLife = offline ? null : createAmazonBedLife(context, output, when);

  const nodes = [
    noise, low, mid, mistFilter, mistGain, bedGain, grit, swellBus,
    driftLfo, driftToMid, driftToLow, swellLfo, swellDepth, output,
    ...swarm.flatMap((entry) => Object.values(entry)),
    ...(bedLife?.nodes || []),
  ];

  function apply(settings = {}) {
    const now = audioNow(context);
    const frequency = clamp(Number(settings.frequency) || 700, 80, 4000);
    const filterHz = clamp(Number(settings.filterHz) || 3200, 200, 12000);
    const drive = clamp(Number(settings.drive) || 0, 0, 1);
    const resonance = clamp(Number(settings.resonance) || 0.7, 0.1, 18);
    const wpm = clamp(Number(settings.wpm) || 18, 5, 60);
    const canopy = clamp(Number(settings.canopy) ?? 0.55, 0, 1);
    const mist = clamp(Number(settings.mist) ?? 0.4, 0, 1);
    const drift = clamp(Number(settings.drift) ?? 0.45, 0, 1);
    const swell = clamp(Number(settings.swell) ?? 0.5, 0, 1);
    const delayWet = clamp(Number(settings.delayMix) || 0, 0, 1);
    const bedLevel = canopy * (0.18 + mist * 0.06 + delayWet * 0.04);
    const midCenter = clamp(frequency * (1.4 + drift * 0.8), 400, filterHz * 0.85);
    const lowCut = clamp(frequency * (0.55 + mist * 0.2), 180, filterHz * 0.5);
    const mistCut = clamp(1400 + mist * 2200 + frequency * 0.3, 800, filterHz);
    const tempo = 0.04 + drift * 0.22 + (wpm / 60) * 0.08;

    output.gain.cancelScheduledValues(now);
    output.gain.setTargetAtTime(Math.max(0.0001, bedLevel), now, 0.08);
    low.frequency.setTargetAtTime(lowCut, now, 0.05);
    low.Q.setTargetAtTime(0.4 + resonance * 0.08, now, 0.05);
    mid.frequency.setTargetAtTime(midCenter, now, 0.05);
    mid.Q.setTargetAtTime(0.5 + resonance * 0.15 + drift * 0.4, now, 0.05);
    mistFilter.frequency.setTargetAtTime(mistCut, now, 0.05);
    mistGain.gain.setTargetAtTime(mist * 0.22, now, 0.05);
    bedGain.gain.setTargetAtTime(0.85 + drive * 0.2, now, 0.05);
    grit.curve = makeDriveCurve(1 + drive * 14);
    driftLfo.frequency.setTargetAtTime(tempo, now, 0.05);
    driftToMid.gain.setTargetAtTime(midCenter * (0.12 + drift * 0.35), now, 0.05);
    driftToLow.gain.setTargetAtTime(lowCut * (0.08 + drift * 0.2), now, 0.05);
    swellLfo.frequency.setTargetAtTime(0.03 + swell * 0.12 + drift * 0.04, now, 0.05);
    swellDepth.gain.setTargetAtTime(bedLevel * swell * 0.55, now, 0.05);
    if (offline) {
      swellBus.gain.setTargetAtTime(1 + swell * 0.15, now, 0.05);
    }

    for (let index = 0; index < swarm.length; index += 1) {
      const entry = swarm[index];
      const toneHz = clamp(frequency * (0.12 + index * 0.05 + mist * 0.02), 40, 420);
      entry.carrier.frequency.setTargetAtTime(toneHz, now, 0.06);
      entry.lfo.frequency.setTargetAtTime(tempo * (0.7 + index * 0.35), now, 0.05);
      entry.lfoDepth.gain.setTargetAtTime(toneHz * (0.01 + drift * 0.05), now, 0.05);
      entry.level.gain.setTargetAtTime(
        canopy * (0.025 + swell * 0.04) * (1 - index * 0.15),
        now,
        0.05,
      );
      entry.couple.gain.setTargetAtTime(
        offline ? 0 : toneHz * (0.02 + drift * 0.06),
        now,
        0.05,
      );
    }
    bedLife?.set(settings);
  }

  apply(params);
  output.gain.setValueAtTime(0.0001, when);
  output.gain.linearRampToValueAtTime(
    clamp(Number(params.canopy) ?? 0.55, 0, 1) * 0.22,
    when + 0.45,
  );

  return {
    set: apply,
    stop(stopWhen = audioNow(context)) {
      const stopAt = Math.max(stopWhen, audioNow(context));
      try {
        output.gain.cancelScheduledValues(stopAt);
        output.gain.setTargetAtTime(0.0001, stopAt, 0.12);
      } catch {
        /* automation cleared */
      }
      for (const node of nodes) {
        if (typeof node.stop !== "function") continue;
        try {
          node.stop(stopAt + 0.35);
        } catch {
          /* already stopped */
        }
      }
    },
  };
}
