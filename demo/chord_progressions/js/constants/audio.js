// Audio context settings
export const SAMPLE_RATE = 44100;
export const BIT_DEPTH = 32;
export const MAX_LATENCY = 50; // milliseconds
export const MAX_POLYPHONY = 16;

// Oscillator types
export const OSCILLATOR_TYPES = {
  TRIANGLE: "triangle",
  SINE: "sine",
  SQUARE: "square",
  SAWTOOTH: "sawtooth",
};

// Default audio parameters
export const DEFAULT_AUDIO_PARAMS = {
  mainGain: 0.15,
  filterFreq: 2000,
  filterQ: 2,
  maxDelayTime: 2.0,
  crossfadeDuration: 0.1,
};

// Musical constants
export const NOTES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
export const BASE_FREQUENCY = 261.63; // Middle C

// Mixer channel defaults
export const MIXER_DEFAULTS = {
  CHORDS_GAIN: 0.6,
  BASS_GAIN: 0.8,
  MASTER_GAIN: 0.7,
  chords: {
    gain: 0.8,
    pan: 0.2,
    eq: {
      low: { freq: 200, gain: 0 },
      mid: { freq: 1000, gain: 3 },
      high: { freq: 4000, gain: 4 },
    },
  },
  arp: {
    gain: 0.5,
    pan: 0,
    eq: {
      low: { freq: 300, gain: -2 },
      mid: { freq: 1500, gain: 3 },
      high: { freq: 5000, gain: 2 },
    },
  },
  noise: {
    gain: 0.3,
    pan: 0,
    eq: {
      low: { freq: 100, gain: -12 },
      mid: { freq: 2000, gain: 0 },
      high: { freq: 8000, gain: 6 },
    },
  },
  bass: {
    gain: 0.8,
    pan: -0.1,
    eq: {
      low: { freq: 60, gain: 6 },
      mid: { freq: 500, gain: -3 },
      high: { freq: 2000, gain: -6 },
    },
  },
  master: {
    gain: 0.7,
    limiter: {
      threshold: -3,
      knee: 0,
      ratio: 20,
      attack: 0.003,
      release: 0.25,
    },
  },
};

// Effect defaults
export const EFFECT_DEFAULTS = {
  reverb: {
    time: 2.0,
    decay: 0.8,
    mix: 0.5,
  },
  delay: {
    time: 0.15,
    feedback: 0.3,
    mix: 0.5,
  },
  filter: {
    type: "lowpass",
    frequency: 2000,
    Q: 2,
  },
};

// Musical timing constants
export const TIMING = {
  minBPM: 20,
  maxBPM: 1000,
  defaultBPM: 120,
  scheduleAhead: 2.0, // seconds
};
