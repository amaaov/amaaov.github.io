import { getAudioContext } from "./context.js";
import { EFFECT_DEFAULTS } from "../constants/audio.js";
import { secondsToSamples } from "../utils/math.js";

// Create reverb effect with configurable parameters
export function createReverb(audioContext) {
  if (!audioContext) {
    audioContext = getAudioContext();
    if (!audioContext) return null;
  }

  const input = audioContext.createGain();
  const output = audioContext.createGain();
  const wetGain = audioContext.createGain();
  const dryGain = audioContext.createGain();
  const convolver = audioContext.createConvolver();

  // Set initial mix
  wetGain.gain.value = EFFECT_DEFAULTS.reverb.mix;
  dryGain.gain.value = 1 - EFFECT_DEFAULTS.reverb.mix;

  // Connect the reverb network
  input.connect(dryGain);
  input.connect(convolver);
  convolver.connect(wetGain);
  dryGain.connect(output);
  wetGain.connect(output);

  // Create impulse response
  const generateImpulseResponse = (decay = EFFECT_DEFAULTS.reverb.time, preDelay = 0.1) => {
    const sampleRate = audioContext.sampleRate;
    const length = Math.floor(sampleRate * (decay + preDelay));
    const impulse = audioContext.createBuffer(2, length, sampleRate);

    // Generate impulse response for both channels
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);

      // Pre-delay
      const preDelaySamples = Math.floor(preDelay * sampleRate);
      for (let i = 0; i < preDelaySamples; i++) {
        channelData[i] = 0;
      }

      // Exponential decay
      for (let i = preDelaySamples; i < length; i++) {
        const t = (i - preDelaySamples) / (length - preDelaySamples);
        channelData[i] = (Math.random() * 2 - 1) * Math.exp(-t * 5);
      }
    }

    return impulse;
  };

  // Initialize with default impulse response
  convolver.buffer = generateImpulseResponse();

  return {
    input,
    output,
    convolver,
    wetGain,
    dryGain,
    updateParameters(time, mix, decayTime, preDelay) {
      const now = time || audioContext.currentTime;

      // Update impulse response
      convolver.buffer = generateImpulseResponse(decayTime, preDelay);

      // Update wet/dry mix (constant power crossfade)
      const wetAmount = Math.min(Math.max(0, mix), 1);
      const dryAmount = Math.sqrt(1 - wetAmount * wetAmount);

      wetGain.gain.setTargetAtTime(wetAmount, now, 0.01);
      dryGain.gain.setTargetAtTime(dryAmount, now, 0.01);
    }
  };
}

// Create delay effect with configurable parameters
export function createDelay(audioContext) {
  if (!audioContext) {
    audioContext = getAudioContext();
    if (!audioContext) return null;
  }

  const input = audioContext.createGain();
  const output = audioContext.createGain();
  const delay = audioContext.createDelay(5.0);
  const feedback = audioContext.createGain();
  const wetGain = audioContext.createGain();
  const dryGain = audioContext.createGain();

  // Set initial parameters with smoother transitions
  const now = audioContext.currentTime;
  delay.delayTime.setTargetAtTime(EFFECT_DEFAULTS.delay.time, now, 0.01);
  feedback.gain.setTargetAtTime(EFFECT_DEFAULTS.delay.feedback, now, 0.01);

  // Use constant power crossfade for mix
  const wetAmount = EFFECT_DEFAULTS.delay.mix;
  const dryAmount = Math.sqrt(1 - wetAmount * wetAmount);
  wetGain.gain.setTargetAtTime(wetAmount, now, 0.01);
  dryGain.gain.setTargetAtTime(dryAmount, now, 0.01);

  // Connect the delay network with additional gain compensation
  const compensationGain = audioContext.createGain();
  compensationGain.gain.value = 1.2; // Slight boost to compensate for wet/dry mixing

  input.connect(dryGain);
  input.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wetGain);
  dryGain.connect(compensationGain);
  wetGain.connect(compensationGain);
  compensationGain.connect(output);

  return {
    input,
    output,
    delay,
    feedback,
    wetGain,
    dryGain,
    updateParameters(time, mix, delayTime, feedbackAmount) {
      const now = time || audioContext.currentTime;

      // Smoother delay time transition
      delay.delayTime.linearRampToValueAtTime(
        Math.min(Math.max(0.01, delayTime), 2.0),
        now + 0.05
      );

      // Controlled feedback with safety limiter
      const safeFeedback = Math.min(Math.max(0, feedbackAmount), 0.95);
      feedback.gain.setTargetAtTime(safeFeedback, now, 0.01);

      // Constant power crossfade for mix
      const wetAmount = Math.min(Math.max(0, mix), 1);
      const dryAmount = Math.sqrt(1 - wetAmount * wetAmount);

      wetGain.gain.setTargetAtTime(wetAmount, now, 0.01);
      dryGain.gain.setTargetAtTime(dryAmount, now, 0.01);
    }
  };
}

// Create channel EQ
export function createChannelEQ(audioContext) {
  if (!audioContext) {
    audioContext = getAudioContext();
    if (!audioContext) return null;
  }

  const input = audioContext.createGain();
  const output = audioContext.createGain();

  // Create EQ bands
  const low = audioContext.createBiquadFilter();
  const mid = audioContext.createBiquadFilter();
  const high = audioContext.createBiquadFilter();

  // Configure filters
  low.type = "lowshelf";
  low.frequency.value = 200;
  low.gain.value = 0;

  mid.type = "peaking";
  mid.frequency.value = 1000;
  mid.Q.value = 1;
  mid.gain.value = 0;

  high.type = "highshelf";
  high.frequency.value = 4000;
  high.gain.value = 0;

  // Connect the chain
  input.connect(low);
  low.connect(mid);
  mid.connect(high);
  high.connect(output);

  return { input, low, mid, high, output };
}

// Create master limiter
export function createMasterLimiter(audioContext) {
  if (!audioContext) {
    audioContext = getAudioContext();
    if (!audioContext) return null;
  }

  const compressor = audioContext.createDynamicsCompressor();

  // Set up compressor for limiting
  compressor.threshold.value = -1.0;  // dB
  compressor.knee.value = 0.0;        // dB
  compressor.ratio.value = 20.0;      // Hard limit
  compressor.attack.value = 0.001;    // 1ms
  compressor.release.value = 0.1;     // 100ms

  return compressor;
}

// Create filter
export function createFilter(audioContext, frequency = EFFECT_DEFAULTS.filter.frequency) {
  if (!audioContext) {
    audioContext = getAudioContext();
    if (!audioContext) return null;
  }

  const filter = audioContext.createBiquadFilter();
  filter.type = EFFECT_DEFAULTS.filter.type;
  filter.frequency.setValueAtTime(frequency, audioContext.currentTime);
  filter.Q.setValueAtTime(EFFECT_DEFAULTS.filter.Q, audioContext.currentTime);
  return filter;
}

// Create LFO
export function createLFO(frequency = 0.5, depth = 0.5) {
  const audioContext = getAudioContext();
  if (!audioContext) return null;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.frequency.value = frequency;
  gain.gain.value = depth;

  oscillator.connect(gain);
  oscillator.start();

  return { oscillator, gain };
}

// Create stereo panner with LFO
export function createStereoPanner(rate = 0.5, depth = 0.5) {
  const audioContext = getAudioContext();
  if (!audioContext) return null;

  const panner = audioContext.createStereoPanner();
  const lfo = createLFO(rate, depth);

  if (lfo) {
    lfo.gain.connect(panner.pan);
  }

  return { panner, lfo };
}

// Clean up audio node
export function cleanupAudioNode(node) {
  if (!node) return;
  try {
    if (node.stop) node.stop();
    if (node.disconnect) node.disconnect();
  } catch (error) {
    console.warn("Error cleaning up audio node:", error);
  }
}

// Create warmth effect (saturation)
export function createWarmth(audioContext) {
  if (!audioContext) return null;

  const input = audioContext.createGain();
  const output = audioContext.createGain();
  const drive = audioContext.createWaveShaper();

  // Create warmth curve
  const makeWarmthCurve = (amount) => {
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < n_samples; i++) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }

    return curve;
  };

  drive.curve = makeWarmthCurve(4);
  drive.oversample = "4x";

  input.connect(drive);
  drive.connect(output);

  return {
    input,
    output,
    drive,
    updateDrive(amount) {
      drive.curve = makeWarmthCurve(amount);
    }
  };
}

// Create multi-band compressor
export function createMultibandCompressor() {
  const audioContext = getAudioContext();
  if (!audioContext) return null;

  const input = audioContext.createGain();
  const output = audioContext.createGain();

  // Create crossover filters
  const lowFilter = audioContext.createBiquadFilter();
  const midFilter = audioContext.createBiquadFilter();
  const highFilter = audioContext.createBiquadFilter();

  lowFilter.type = "lowpass";
  lowFilter.frequency.value = 200;

  midFilter.type = "bandpass";
  midFilter.frequency.value = 2000;
  midFilter.Q.value = 1;

  highFilter.type = "highpass";
  highFilter.frequency.value = 6000;

  // Create compressors for each band
  const lowComp = audioContext.createDynamicsCompressor();
  const midComp = audioContext.createDynamicsCompressor();
  const highComp = audioContext.createDynamicsCompressor();

  // Set compressor parameters
  [lowComp, midComp, highComp].forEach((comp) => {
    comp.threshold.value = -24;
    comp.knee.value = 30;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
  });

  // Connect the bands
  input.connect(lowFilter);
  input.connect(midFilter);
  input.connect(highFilter);

  lowFilter.connect(lowComp);
  midFilter.connect(midComp);
  highFilter.connect(highComp);

  lowComp.connect(output);
  midComp.connect(output);
  highComp.connect(output);

  return {
    input,
    output,
    bands: {
      low: { filter: lowFilter, compressor: lowComp },
      mid: { filter: midFilter, compressor: midComp },
      high: { filter: highFilter, compressor: highComp },
    },
  };
}
