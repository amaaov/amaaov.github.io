import test from "node:test";
import assert from "node:assert/strict";
import {
  createGranularDelayState,
  granularDelayPlan,
  processGranularDelay,
} from "./granular_delay.js";

test("granular plan scales spray, density, and mix from amount", () => {
  const quiet = granularDelayPlan(0, 0.3);
  const loud = granularDelayPlan(0.9, 0.3);
  assert.equal(quiet.mix, 0);
  assert.ok(loud.mix > 0.7);
  assert.ok(loud.density > quiet.density);
  assert.ok(loud.spray > quiet.spray);
});

test("processGranularDelay writes wet grains after delay window", () => {
  const state = createGranularDelayState(48000, 1);
  const plan = granularDelayPlan(0.85, 0.04);
  const block = 512;
  const input = new Float32Array(block);
  const output = new Float32Array(block);
  let energy = 0;
  // Sustained tone so grains have material once the delay window fills.
  for (let pass = 0; pass < 20; pass += 1) {
    for (let index = 0; index < block; index += 1) {
      input[index] = Math.sin((pass * block + index) * 0.08);
    }
    processGranularDelay(state, input, output, plan);
    for (let index = 0; index < output.length; index += 1) {
      energy += Math.abs(output[index]);
    }
  }
  assert.ok(energy > 1, `expected grain energy, got ${energy}`);
});
