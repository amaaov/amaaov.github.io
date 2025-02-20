// Chord progression types and their corresponding angles in the hexagon
export const CHORD_POSITIONS = [
  { angle: 0, type: "positive" }, // I
  { angle: 60, type: "sad" }, // ii
  { angle: 120, type: "dark" }, // iii
  { angle: 180, type: "positive" }, // IV
  { angle: 240, type: "positive" }, // V
  { angle: 300, type: "sad" }, // vi
];

// Progression patterns
export const PROGRESSION_PATTERNS = {
  PUNK: "punk",
  FUNK: "funk",
  JAZZ: "jazz",
  FREE_JAZZ: "free_jazz",
};

// Arpeggiator patterns
export const ARPEGGIATOR_PATTERNS = {
  UP: "up",
  DOWN: "down",
  UPDOWN: "updown",
  RANDOM: "random",
  OCTAVE_UP: "octave-up",
};

// Arpeggiator speeds
export const ARPEGGIATOR_SPEEDS = {
  SLOW: 60,
  MEDIUM: 120,
  FAST: 240,
  VERY_FAST: 480,
};

// Default arpeggiator settings
export const DEFAULT_ARPEGGIATOR_SETTINGS = {
  pattern: ARPEGGIATOR_PATTERNS.UP,
  bpm: ARPEGGIATOR_SPEEDS.MEDIUM,
};

// FUN mode styles
export const FUN_MODE_STYLES = {
  PUNK: {
    name: "punk",
    bpm: { min: 140, max: 180 }, // Fast punk
  },
  FUNK: {
    name: "funk",
    bpm: { min: 90, max: 120 }, // Groovy funk tempo
  },
  JAZZ: {
    name: "jazz",
    bpm: { min: 60, max: 100 }, // Slower, more laid back jazz
  },
  FREE_JAZZ: {
    name: "free_jazz",
    bpm: { min: 40, max: 200 }, // Variable tempo for free jazz
  },
};

// UI Layout constants
export const LAYOUT = {
  MOBILE_BREAKPOINT: 768,
  CHORD_RADIUS: 200,
  MIN_NODES: 3,
  MAX_NODES: 12,
  DEFAULT_NODES: 6,
};

// Animation durations
export const ANIMATION = {
  CHORD_TRANSITION: 300,
  PARAMETER_CHANGE: 100,
  STYLE_CHANGE: 30000,
  SEQUENCE_UPDATE: 100,
};

// Control ranges
export const CONTROL_RANGES = {
  oscillator: {
    detune: { min: 0, max: 24, default: 12, step: 1 },
    mix: { min: 0, max: 100, default: 30, step: 1 },
    resonance: { min: 0, max: 20, default: 2, step: 0.1 },
    glide: { min: 0, max: 1000, default: 0, step: 1 },
    octave: { min: -2, max: 2, default: 0, step: 0.05 },
  },
  envelope: {
    attack: { min: 0, max: 2000, default: 20, step: 1 },
    decay: { min: 0, max: 3000, default: 150, step: 1 },
    sustain: { min: 0, max: 100, default: 50, step: 1 },
    release: { min: 0, max: 5000, default: 1000, step: 10 },
  },
  reverb: {
    time: { min: 0.1, max: 20.0, default: 2.0, step: 0.1 },
    decay: { min: 0, max: 100, default: 80, step: 1 },
    mix: { min: 0, max: 100, default: 50, step: 1 },
  },
  delay: {
    time: { min: 0, max: 2000, default: 150, step: 1 },
    feedback: { min: 0, max: 95, default: 30, step: 1 },
    mix: { min: 0, max: 100, default: 50, step: 1 },
  },
  arpeggiator: {
    bpm: { min: 20, max: 1000, default: 120, step: 1 },
  },
};
