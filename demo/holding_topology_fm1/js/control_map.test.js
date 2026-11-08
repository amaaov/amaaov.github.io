import test from "node:test";
import assert from "node:assert/strict";
import {
  assertUniqueControlJobs,
  bpmFromTempoKnob,
  objectCountFromSiteswapKnob,
  patchTypeFromAlgorithm,
  feedbackFromKnob,
  wildnessFromGloKnob,
  CONTROL_JOBS,
} from "./control_map.js";
import { createRndPatch, ENGINES } from "./rnd_patch.js";

test("every panel control job is unique", () => {
  assert.equal(assertUniqueControlJobs(), true);
  assert.equal(CONTROL_JOBS["OCT-"], "−12");
  assert.equal(CONTROL_JOBS.SEL, "Cosmos");
  assert.notEqual(CONTROL_JOBS.KNOB2, CONTROL_JOBS.LFO);
  assert.notEqual(CONTROL_JOBS.PLAY, CONTROL_JOBS.REC);
  assert.equal(CONTROL_JOBS.REC, "Tape");
  assert.equal(CONTROL_JOBS.ENV, "ADSR");
  assert.equal(CONTROL_JOBS.LFO, "Route");
  assert.equal(CONTROL_JOBS.FX, "Grain");
  for (const label of Object.values(CONTROL_JOBS)) {
    assert.ok(label.length <= 8, `label too long: ${label}`);
  }
});

test("tempo and siteswap knobs map into usable ranges", () => {
  assert.equal(bpmFromTempoKnob(0), 40);
  assert.equal(bpmFromTempoKnob(1), 220);
  assert.equal(bpmFromTempoKnob(0.5), 130);
  assert.equal(objectCountFromSiteswapKnob(0.1), 3);
  assert.equal(objectCountFromSiteswapKnob(0.5), 5);
  assert.equal(objectCountFromSiteswapKnob(0.9), 7);
  assert.equal(patchTypeFromAlgorithm(0), "looping");
  assert.equal(patchTypeFromAlgorithm(1 / 12), "drone");
  assert.equal(patchTypeFromAlgorithm(0.99), "atlas_drums");
});

test("bias knobs shape a deterministic patch", () => {
  const locked = createRndPatch(0x11112222, {
    wildness: 0,
    objectCount: objectCountFromSiteswapKnob(0.9),
    lockObjectCount: true,
    throwBias: 0.9,
    bpm: bpmFromTempoKnob(0.2),
    totalFeedback: feedbackFromKnob(0.8),
    patchType: "drone",
    scaleName: "hirajoshi",
  });
  assert.equal(locked.objectCount, 7);
  assert.equal(locked.bpm, 76);
  assert.equal(locked.patchType, "drone");
  assert.equal(locked.scaleName, "hirajoshi");
  assert.ok(locked.totalFeedback > 0.7);
  assert.ok(locked.tricks.length >= 3);

  const wild = createRndPatch(0x33334444, {
    wildness: wildnessFromGloKnob(0.95),
    patchType: "drone",
    scaleName: "hirajoshi",
  });
  assert.ok(wild.timbreProfile);
  assert.ok(wild.tricks.length >= 4);
});

test("randomisation draws only from the full engine catalog including pipe", () => {
  assert.ok(ENGINES.includes("pipe"));
  assert.ok(ENGINES.includes("vowel"));
  const seen = new Set();
  for (let seed = 0; seed < 16; seed += 1) {
    const patch = createRndPatch(0x510000 + seed * 97, { wildness: 1 });
    for (const voice of patch.voices) {
      if (voice.active) {
        assert.ok(ENGINES.includes(voice.engine), `unknown engine ${voice.engine}`);
        seen.add(voice.engine);
      }
    }
  }
  // Full catalog is eligible; a short sample should still spread widely.
  assert.ok(seen.size >= 10, `expected broad engine spread, got ${seen.size}: ${[...seen]}`);
});

test("patches often open the perc bus for drums", () => {
  let open = 0;
  for (let seed = 0; seed < 10; seed += 1) {
    const patch = createRndPatch(0x620000 + seed * 41, { wildness: 0.7 });
    if (patch.drumsOpen && patch.composition.tracks[3].active) {
      open += 1;
    }
  }
  assert.ok(open >= 6, `expected frequent drums, got ${open}/10`);
});
