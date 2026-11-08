import test from "node:test";
import assert from "node:assert/strict";
import {
  createComposition,
  mixSnapshotForSection,
  sectionAtBeat,
  TRACK_COUNT,
} from "./mix_composition.js";
import { createRndPatch } from "./rnd_patch.js";
import { seededRandom } from "../../../pages/20260819100800_grip_algebra/siteswap_generator.js";

test("composition builds four tracks with pan level and sends", () => {
  const random = seededRandom(0xabc101);
  const composition = createComposition(random, {
    wildness: 0.7,
    voiceCount: 12,
    patchType: "looping",
  });
  assert.equal(composition.tracks.length, TRACK_COUNT);
  assert.ok(composition.activeTracks >= 2);
  assert.ok(composition.sections.length >= 1);
  assert.ok(composition.mix.reverb > 0);
  assert.ok(composition.mix.compressor.ratio >= 2);
  assert.ok(composition.mix.chain.delay > 0);
  for (const track of composition.tracks) {
    assert.ok(track.pan >= -1 && track.pan <= 1);
    assert.ok(Array.isArray(track.voiceIndexes));
  }
});

test("sectionAtBeat walks the arrangement and mix snapshots mute inactive parts", () => {
  const random = seededRandom(0xabc102);
  const composition = createComposition(random, {
    wildness: 0.5,
    voiceCount: 12,
    patchType: "euclid_groove",
  });
  const total = composition.sections.reduce((sum, section) => sum + section.beats, 0);
  const first = sectionAtBeat(composition, 0);
  assert.equal(first.index, 0);
  const wrapped = sectionAtBeat(composition, total + 1);
  assert.equal(wrapped.index, 0);
  const mid = sectionAtBeat(composition, composition.sections[0].beats);
  assert.equal(mid.index, 1);
  const snapshot = mixSnapshotForSection(composition, first.section);
  assert.equal(snapshot.length, TRACK_COUNT);
  assert.ok(snapshot.every((row) => row.level >= 0));
});

test("rnd patches carry generative mix compositions", () => {
  const patch = createRndPatch(0xc0ffee, { patchType: "looping", wildness: 0.6 });
  assert.ok(patch.composition);
  assert.ok(patch.composition.tracks.length === 4);
  assert.ok(patch.voices.every((voice) => voice.trackIndex >= 0 && voice.trackIndex < 4));
  assert.ok(patch.composition.mix.chain.returnLevel > 0);
});

test("rnd patches randomize engines per track instead of one forced engine", () => {
  const patch = createRndPatch(0x51feed, { patchType: "looping", wildness: 0.8 });
  const active = patch.voices.filter((voice) => voice.active);
  assert.ok(active.length >= 4);
  const engines = new Set(active.map((voice) => voice.engine));
  assert.ok(engines.size >= 3);
  assert.ok(patch.totalFeedback >= 0.05 && patch.totalFeedback <= 0.9);
  assert.ok(patch.delayTime >= 0.08 && patch.delayTime <= 0.7);
  assert.ok(patch.timbreProfile);
});

test("active tracks are not always the first N roles", () => {
  let nonPrefix = 0;
  for (let seed = 0; seed < 40; seed += 1) {
    const random = seededRandom(0x77aa00 + seed);
    const composition = createComposition(random, {
      wildness: 0.6,
      voiceCount: 12,
      patchType: "looping",
    });
    const active = composition.tracks.filter((track) => track.active).map((track) => track.index);
    const max = Math.max(...active);
    // Prefix selection would always fill 0..max; shuffled sets leave holes.
    for (let index = 0; index < max; index += 1) {
      if (!active.includes(index)) {
        nonPrefix += 1;
        break;
      }
    }
  }
  assert.ok(nonPrefix >= 5, `expected shuffled actives, got ${nonPrefix}/40`);
});
