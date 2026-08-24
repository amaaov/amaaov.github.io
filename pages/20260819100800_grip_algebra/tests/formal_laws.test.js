import assert from "node:assert/strict";
import test from "node:test";

import {
  bernoulliTemporalLaw,
  oneBitFirstPassage,
  sampleLawCurve,
  twoObjectPhaseLaw,
} from "../formal_laws.js";

test("phase overlap law crosses from changing shares to a fragmentation plateau", () => {
  const touching = twoObjectPhaseLaw({ retentionDuty: 0.4, phaseOffset: 0.4 });
  const separated = twoObjectPhaseLaw({ retentionDuty: 0.4, phaseOffset: 0.5 });

  assert.deepEqual(touching.macrostateShares, [0.2, 0.8, 0]);
  assert.deepEqual(separated.macrostateShares, touching.macrostateShares);
  assert.equal(touching.alphaBoutCount, 1);
  assert.equal(separated.alphaBoutCount, 2);
  assert.deepEqual(separated.alphaBoutFractions, [0.1, 0.1]);
});

test("phase overlap law also covers duties above one half", () => {
  const law = twoObjectPhaseLaw({ retentionDuty: 0.7, phaseOffset: 0.4 });

  assert.deepEqual(law.macrostateShares, [0, 0.6, 0.4]);
  assert.equal(law.alphaBoutCount, 0);
});

test("phase overlap law accepts every finite duty strictly inside the unit interval", () => {
  assert.doesNotThrow(() => twoObjectPhaseLaw({
    retentionDuty: Number.EPSILON / 2,
    phaseOffset: 0,
  }));
  assert.throws(
    () => twoObjectPhaseLaw({ retentionDuty: 0, phaseOffset: 0 }),
    /retention duty/,
  );
  assert.throws(
    () => twoObjectPhaseLaw({ retentionDuty: 1, phaseOffset: 0 }),
    /retention duty/,
  );
});

test("Bernoulli temporal law recovers the combinatorial midpoint", () => {
  const law = bernoulliTemporalLaw({ objectCount: 5, retentionProbability: 0.5 });

  assert.equal(law.pAlpha, 1 / 32);
  assert.equal(law.pPolymorphy, 15 / 16);
  assert.equal(law.pKappa, 1 / 32);
});

test("one-bit first-passage curve satisfies boundaries, recurrence, and symmetry", () => {
  const expectations = oneBitFirstPassage(8);

  assert.equal(expectations[0], 0);
  assert.equal(expectations[8], 0);
  assert.ok(Math.abs(expectations[4] - 448 / 3) < 1e-10);
  for (let heldCount = 1; heldCount < 8; heldCount += 1) {
    const residual = expectations[heldCount] - 1
      - (heldCount / 8) * expectations[heldCount - 1]
      - ((8 - heldCount) / 8) * expectations[heldCount + 1];
    assert.ok(Math.abs(residual) < 1e-10);
    assert.ok(Math.abs(expectations[heldCount] - expectations[8 - heldCount]) < 1e-10);
  }
});

test("law curve sampling keeps both endpoints", () => {
  const points = sampleLawCurve((value) => value ** 2, { minimum: 0, maximum: 1, steps: 4 });

  assert.deepEqual(points, [
    { x: 0, y: 0 },
    { x: 0.25, y: 0.0625 },
    { x: 0.5, y: 0.25 },
    { x: 0.75, y: 0.5625 },
    { x: 1, y: 1 },
  ]);
});
