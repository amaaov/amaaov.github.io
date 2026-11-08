/**
 * Pure granular delay — circular buffer + overlapping Hann grains.
 * Used by the Web Audio mix; maps stay portable for firmware parity later.
 */

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function hann(progress) {
  const t = clamp(progress, 0, 1);
  return 0.5 - 0.5 * Math.cos(Math.PI * 2 * t);
}

export function createGranularDelayState(sampleRate, maxSeconds = 2) {
  const length = Math.max(64, Math.floor(sampleRate * maxSeconds));
  return {
    buffer: new Float32Array(length),
    write: 0,
    sampleRate,
    grains: [],
    spawnAccum: 0,
    feedbackSample: 0,
  };
}

/**
 * @param {number} amount scatter/granular amount 0…1
 * @param {number} delaySeconds base delay time
 */
export function granularDelayPlan(amount = 0, delaySeconds = 0.28) {
  const unit = clamp(Number(amount) || 0, 0, 1);
  const delay = clamp(Number(delaySeconds) || 0.28, 0.02, 1.85);
  return {
    delaySeconds: delay,
    spray: unit * 0.55,
    grainSeconds: 0.035 + unit * 0.14,
    density: 3 + unit * 36,
    feedback: unit * 0.42,
    mix: unit <= 0.02 ? 0 : 0.2 + unit * 0.75,
    maxGrains: Math.min(24, 4 + Math.floor(unit * 20)),
  };
}

function readBuffer(buffer, position) {
  const length = buffer.length;
  const wrapped = ((position % length) + length) % length;
  const index = Math.floor(wrapped);
  const frac = wrapped - index;
  const a = buffer[index] ?? 0;
  const b = buffer[(index + 1) % length] ?? 0;
  return a + (b - a) * frac;
}

/**
 * Process one block. Mutates state; writes wet-only grain sum into output.
 */
export function processGranularDelay(state, input, output, plan) {
  const buffer = state.buffer;
  const length = buffer.length;
  const sampleRate = state.sampleRate;
  const delaySamples = clamp(plan.delaySeconds * sampleRate, 1, length - 2);
  const spraySamples = plan.spray * delaySamples;
  const grainSamples = Math.max(24, Math.floor(plan.grainSeconds * sampleRate));
  const spawnEvery = Math.max(8, Math.floor(sampleRate / Math.max(1, plan.density)));
  const mix = clamp(plan.mix, 0, 1);
  const feedback = clamp(plan.feedback, 0, 0.7);
  const maxGrains = plan.maxGrains ?? 16;

  output.fill(0);
  for (let index = 0; index < input.length; index += 1) {
    const incoming = input[index] + state.feedbackSample * feedback;
    buffer[state.write] = incoming;

    state.spawnAccum += 1;
    if (state.spawnAccum >= spawnEvery && state.grains.length < maxGrains && mix > 0) {
      state.spawnAccum = 0;
      const spray = (Math.random() * 2 - 1) * spraySamples;
      const read = state.write - delaySamples + spray;
      state.grains.push({
        read,
        age: 0,
        duration: grainSamples,
        amp: 0.55 + Math.random() * 0.45,
      });
    }

    let wet = 0;
    for (let grainIndex = state.grains.length - 1; grainIndex >= 0; grainIndex -= 1) {
      const grain = state.grains[grainIndex];
      const progress = grain.age / grain.duration;
      if (progress >= 1) {
        state.grains.splice(grainIndex, 1);
        continue;
      }
      wet += readBuffer(buffer, grain.read) * hann(progress) * grain.amp;
      grain.read += 1;
      grain.age += 1;
    }

    const sample = wet * mix;
    output[index] = sample;
    state.feedbackSample = sample;
    state.write += 1;
    if (state.write >= length) {
      state.write = 0;
    }
  }
  return output;
}
