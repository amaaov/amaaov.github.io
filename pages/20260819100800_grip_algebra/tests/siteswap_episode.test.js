import assert from "node:assert/strict";
import test from "node:test";

import { parseHybridSiteswap, readSiteswap, siteswapIsValid, throwHeightOf } from "../siteswap.js";
import { playbackTimeBeat, playbackWindowBeats } from "../schedule.js";
import {
  scheduleEpisode,
  schedulePlayable,
  siteswapCanPlay,
} from "../siteswap_episode.js";
import { courtPicture } from "../toss.js";
import { EMPTY_SIGN } from "../holding.js";

test("hybrid parser attaches plus and minus to the neighbouring vanilla throws", () => {
  const frames = parseHybridSiteswap("55500+552-");
  assert.equal(frames.length, 8);
  assert.equal(throwHeightOf(frames[4].throws[0]), 0);
  assert.equal(frames[4].throws[0].addAfter, 1);
  assert.equal(throwHeightOf(frames[7].throws[0]), 2);
  assert.equal(frames[7].throws[0].removeAfter, 1);
  assert.equal(readSiteswap("55500+552-").timing, "hybrid");
});

test("plus and minus attach to a sync hand and to a multiplex throw", () => {
  const syncHand = parseHybridSiteswap("(4+,2-)");
  assert.equal(syncHand[0].left[0].addAfter, 1);
  assert.equal(syncHand[0].right[0].removeAfter, 1);
  const syncPair = parseHybridSiteswap("(4,2)+");
  assert.equal(syncPair[0].addAfter, 1);
  const multiplex = parseHybridSiteswap("[2-5]");
  assert.equal(multiplex[0].throws[0].removeAfter, 1);
  assert.equal(throwHeightOf(multiplex[0].throws[1]), 5);
  const multiplexPacket = parseHybridSiteswap("[22]+");
  assert.equal(multiplexPacket[0].throws[1].addAfter, 1);
  assert.equal(siteswapCanPlay("(4,2)+"), true);
  assert.equal(siteswapCanPlay("[22]-"), true);
  assert.equal(siteswapIsValid("(4+,2)"), false);
  assert.equal(siteswapIsValid("[22]+"), false);
});

test("a leading plus adds before the first throw", () => {
  const frames = parseHybridSiteswap("+3");
  assert.equal(frames[0].throws[0], 3);
  assert.equal(frames[0].addBefore, 1);
});

test("plus and minus keep the string outside cyclic validity", () => {
  assert.equal(siteswapIsValid("55500+552-"), false);
  assert.equal(siteswapIsValid("76"), false);
  assert.equal(siteswapIsValid("2-"), false);
  assert.equal(siteswapIsValid("3+"), false);
  assert.equal(siteswapCanPlay("55500+552-"), true);
  assert.equal(siteswapCanPlay("76"), true);
  assert.equal(siteswapCanPlay(""), false);
  assert.equal(siteswapCanPlay("("), false);
});

test("an invalid 76 episode throws twice then breaks on an uncaught landing", () => {
  const episode = scheduleEpisode("76", true);
  assert.equal(episode.cyclic, false);
  assert.ok(episode.events.length >= 2);
  assert.equal(episode.events[0].height, 7);
  assert.equal(episode.events[1].height, 6);
  assert.equal(episode.break.kind, "uncaught");
  assert.ok(episode.break.beat > 1);
});

test("plus after an empty hand raises the live object count", () => {
  const episode = scheduleEpisode("0+", true);
  assert.ok(episode.ballCount >= 1);
  assert.ok(episode.events.some((event) => event.parked));
});

test("minus after a hold dumps that tained object", () => {
  const episode = scheduleEpisode("2-", true);
  const dumped = episode.events.find((event) => event.dump);
  assert.ok(dumped);
  assert.equal(dumped.hold, true);
});

test("courtPicture paints an invalid 76 instead of empty hands", () => {
  const pictured = courtPicture({
    source: "76",
    dwellRatio: 0.75,
    holdTwos: true,
    timeBeat: 0.4,
  });
  assert.ok(pictured.positions.length >= 1);
  assert.notEqual(pictured.state, EMPTY_SIGN);
  assert.equal(pictured.valid, false);
});

test("an uncaught 76 landing falls as abandoned and leaves occupancy", () => {
  const episode = scheduleEpisode("76", true);
  const pictured = courtPicture({
    source: "76",
    dwellRatio: 0.75,
    holdTwos: true,
    timeBeat: episode.break.beat + 0.4,
  });
  assert.ok(pictured.positions.some((position) => position.abandoned));
  assert.equal(pictured.airborne, 0);
  assert.equal(pictured.valid, false);
});

test("a dumped hold stays tained until the hold ends", () => {
  const during = courtPicture({
    source: "2-",
    dwellRatio: 0.75,
    holdTwos: true,
    timeBeat: 0.4,
  });
  assert.ok(during.positions.some((position) => position.held));
  const after = courtPicture({
    source: "2-",
    dwellRatio: 0.75,
    holdTwos: true,
    timeBeat: 2.2,
  });
  assert.equal(after.positions.filter((position) => position.held).length, 0);
});

test("an empty or unreadable string still paints an empty court", () => {
  for (const source of ["", "("]) {
    const pictured = courtPicture({
      source,
      dwellRatio: 0.75,
      holdTwos: true,
      timeBeat: 1,
    });
    assert.deepEqual(pictured.positions, []);
    assert.equal(pictured.state, EMPTY_SIGN);
  }
});

test("a flash-add-dump episode is playable and adds then removes", () => {
  const episode = scheduleEpisode("55500+552-", true);
  assert.ok(episode.ballCount >= 3);
  assert.ok(episode.events.some((event) => event.parked || event.height === 5));
  assert.ok(episode.events.some((event) => event.dump || event.drop));
  const pictured = courtPicture({
    source: "55500+552-",
    dwellRatio: 0.75,
    holdTwos: true,
    timeBeat: 4.2,
  });
  assert.ok(pictured.positions.some((position) => position.held));
});

test("playable invalid windows clamp when Loop is off and wrap when Loop is on", () => {
  const windowBeats = playbackWindowBeats("76");
  assert.ok(windowBeats > 0);
  assert.ok(windowBeats < 48);
  assert.equal(playbackTimeBeat(windowBeats + 0.2, { windowBeats, loop: false }), windowBeats);
  assert.ok(playbackTimeBeat(windowBeats + 0.2, { windowBeats, loop: true }) < 1);
});

test("a legal cascade still uses the cyclic schedule", () => {
  const playable = schedulePlayable("3", true, 8);
  assert.equal(playable.cyclic, true);
  assert.equal(playable.ballCount, 3);
  assert.equal(playable.break, null);
});

test("plus after a sync pair parks on the right hand", () => {
  const episode = scheduleEpisode("(2,2)+", true);
  assert.ok(episode.events.some((event) => event.parked && event.toHand === 1));
  assert.equal(siteswapIsValid("(2,2)+"), false);
});

test("minus on a sync throw drops that flight", () => {
  const episode = scheduleEpisode("(2,4-)", true);
  const marked = episode.events.find((event) => event.drop || event.dump);
  assert.ok(marked);
  assert.equal(marked.height, 4);
  assert.equal(marked.fromHand, 1);
});

test("minus inside a multiplex dumps that hold", () => {
  const episode = scheduleEpisode("[2-2]", true);
  const dumped = episode.events.filter((event) => event.dump);
  assert.equal(dumped.length, 1);
  assert.equal(dumped[0].hold, true);
});

test("plus after a multiplex raises the live object count", () => {
  const episode = scheduleEpisode("[22]+", true);
  assert.ok(episode.events.some((event) => event.parked));
  assert.ok(episode.ballCount >= 3);
});
