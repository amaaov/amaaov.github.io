import test from "node:test";
import assert from "node:assert/strict";
import { VOWELS, VOWEL_NAMES, vowelFromIndex } from "./vowel_formants.js";
import { createRndPatch, PATCH_TYPES, ENGINES } from "./rnd_patch.js";
import { VOICE_COUNT } from "./control_map.js";

test("vowel table has three formants for each vowel", () => {
  for (const name of VOWEL_NAMES) {
    assert.ok(VOWELS[name].f1 > 0);
    assert.ok(VOWELS[name].f2 > VOWELS[name].f1);
    assert.ok(VOWELS[name].f3 > VOWELS[name].f2);
  }
  assert.equal(vowelFromIndex(0), "a");
  assert.equal(vowelFromIndex(5), "a");
});

test("patches expose more types, vowel engine, and twelve voices", () => {
  assert.ok(PATCH_TYPES.includes("vowel_chant"));
  assert.ok(PATCH_TYPES.includes("cascade_choir"));
  assert.ok(ENGINES.includes("vowel"));
  const patch = createRndPatch(0xabcdef01, {
    patchType: "vowel_chant",
    wildness: 0,
  });
  assert.equal(patch.patchType, "vowel_chant");
  assert.equal(patch.voices.length, VOICE_COUNT);
  assert.ok(patch.voices.every((voice) => voice.engine === "vowel"));
  assert.ok(patch.voices.every((voice) => VOWEL_NAMES.includes(voice.vowel)));
});
