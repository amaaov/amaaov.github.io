import assert from "node:assert/strict";
import test from "node:test";
import {
  BIRD_MODES,
  DOLPHIN_CONTOURS,
  FIRE_MODES,
  NATURE_ENGINES,
  birdModeName,
  bubbleGrainSample,
  dolphinContourName,
  dolphinContourShape,
  dubBassFilterEnv,
  fireCrackleRate,
  fireModeName,
  natureModeIndex,
} from "./nature_synth.js";
import { ENGINES, TIMBRE_PROFILES } from "./rnd_patch.js";

test("nature engines sit in the shared catalog", () => {
  for (const engine of NATURE_ENGINES) {
    assert.ok(ENGINES.includes(engine), engine);
  }
  assert.equal(ENGINES.length, 29);
  assert.ok(TIMBRE_PROFILES.includes("amazon_canopy"));
  assert.ok(TIMBRE_PROFILES.includes("jamaica_dub"));
  assert.equal(TIMBRE_PROFILES.length, 12);
  assert.ok(ENGINES.includes("fire"));
});

test("nature mode indices cover bird and water families", () => {
  assert.equal(natureModeIndex("bird", 60, 1) % 4, natureModeIndex("bird", 60, 1));
  assert.ok(natureModeIndex("bird", 61, 2) >= 0 && natureModeIndex("bird", 61, 2) < 4);
  assert.ok([0, 1].includes(natureModeIndex("bubble", 48, 3)));
  assert.ok([0, 1].includes(natureModeIndex("dub_bass", 36, 9)));
  assert.ok([0, 1].includes(natureModeIndex("fire", 52, 4)));
  assert.equal(birdModeName(2), "bark");
  assert.equal(dolphinContourName(0), "upsweep");
  assert.equal(fireModeName(0), "camp");
  assert.equal(fireModeName(1), "forest_fire");
  assert.equal(BIRD_MODES.length, 4);
  assert.equal(DOLPHIN_CONTOURS.length, 4);
  assert.equal(FIRE_MODES.length, 2);
});

test("forest fire crackles denser than campfire", () => {
  assert.ok(fireCrackleRate(220, true) > fireCrackleRate(220, false));
});

test("bubble grain decays and glides down", () => {
  let phase = 0;
  let envelope = 1;
  let freqHz = 900;
  for (let index = 0; index < 64; index += 1) {
    const step = bubbleGrainSample(phase, envelope, freqHz);
    phase = step.phase;
    envelope = step.envelope;
    freqHz = step.freqHz;
    assert.ok(Number.isFinite(step.sample));
  }
  assert.ok(envelope < 0.95);
  assert.ok(freqHz < 900);
});

test("dolphin contours and dub envelopes stay in range", () => {
  for (let mode = 0; mode < 4; mode += 1) {
    const shape = dolphinContourShape(0.25, mode);
    assert.ok(shape >= 0 && shape <= 1.01);
  }
  assert.ok(dubBassFilterEnv(0.02, false) > 0.9);
  assert.ok(dubBassFilterEnv(0.5, false) < 0.5);
  assert.ok(dubBassFilterEnv(0.1, true) > 0.15);
  assert.ok(dubBassFilterEnv(1.0, true) >= 0.99);
});
