import assert from "node:assert/strict";
import test from "node:test";
import { SCALES, SCALE_NAMES } from "./rnd_patch.js";
import {
  SCALE_DIVISIONS,
  degreeToMidi,
  edoStepToMidiOffset,
  isMicrotonalScale,
  noteToHz,
  ratioToMidiOffset,
} from "./ht_tuning.js";

test("12-TET major degree matches integer MIDI", () => {
  assert.equal(degreeToMidi(60, 0, "major", 0), 60);
  assert.equal(degreeToMidi(60, 7, "major", 0), 67);
  assert.equal(degreeToMidi(60, 0, "major", 1), 72);
});

test("19-EDO step is not a 12-TET semitone", () => {
  const offset = edoStepToMidiOffset(1, 19);
  assert.ok(Math.abs(offset - 12 / 19) < 1e-9);
  const note = degreeToMidi(60, 3, "edo19", 0);
  assert.notEqual(note, 63);
  assert.ok(Math.abs(note - (60 + 36 / 19)) < 1e-9);
});

test("just major third is 386 cents", () => {
  const offset = ratioToMidiOffset(5 / 4);
  assert.ok(Math.abs(offset - 3.863137) < 0.01);
  const midi = degreeToMidi(60, 2, "justMajor", 0);
  assert.ok(Math.abs(midi - (60 + offset)) < 1e-9);
  assert.ok(Math.abs(noteToHz(midi) / noteToHz(60) - 1.25) < 1e-6);
});

test("scale catalog exposes micro scales and divisions", () => {
  assert.equal(SCALE_NAMES.length, 15);
  assert.ok(SCALES.edo19);
  assert.ok(SCALES.justMajor);
  assert.equal(SCALE_DIVISIONS.edo24, 24);
  assert.equal(isMicrotonalScale("edo22"), true);
  assert.equal(isMicrotonalScale("major"), false);
});
