import assert from "node:assert/strict";
import test from "node:test";
import {
  HAND_STYLE_PRESETS,
  parseHandStyle,
  sampleHandStyle,
} from "../hand_style.js";
import { courtPicture } from "../toss.js";

test("parses inside-throws hand style", () => {
  const parsed = parseHandStyle(HAND_STYLE_PRESETS.inside);
  assert.equal(parsed.beats.length, 1);
  assert.equal(parsed.beats[0].length, 2);
  assert.equal(parsed.beats[0][0].x, 10);
  assert.equal(parsed.beats[0][1].x, 32.5);
});

test("parses mills mess style period", () => {
  const parsed = parseHandStyle(HAND_STYLE_PRESETS.millsMess);
  assert.equal(parsed.beats.length, 3);
});

test("extra presets parse", () => {
  assert.ok(parseHandStyle(HAND_STYLE_PRESETS.outside).beats.length >= 1);
  assert.ok(parseHandStyle(HAND_STYLE_PRESETS.tennis).beats.length >= 2);
  assert.ok(parseHandStyle(HAND_STYLE_PRESETS.windmill).beats.length >= 2);
});

test("samples mirrored left versus right", () => {
  const left = sampleHandStyle(HAND_STYLE_PRESETS.inside, 0, 0, 0);
  const right = sampleHandStyle(HAND_STYLE_PRESETS.inside, 1, 0, 0);
  assert.ok(left.x < 0);
  assert.ok(right.x > 0);
  assert.equal(Math.abs(left.x), Math.abs(right.x));
});

test("courtPicture accepts handStyle without breaking cascade", () => {
  const pictured = courtPicture({
    source: "3",
    dwellRatio: 0.5,
    timeBeat: 0.25,
    handStyle: HAND_STYLE_PRESETS.inside,
  });
  assert.equal(pictured.ballCount, 3);
  assert.ok(pictured.hands.length === 2);
});
