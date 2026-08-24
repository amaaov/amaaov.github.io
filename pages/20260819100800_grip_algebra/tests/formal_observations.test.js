import assert from "node:assert/strict";
import test from "node:test";

import {
  bernoulliObjectObservation,
  firstPassageGrowthObservation,
  phaseStepObservation,
} from "../formal_observations.js";

function assertClose(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test("first-passage observation exposes the thousand-event crossing", () => {
  const before = firstPassageGrowthObservation(10);
  const crossing = firstPassageGrowthObservation(11);

  assert.equal(before.crossedThousand, false);
  assert.equal(crossing.crossedThousand, true);
  assert.equal(crossing.centralHeldCount, 5);
  assertClose(crossing.expectation, 1154.2666666666667);
  assertClose(crossing.previousExpectation, 584.3333333333333);
  assertClose(crossing.percentageIncrease, 97.53565316600117);
});

test("independent-snapshot observation reports percentage-point concentration", () => {
  const observation = bernoulliObjectObservation({
    objectCount: 6,
    retentionProbability: 0.5,
  });

  assertClose(observation.polymorphy, 0.96875);
  assertClose(observation.previousPolymorphy, 0.9375);
  assertClose(observation.polymorphyPercentagePointChange, 3.125);
  assertClose(observation.homogeneous, 0.03125);
  assertClose(observation.previousHomogeneous, 0.0625);
});

test("phase observation detects equal-share plateau with a bout split", () => {
  const observation = phaseStepObservation({
    retentionDuty: 0.4,
    phaseOffset: 0.4,
    step: 0.01,
  });

  assert.equal(observation.sharePlateau, true);
  assert.equal(observation.boutCountChanged, true);
  assert.equal(observation.alphaBoutCount, 1);
  assert.equal(observation.nextAlphaBoutCount, 2);
  assert.deepEqual(observation.sharePercentagePointChanges, {
    alpha: 0,
    polymorphy: 0,
    kappa: 0,
  });
});
