import assert from "node:assert/strict";
import test from "node:test";
import {
  AIRBORNE_SIGN,
  EMPTY_SIGN,
  HOLD_SIGN,
  MIXED_SIGN,
  occupancyState,
} from "../holding.js";
import {
  DROP_SIGN,
  LEASED_SIGN,
  TAINED_SIGN,
  applyObjectEvent,
  leaseTarget,
  objectRelation,
  relationPresence,
  relationsInPattern,
  tainedAndLeasedTogether,
} from "../object_relation.js";
import { occupancyAtTime } from "../schedule.js";

const tained = { retained: true, returnDue: false };

test("a throw opens a lease; a catch fulfills it", () => {
  const leased = applyObjectEvent(tained, "throw");
  assert.equal(objectRelation(leased), "leased");
  assert.equal(objectRelation(applyObjectEvent(leased, "catch")), "tained");
});

test("a drop is a lease whose capture continuation dies", () => {
  const leased = applyObjectEvent(tained, "throw");
  const dropped = applyObjectEvent(leased, "drop");
  assert.equal(objectRelation(dropped), "abandoned");
  assert.equal(dropped.returnDue, false);
  assert.equal(occupancyState([dropped.retained]), AIRBORNE_SIGN);
});

test("a dump never opens a lease", () => {
  const dumped = applyObjectEvent(tained, "dump");
  assert.equal(objectRelation(dumped), "abandoned");
  assert.equal(dumped.returnDue, false);
});

test("occupancy from g still names empty, all unheld, mixed, and all held", () => {
  assert.equal(occupancyState([]), EMPTY_SIGN);
  assert.equal(occupancyState([false, false, false]), AIRBORNE_SIGN);
  assert.equal(occupancyState([true, false, false]), MIXED_SIGN);
  assert.equal(occupancyState([true, true, true]), HOLD_SIGN);
});

test("a bagged object is outside the domain", () => {
  assert.equal(occupancyState([]), EMPTY_SIGN);
  assert.deepEqual(relationsInPattern([]), []);
});

test("55500 empty hands are all leased while occupancy is total unheld", () => {
  let snapshot = null;
  for (let timeBeat = 4; timeBeat < 24; timeBeat += 0.05) {
    const occupancy = occupancyAtTime("55500", timeBeat, 0.75, true);
    if (occupancy.held === 0 && occupancy.ballCount === 3) {
      snapshot = occupancy;
      break;
    }
  }
  assert.ok(snapshot);
  assert.equal(occupancyState(snapshot.heldFlags), AIRBORNE_SIGN);
  const relations = relationsInPattern(snapshot.heldFlags);
  assert.equal(relations.length, 3);
  assert.equal(relations.every((relation) => relation === "leased"), true);
  assert.equal(tainedAndLeasedTogether(relations), false);
});

test("a cascade snapshot mixes tained and leased objects", () => {
  let snapshot = null;
  for (let timeBeat = 8; timeBeat < 16; timeBeat += 0.05) {
    const occupancy = occupancyAtTime("3", timeBeat, 0.7, true);
    if (occupancy.held > 0 && occupancy.held < occupancy.ballCount) {
      snapshot = occupancy;
      break;
    }
  }
  assert.ok(snapshot);
  assert.equal(occupancyState(snapshot.heldFlags), MIXED_SIGN);
  const relations = relationsInPattern(snapshot.heldFlags);
  assert.equal(tainedAndLeasedTogether(relations), true);
});

test("a discard has an empty catcher; a live lease names its catcher", () => {
  assert.equal(leaseTarget({ returnDue: false, catcher: 1 }), null);
  assert.equal(leaseTarget({ returnDue: true, catcher: 0 }), 0);
  assert.equal(leaseTarget({ returnDue: true, catcher: 1 }), 1);
});

test("object-relation lamps are tau, lambda, and rho", () => {
  assert.equal(TAINED_SIGN, "τ");
  assert.equal(LEASED_SIGN, "λ");
  assert.equal(DROP_SIGN, "ρ");
});

test("relation presence lights tained, leased, and drop independently of occupancy", () => {
  assert.deepEqual(relationPresence(["tained", "leased"]), {
    tained: true,
    leased: true,
    dropped: false,
  });
  assert.deepEqual(relationPresence(relationsInPattern([false, false, false])), {
    tained: false,
    leased: true,
    dropped: false,
  });
  assert.deepEqual(relationPresence(["abandoned", "leased"]), {
    tained: false,
    leased: true,
    dropped: true,
  });
});
