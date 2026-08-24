import assert from "node:assert/strict";
import test from "node:test";
import { passingOccupancy } from "../passing_occupancy.js";
import { schedulePassingEvents } from "../passing_schedule.js";

function packetRoutes(source, beat) {
  return schedulePassingEvents(source, true, 1).cycleTosses
    .filter((event) => event.beat === beat)
    .map((event) => [event.fromHand, event.toHand, event.height, event.kind]);
}

test("ultimate six-club passing routes 3p from each right to the partner left", () => {
  const schedule = schedulePassingEvents("<3p|3p>", true, 8);
  assert.equal(schedule.ballCount, 6);
  assert.equal(schedule.bodyCount, 2);
  assert.equal(schedule.handCount, 4);
  assert.equal(schedule.period, 1);
  assert.equal(schedule.cycleLength % 2, 0);
  assert.deepEqual(packetRoutes("<3p|3p>", 0), [
    [1, 2, 3, "throw"],
    [3, 0, 3, "throw"],
  ]);
  assert.deepEqual(packetRoutes("<3p|3p>", 1), [
    [0, 3, 3, "throw"],
    [2, 1, 3, "throw"],
  ]);
  assert.equal(schedule.cycleTosses.every((event) => event.pass), true);
});

test("partitioned double cascade never leaves its own body", () => {
  const schedule = schedulePassingEvents("<3|3>", true, 8);
  assert.equal(schedule.ballCount, 6);
  assert.equal(schedule.cycleTosses.every((event) => event.pass), false);
  assert.equal(schedule.cycleTosses.every((event) => event.fromBody === event.toBody), true);
  assert.deepEqual(packetRoutes("<3|3>", 0), [
    [1, 0, 3, "throw"],
    [3, 2, 3, "throw"],
  ]);
  assert.deepEqual(packetRoutes("<3|3>", 1), [
    [0, 1, 3, "throw"],
    [2, 3, 3, "throw"],
  ]);
});

test("two-count six keeps a pass on even beats and a self on odd beats", () => {
  const schedule = schedulePassingEvents("<3p 3|3p 3>", true, 8);
  assert.equal(schedule.ballCount, 6);
  const byBeat = Map.groupBy(schedule.cycleTosses, (event) => event.beat);
  assert.equal(byBeat.get(0).every((event) => event.pass), true);
  assert.equal(byBeat.get(1).every((event) => event.pass), false);
});

test("seven-club two-count starts on opposite hands", () => {
  const schedule = schedulePassingEvents("<R|L><4xp|3><3|4xp>", true, 16);
  assert.equal(schedule.ballCount, 7);
  assert.deepEqual(packetRoutes("<R|L><4xp|3><3|4xp>", 0), [
    [1, 2, 4, "throw"],
    [2, 3, 3, "throw"],
  ]);
  assert.deepEqual(packetRoutes("<R|L><4xp|3><3|4xp>", 1), [
    [0, 1, 3, "throw"],
    [3, 0, 4, "throw"],
  ]);
});

test("group occupancy of six-object unit-hand patterns is half empty and half two-held", () => {
  ["<3|3>", "<3p|3p>", "<3p 3|3p 3>"].forEach((notation) => {
    const occupancy = passingOccupancy(schedulePassingEvents(notation, true, 1), 0.25);
    assert.equal(occupancy.objectCount, 6);
    assert.equal(occupancy.pAlpha, 0.5);
    assert.equal(occupancy.pPolymorphy, 0.5);
    assert.equal(occupancy.pKappa, 0);
    assert.deepEqual(occupancy.occupancyShares, [0.5, 0, 0.5, 0, 0, 0, 0]);
  });
});

test("seven-club occupancy matches the two-throw packet law", () => {
  const occupancy = passingOccupancy(
    schedulePassingEvents("<R|L><4xp|3><3|4xp>", true, 1),
    0.25,
  );
  assert.equal(occupancy.objectCount, 7);
  assert.equal(occupancy.pAlpha, 0.5);
  assert.equal(occupancy.pPolymorphy, 0.5);
  assert.equal(occupancy.pKappa, 0);
  assert.deepEqual(occupancy.occupancyShares, [0.5, 0, 0.5, 0, 0, 0, 0, 0]);
});
