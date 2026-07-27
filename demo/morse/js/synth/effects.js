import { getAudioContext } from "./context.js";
import { createModulatorBank } from "./modulation.js";
import { MOD_DEFAULTS } from "./mod-params.js";

export function createEffectsChain(defaults = {}, context = getAudioContext()) {
  const input = context.createGain();
  const filter = context.createBiquadFilter();
  const delay = context.createDelay(2);
  const feedback = context.createGain();
  const delayWet = context.createGain();
  const shaper = context.createWaveShaper();
  const dry = context.createGain();
  const wet = context.createGain();
  const output = context.createGain();
  const modulators = createModulatorBank(context);

  filter.type = "lowpass";
  filter.frequency.value = defaults.filterHz ?? 2400;
  filter.Q.value = defaults.resonance ?? 0.7;
  delay.delayTime.value = defaults.delayMs ? defaults.delayMs / 1000 : 0.18;
  feedback.gain.value = defaults.feedback ?? 0.25;
  delayWet.gain.value = defaults.delayMix ?? 0.2;
  dry.gain.value = 1 - (defaults.delayMix ?? 0.2);
  wet.gain.value = defaults.drive ?? 0;
  output.gain.value = defaults.master ?? 0.35;
  shaper.curve = makeDistortionCurve(defaults.driveAmount ?? 12);
  shaper.oversample = "2x";

  input.connect(filter);
  filter.connect(modulators.tremolo);
  modulators.tremolo.connect(dry);
  modulators.tremolo.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(delayWet);
  modulators.tremolo.connect(shaper);
  shaper.connect(wet);
  dry.connect(output);
  delayWet.connect(output);
  wet.connect(output);

  const nodes = { filter, delay, feedback, delayWet, dry, wet, shaper, output };
  modulators.wireChain(nodes);
  modulators.set({ ...MOD_DEFAULTS, ...defaults });

  return {
    input,
    output,
    modulators,
    nodes,
    set(params) {
      const now = context.currentTime;
      if (params.filterHz != null) {
        filter.frequency.setTargetAtTime(params.filterHz, now, 0.02);
      }
      if (params.resonance != null) {
        filter.Q.setTargetAtTime(params.resonance, now, 0.02);
      }
      if (params.delayMs != null) {
        delay.delayTime.setTargetAtTime(params.delayMs / 1000, now, 0.02);
      }
      if (params.feedback != null) {
        feedback.gain.setTargetAtTime(params.feedback, now, 0.02);
      }
      if (params.delayMix != null) {
        delayWet.gain.setTargetAtTime(params.delayMix, now, 0.02);
        dry.gain.setTargetAtTime(1 - params.delayMix, now, 0.02);
      }
      if (params.drive != null) {
        wet.gain.setTargetAtTime(params.drive, now, 0.02);
      }
      if (params.driveAmount != null) {
        shaper.curve = makeDistortionCurve(params.driveAmount);
      }
      if (params.master != null) {
        output.gain.setTargetAtTime(params.master, now, 0.02);
      }
      modulators.set(params);
    },
  };
}

function makeDistortionCurve(amount) {
  const samples = 256;
  const curve = new Float32Array(samples);
  const k = Number(amount) || 1;
  for (let index = 0; index < samples; index += 1) {
    const x = (index * 2) / samples - 1;
    curve[index] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}
