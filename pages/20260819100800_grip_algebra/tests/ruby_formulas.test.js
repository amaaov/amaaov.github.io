import assert from "node:assert/strict";
import test from "node:test";

import {
  FORMULA_MODE_STORAGE_KEY,
  normalizeFormulaMode,
  rubyFormulaEntries,
  rubySourceFor,
} from "../ruby_formulas.js";

test("every displayed law has one authored Ruby alternative", () => {
  assert.equal(rubyFormulaEntries().length, 37);
  assert.equal(new Set(rubyFormulaEntries().map(([key]) => key)).size, 37);
});

test("Ruby alternatives use reader-facing names", () => {
  assert.match(rubySourceFor("held-state"), /held = objects\.select/);
  assert.match(rubySourceFor("independent-probabilities"), /probability_mixed/);
  assert.match(rubySourceFor("launch-energy"), /launch_energy_rate/);
  assert.equal(rubySourceFor("missing-law"), null);
});

test("formula mode accepts only the persisted Ruby value", () => {
  assert.equal(normalizeFormulaMode("ruby"), "ruby");
  assert.equal(normalizeFormulaMode("math"), "math");
  assert.equal(normalizeFormulaMode("anything else"), "math");
  assert.equal(FORMULA_MODE_STORAGE_KEY, "amaaov.grip-algebra.formula-mode");
});
