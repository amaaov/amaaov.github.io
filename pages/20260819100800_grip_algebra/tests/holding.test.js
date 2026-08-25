import assert from "node:assert/strict";
import test from "node:test";
import {
  HOLD_SIGN,
  MIXED_SIGN,
  AIRBORNE_SIGN,
  composeStates,
  heldCount,
  mixedAssignmentCount,
  mixedGraphConnected,
  threeObjectHexagon,
  occupancyState,
} from "../holding.js";

test("freeze signs are Greek letters, not Latin or Cyrillic A/K", () => {
  assert.equal(HOLD_SIGN, "κ");
  assert.equal(AIRBORNE_SIGN, "α");
  assert.equal(MIXED_SIGN, "ακ");
  assert.equal(/[A-Za-zА-Яа-яЁё]/.test(HOLD_SIGN + AIRBORNE_SIGN + MIXED_SIGN), false);
});

test("empty attention is only in ∅", () => {
  assert.equal(occupancyState([]), "∅");
});

test("one-object system is only in κ or α", () => {
  assert.equal(occupancyState([true]), HOLD_SIGN);
  assert.equal(occupancyState([false]), AIRBORNE_SIGN);
});

test("two-object system is in κ, α, or ακ", () => {
  assert.equal(occupancyState([true, true]), HOLD_SIGN);
  assert.equal(occupancyState([false, false]), AIRBORNE_SIGN);
  assert.equal(occupancyState([true, false]), MIXED_SIGN);
  assert.equal(occupancyState([false, true]), MIXED_SIGN);
});

test("three-object system is in κ, α, or ακ", () => {
  assert.equal(occupancyState([true, true, true]), HOLD_SIGN);
  assert.equal(occupancyState([false, false, false]), AIRBORNE_SIGN);
  assert.equal(occupancyState([true, false, false]), MIXED_SIGN);
  assert.equal(occupancyState([true, true, false]), MIXED_SIGN);
});

test("composition is the join of unheld and held lamps", () => {
  assert.equal(composeStates(HOLD_SIGN, HOLD_SIGN), HOLD_SIGN);
  assert.equal(composeStates(AIRBORNE_SIGN, AIRBORNE_SIGN), AIRBORNE_SIGN);
  assert.equal(composeStates(HOLD_SIGN, AIRBORNE_SIGN), MIXED_SIGN);
  assert.equal(composeStates(MIXED_SIGN, "∅"), MIXED_SIGN);
  assert.equal(composeStates("∅", "∅"), "∅");
});

test("mixed-state multiplicity is 2^n - 2", () => {
  assert.equal(mixedAssignmentCount(1), 0);
  assert.equal(mixedAssignmentCount(2), 2);
  assert.equal(mixedAssignmentCount(3), 6);
  assert.equal(mixedAssignmentCount(4), 14);
});

test("three-object mixed graph is a six-cycle", () => {
  const hexagon = threeObjectHexagon();
  assert.equal(hexagon.vertices.length, 6);
  assert.equal(hexagon.edges.length, 6);
  for (const vertex of hexagon.vertices) {
    const count = heldCount(vertex);
    assert.ok(count === 1 || count === 2);
    assert.equal(occupancyState(vertex), MIXED_SIGN);
  }
});

test("mixed region is internally connected for n >= 3", () => {
  assert.equal(mixedGraphConnected(0), false);
  assert.equal(mixedGraphConnected(1), false);
  assert.equal(mixedGraphConnected(2), false);
  assert.equal(mixedGraphConnected(3), true);
  assert.equal(mixedGraphConnected(4), true);
});

test("n = 2 single-bit flips from mixed occupancy reach a pole", () => {
  const mixed = [true, false];
  assert.equal(occupancyState(mixed), MIXED_SIGN);
  assert.equal(occupancyState([false, false]), AIRBORNE_SIGN);
  assert.equal(occupancyState([true, true]), HOLD_SIGN);
});

test("four-object mixed occupancy includes sparse and dense held weights", () => {
  assert.equal(occupancyState([true, false, false, false]), MIXED_SIGN);
  assert.equal(occupancyState([true, true, true, false]), MIXED_SIGN);
});
