import test from "node:test";
import assert from "node:assert/strict";
import { seededRandom } from "../../../pages/20260819100800_grip_algebra/siteswap_generator.js";
import { siteswapCanPlay } from "../../../pages/20260819100800_grip_algebra/siteswap_episode.js";
import {
  MAX_OBJECTS,
  MAX_WAIT_SECONDS,
  MIN_OBJECTS,
  episodeStepCount,
  generateSiteswapEpisode,
  isRestTrick,
  pickWaitBeats,
  restBeatCount,
  trickSource,
  validateEpisode,
  waitBeatsWithinLimit,
} from "./siteswap_episode.js";
import {
  createDistinctRndPatch,
  createRndPatch,
  patchFingerprint,
  patchesDistinctEnough,
} from "./rnd_patch.js";
import { objectCountFromSiteswapKnob } from "./control_map.js";
import {
  advanceTrickSequencer,
  createTrickSequencer,
  currentTrick,
  currentTrickBeats,
} from "./trick_sequencer.js";

test("siteswap knob spans three to seven objects", () => {
  assert.equal(objectCountFromSiteswapKnob(0), 3);
  assert.equal(objectCountFromSiteswapKnob(0.25), 4);
  assert.equal(objectCountFromSiteswapKnob(0.5), 5);
  assert.equal(objectCountFromSiteswapKnob(0.75), 6);
  assert.equal(objectCountFromSiteswapKnob(1), 7);
  assert.equal(MIN_OBJECTS, 3);
  assert.equal(MAX_OBJECTS, 7);
});

test("waits stay short, rhythmic, and under the wall-clock ceiling", () => {
  const bpm = 70;
  const maxBeats = waitBeatsWithinLimit(99, bpm);
  assert.ok(maxBeats * (60 / bpm) <= MAX_WAIT_SECONDS + 1e-6);
  const random = seededRandom(0x0a17);
  let ones = 0;
  let longs = 0;
  for (let index = 0; index < 40; index += 1) {
    const beats = pickWaitBeats(random, 0.6, bpm);
    assert.ok(beats >= 1 && beats <= maxBeats);
    if (beats === 1) {
      ones += 1;
    }
    if (beats >= 3) {
      longs += 1;
    }
  }
  assert.ok(ones >= 15, `expected mostly 1-beat waits, got ${ones}/40`);
  assert.ok(longs <= 12, `expected rare long waits, got ${longs}/40`);
});

test("siteswap episodes mix long phrases with waits and drops", () => {
  const random = seededRandom(0x51e501);
  const episode = generateSiteswapEpisode(random, 3, 0.6, 0.8, { bpm: 100 });
  assert.ok(episode.length >= 4);
  const kinds = new Set(episode.map((entry) => entry.kind));
  assert.ok(episode.some((entry) => !isRestTrick(trickSource(entry))));
  assert.ok(validateEpisode(episode));
  for (const entry of episode) {
    const source = trickSource(entry);
    if (isRestTrick(source)) {
      assert.ok(restBeatCount(source) >= 1);
      assert.ok(restBeatCount(source) <= waitBeatsWithinLimit(99, 100));
    } else {
      assert.equal(siteswapCanPlay(source), true);
    }
  }
  assert.ok(kinds.size >= 2);
});

test("episodes can reach 128 period steps and vary timing families", () => {
  const random = seededRandom(0x128001);
  const episode = generateSiteswapEpisode(random, 5, 0.7, 0.95);
  assert.ok(episodeStepCount(episode) >= 128, `steps=${episodeStepCount(episode)}`);
  assert.ok(validateEpisode(episode));
  const sources = episode.map((entry) => trickSource(entry)).filter((source) => !isRestTrick(source));
  assert.ok(sources.some((source) => source.includes("(") || source.includes("[")));
});

test("seven-object episodes stay playable", () => {
  const random = seededRandom(0x70007);
  const episode = generateSiteswapEpisode(random, 7, 0.8, 0.7);
  assert.ok(validateEpisode(episode));
  assert.ok(episodeStepCount(episode) >= 48);
});

test("trick sequencer respects per-phrase beat lengths including waits", () => {
  const sequencer = createTrickSequencer(
    [
      { source: "3", beats: 6, kind: "cascade" },
      { source: "~4", beats: 4, kind: "wait" },
      { source: "423", beats: 8, kind: "hold" },
    ],
    10,
  );
  assert.equal(currentTrick(sequencer), "3");
  assert.equal(currentTrickBeats(sequencer), 6);
  const afterFirst = advanceTrickSequencer(sequencer, 6);
  assert.equal(currentTrick(afterFirst.sequencer), "~4");
  assert.equal(currentTrickBeats(afterFirst.sequencer), 4);
  const afterWait = advanceTrickSequencer(afterFirst.sequencer, 4);
  assert.equal(currentTrick(afterWait.sequencer), "423");
});

test("episodes include generated family roles without pattern shelves", () => {
  const kinds = new Set();
  const sources = new Set();
  for (let seed = 1; seed <= 16; seed += 1) {
    const episode = generateSiteswapEpisode(seededRandom(0x51e000 + seed), 3, 0.55, 0.85, {
      bpm: 100,
    });
    assert.ok(validateEpisode(episode));
    for (const entry of episode) {
      if (entry.kind) {
        kinds.add(entry.kind);
      }
      const source = trickSource(entry);
      if (!isRestTrick(source)) {
        sources.add(source);
      }
    }
  }
  assert.ok(kinds.has("shower"), `missing shower; kinds=${[...kinds]}`);
  assert.ok(kinds.has("box"), `missing box; kinds=${[...kinds]}`);
  assert.ok(kinds.has("columns"), `missing columns; kinds=${[...kinds]}`);
  assert.ok(
    [...sources].some((source) => source.includes("x") || source.includes("(")),
    "expected generated sync/crossing structure",
  );
  assert.ok(sources.size >= 10, `expected diverse generated sources, got ${sources.size}`);
});

test("rnd patches diverge in profile type and build long trick episodes", () => {
  const a = createRndPatch(0x11110001, { wildness: 0.9 });
  const b = createRndPatch(0x22220002, { wildness: 0.9 });
  assert.ok(a.tricks.length >= 4);
  assert.ok(b.tricks.length >= 4);
  assert.ok(a.objectCount >= 3 && a.objectCount <= 7);
  assert.ok(b.objectCount >= 3 && b.objectCount <= 7);
  assert.ok(a.timbreProfile);
  assert.ok(b.timbreProfile);
  const sameSonic =
    a.patchType === b.patchType &&
    a.timbreProfile === b.timbreProfile &&
    a.scaleName === b.scaleName &&
    Math.abs(a.totalFeedback - b.totalFeedback) < 0.05 &&
    Math.abs(a.delayTime - b.delayTime) < 0.05;
  assert.equal(sameSonic, false);
});

test("object counts roam beyond a single preferred knob value", () => {
  const counts = new Set();
  for (let seed = 1; seed <= 24; seed += 1) {
    const patch = createRndPatch(0x500000 + seed * 17, {
      wildness: 0.8,
      objectCountPrefer: 5,
    });
    counts.add(patch.objectCount);
  }
  assert.ok(counts.size >= 3, `expected varied object counts, got ${[...counts]}`);
  assert.ok(![...counts].every((count) => count === 5));
});

test("distinct PLAY patches differ across pattern and timbre axes", () => {
  let previous = createRndPatch(0x1001, { wildness: 0.75, objectCountPrefer: 5 });
  let distinctPairs = 0;
  for (let step = 0; step < 8; step += 1) {
    const next = createDistinctRndPatch(0x2000 + step * 97, { wildness: 0.75, objectCountPrefer: 5 }, previous);
    if (patchesDistinctEnough(patchFingerprint(previous), patchFingerprint(next))) {
      distinctPairs += 1;
    }
    previous = next;
  }
  assert.ok(distinctPairs >= 6, `expected distinct successive patches, got ${distinctPairs}/8`);
});

test("episode openers prefer named families over cascade", () => {
  const openers = [];
  for (let seed = 1; seed <= 20; seed += 1) {
    const episode = generateSiteswapEpisode(seededRandom(0x0fed00 + seed), 4, 0.6, 0.8, {
      bpm: 110,
    });
    openers.push(episode[0]?.kind);
  }
  const cascadeOpeners = openers.filter((kind) => kind === "cascade").length;
  assert.ok(cascadeOpeners <= 2, `cascade openers too common: ${openers.join(",")}`);
  assert.ok(
    openers.some((kind) => ["shower", "box", "multiplex", "hybrid", "fountain", "sync"].includes(kind)),
    `expected family openers, got ${openers.join(",")}`,
  );
});
