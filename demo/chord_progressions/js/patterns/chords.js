import { CHORD_POSITIONS } from "../constants/ui.js";
import { NOTES } from "../constants/audio.js";
import { PROGRESSION_PATTERNS, PROGRESSION_TYPES } from "../constants/progressions.js";
import { randomInRange } from "../utils/math.js";

// Scale intervals for different modes
const SCALE_INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  altered: [0, 1, 3, 4, 6, 8, 10],
  lydianDominant: [0, 2, 4, 6, 7, 9, 10],
  halfDiminished: [0, 2, 3, 5, 6, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  wholeTone: [0, 2, 4, 6, 8, 10],
  diminished: [0, 2, 3, 5, 6, 8, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};

// Extended chord types with rich harmonies
const EXTENDED_CHORD_TYPES = {
  // Basic seventh chords
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  dim7: [0, 3, 6, 9],
  hdim7: [0, 3, 6, 10],
  aug7: [0, 4, 8, 10],

  // Ninth chords
  maj9: [0, 4, 7, 11, 14],
  min9: [0, 3, 7, 10, 14],
  dom9: [0, 4, 7, 10, 14],
  dom7flat9: [0, 4, 7, 10, 13],
  dom7sharp9: [0, 4, 7, 10, 15],
  min7flat9: [0, 3, 7, 10, 13],

  // Eleventh chords
  maj7sharp11: [0, 4, 7, 11, 18],
  min11: [0, 3, 7, 10, 14, 17],
  dom11: [0, 4, 7, 10, 14, 17],

  // Thirteenth chords
  maj13: [0, 4, 7, 11, 14, 21],
  min13: [0, 3, 7, 10, 14, 21],
  dom13: [0, 4, 7, 10, 14, 21],
  dom7flat13: [0, 4, 7, 10, 14, 20],

  // Altered dominants
  dom7alt: [0, 4, 8, 10, 13, 15],
  dom7flat5: [0, 4, 6, 10],
  dom7sharp5: [0, 4, 8, 10],

  // Sus chords
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  sus7: [0, 5, 7, 10],
  sus9: [0, 5, 7, 10, 14],

  // Add chords
  add9: [0, 4, 7, 14],
  minadd9: [0, 3, 7, 14],
  add11: [0, 4, 7, 17],

  // Complex harmonies
  maj7sharp5: [0, 4, 8, 11],
  min7flat5: [0, 3, 6, 10],
  dim7flat9: [0, 3, 6, 9, 13],
  aug9: [0, 4, 8, 10, 14],

  // Quartal harmonies
  quartal: [0, 5, 10, 15],
  quintal: [0, 7, 14, 21],
};

// Generate chord positions based on number of nodes
export function generateChordPositions(numNodes) {
  const positions = [];
  const angleStep = 360 / numNodes;

  for (let i = 0; i < numNodes; i++) {
    const angle = i * angleStep;
    const type = getProgressionType(i, numNodes);
    positions.push({ angle, type });
  }

  return positions;
}

// Get progression type based on position
function getProgressionType(index, total) {
  const normalizedIndex = index % 7;
  switch (normalizedIndex) {
    case 0: // I
    case 3: // IV
    case 4: // V
      return "positive";
    case 1: // ii
    case 5: // vi
      return "sad";
    default: // iii, vii
      return "dark";
  }
}

// Generate chords based on root note and scale
export function generateChords(rootNote, scale) {
  console.log("Generating chords for root:", rootNote, "scale:", scale);

  const rootIndex = NOTES.indexOf(rootNote);
  if (rootIndex === -1) return [];

  const scaleIntervals = SCALE_INTERVALS[scale];
  if (!scaleIntervals) return [];

  // Get progression pattern and number of nodes
  const activePattern = document.querySelector(".prog-btn.active");
  const pattern = activePattern?.dataset.progression || "free";
  console.log("Using progression pattern:", pattern);

  // Limit the maximum number of nodes to prevent performance issues
  const maxNodes = 12;
  const nodesElement = document.getElementById("progression-nodes");
  const numNodes = Math.min(
    nodesElement ? parseInt(nodesElement.value) || 6 : 6,
    maxNodes,
  );
  console.log("Number of nodes:", numNodes);

  try {
    let chords;
    switch (pattern) {
      case "twoFive":
        chords = generateTwoFiveOne(rootNote, scale, numNodes);
        break;
      case "bird":
        chords = generateBirdChanges(rootNote, scale, numNodes);
        break;
      case "coltrane":
        chords = generateColtraneChanges(rootNote, scale, numNodes);
        break;
      default:
        chords = generateAdvancedProgression(rootNote, scale, numNodes);
    }

    // Ensure we don't exceed the maximum number of chords
    if (chords.length > maxNodes) {
      chords = chords.slice(0, maxNodes);
    }

    // Deduplicate chords
    const uniqueChords = [];
    const seen = new Set();
    chords.forEach((chord) => {
      const key = `${chord.root}-${chord.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueChords.push(chord);
      }
    });

    return uniqueChords;
  } catch (error) {
    console.error("Error generating chords:", error);
    // Fallback to a simple major chord
    return [{
      root: rootNote,
      type: "maj7",
      intervals: EXTENDED_CHORD_TYPES.maj7,
    }];
  }
}

// Generate advanced progression with optimized performance
function generateAdvancedProgression(rootNote, scale, numNodes) {
  const rootIndex = NOTES.indexOf(rootNote);
  const scaleIntervals = SCALE_INTERVALS[scale];
  const chords = [];
  const usedPositions = new Set();

  // Get active progression pattern with fallback
  const activePattern = document.querySelector(".prog-btn.active");
  const pattern = activePattern?.dataset.progression || "free";

  // Get chord types with fallback to basic progression
  const patternKey = pattern.toUpperCase();
  const defaultPattern = {
    chords: [
      { type: "maj7" },
      { type: "min7" },
      { type: "min7" },
      { type: "maj7" },
      { type: "dom7" },
      { type: "min7" },
      { type: "hdim7" }
    ]
  };

  const progressionPattern = PROGRESSION_PATTERNS[patternKey] || defaultPattern;
  const chordTypes = progressionPattern.chords.map(chord => chord.type);

  // Helper function to get scale degree
  const getScaleDegree = (degree) => {
    const noteIndex = (rootIndex + (scaleIntervals?.[degree % 7] || 0)) % 12;
    return NOTES[noteIndex];
  };

  // Generate chords based on pattern
  for (let i = 0; i < numNodes; i++) {
    const degree = i % 7;
    if (usedPositions.has(degree)) continue;

    const root = getScaleDegree(degree);
    const type = chordTypes[i % chordTypes.length];

    if (root && type) {
      const intervals = calculateChordNotes(root, type);
      chords.push({ root, type, intervals });
      usedPositions.add(degree);
    }
  }

  // Ensure at least one chord is generated
  if (chords.length === 0) {
    chords.push({
      root: rootNote,
      type: "maj7",
      intervals: calculateChordNotes(rootNote, "maj7")
    });
  }

  return chords;
}

// Get chord type based on scale position
function getChordType(position, scale) {
  const chordTypes = {
    major: ["maj7", "min7", "min7", "maj7", "dom7", "min7", "half7"],
    minor: ["min7", "half7", "maj7", "min7", "min7", "maj7", "dom7"],
    dorian: ["min7", "min7", "maj7", "dom7", "min7", "half7", "maj7"],
    mixolydian: ["dom7", "min7", "half7", "maj7", "min7", "min7", "maj7"],
    altered: ["dom7", "min7", "min7", "maj7", "dom7", "min7", "half7"],
    lydianDominant: ["dom7", "min7", "min7", "dim7", "min7", "min7", "maj7"],
    halfDiminished: ["half7", "dom7", "maj7", "min7", "dim7", "maj7", "min7"],
  };

  return chordTypes[scale]?.[position] || "maj7";
}

// Helper function to calculate chord notes
function calculateChordNotes(root, type) {
  if (!root || !type || !EXTENDED_CHORD_TYPES[type]) {
    console.warn(`Invalid chord parameters - root: ${root}, type: ${type}`);
    // Return a simple major triad as fallback
    return [root];
  }

  const rootIdx = NOTES.indexOf(root);
  if (rootIdx === -1) {
    console.warn(`Invalid root note: ${root}`);
    return [root];
  }

  try {
    return EXTENDED_CHORD_TYPES[type].map(interval =>
      NOTES[(rootIdx + interval) % 12]
    );
  } catch (error) {
    console.error("Error calculating chord notes:", error);
    return [root];
  }
}

// Generate II-V-I progression with extended harmonies
function generateTwoFiveOne(rootNote, scale, numNodes) {
  const chords = [];
  const rootIndex = NOTES.indexOf(rootNote);
  const intervals = SCALE_INTERVALS[scale];

  // Calculate scale degrees for the progression
  const getScaleDegree = (degree) =>
    NOTES[(rootIndex + intervals[degree % 7]) % 12];

  // Extended chord types for each position
  const twoChordTypes = ["min9", "min11", "min7flat5", "min13"];
  const fiveChordTypes = [
    "dom9",
    "dom13",
    "dom7alt",
    "dom7sharp9",
    "dom7flat13",
  ];
  const oneChordTypes = ["maj9", "maj13", "maj7sharp11", "add9"];

  // Generate chords to fill numNodes
  while (chords.length < numNodes) {
    // ii chord variations
    const iiRoot = getScaleDegree(1);
    const iiType = twoChordTypes[chords.length % twoChordTypes.length];
    chords.push({
      root: iiRoot,
      type: iiType,
      intervals: calculateChordNotes(iiRoot, iiType),
    });

    if (chords.length >= numNodes) break;

    // V chord variations
    const vRoot = getScaleDegree(4);
    const vType = fiveChordTypes[chords.length % fiveChordTypes.length];
    chords.push({
      root: vRoot,
      type: vType,
      intervals: calculateChordNotes(vRoot, vType),
    });

    if (chords.length >= numNodes) break;

    // I chord variations
    const iType = oneChordTypes[chords.length % oneChordTypes.length];
    chords.push({
      root: rootNote,
      type: iType,
      intervals: calculateChordNotes(rootNote, iType),
    });

    // Add optional tension chords
    if (chords.length < numNodes) {
      const tensionChords = [
        { root: getScaleDegree(3), type: "min11" },
        { root: getScaleDegree(5), type: "dom7alt" },
        { root: getScaleDegree(2), type: "min13" },
      ];

      for (const tension of tensionChords) {
        if (chords.length >= numNodes) break;
        chords.push({
          root: tension.root,
          type: tension.type,
          intervals: calculateChordNotes(tension.root, tension.type),
        });
      }
    }
  }

  return chords;
}

// Generate Bird changes with extended harmonies
function generateBirdChanges(rootNote, scale, numNodes) {
  const chords = [];
  const rootIndex = NOTES.indexOf(rootNote);

  // Extended chord types for each position
  const oneChordTypes = ["maj9", "maj13", "maj7sharp11", "add9"];
  const sixChordTypes = ["min9", "min11", "min13", "minadd9"];
  const twoChordTypes = ["min9", "min11", "min7flat5", "min13"];
  const fiveChordTypes = ["dom9", "dom13", "dom7alt", "dom7sharp9"];

  // Additional substitution chords
  const substitutionTypes = ["dom7flat5", "dom7sharp5", "aug9", "dom7flat13"];

  while (chords.length < numNodes) {
    // I chord variations
    chords.push({
      root: rootNote,
      type: oneChordTypes[chords.length % oneChordTypes.length],
      intervals: calculateChordNotes(
        rootNote,
        oneChordTypes[chords.length % oneChordTypes.length],
      ),
    });

    if (chords.length >= numNodes) break;

    // VI chord variations
    const viRoot = NOTES[(rootIndex + 9) % 12];
    chords.push({
      root: viRoot,
      type: sixChordTypes[chords.length % sixChordTypes.length],
      intervals: calculateChordNotes(
        viRoot,
        sixChordTypes[chords.length % sixChordTypes.length],
      ),
    });

    if (chords.length >= numNodes) break;

    // II chord variations
    const iiRoot = NOTES[(rootIndex + 2) % 12];
    chords.push({
      root: iiRoot,
      type: twoChordTypes[chords.length % twoChordTypes.length],
      intervals: calculateChordNotes(
        iiRoot,
        twoChordTypes[chords.length % twoChordTypes.length],
      ),
    });

    if (chords.length >= numNodes) break;

    // V chord variations
    const vRoot = NOTES[(rootIndex + 7) % 12];
    chords.push({
      root: vRoot,
      type: fiveChordTypes[chords.length % fiveChordTypes.length],
      intervals: calculateChordNotes(
        vRoot,
        fiveChordTypes[chords.length % fiveChordTypes.length],
      ),
    });

    // Add tritone substitutions and additional tension chords
    if (chords.length < numNodes) {
      const tritoneRoot = NOTES[(rootIndex + 6) % 12];
      chords.push({
        root: tritoneRoot,
        type: substitutionTypes[chords.length % substitutionTypes.length],
        intervals: calculateChordNotes(
          tritoneRoot,
          substitutionTypes[chords.length % substitutionTypes.length],
        ),
      });
    }
  }

  return chords;
}

// Generate Coltrane changes with extended harmonies
function generateColtraneChanges(rootNote, scale, numNodes) {
  const chords = [];
  const rootIndex = NOTES.indexOf(rootNote);

  // Extended chord types for each position
  const majorTypes = ["maj9", "maj13", "maj7sharp11", "maj7sharp5"];
  const dominantTypes = ["dom7alt", "dom13", "dom7sharp9", "dom7flat13"];
  const minorTypes = ["min9", "min11", "min13", "min7flat5"];

  // Giant Steps cycle (in semitones from root)
  const giantStepsCycle = [0, 4, 8, 0, 5, 9, 0, 4, 8, 0];

  while (chords.length < numNodes) {
    for (
      let i = 0;
      i < giantStepsCycle.length && chords.length < numNodes;
      i++
    ) {
      const currentRoot = NOTES[(rootIndex + giantStepsCycle[i]) % 12];

      // Add major chord
      chords.push({
        root: currentRoot,
        type: majorTypes[chords.length % majorTypes.length],
        intervals: calculateChordNotes(
          currentRoot,
          majorTypes[chords.length % majorTypes.length],
        ),
      });

      if (chords.length >= numNodes) break;

      // Add dominant approach chord
      const dominantRoot = NOTES[(rootIndex + giantStepsCycle[i] + 7) % 12];
      chords.push({
        root: dominantRoot,
        type: dominantTypes[chords.length % dominantTypes.length],
        intervals: calculateChordNotes(
          dominantRoot,
          dominantTypes[chords.length % dominantTypes.length],
        ),
      });

      if (chords.length >= numNodes) break;

      // Add minor substitution
      const minorRoot = NOTES[(rootIndex + giantStepsCycle[i] + 9) % 12];
      chords.push({
        root: minorRoot,
        type: minorTypes[chords.length % minorTypes.length],
        intervals: calculateChordNotes(
          minorRoot,
          minorTypes[chords.length % minorTypes.length],
        ),
      });
    }
  }

  return chords;
}

// Apply tritone substitution
export function applyTritoneSubstitution(chords, position) {
  if (position >= chords.length) return chords;

  const chord = chords[position];
  const rootIndex = NOTES.indexOf(chord.root);
  const tritoneRoot = NOTES[(rootIndex + 6) % 12];

  return [
    ...chords.slice(0, position),
    {
      root: tritoneRoot,
      type: "dom7",
      intervals: generateChordIntervals(NOTES.indexOf(tritoneRoot), "dom7"),
    },
    ...chords.slice(position + 1),
  ];
}

// Apply modal interchange
export function applyModalInterchange(chords, position, targetScale) {
  if (position >= chords.length) return chords;

  const chord = chords[position];
  const rootIndex = NOTES.indexOf(chord.root);
  const newType = getChordType(position % 7, targetScale);

  return [
    ...chords.slice(0, position),
    {
      root: chord.root,
      type: newType,
      intervals: generateChordIntervals(rootIndex, newType),
    },
    ...chords.slice(position + 1),
  ];
}

// Generate walking bass line
function generateWalkingBass(chord, previousPattern) {
  const rootIndex = NOTES.indexOf(chord.root);
  const pattern = [];

  // Start with root
  pattern.push(chord.root);

  // Add approach notes
  if (previousPattern && previousPattern.length > 0) {
    const lastNote = previousPattern[previousPattern.length - 1].note;
    const lastNoteIndex = NOTES.indexOf(lastNote);
    const targetIndex = rootIndex;

    // Calculate approach notes
    const approach = calculateApproachNotes(lastNoteIndex, targetIndex);
    pattern.push(...approach);
  } else {
    // If no previous pattern, use chord tones or scale tones
    const chordTones = chord.intervals || [];
    if (chordTones.length >= 3) {
      pattern.push(chordTones[1], chordTones[2], chordTones[0]);
    } else {
      // Fallback to basic scale tones if chord tones aren't available
      const fifth = NOTES[(rootIndex + 7) % 12];
      const third = NOTES[(rootIndex + 4) % 12];
      pattern.push(third, fifth, chord.root);
    }
  }

  return pattern;
}

// Generate reggae bass line
function generateReggaeBass(chord) {
  const rootIndex = NOTES.indexOf(chord.root);
  const pattern = [];

  // Root on the one
  pattern.push(chord.root);

  // Fifth on the three
  const fifthIndex = (rootIndex + 7) % 12;
  pattern.push(NOTES[fifthIndex]);

  return pattern;
}

// Generate Latin bass line
function generateLatinBass(chord) {
  const rootIndex = NOTES.indexOf(chord.root);
  const pattern = [];

  // Root - Fifth - Octave - Fifth pattern
  pattern.push(chord.root);
  const fifthIndex = (rootIndex + 7) % 12;
  pattern.push(NOTES[fifthIndex]);
  pattern.push(chord.root);
  pattern.push(NOTES[fifthIndex]);

  return pattern;
}

// Generate pedal bass
function generatePedalBass(chord) {
  const pattern = [];

  // Simple root note pedal
  pattern.push(chord.root, chord.root);

  return pattern;
}
