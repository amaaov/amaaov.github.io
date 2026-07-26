function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

/** Short stereo noise impulse for ConvolverNode reverb. */
export function makeReverbImpulse(context, seconds = 1.6, decay = 2.2) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      data[index] =
        (Math.random() * 2 - 1) * (1 - index / length) ** decay;
    }
  }
  return buffer;
}

/** Master bus: compressor into dry/wet convolver reverb. */
export function createEnsembleMaster(context, defaults = {}) {
  const input = context.createGain();
  const compressor = context.createDynamicsCompressor();
  const dry = context.createGain();
  const wet = context.createGain();
  const convolver = context.createConvolver();
  convolver.buffer = makeReverbImpulse(context);
  const output = context.createGain();
  output.gain.value = defaults.outputGain ?? 0.45;

  input.connect(compressor);
  compressor.connect(dry);
  compressor.connect(convolver);
  convolver.connect(wet);
  dry.connect(output);
  wet.connect(output);

  let reverb = clamp(defaults.reverb, 0, 1, 0.18);
  let compression = clamp(defaults.compression, 0, 1, 0.35);

  function apply() {
    wet.gain.value = reverb;
    dry.gain.value = 1 - reverb * 0.55;
    compressor.threshold.value = -6 - compression * 26;
    compressor.knee.value = 4 + compression * 14;
    compressor.ratio.value = 1.4 + compression * 10;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.16 + compression * 0.12;
  }

  apply();

  return {
    input,
    output,
    get: () => ({ reverb, compression }),
    set(patch = {}) {
      if (patch.reverb != null) reverb = clamp(patch.reverb, 0, 1, reverb);
      if (patch.compression != null) {
        compression = clamp(patch.compression, 0, 1, compression);
      }
      apply();
      return { reverb, compression };
    },
  };
}

/** Per-track delay: dry path + feedback delay wet. */
export function createTrackDelay(context) {
  const input = context.createGain();
  const dry = context.createGain();
  const delay = context.createDelay(1.5);
  const feedback = context.createGain();
  const wet = context.createGain();
  const output = context.createGain();

  input.connect(dry);
  dry.connect(output);
  input.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);
  wet.connect(output);

  function set({
    delayMix = 0,
    delayMs = 180,
    delayFeedback = 0.2,
  } = {}) {
    const mix = clamp(delayMix, 0, 0.95, 0);
    wet.gain.value = mix;
    dry.gain.value = 1 - mix * 0.4;
    delay.delayTime.value = clamp(delayMs, 1, 1200, 180) / 1000;
    feedback.gain.value = clamp(delayFeedback, 0, 0.92, 0.2);
  }

  set();

  return {
    input,
    output,
    set,
    disconnect() {
      for (const node of [input, dry, delay, feedback, wet, output]) {
        try {
          node.disconnect();
        } catch {
          /* already disconnected */
        }
      }
    },
  };
}

export function clampDelayMix(value) {
  return clamp(value, 0, 0.95, 0);
}

export function clampDelayMs(value) {
  return clamp(value, 1, 1200, 180);
}

export function clampDelayFeedback(value) {
  return clamp(value, 0, 0.92, 0.2);
}

export function clampMasterAmount(value, fallback = 0) {
  return clamp(value, 0, 1, fallback);
}
