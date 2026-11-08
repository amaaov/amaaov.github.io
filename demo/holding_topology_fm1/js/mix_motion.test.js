import test from "node:test";
import assert from "node:assert/strict";
import { seededRandom } from "../../../pages/20260819100800_grip_algebra/siteswap_generator.js";
import { createComposition } from "./mix_composition.js";
import { liveMixGlobals, liveMixSnapshot } from "./mix_motion.js";
import { createRndPatch, ENGINES } from "./rnd_patch.js";

test("live mix drifts pans and levels and ducks on silence", () => {
  const random = seededRandom(0x111);
  const composition = createComposition(random, {
    wildness: 0.7,
    voiceCount: 12,
    patchType: "looping",
  });
  const a = liveMixSnapshot(composition, {
    beat: 0,
    elapsedSeconds: 0,
    seed: 1,
    silenceMode: "open",
  });
  const b = liveMixSnapshot(composition, {
    beat: 8,
    elapsedSeconds: 4.5,
    weather: { storm: 0.8, chaos: 0.6, feedback: 0.5, moon: 0.4 },
    seed: 1,
    silenceMode: "open",
  });
  const tail = liveMixSnapshot(composition, {
    beat: 8,
    elapsedSeconds: 4.5,
    seed: 1,
    silenceMode: "tail",
  });
  const gap = liveMixSnapshot(composition, {
    beat: 8,
    elapsedSeconds: 4.5,
    seed: 1,
    silenceMode: "gap",
  });
  assert.equal(a.length, 4);
  assert.ok(Math.abs(a[0].pan - b[0].pan) > 0.001 || Math.abs(a[0].level - b[0].level) > 0.001);
  assert.ok(tail.every((row) => row.level < a[0].level || row.reverbSend >= 0.4));
  assert.ok(gap.every((row) => row.level < 0.05));
  const openGlobals = liveMixGlobals(composition, {
    weather: { storm: 0.7, feedback: 0.4 },
    silenceMode: "open",
  });
  const tailGlobals = liveMixGlobals(composition, { silenceMode: "tail" });
  assert.ok(openGlobals.reverb > composition.mix.reverb);
  assert.ok(openGlobals.wet <= 0.75);
  assert.ok(openGlobals.dry >= 0.35);
  assert.ok(tailGlobals.feedback > 0.25);
  assert.ok(tailGlobals.wet > openGlobals.wet * 0.5);
  assert.ok(tailGlobals.dry < openGlobals.dry);
});

test("patches include a noise engine voice", () => {
  assert.ok(ENGINES.includes("noise"));
  const patch = createRndPatch(0x909090, { wildness: 0.7, patchType: "looping" });
  assert.ok(patch.voices.some((voice) => voice.engine === "noise" && voice.active));
});
