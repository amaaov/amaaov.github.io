/**
 * Microtonal tuning helpers for Holding Topology.
 * Degrees are steps in the scale's division (EDO) or indices into a JI ratio row.
 * Output is 12-TET-equivalent MIDI (may be fractional) so existing Hz paths work.
 */

export const A4_HZ = 440;

/** Just major (5-limit diatonic) ratios from tonic. */
export const JUST_MAJOR_RATIOS = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8];

/**
 * Division size per scale name. 12 = ordinary semitone steps.
 * 0 = just-intonation index into JUST_MAJOR_RATIOS.
 */
export const SCALE_DIVISIONS = {
  major: 12,
  minor: 12,
  harmonicMinor: 12,
  blues: 12,
  majorPentatonic: 12,
  minorPentatonic: 12,
  dorian: 12,
  phrygian: 12,
  hirajoshi: 12,
  wholeTone: 12,
  octatonic: 12,
  edo19: 19,
  edo22: 22,
  edo24: 24,
  justMajor: 0,
};

export function noteToHz(midi, a4Hz = A4_HZ) {
  return a4Hz * 2 ** ((Number(midi) - 69) / 12);
}

export function hzToMidi(hz, a4Hz = A4_HZ) {
  if (!(hz > 0)) {
    return 69;
  }
  return 69 + 12 * Math.log2(hz / a4Hz);
}

export function edoStepToMidiOffset(step, edo = 12) {
  const division = Math.max(1, Number(edo) || 12);
  return (Number(step) * 12) / division;
}

export function ratioToMidiOffset(ratio) {
  const value = Number(ratio);
  if (!(value > 0)) {
    return 0;
  }
  return 12 * Math.log2(value);
}

export function centsToMidiOffset(cents) {
  return Number(cents) / 100;
}

/**
 * Map a scale degree step (or JI index) to a (possibly fractional) MIDI note.
 */
export function degreeToMidi(rootMidi, degreeStep, scaleName = "major", octave = 0) {
  const root = Number(rootMidi) || 0;
  const division = SCALE_DIVISIONS[scaleName] ?? 12;
  let offset;
  if (division === 0) {
    const index = Math.max(0, Math.floor(Number(degreeStep) || 0)) % JUST_MAJOR_RATIOS.length;
    offset = ratioToMidiOffset(JUST_MAJOR_RATIOS[index]);
  } else {
    offset = edoStepToMidiOffset(degreeStep, division);
  }
  return root + offset + 12 * (Number(octave) || 0);
}

export function isMicrotonalScale(scaleName) {
  const division = SCALE_DIVISIONS[scaleName];
  return division === 0 || (division != null && division !== 12);
}

export function scaleDivision(scaleName) {
  return SCALE_DIVISIONS[scaleName] ?? 12;
}
