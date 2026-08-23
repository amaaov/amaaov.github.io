import assert from "node:assert/strict";
import test from "node:test";
import {
  completeSiteswapMask,
  createGenerationMask,
  seededRandom,
  siteswapFeatures,
} from "../siteswap_generator.js";
import { readSiteswap, siteswapBallCount, siteswapIsValid } from "../siteswap.js";

test("asynchronous masks preserve fixed throws and return only legal requested counts", () => {
  const result = completeSiteswapMask({
    mask: "5??00",
    objectCount: 3,
    maximumThrow: 5,
    limit: 20,
    random: seededRandom(17),
  });

  assert.ok(result.patterns.includes("55500"));
  assert.ok(result.patterns.length > 0);
  assert.ok(result.patterns.every((pattern) => /^5..00$/.test(pattern)));
  assert.ok(result.patterns.every((pattern) => siteswapIsValid(pattern)));
  assert.ok(result.patterns.every((pattern) => siteswapBallCount(pattern) === 3));
});

test("synchronous masks complete multiplex packets on their two-beat clock", () => {
  const result = completeSiteswapMask({
    mask: "([??],?)(0,0)([22],2)",
    objectCount: 3,
    maximumThrow: 4,
    limit: 20,
    random: seededRandom(4),
  });

  assert.ok(result.patterns.includes("([44],4)(0,0)([22],2)"));
  assert.ok(result.patterns.every((pattern) => readSiteswap(pattern).timing === "sync"));
  assert.ok(result.patterns.every((pattern) => siteswapIsValid(pattern)));
});

test("hybrid masks interleave one-hand beats and two-hand packets", () => {
  const result = completeSiteswapMask({
    mask: "?(?,?)?",
    objectCount: 3,
    maximumThrow: 5,
    limit: 100,
    random: seededRandom(9),
  });

  assert.ok(result.patterns.includes("5(2,4)1"));
  assert.ok(result.patterns.length > 0);
  assert.ok(result.patterns.every((pattern) => readSiteswap(pattern).timing === "hybrid"));
  assert.ok(result.patterns.every((pattern) => siteswapIsValid(pattern)));
});

test("hybrid random completion can require active throws in both rhythm families", () => {
  const result = completeSiteswapMask({
    mask: "(?,?)???",
    objectCount: 3,
    maximumThrow: 7,
    limit: 24,
    random: seededRandom(17),
    requireActiveRhythms: true,
  });

  assert.ok(result.patterns.length > 0);
  for (const pattern of result.patterns) {
    const frames = readSiteswap(pattern).frames;
    const frameIsActive = (frame) => {
      const tokens = frame.kind === "sync" ? [...frame.left, ...frame.right] : frame.throws;
      return tokens.some((token) => (typeof token === "number" ? token : token.height) > 0);
    };
    assert.ok(frames.some((frame) => frame.kind === "sync" && frameIsActive(frame)));
    assert.ok(frames.some((frame) => frame.kind === "async" && frameIsActive(frame)));
  }
});

test("hybrid masks admit odd throws and suppressed synchronous beats", () => {
  const result = completeSiteswapMask({
    mask: "(0,?)!(?,0)!(0,?)!(?,0)!",
    objectCount: 4,
    maximumThrow: 5,
    limit: 100,
    random: seededRandom(12),
  });

  assert.ok(result.patterns.includes("(0,5)!(5,0)!(0,5)!(1,0)!"));
  assert.ok(result.patterns.every((pattern) => readSiteswap(pattern).timing === "hybrid"));
  assert.ok(result.patterns.every((pattern) => siteswapIsValid(pattern)));
});

test("generation masks have the requested base-beat period and rhythm", () => {
  assert.equal(createGenerationMask({ timing: "async", periodBeats: 5 }), "?????");
  assert.equal(createGenerationMask({ timing: "sync", periodBeats: 6 }), "(?,?)(?,?)(?,?)");
  const hybrid = createGenerationMask({
    timing: "hybrid",
    periodBeats: 5,
    random: seededRandom(2),
  });
  assert.equal([...hybrid].filter((character) => character === "?").length, 5);
  assert.match(hybrid, /\(\?,\?\)/);
});

test("seeded completion order is reproducible and an impossible mask is explicit", () => {
  const request = {
    mask: "????",
    objectCount: 3,
    maximumThrow: 6,
    limit: 8,
  };
  const first = completeSiteswapMask({ ...request, random: seededRandom(44) });
  const second = completeSiteswapMask({ ...request, random: seededRandom(44) });
  assert.deepEqual(first.patterns, second.patterns);

  const impossible = completeSiteswapMask({
    mask: "000",
    objectCount: 3,
    maximumThrow: 5,
  });
  assert.deepEqual(impossible.patterns, []);
  assert.equal(impossible.status, "unsatisfiable");
});

test("search budget counts at most the declared number of search states", () => {
  const result = completeSiteswapMask({
    mask: "??????",
    objectCount: 3,
    maximumThrow: 9,
    limit: 100,
    searchBudget: 3,
    random: seededRandom(2),
  });

  assert.equal(result.status, "budget-exhausted");
  assert.ok(result.visited <= 3);
});

test("structural features separate release concentration from throw count", () => {
  const asynchronous = siteswapFeatures("55500", true);
  const synchronous = siteswapFeatures("([44],4)(0,0)([22],2)", true);
  const hybrid = siteswapFeatures("5(2,4)1", true);

  assert.equal(asynchronous.timing, "async");
  assert.equal(asynchronous.maximumReleasePacket, 1);
  assert.equal(asynchronous.maximumEmptyPacketRun, 2);
  assert.equal(synchronous.timing, "sync");
  assert.equal(synchronous.maximumReleasePacket, 3);
  assert.equal(synchronous.zeroPacketShare, 1 / 3);
  assert.equal(synchronous.maximumEmptyPacketRun, 1);
  assert.equal(hybrid.timing, "hybrid");
  assert.equal(hybrid.periodBeats, 4);
  assert.equal(hybrid.objectCount, 3);
  assert.equal(hybrid.maximumTossPacket, 2);
  assert.equal(hybrid.maximumReleasePacket, 1);
  assert.equal(hybrid.maximumEmptyPacketRun, 0);
});
