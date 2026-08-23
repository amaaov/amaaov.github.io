import assert from "node:assert/strict";
import test from "node:test";

import {
  clampInspectorWidth,
  fitDisplayCanvas,
  inspectorWidthFromPointer,
} from "../simulator_layout.js";
import { beatSecondsFromBeatsPerMinute } from "../siteswap_ui.js";

test("fitDisplayCanvas writes a device-pixel backing store and ignores a repeat", () => {
  const canvas = { width: 300, height: 150 };
  assert.equal(fitDisplayCanvas(canvas, 2, 400, 300), true);
  assert.equal(canvas.width, 800);
  assert.equal(canvas.height, 600);
  assert.equal(fitDisplayCanvas(canvas, 2, 400, 300), false);
});

test("fitDisplayCanvas keeps a one-pixel store when the layout box is unmeasured", () => {
  const canvas = { width: 300, height: 150 };
  fitDisplayCanvas(canvas, 2, 0, 0);
  assert.equal(canvas.width, 1);
  assert.equal(canvas.height, 1);
});

test("inspector width stays between the court remainder and the declared bounds", () => {
  assert.equal(clampInspectorWidth(120, 900), 196);
  assert.equal(clampInspectorWidth(500, 900), 360);
  assert.equal(clampInspectorWidth(280, 400), 196);
});

test("pointer drag measures inspector width from the right edge", () => {
  assert.equal(inspectorWidthFromPointer(700, 100, 800), 200);
  assert.equal(inspectorWidthFromPointer(100, 100, 800), 360);
});

test("150 BPM is a 0.4 second beat", () => {
  assert.equal(beatSecondsFromBeatsPerMinute(150), 0.4);
});

test("beats per minute must be a positive finite tempo", () => {
  assert.throws(() => beatSecondsFromBeatsPerMinute(0), /positive finite/);
});
