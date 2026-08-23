import assert from "node:assert/strict";
import test from "node:test";
import { scheduleEvents } from "../siteswap.js";
import {
  cascadeHoldingFlags,
  holdingFlagsAtTime,
  occupancyAtTime,
} from "../schedule.js";
import { retentionMetrics } from "../siteswap_metrics.js";

function assertClose(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test("compiled schedules expose identity-bearing holding flags", () => {
  const schedule = scheduleEvents("3", true, 24);

  for (const timeBeat of [12.25, 13.25, 14.25, 15.25]) {
    const flags = holdingFlagsAtTime(schedule, timeBeat, 0.7, true);
    const occupancy = occupancyAtTime("3", timeBeat, 0.7, true);

    assert.deepEqual(flags, cascadeHoldingFlags(timeBeat, 0.7));
    assert.equal(flags.filter(Boolean).length, occupancy.held);
  }
});

test("low-dwell cascade metrics separate alpha and Amphoteron bouts", () => {
  const schedule = scheduleEvents("3", true, 24);
  const metrics = retentionMetrics({ schedule, dwellRatio: 0.25, beatSeconds: 0.4, holdTwos: true });

  assert.equal(metrics.objectCount, 3);
  assert.equal(metrics.holdTwos, true);
  assert.deepEqual(metrics.occupancySharesByHeldCount, [0.5, 0.5, 0, 0]);
  assert.equal(metrics.pAlpha, 0.5);
  assert.equal(metrics.pAmphoteron, 0.5);
  assert.equal(metrics.pKappa, 0);
  assertClose(metrics.meanNormalizedRetention, 1 / 6);
  assert.equal(metrics.airbornePairExposure, 2);
  assert.equal(metrics.macrostateEntropyBits, 1);
  assert.deepEqual(metrics.macrostateBouts.alpha, {
    entryCount: 6,
    boutCount: 6,
    meanLengthBeats: 0.5,
    maximumLengthBeats: 0.5,
    meanLengthSeconds: 0.2,
    maximumLengthSeconds: 0.2,
  });
  assert.deepEqual(metrics.macrostateBouts.amphoteron, metrics.macrostateBouts.alpha);
  assert.deepEqual(metrics.macrostateBouts.kappa, {
    entryCount: 0,
    boutCount: 0,
    meanLengthBeats: 0,
    maximumLengthBeats: 0,
    meanLengthSeconds: 0,
    maximumLengthSeconds: 0,
  });
});

test("constant retention has one periodic bout but no entry event", () => {
  const schedule = scheduleEvents("02", true, 12);
  const metrics = retentionMetrics({ schedule, dwellRatio: 0.7, beatSeconds: 0.3, holdTwos: true });

  assert.deepEqual(metrics.occupancySharesByHeldCount, [0, 1]);
  assert.equal(metrics.pAlpha, 0);
  assert.equal(metrics.pAmphoteron, 0);
  assert.equal(metrics.pKappa, 1);
  assert.equal(metrics.meanNormalizedRetention, 1);
  assert.equal(metrics.airbornePairExposure, 0);
  assert.equal(metrics.macrostateEntropyBits, 0);
  assert.deepEqual(metrics.macrostateBouts.kappa, {
    entryCount: 0,
    boutCount: 1,
    meanLengthBeats: 2,
    maximumLengthBeats: 2,
    meanLengthSeconds: 0.6,
    maximumLengthSeconds: 0.6,
  });
  assert.deepEqual(metrics.identityTurnover, {
    packetCount: 0,
    totalObjectStateChanges: 0,
    meanObjectStateChangesPerPacket: 0,
    maximumObjectStateChangesPerPacket: 0,
    occupancyNeutralExchangePacketCount: 0,
  });
});

test("simultaneous flash packets retain their multiplicity", () => {
  const schedule = scheduleEvents("([44],4)(0,0)([22],2)", true, 18);
  const metrics = retentionMetrics({ schedule, dwellRatio: 0.7, beatSeconds: 0.5, holdTwos: true });

  assertClose(metrics.occupancySharesByHeldCount[0], 13 / 30);
  assert.equal(metrics.occupancySharesByHeldCount[1], 0);
  assert.equal(metrics.occupancySharesByHeldCount[2], 0);
  assertClose(metrics.occupancySharesByHeldCount[3], 17 / 30);
  assertClose(metrics.airbornePairExposure, 13 / 10);
  assert.equal(metrics.macrostateBouts.alpha.entryCount, 1);
  assertClose(metrics.macrostateBouts.alpha.meanLengthBeats, 2.6);
  assertClose(metrics.macrostateBouts.alpha.meanLengthSeconds, 1.3);
  assert.equal(metrics.macrostateBouts.kappa.entryCount, 1);
  assertClose(metrics.macrostateBouts.kappa.maximumLengthSeconds, 1.7);
  assert.deepEqual(metrics.identityTurnover, {
    packetCount: 2,
    totalObjectStateChanges: 6,
    meanObjectStateChangesPerPacket: 3,
    maximumObjectStateChangesPerPacket: 3,
    occupancyNeutralExchangePacketCount: 0,
  });
});

test("simultaneous capture-release packets expose identity exchange at fixed occupancy", () => {
  const schedule = scheduleEvents("3", true, 24);
  const metrics = retentionMetrics({ schedule, dwellRatio: 0.5, beatSeconds: 0.4, holdTwos: true });

  assert.deepEqual(metrics.occupancySharesByHeldCount, [0, 1, 0, 0]);
  assert.equal(metrics.pAmphoteron, 1);
  assert.equal(metrics.macrostateBouts.amphoteron.entryCount, 0);
  assert.equal(metrics.identityTurnover.packetCount, 6);
  assert.equal(metrics.identityTurnover.totalObjectStateChanges, 12);
  assert.equal(metrics.identityTurnover.meanObjectStateChangesPerPacket, 2);
  assert.equal(metrics.identityTurnover.maximumObjectStateChangesPerPacket, 2);
  assert.equal(metrics.identityTurnover.occupancyNeutralExchangePacketCount, 6);
});

test("tempo rescales bout time without mutating the compiled periodic schedule", () => {
  const schedule = scheduleEvents("3", true, 24);
  const original = structuredClone(schedule);
  const slower = retentionMetrics({ schedule, dwellRatio: 0.25, beatSeconds: 0.4 });
  const faster = retentionMetrics({ schedule, dwellRatio: 0.25, beatSeconds: 0.2 });

  assert.deepEqual(schedule, original);
  assert.deepEqual(faster.occupancySharesByHeldCount, slower.occupancySharesByHeldCount);
  assert.equal(faster.macrostateBouts.alpha.meanLengthBeats, slower.macrostateBouts.alpha.meanLengthBeats);
  assert.equal(
    faster.macrostateBouts.alpha.meanLengthSeconds,
    slower.macrostateBouts.alpha.meanLengthSeconds / 2,
  );
});

test("numerical retention rejects a dwell that implies negative physical flight", () => {
  const schedule = scheduleEvents("441", true, 24);

  assert.throws(
    () => retentionMetrics({ schedule, dwellRatio: 0.7, beatSeconds: 0.4, holdTwos: true }),
    (error) => error.code === "infeasible-retention-timing",
  );
});
