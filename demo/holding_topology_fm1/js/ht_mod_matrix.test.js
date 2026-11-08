import assert from "node:assert/strict";
import test from "node:test";
import {
  MOD_SUSTAIN,
  MOD_THROW,
  OCC_AKRATEIA,
  OCC_KRATOS,
  OCC_MIXED,
  modMatrixCombine,
  occupancySign,
} from "./ht_mod_matrix.js";

test("occupancy signs match grip algebra", () => {
  assert.equal(occupancySign(3, 0, 3), OCC_KRATOS);
  assert.equal(occupancySign(0, 3, 3), OCC_AKRATEIA);
  assert.equal(occupancySign(1, 2, 3), OCC_MIXED);
});

test("matrix multiplies state object and hand", () => {
  const a = modMatrixCombine({
    state: OCC_KRATOS,
    objectCount: 3,
    objectIndex: 0,
    hand: 0,
    dwellPhase: 0.2,
    transition: MOD_SUSTAIN,
  });
  const b = modMatrixCombine({
    state: OCC_AKRATEIA,
    objectCount: 7,
    objectIndex: 4,
    hand: 1,
    dwellPhase: 0.9,
    transition: MOD_SUSTAIN,
  });
  assert.ok(a.audible);
  assert.ok(b.detune !== a.detune);
  assert.ok(b.feedback !== a.feedback);
  assert.ok(b.pan !== a.pan);
});

test("transition boosts burst relative to sustain", () => {
  const sustain = modMatrixCombine({
    state: OCC_MIXED,
    objectCount: 4,
    objectIndex: 1,
    hand: 1,
    transition: MOD_SUSTAIN,
  });
  const edge = modMatrixCombine({
    state: OCC_MIXED,
    objectCount: 4,
    objectIndex: 1,
    hand: 1,
    transition: MOD_THROW,
  });
  assert.ok(edge.burstGain > sustain.burstGain);
});
