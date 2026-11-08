import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_ANALOG,
  driftCents,
  fillPinkNoise,
  flutterDepthSeconds,
  hissGainFromAmount,
  makeTapeSatCurve,
  warmthCutoffHz,
  wowDepthSeconds,
} from "./analog_character.js";
import { createComposition } from "./mix_composition.js";
import { seededRandom } from "../../../pages/20260819100800_grip_algebra/siteswap_generator.js";

test("tape sat curve is soft, bounded, and asymmetric", () => {
  const curve = makeTapeSatCurve(0.6, 256);
  assert.equal(curve.length, 256);
  assert.ok(Math.abs(curve[128]) < 0.2);
  assert.ok(curve[255] <= 1 && curve[255] >= -1);
  assert.ok(curve[0] <= 1 && curve[0] >= -1);
  // Soft clip: mid drive stays below hard rail of ±1 for modest input table ends.
  assert.ok(Math.abs(curve[255]) < 1.0001);
  // Even tilt breaks perfect odd symmetry.
  const pos = curve[200];
  const neg = curve[55];
  assert.ok(Math.abs(pos + neg) > 0.001);
});

test("warmth wow flutter hiss drift maps stay musical", () => {
  assert.ok(warmthCutoffHz(0.9) < warmthCutoffHz(0.1));
  assert.ok(wowDepthSeconds(1) > wowDepthSeconds(0));
  assert.ok(flutterDepthSeconds(1) > flutterDepthSeconds(0));
  assert.ok(hissGainFromAmount(1) < 0.04);
  assert.ok(driftCents(1) > driftCents(0));
  assert.ok(DEFAULT_ANALOG.mix > 0.25 && DEFAULT_ANALOG.mix < 0.7);
});

test("pink noise fill is finite and non-zero", () => {
  const data = new Float32Array(2048);
  fillPinkNoise(data);
  let sum = 0;
  for (const sample of data) {
    assert.ok(Number.isFinite(sample));
    sum += Math.abs(sample);
  }
  assert.ok(sum > 1);
});

test("compositions carry analog character settings", () => {
  const composition = createComposition(seededRandom(0xa106), { wildness: 0.6 });
  assert.ok(composition.mix.analog.drive > 0);
  assert.ok(composition.mix.analog.warmth > 0);
  assert.ok(composition.mix.analog.hiss >= 0);
  assert.ok(composition.mix.analog.drift > 0);
});
