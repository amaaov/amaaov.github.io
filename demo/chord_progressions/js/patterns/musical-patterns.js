// Musical pattern definitions
export const musicalPatterns = {
  jazz: {
    melodic: [
      [0, 4, 7, 9, 11, 12, 11, 9], // Bebop scale ascending/descending
      [0, 4, 7, 11, 12, 9, 7, 4], // Chord tones with chromatic approach
      [0, 2, 4, 5, 7, 9, 11, 12], // Dorian scale
    ],
    rhythmic: [
      [1, 0.5, 0.5, 1, 1], // Swing rhythm
      [0.5, 0.5, 1, 1, 1], // Bebop rhythm
      [1, 0.75, 0.25, 1, 1], // Triplet feel
    ],
  },
  punk: {
    melodic: [
      [0, 0, 7, 7, 4, 4, 0, 0], // Power chord progression
      [0, 7, 0, 7, 4, 7, 0, 7], // Aggressive alternating
      [0, 12, 7, 12, 4, 12, 0, 12], // Octave jumps
    ],
    rhythmic: [
      [0.25, 0.25, 0.25, 0.25], // Straight 16ths
      [0.5, 0.25, 0.25, 0.5, 0.5], // Punk groove
      [0.125, 0.125, 0.25, 0.5], // Fast attack
    ],
  },
  classical: {
    melodic: [
      [0, 2, 4, 7, 9, 7, 4, 2], // Classical scale movement
      [0, 4, 7, 12, 7, 4, 0, -5], // Arpeggiated figure
      [0, 3, 7, 12, 15, 12, 7, 3], // Extended harmony
    ],
    rhythmic: [
      [1, 1, 2, 2, 1, 1], // Classical period
      [0.5, 1, 0.5, 2], // Waltz time
      [0.25, 0.25, 0.5, 0.5, 0.5], // Mozart-style rhythm
    ],
  },
};

// Generate new musical pattern based on chord and style
export function generateNewPattern(chord, style = 'jazz') {
  const frequencies = chord.dataset.frequencies.split(",").map(Number);
  const patterns = musicalPatterns[style];

  if (!patterns) {
    console.warn(`Style ${style} not found, defaulting to jazz`);
    return generateNewPattern(chord, 'jazz');
  }

  // Select random melodic and rhythmic patterns
  const melodicPattern = patterns.melodic[Math.floor(Math.random() * patterns.melodic.length)];
  const rhythmicPattern = patterns.rhythmic[Math.floor(Math.random() * patterns.rhythmic.length)];

  return {
    frequencies: melodicPattern.map(interval => {
      const baseFreq = frequencies[0];
      return baseFreq * Math.pow(2, interval / 12);
    }),
    durations: rhythmicPattern,
    style: style
  };
}

// Generate bass pattern that complements the chord
export function generateBassPattern(chord, previousPattern = null) {
  const frequencies = chord.dataset.frequencies.split(",").map(Number);
  const rootFreq = frequencies[0];
  const fifth = rootFreq * 1.5;
  const octaveDown = rootFreq * 0.5;

  // Basic walking bass patterns
  const patterns = [
    [octaveDown, rootFreq, fifth, rootFreq], // Basic root-fifth pattern
    [octaveDown, octaveDown * 1.5, rootFreq, fifth], // Walking bass line
    [octaveDown, octaveDown * 1.25, octaveDown * 1.5, octaveDown * 1.75] // Chromatic walk up
  ];

  // Avoid repeating the same pattern
  let newPattern;
  do {
    newPattern = patterns[Math.floor(Math.random() * patterns.length)];
  } while (previousPattern && arraysEqual(previousPattern, newPattern));

  return newPattern;
}

// Helper function for array comparison
function arraysEqual(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((val, idx) => Math.abs(val - b[idx]) < 0.0001);
}

// Apply tritone substitution to a chord sequence
export function applyTritoneSubstitution(chordSequence, position) {
  if (position >= chordSequence.length) return chordSequence;

  const chord = chordSequence[position];
  const frequencies = chord.dataset.frequencies.split(",").map(Number);

  // Move root up by tritone (6 semitones)
  const substitutedFrequencies = frequencies.map(f => f * Math.pow(2, 6/12));
  chord.dataset.frequencies = substitutedFrequencies.join(",");

  return chordSequence;
}

// Apply modal interchange to a chord sequence
export function applyModalInterchange(chordSequence, scale) {
  return chordSequence.map(chord => {
    const frequencies = chord.dataset.frequencies.split(",").map(Number);

    // Apply modal interchange based on scale
    if (scale === "minor") {
      // Lower the third by a semitone for minor sound
      frequencies[1] *= Math.pow(2, -1/12);
    }

    chord.dataset.frequencies = frequencies.join(",");
    return chord;
  });
}

// Get optimal voice leading between two chords
export function getOptimalVoicing(chord1, chord2) {
  const freq1 = chord1.dataset.frequencies.split(",").map(Number);
  const freq2 = chord2.dataset.frequencies.split(",").map(Number);

  // Find closest frequencies for each note in chord2
  return freq2.map(target => {
    const closest = freq1.reduce((prev, curr) => {
      return Math.abs(Math.log2(curr/target)) < Math.abs(Math.log2(prev/target)) ? curr : prev;
    });
    return closest;
  });
}
