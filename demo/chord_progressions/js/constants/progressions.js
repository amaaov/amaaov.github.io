// Progression patterns for different musical styles
export const PROGRESSION_PATTERNS = {
  PUNK: {
    name: "punk",
    chords: [
      { type: "5", description: "Power chord" },
      { type: "", description: "Major" },
      { type: "m", description: "Minor" },
      { type: "sus4", description: "Suspended 4th" },
      { type: "add9", description: "Added 9th" },
      { type: "m7", description: "Minor 7th" },
    ],
  },
  FUNK: {
    name: "funk",
    chords: [
      { type: "7", description: "Dominant 7th" },
      { type: "9", description: "Dominant 9th" },
      { type: "maj7", description: "Major 7th" },
      { type: "m7", description: "Minor 7th" },
      { type: "13", description: "Dominant 13th" },
      { type: "m9", description: "Minor 9th" },
      { type: "7#9", description: "Dominant 7 Sharp 9" },
    ],
  },
  JAZZ: {
    name: "jazz",
    chords: [
      { type: "maj7", description: "Major 7th" },
      { type: "m7", description: "Minor 7th" },
      { type: "7alt", description: "Altered Dominant" },
      { type: "m7b5", description: "Half Diminished" },
      { type: "maj9", description: "Major 9th" },
      { type: "13b9", description: "Dominant 13 Flat 9" },
      { type: "mMaj7", description: "Minor Major 7th" },
    ],
  },
  FREE_JAZZ: {
    name: "free jazz",
    chords: [
      { type: "7#11", description: "Dominant Sharp 11" },
      { type: "maj7#5", description: "Major 7 Sharp 5" },
      { type: "7alt", description: "Altered Dominant" },
      { type: "m7b5#9", description: "Minor 7 Flat 5 Sharp 9" },
      { type: "13#11b9", description: "Dominant 13 Sharp 11 Flat 9" },
      { type: "aug7", description: "Augmented 7" },
      { type: "dim7", description: "Diminished 7" },
    ],
  },
};

export const PROGRESSION_TYPES = {
  POSITIVE: {
    name: "positive",
    chords: ["I", "IV", "V", "vi"],
    patterns: [
      ["I", "V", "vi", "IV"],
      ["I", "IV", "V"],
      ["I", "vi", "IV", "V"],
    ],
  },
  SAD: {
    name: "sad",
    chords: ["i", "iv", "v", "VI"],
    patterns: [
      ["i", "VI", "iv", "v"],
      ["i", "iv", "v"],
      ["i", "VI", "III", "v"],
    ],
  },
  PUNK: {
    name: "dark",
    chords: ["I", "IV", "V"],
    patterns: [
      ["I", "IV", "V", "IV"],
      ["I", "V", "IV", "IV"],
      ["I", "I", "IV", "V"],
    ],
  },
};

export const MIN_NODES = 3;
export const MAX_NODES = 7;
