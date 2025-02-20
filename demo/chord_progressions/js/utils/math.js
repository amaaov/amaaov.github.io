// Random value within range
export function randomInRange(min, max, step = 1) {
  const steps = Math.floor((max - min) / step);
  return min + (Math.floor(Math.random() * steps) * step);
}

// Convert frequency to MIDI note number
export function freqToMidi(frequency) {
  return Math.round(12 * Math.log2(frequency / 440) + 69);
}

// Convert MIDI note number to frequency
export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Get closest frequency from array
export function getClosestFrequency(target, frequencies) {
  return frequencies.reduce((closest, current) => {
    const currentRatio = Math.abs(Math.log2(current / target));
    const closestRatio = Math.abs(Math.log2(closest / target));
    return currentRatio < closestRatio ? current : closest;
  }, frequencies[0]);
}

// Linear interpolation
export function lerp(start, end, t) {
  return start + (end - start) * t;
}

// Exponential interpolation (good for audio parameters)
export function expLerp(start, end, t) {
  return start * Math.pow(end / start, t);
}

// Clamp value between min and max
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Convert linear value to exponential
export function linearToExponential(value, min, max) {
  return min * Math.pow(max / min, value);
}

// Convert exponential value to linear
export function exponentialToLinear(value, min, max) {
  return Math.log(value / min) / Math.log(max / min);
}

// Calculate pan position with spread
export function calculatePanPosition(index, total, spread) {
  return ((index - (total - 1) / 2) / ((total - 1) / 2)) * spread;
}

// Generate array of detune values
export function generateDetuneValues(amount, count) {
  const values = [];
  const step = amount / (count - 1);
  for (let i = 0; i < count; i++) {
    values.push(-amount + (i * step * 2));
  }
  return values;
}

// Calculate gain values for detuned oscillators
export function calculateOscillatorGains(count, mixAmount) {
  const gains = [];
  const centerIndex = Math.floor(count / 2);

  for (let i = 0; i < count; i++) {
    const distance = Math.abs(i - centerIndex) / centerIndex;
    const gain = i === centerIndex
      ? 1 - (mixAmount * 0.5)
      : mixAmount * (1 - distance) * 0.8;
    gains.push(gain);
  }

  return gains;
}

// Calculate phase offset for LFO
export function calculatePhaseOffset(index, total) {
  return (index / total) * 2 * Math.PI;
}

// Convert BPM to beat duration in seconds
export function bpmToDuration(bpm) {
  return 60 / bpm;
}

// Convert seconds to samples
export function secondsToSamples(seconds, sampleRate = 44100) {
  return Math.floor(seconds * sampleRate);
}

// Convert samples to seconds
export function samplesToSeconds(samples, sampleRate = 44100) {
  return samples / sampleRate;
}

// Calculate frequency ratio between two notes
export function getFrequencyRatio(freq1, freq2) {
  return Math.abs(Math.log2(freq1 / freq2));
}

// Generate smoothing curve for audio transitions
export function generateSmoothingCurve(length) {
  const curve = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const x = (i * 2) / length - 1;
    curve[i] = (Math.PI + x) * Math.tan(x * 0.5);
  }
  return curve;
}
