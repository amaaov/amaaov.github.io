import assert from "node:assert/strict";
import test from "node:test";

import { playbackTimeBeat, playbackWindowBeats } from "../schedule.js";
import { scheduleEvents } from "../siteswap.js";
import { courtPicture } from "../toss.js";

const FOUR_OBJECT_HOLD_FLASH =
  "([22],[22])([28x],[22])(6x,[22])(0,[26x])(0,6x)(0,[22])(2,[22])";

function ballTravel(from, to) {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

test("reverse playback walks the beat window backward", () => {
  assert.equal(playbackTimeBeat(10), 10);
  assert.equal(playbackTimeBeat(10, { reverse: true, windowBeats: 48 }), 38);
  assert.equal(playbackTimeBeat(0, { reverse: true, windowBeats: 48 }), 0);
  assert.equal(playbackTimeBeat(48, { reverse: true, windowBeats: 48 }), 0);
  assert.ok(playbackTimeBeat(12.4, { reverse: true, windowBeats: 48 }) < playbackTimeBeat(12.1, { reverse: true, windowBeats: 48 }));
});

test("a reversed 531 court matches the forward court at the complementary beat", () => {
  const elapsed = 11.3;
  const reversedBeat = playbackTimeBeat(elapsed, { reverse: true, windowBeats: 48 });
  const reversed = courtPicture({
    source: "531",
    dwellRatio: 0.75,
    holdTwos: true,
    timeBeat: reversedBeat,
  });
  const forward = courtPicture({
    source: "531",
    dwellRatio: 0.75,
    holdTwos: true,
    timeBeat: 48 - elapsed,
  });
  assert.equal(reversed.positions.length, 3);
  assert.equal(reversed.held, forward.held);
  assert.deepEqual(
    reversed.positions.map((point) => [point.x, point.y]),
    forward.positions.map((point) => [point.x, point.y]),
  );
});

test("a 48-beat playback window cuts the 4-object hold-flash mid-air and restarts from hold", () => {
  const { cycleLength } = scheduleEvents(FOUR_OBJECT_HOLD_FLASH, true, 1);
  assert.equal(cycleLength, 56);
  assert.notEqual(48 % cycleLength, 0);

  const beforeWrap = courtPicture({
    source: FOUR_OBJECT_HOLD_FLASH,
    dwellRatio: 0.75,
    holdTwos: true,
    timeBeat: 47.95,
  });
  const wrapped = courtPicture({
    source: FOUR_OBJECT_HOLD_FLASH,
    dwellRatio: 0.75,
    holdTwos: true,
    timeBeat: playbackTimeBeat(48.05),
  });

  assert.ok(beforeWrap.airborne >= 2);
  assert.equal(wrapped.held, 4);
  assert.equal(wrapped.airborne, 0);
  assert.ok(
    beforeWrap.positions.some((point, index) => ballTravel(point, wrapped.positions[index]) > 0.2),
  );
});

test("playback on the compiled identity cycle keeps the 4-object hold-flash continuous", () => {
  const windowBeats = playbackWindowBeats(FOUR_OBJECT_HOLD_FLASH);
  assert.equal(windowBeats, 56);

  const before = courtPicture({
    source: FOUR_OBJECT_HOLD_FLASH,
    dwellRatio: 0.75,
    holdTwos: true,
    timeBeat: playbackTimeBeat(windowBeats - 0.05, { windowBeats }),
  });
  const after = courtPicture({
    source: FOUR_OBJECT_HOLD_FLASH,
    dwellRatio: 0.75,
    holdTwos: true,
    timeBeat: playbackTimeBeat(windowBeats + 0.05, { windowBeats }),
  });

  assert.equal(before.held, 4);
  assert.equal(after.held, 4);
  before.positions.forEach((point, index) => {
    assert.ok(ballTravel(point, after.positions[index]) < 0.05, `ball ${index} jumped`);
  });
});
