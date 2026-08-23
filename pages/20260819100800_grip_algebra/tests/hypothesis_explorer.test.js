import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeSiteswap,
  analyzeSiteswaps,
  correlationCoefficient,
  hypothesisContrastPair,
  scatterLayout,
} from "../hypothesis_explorer.js";

function assertClose(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test("tempo rescales entry rates and bout seconds while preserving beat-time shares", () => {
  const slower = analyzeSiteswap({
    source: "3",
    dwellRatio: 0.25,
    beatSeconds: 0.4,
    holdTwos: true,
  });
  const faster = analyzeSiteswap({
    source: "3",
    dwellRatio: 0.25,
    beatSeconds: 0.2,
    holdTwos: true,
  });

  assert.equal(slower.pAlpha, faster.pAlpha);
  assert.equal(slower.pAmphoteron, faster.pAmphoteron);
  assertClose(faster.alphaEntryRateHz, 2 * slower.alphaEntryRateHz);
  assertClose(faster.alphaMeanBoutSeconds, slower.alphaMeanBoutSeconds / 2);
});

test("live comparison joins schedule structure to Grip observables", () => {
  const rows = analyzeSiteswaps({
    sources: ["3", "55500", "([44],4)(0,0)([22],2)", "5(2,4)1"],
    dwellRatio: 0.25,
    beatSeconds: 0.4,
    holdTwos: true,
  });

  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((row) => row.timing), ["async", "async", "sync", "hybrid"]);
  assert.ok(rows.every((row) => row.physicalMetricsFeasible));
  assert.ok(rows.every((row) => row.pAlpha + row.pAmphoteron + row.pKappa > 0.999999));
  assert.ok(rows.every((row) => Number.isFinite(row.airbornePairExposure)));
  assert.equal(rows[2].maximumReleasePacket, 3);
});

test("comparison distinguishes notation period from the compiled prop-and-hand routing cycle", () => {
  const row = analyzeSiteswap({
    source: "(5,5)005",
    dwellRatio: 0.7,
    beatSeconds: 0.4,
    holdTwos: true,
  });

  assert.equal(row.notationPeriodBeats, 5);
  assert.equal(row.routingCycleBeats, 10);
  assert.equal(row.routingCycleRatio, 2);
  assert.ok(Number.isFinite(row.microstateChangeRateHz));
});

test("comparison keeps structure but excludes infeasible physical retention timing", () => {
  const row = analyzeSiteswap({
    source: "441",
    dwellRatio: 0.7,
    beatSeconds: 0.4,
    holdTwos: true,
  });

  assert.equal(row.physicalMetricsFeasible, false);
  assert.equal(row.notationPeriodBeats, 3);
  assert.equal(row.routingCycleBeats, 18);
  assert.equal(row.pAlpha, undefined);
});

test("comparison integrates the complete routing cycle when it exceeds the probe horizon", () => {
  const row = analyzeSiteswap({
    source: "4b9",
    dwellRatio: 0.25,
    beatSeconds: 0.4,
    holdTwos: true,
  });

  assert.equal(row.routingCycleBeats, 90);
  assertClose(row.pAlpha, 0.5);
  assertClose(row.pAmphoteron, 0.5);
  assertClose(row.pKappa, 0);
});

test("correlation describes the displayed sample and handles a constant axis", () => {
  const rows = [
    { x: 1, y: 3 },
    { x: 2, y: 5 },
    { x: 3, y: 7 },
  ];
  assertClose(correlationCoefficient(rows, "x", "y"), 1);
  assert.equal(correlationCoefficient(rows.map((row) => ({ ...row, x: 1 })), "x", "y"), null);
  assert.equal(correlationCoefficient(rows.slice(0, 1), "x", "y"), null);
});

test("scatter layout retains source identity and keeps points inside the plot", () => {
  const rows = [
    { source: "3", horizontal: 0, vertical: 4 },
    { source: "55500", horizontal: 2, vertical: 1 },
  ];
  const points = scatterLayout(rows, "horizontal", "vertical", 320, 180, 24);

  assert.deepEqual(points.map((point) => point.source), ["3", "55500"]);
  assert.ok(points.every((point) => point.x >= 24 && point.x <= 296));
  assert.ok(points.every((point) => point.y >= 24 && point.y <= 156));
});

test("scatter layout separates coincident patterns so each remains selectable", () => {
  const rows = [
    { source: "3", horizontal: 1, vertical: 1 },
    { source: "441", horizontal: 1, vertical: 1 },
    { source: "531", horizontal: 1, vertical: 1 },
  ];
  const points = scatterLayout(rows, "horizontal", "vertical", 320, 180, 24);
  const positions = new Set(points.map((point) => `${point.x},${point.y}`));

  assert.equal(positions.size, rows.length);
  assert.ok(points.every((point) => point.x >= 24 && point.x <= 296));
  assert.ok(points.every((point) => point.y >= 24 && point.y <= 156));
});

test("hypothesis contrast chooses two finite rows spanning both displayed axes", () => {
  const rows = [
    { source: "low", horizontal: 0, vertical: 0 },
    { source: "middle", horizontal: 4, vertical: 1 },
    { source: "high", horizontal: 10, vertical: 10 },
    { source: "unavailable", horizontal: undefined, vertical: 20 },
  ];
  const pair = hypothesisContrastPair(rows, "horizontal", "vertical");

  assert.deepEqual(pair.map((row) => row.source), ["low", "high"]);
  assert.equal(hypothesisContrastPair(rows.slice(0, 1), "horizontal", "vertical"), null);
});
