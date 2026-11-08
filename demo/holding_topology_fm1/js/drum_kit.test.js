import test from "node:test";
import assert from "node:assert/strict";
import { drumEnvelopesFromSeed, hashPatternSeed } from "./drum_kit.js";
import { createRndPatch } from "./rnd_patch.js";

test("pattern hash is stable and seed-sensitive", () => {
  assert.equal(hashPatternSeed("51"), hashPatternSeed("51"));
  assert.notEqual(hashPatternSeed("51"), hashPatternSeed("3"));
});

test("drum ADSR differs by seed and by pattern", () => {
  const a = drumEnvelopesFromSeed(0x1111, "3");
  const b = drumEnvelopesFromSeed(0x2222, "3");
  const c = drumEnvelopesFromSeed(0x1111, "51");
  assert.notDeepEqual(a.kick, b.kick);
  assert.notDeepEqual(a.snare, c.snare);
  assert.ok(a.kick.attack > 0 && a.kick.release > a.kick.attack);
  assert.ok(a.hat.release < a.kick.release);
});

test("rnd patches carry seed/pattern drum envelopes", () => {
  const patch = createRndPatch(0xabcd99, { wildness: 0.6 });
  assert.ok(patch.drumEnvelopes.kick.decay > 0);
  assert.ok(patch.drumEnvelopes.snare.release > 0);
  assert.ok(patch.drumEnvelopes.hat.attack > 0);
  const other = createRndPatch(0xabcd98, { wildness: 0.6 });
  assert.notDeepEqual(patch.drumEnvelopes.kick, other.drumEnvelopes.kick);
});
