import { NOTES } from "../constants/audio.js";
import { FUN_MODE_STYLES } from "../constants/ui.js";
import { randomInRange } from "../utils/math.js";

// Bass pattern types
const BASS_PATTERNS = {
  WALKING: "walking",
  REGGAE: "reggae",
  LATIN: "latin",
  PEDAL: "pedal",
};

// Bass pattern rhythms (in 16th notes)
const BASS_RHYTHMS = {
  WALKING: [0, 4, 8, 12],
  REGGAE: [0, 12],
  LATIN: [0, 3, 6, 9],
  PEDAL: [0, 8],
};

// Generate bass pattern
export function generateBassPattern(
  chord,
  previousPattern = null,
  style = FUN_MODE_STYLES.JAZZ,
) {
  if (!chord) return [];

  const rootIndex = NOTES.indexOf(chord.root);
  if (rootIndex === -1) return [];

  const pattern = [];

  // Choose pattern type based on style
  let patternType;
  switch (style.name) {
    case "jazz":
      patternType = BASS_PATTERNS.WALKING;
      break;
    case "punk":
      patternType = BASS_PATTERNS.PEDAL;
      break;
    case "classical":
      patternType = BASS_PATTERNS.LATIN;
      break;
    default:
      patternType = BASS_PATTERNS.REGGAE;
  }

  // Get rhythm for pattern type
  const rhythm = BASS_RHYTHMS[patternType] || BASS_RHYTHMS.WALKING;

  // Generate notes based on pattern type
  switch (patternType) {
    case BASS_PATTERNS.WALKING:
      // Always start with root note
      pattern.push(chord.root);

      // Add additional notes based on previous pattern or chord structure
      if (previousPattern && previousPattern.length > 0) {
        const lastNote = previousPattern[previousPattern.length - 1].note;
        const lastNoteIndex = NOTES.indexOf(lastNote);
        const approach = calculateApproachNotes(lastNoteIndex, rootIndex);
        pattern.push(...approach);
      } else {
        // Use basic chord tones when no previous pattern
        const fifth = NOTES[(rootIndex + 7) % 12];
        const third = NOTES[(rootIndex + 4) % 12];
        pattern.push(third, fifth, chord.root);
      }
      break;

    case BASS_PATTERNS.REGGAE:
      pattern.push(chord.root);
      const fifthIndex = (rootIndex + 7) % 12;
      pattern.push(NOTES[fifthIndex]);
      break;

    case BASS_PATTERNS.LATIN:
      pattern.push(chord.root);
      const latinFifth = NOTES[(rootIndex + 7) % 12];
      pattern.push(latinFifth, chord.root, latinFifth);
      break;

    case BASS_PATTERNS.PEDAL:
      pattern.push(chord.root, chord.root);
      break;
  }

  // Return pattern with timing, ensuring we don't exceed rhythm length
  return pattern.map((note, index) => ({
    note,
    time: rhythm[index % rhythm.length] / 16,
    duration: getDurationForPattern(patternType),
  }));
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
    // If no previous pattern, use chord tones
    const chordTones = chord.intervals;
    pattern.push(chordTones[1], chordTones[2], chordTones[0]);
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

// Calculate approach notes for walking bass
function calculateApproachNotes(fromIndex, toIndex) {
  const approach = [];
  const distance = (toIndex - fromIndex + 12) % 12;

  if (distance <= 2) {
    // Chromatic approach
    const step = distance > 0 ? 1 : -1;
    let currentIndex = fromIndex;
    while (currentIndex !== toIndex) {
      currentIndex = (currentIndex + step + 12) % 12;
      approach.push(NOTES[currentIndex]);
    }
  } else {
    // Scalar approach
    const scaleSteps = [2, 2, 1, 2, 2, 2, 1]; // Major scale
    let currentIndex = fromIndex;
    while (currentIndex !== toIndex) {
      const step = scaleSteps[currentIndex % scaleSteps.length];
      currentIndex = (currentIndex + step + 12) % 12;
      approach.push(NOTES[currentIndex]);
    }
  }

  return approach;
}

// Get note duration based on pattern type
function getDurationForPattern(patternType) {
  switch (patternType) {
    case BASS_PATTERNS.WALKING:
      return 0.25; // Quarter notes
    case BASS_PATTERNS.REGGAE:
      return 0.75; // Dotted half notes
    case BASS_PATTERNS.LATIN:
      return 0.25; // Quarter notes
    case BASS_PATTERNS.PEDAL:
      return 0.5; // Half notes
    default:
      return 0.25;
  }
}

// Get bass octave for a given style
export function getBassOctave(style) {
  switch (style.name) {
    case "jazz":
      return 2;
    case "punk":
      return 1;
    case "classical":
      return 2;
    default:
      return 1;
  }
}

// Transpose bass note to correct octave
export function transposeBassNote(note, octave) {
  const noteIndex = NOTES.indexOf(note);
  return noteIndex + (octave * 12);
}

// Get bass pattern transition type
export function getTransitionType(fromPattern, toPattern) {
  if (!fromPattern || !toPattern) return "direct";

  const fromLast = fromPattern[fromPattern.length - 1].note;
  const toFirst = toPattern[0].note;
  const interval = Math.abs(NOTES.indexOf(toFirst) - NOTES.indexOf(fromLast));

  if (interval > 7) return "glide";
  if (interval > 4) return "step";
  return "direct";
}
