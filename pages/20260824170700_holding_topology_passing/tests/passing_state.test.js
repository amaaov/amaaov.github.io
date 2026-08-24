import assert from "node:assert/strict";
import test from "node:test";
import { passingOccupancy, akrateiaPresent, kratosPresent } from "../passing_occupancy.js";
import { schedulePassingEvents } from "../passing_schedule.js";
import { bodyRetention, signLabel, advanceCourtClock, stepCourtClock, toggleCourtPause } from "../passing_state.js";
import { passingCourtPicture } from "../passing_toss.js";

function signsVisited(source, dwellRatio = 0.25, holdTwos = true) {
  const schedule = schedulePassingEvents(source, holdTwos, 1);
  const signs = new Set();
  for (let timeBeat = 0; timeBeat < schedule.cycleLength; timeBeat += 0.05) {
    const picture = passingCourtPicture({ source, dwellRatio, holdTwos, timeBeat });
    signs.add(picture.groupSign);
  }
  return signs;
}

test("four-club PPS with zips visits akrateia, amphoteron, and kratos", () => {
  const signs = signsVisited("<2p 2p 2|2p 2p 2>");
  assert.equal(signs.has("alpha"), true);
  assert.equal(signs.has("amphoteron"), true);
  assert.equal(signs.has("kappa"), true);
  const occupancy = passingOccupancy(schedulePassingEvents("<2p 2p 2|2p 2p 2>", true, 1), 0.25);
  assert.ok(occupancy.pAlpha > 0 && occupancy.pAmphoteron > 0 && occupancy.pKappa > 0);
});

test("four-club hold stays in kratos; six-club 2-count never does", () => {
  const hold = signsVisited("<2|2>");
  assert.deepEqual([...hold], ["kappa"]);
  const twoCount = signsVisited("<3p 3|3p 3>");
  assert.equal(twoCount.has("kappa"), false);
  assert.equal(twoCount.has("alpha"), true);
  assert.equal(twoCount.has("amphoteron"), true);
});

test("reading 2 as a throw takes the four-club hold out of kratos", () => {
  const occupancy = passingOccupancy(schedulePassingEvents("<2|2>", false, 1), 0.25);
  assert.equal(occupancy.pKappa, 0);
  assert.ok(occupancy.pAlpha > 0);
  assert.ok(occupancy.pAmphoteron > 0);
});

test("body retention partitions every object and names a local sign", () => {
  const picture = passingCourtPicture({ source: "<2p 2p 2|2p 2p 2>", timeBeat: 0.2 });
  const rows = bodyRetention(picture.positions, picture.bodyCount);
  const localSum = rows.reduce((sum, row) => sum + row.local, 0);
  const heldSum = rows.reduce((sum, row) => sum + row.held, 0);
  assert.equal(localSum, picture.ballCount);
  assert.equal(heldSum, picture.held);
  assert.equal(picture.bodyRetention.length, 2);
  assert.equal(signLabel("amphoteron"), "ακ");
  assert.equal(akrateiaPresent(picture.groupSign), picture.held < picture.ballCount);
  assert.equal(kratosPresent(picture.groupSign), picture.held > 0);
});

test("a dwell change moves the four-club PPS kratos share", () => {
  const schedule = schedulePassingEvents("<2p 2p 2|2p 2p 2>", true, 1);
  const tight = passingOccupancy(schedule, 0.15);
  const loose = passingOccupancy(schedule, 1 / 3);
  assert.ok(loose.pKappa > tight.pKappa);
});

test("triangle with zips can hold every object", () => {
  const occupancy = passingOccupancy(schedulePassingEvents("<2p2|2p3|2p1><2|2|2>", true, 1), 0.25);
  assert.equal(occupancy.objectCount, 6);
  assert.ok(occupancy.pKappa > 0);
  assert.equal(signsVisited("<2p2|2p3|2p1><2|2|2>").has("kappa"), true);
});

test("a paused court clock holds elapsed; a step adds one beat and stays paused", () => {
  const running = advanceCourtClock({ elapsed: 1, lastStamp: 1000, paused: false }, 1500);
  assert.equal(running.elapsed, 1.5);
  const paused = advanceCourtClock({ elapsed: 1, lastStamp: 1000, paused: true }, 1500);
  assert.equal(paused.elapsed, 1);
  const stepped = stepCourtClock({ elapsed: 2, lastStamp: 0, paused: false }, 0.4);
  assert.equal(stepped.elapsed, 2.4);
  assert.equal(stepped.paused, true);
  assert.equal(toggleCourtPause({ elapsed: 0, lastStamp: 0, paused: false }).paused, true);
});
