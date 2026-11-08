import test from "node:test";
import assert from "node:assert/strict";
import { masterGainFromPanel } from "./feedback_mix.js";

test("MASTER 0 silences even when patch mix.master is high", () => {
  assert.equal(masterGainFromPanel(0, 0.9), 0);
  assert.equal(masterGainFromPanel(0, 1), 0);
  assert.ok(masterGainFromPanel(1, 0.55) > 0.5);
  assert.ok(masterGainFromPanel(0.5, 0.8) > 0.3);
});
