import assert from "node:assert/strict";
import test from "node:test";
import {
  leaseTarget,
  leaseTargetForToss,
  relationPresence,
  relationsInPattern,
} from "../../20260819100800_grip_algebra/object_relation.js";
import { passingOccupancy } from "../passing_occupancy.js";
import { schedulePassingEvents } from "../passing_schedule.js";
import { passingCourtPicture } from "../passing_toss.js";

test("a self-throw keeps the catcher on the throwing body", () => {
  const schedule = schedulePassingEvents("<3|3>", true, 1);
  const toss = schedule.cycleTosses.find((event) => event.ball !== null && !event.hold && !event.pass);
  assert.ok(toss);
  assert.equal(leaseTargetForToss(toss), toss.fromBody);
  assert.equal(leaseTarget({ returnDue: true, catcher: toss.toBody }), toss.fromBody);
});

test("a pass names the other body as catcher", () => {
  const schedule = schedulePassingEvents("<3p 3|3p 3>", true, 1);
  const pass = schedule.cycleTosses.find((event) => event.pass);
  assert.ok(pass);
  assert.notEqual(pass.fromBody, pass.toBody);
  assert.equal(leaseTargetForToss(pass), pass.toBody);
});

test("a discard has an empty catcher", () => {
  assert.equal(leaseTarget({ returnDue: false, catcher: 0 }), null);
  assert.equal(leaseTargetForToss({
    ball: 0,
    height: 3,
    hold: false,
    toBody: 1,
  }), 1);
  assert.equal(leaseTargetForToss({
    ball: null,
    height: 0,
    hold: false,
    toBody: 0,
  }), null);
});

test("four-club and six-club occupancy shares stay on the g-cube", () => {
  const hold = passingOccupancy(schedulePassingEvents("<2|2>", true, 1), 0.25);
  assert.equal(hold.pKappa, 1);
  assert.equal(hold.pAlpha, 0);
  const twoCount = passingOccupancy(schedulePassingEvents("<3p 3|3p 3>", true, 1), 0.25);
  assert.equal(twoCount.pKappa, 0);
  assert.ok(twoCount.pAlpha > 0);
  assert.ok(twoCount.pPolymorphy > 0);
});

test("a four-club hold is all tained; a two-count mixes tained and leased", () => {
  const hold = passingCourtPicture({ source: "<2|2>", dwellRatio: 0.25, holdTwos: true, timeBeat: 0.1 });
  assert.deepEqual(relationPresence(relationsInPattern(hold.heldFlags)), {
    tained: true,
    leased: false,
    dropped: false,
  });
  let mixed = null;
  for (let timeBeat = 0; timeBeat < 4; timeBeat += 0.05) {
    const picture = passingCourtPicture({
      source: "<3p 3|3p 3>",
      dwellRatio: 0.25,
      holdTwos: true,
      timeBeat,
    });
    const presence = relationPresence(relationsInPattern(picture.heldFlags));
    if (presence.tained && presence.leased) {
      mixed = presence;
      break;
    }
  }
  assert.ok(mixed);
  assert.equal(mixed.dropped, false);
});
