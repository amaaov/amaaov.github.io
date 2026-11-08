import assert from "node:assert/strict";
import { test } from "node:test";
import { trailBudgetFromFx } from "./pixel_court.js";

test("trail budget grows with delay and reverb", () => {
  const dry = trailBudgetFromFx({ delay: 0.1, reverb: 0.1, wet: 0.2 });
  const wet = trailBudgetFromFx({ delay: 0.55, reverb: 0.7, wet: 0.8 });
  assert.ok(wet > dry);
  assert.ok(dry >= 6);
  assert.ok(wet <= 36);
});
