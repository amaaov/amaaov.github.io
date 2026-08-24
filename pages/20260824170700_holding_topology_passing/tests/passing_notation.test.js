import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePassingSiteswap,
  parsePassingThrow,
  passingObjectCount,
} from "../passing_notation.js";
import {
  destinationBody,
  destinationContact,
  globalContact,
  isPassThrow,
} from "../passing_route.js";

test("passing throw reads height, x before p, and explicit body", () => {
  const threePass = parsePassingThrow("3p", 0).throw;
  assert.deepEqual(threePass, { height: 3, crossing: true, pass: true, passTarget: null });
  const fourCrossPass = parsePassingThrow("4xp", 0).throw;
  assert.deepEqual(fourCrossPass, { height: 4, crossing: true, pass: true, passTarget: null });
  const toSecond = parsePassingThrow("3p2", 0).throw;
  assert.deepEqual(toSecond, { height: 3, crossing: true, pass: true, passTarget: 2 });
});

test("multiplex slash keeps 3p and 2 from collapsing into a body index", () => {
  const pattern = parsePassingSiteswap("<[3p/2]|3p>");
  assert.equal(pattern.bodyCount, 2);
  assert.deepEqual(pattern.throws[0][0].map((token) => token.height), [3, 2]);
  assert.equal(pattern.throws[0][0][0].pass, true);
  assert.equal(pattern.throws[0][0][1].pass, false);
  assert.equal(pattern.throws[1][0][0].pass, true);
});

test("compact two-count and expanded two-count have six objects and two beats", () => {
  const compact = parsePassingSiteswap("<3p 3|3p 3>");
  const expanded = parsePassingSiteswap("<3p|3p><3|3>");
  assert.equal(passingObjectCount(compact), 6);
  assert.equal(passingObjectCount(expanded), 6);
  assert.equal(compact.throws[0].length, 2);
  assert.equal(expanded.throws[0].length, 2);
  assert.equal(compact.throws[0][0][0].pass, true);
  assert.equal(compact.throws[0][1][0].pass, false);
});

test("implicit two-body pass and 3p2|3p1 name the other body", () => {
  const implicit = parsePassingSiteswap("<3p|3p>");
  const explicit = parsePassingSiteswap("<3p2|3p1>");
  assert.equal(destinationBody(implicit.throws[0][0][0], 0, 2), 1);
  assert.equal(destinationBody(explicit.throws[0][0][0], 0, 2), 1);
  assert.equal(destinationBody(explicit.throws[1][0][0], 1, 2), 0);
  assert.equal(isPassThrow(implicit.throws[0][0][0], 0, 2), true);
});

test("self 3 from the right lands in the left; 3p from the right lands in the partner left", () => {
  const selfThree = { height: 3, crossing: true, pass: false, passTarget: null };
  const passThree = { height: 3, crossing: true, pass: true, passTarget: null };
  assert.equal(destinationContact(selfThree, 1), 0);
  assert.equal(destinationContact(passThree, 1), 0);
  assert.equal(globalContact(1, 0), 2);
});

test("seven-club two-count keeps opposite starting hands", () => {
  const pattern = parsePassingSiteswap("<R|L><4xp|3><3|4xp>");
  assert.deepEqual(pattern.startingHands, [1, 0]);
  assert.equal(passingObjectCount(pattern), 7);
  assert.equal(pattern.throws[0][0][0].pass, true);
  assert.equal(pattern.throws[0][0][0].crossing, true);
  assert.equal(pattern.throws[1][0][0].pass, false);
});

test("solo cascade writing is rejected as a passing block", () => {
  assert.throws(() => parsePassingSiteswap("3"), /expected </);
});
