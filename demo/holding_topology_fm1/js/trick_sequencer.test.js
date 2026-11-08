import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceTrickSequencer,
  createTrickSequencer,
  currentTrick,
} from "./trick_sequencer.js";
import { createRndPatch } from "./rnd_patch.js";

test("trick sequencer advances and wraps", () => {
  const sequencer = createTrickSequencer(["3", "423", "441"], 10);
  assert.equal(currentTrick(sequencer), "3");
  const mid = advanceTrickSequencer(sequencer, 9.5);
  assert.equal(currentTrick(mid.sequencer), "3");
  assert.equal(mid.changed, false);
  const next = advanceTrickSequencer(mid.sequencer, 1);
  assert.equal(currentTrick(next.sequencer), "423");
  assert.equal(next.changed, true);
});

test("jingle mode finishes after the last trick", () => {
  let sequencer = createTrickSequencer(["3", "423"], 4);
  let finished = false;
  for (let step = 0; step < 8; step += 1) {
    const result = advanceTrickSequencer(sequencer, 4, { loopTricks: false });
    sequencer = result.sequencer;
    finished = result.finished;
  }
  assert.equal(finished, true);
  assert.equal(currentTrick(sequencer), "423");
});

test("rnd patch is deterministic for a seed", () => {
  const first = createRndPatch(0xabcd1234);
  const second = createRndPatch(0xabcd1234);
  assert.equal(first.seed, second.seed);
  assert.equal(first.bpm, second.bpm);
  assert.equal(first.scaleName, second.scaleName);
  assert.deepEqual(first.tricks, second.tricks);
  assert.equal(first.voices.length, 12);
  assert.ok(first.tricks.length >= 3);
  assert.equal(first.genKind, second.genKind);
  assert.ok(first.generators?.synth?.step);
});

test("uniqueSeed differs across calls", async () => {
  const { uniqueSeed } = await import("./rnd_patch.js");
  const a = uniqueSeed();
  const b = uniqueSeed();
  assert.notEqual(a, b);
  assert.equal(a >>> 0, a);
  assert.equal(b >>> 0, b);
});
