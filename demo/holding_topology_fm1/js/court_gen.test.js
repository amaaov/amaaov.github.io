import test from "node:test";
import assert from "node:assert/strict";
import {
  createAtlasDrums,
  createEuclid,
  createGeneratorBank,
  createMarkov,
  createMorph,
  createTuring,
  euclidHit,
} from "./court_gen.js";
import { createRndPatch, ENGINES, GENERATIVE_PATCH_TYPES, PATCH_TYPES } from "./rnd_patch.js";

test("euclid spreads pulses evenly", () => {
  const hits = Array.from({ length: 8 }, (_, step) => euclidHit(step, 8, 3, 0));
  assert.equal(hits.filter(Boolean).length, 3);
  assert.deepEqual(hits, [false, false, true, false, false, true, false, true]);
});

test("turing register emits gated notes", () => {
  const gen = createTuring({ len: 8, prob: 0, seed: 42 });
  const steps = Array.from({ length: 16 }, () => gen.step());
  assert.ok(steps.some((step) => step.gate));
  assert.ok(steps.every((step) => step.midi >= 36 && step.midi <= 96));
});

test("euclid generator respects pulse count", () => {
  const gen = createEuclid({ steps: 16, pulses: 4, rot: 0, pitchSeed: 0, seed: 7 });
  const gates = Array.from({ length: 16 }, () => gen.step().gate);
  assert.equal(gates.filter(Boolean).length, 4);
});

test("markov and morph stay in range", () => {
  const markov = createMarkov({ tension: 50, density: 100, seed: 9 });
  const morph = createMorph({ morphPos: 64, seed: 11 });
  for (let index = 0; index < 24; index += 1) {
    const m = markov.step();
    const h = morph.step();
    assert.ok(m.midi >= 36 && m.midi <= 96);
    assert.ok(h.midi >= 36 && h.midi <= 96);
  }
});

test("atlas drums emit kick snare hat parts", () => {
  const drums = createAtlasDrums({ x: 180, y: 90, dens: 90, chaos: 5, seed: 3 });
  const parts = new Set();
  for (let index = 0; index < 64; index += 1) {
    for (const hit of drums.step()) {
      parts.add(hit.part);
    }
  }
  assert.ok(parts.has("kick"));
  assert.ok(parts.has("snare"));
  assert.ok(parts.has("hat"));
});

test("generator bank and generative patches wire together", () => {
  const bank = createGeneratorBank(0xaced, 0.7);
  assert.ok(["turing", "euclid", "markov", "morph"].includes(bank.synth.kind));
  assert.equal(bank.drums.kind, "atlas");
  const patch = createRndPatch(0xaced00, { patchType: "atlas_drums", wildness: 0.8 });
  assert.ok(GENERATIVE_PATCH_TYPES.has(patch.patchType));
  assert.ok(patch.generators.synth.step);
  assert.ok(ENGINES.includes("wavetable"));
  assert.ok(ENGINES.includes("granular"));
  assert.ok(PATCH_TYPES.includes("turing_line"));
});
