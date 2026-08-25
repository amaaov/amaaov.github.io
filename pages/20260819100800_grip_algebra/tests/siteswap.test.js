import assert from "node:assert/strict";
import test from "node:test";
import {
  parseHybridSiteswap,
  parseSiteswap,
  parseSyncSiteswap,
  parseVanillaSiteswap,
  readSiteswap,
  scheduleEvents,
  siteswapBallCount,
  siteswapIsValid,
  siteswapPeriod,
} from "../siteswap.js";
import {
  cascadeStaysMixed,
  dwellBeats,
  flightBeats,
  sampleOccupancy,
  shannonMeanHeld,
  throwFlight,
} from "../schedule.js";
import { courtPicture, trajectoryPositions } from "../toss.js";
import { EMPTY_SIGN, HOLD_SIGN, MIXED_SIGN, AIRBORNE_SIGN } from "../holding.js";

const THREE_UP_HOLD =
  "([26x],2)(2,6x)(6x,0)(0,2)(2,2)(2,[22])(2,[26x])(6x,2)(0,6x)(2,0)(2,2)([22],2)";

const HOLD_FLASH_THREE = "[25]550022[22]2";
const HOLD_FLASH_FOUR = "[27][27]7700022[22][22]";
const HOLD_FLASH_FIVE = "[229][29][29]99000022[22][22][222][22]";

test("vanilla parser reads digits and 55500", () => {
  assert.deepEqual(parseVanillaSiteswap("3"), [3]);
  assert.deepEqual(parseVanillaSiteswap("20"), [2, 0]);
  assert.deepEqual(parseVanillaSiteswap("02"), [0, 2]);
  assert.deepEqual(parseVanillaSiteswap("55500"), [5, 5, 5, 0, 0]);
  assert.deepEqual(parseVanillaSiteswap("55500522"), [5, 5, 5, 0, 0, 5, 2, 2]);
  assert.deepEqual(parseVanillaSiteswap("a"), [10]);
});

test("parser reads multiplex 55500[22]2 and [55]5000[22]2 as per-beat toss lists", () => {
  assert.deepEqual(parseSiteswap("55500[22]2"), [[5], [5], [5], [0], [0], [2, 2], [2]]);
  assert.deepEqual(parseSiteswap("[55]5000[22]2"), [[5, 5], [5], [0], [0], [0], [2, 2], [2]]);
  assert.deepEqual(parseSiteswap("555001[22]2[23]"), [[5], [5], [5], [0], [0], [1], [2, 2], [2], [2, 3]]);
  assert.deepEqual(parseSiteswap("5550022[22]2[25]22"), [[5], [5], [5], [0], [0], [2], [2], [2, 2], [2], [2, 5], [2], [2]]);
  assert.deepEqual(parseSiteswap("02"), [[0], [2]]);
});

test("parser reads the synchronous dump-rest-hold cycle as left and right pairs", () => {
  assert.deepEqual(parseSyncSiteswap("([44],4)(0,0)([22],2)"), [
    {
      left: [
        { height: 4, crossing: false },
        { height: 4, crossing: false },
      ],
      right: [{ height: 4, crossing: false }],
    },
    { left: [{ height: 0, crossing: false }], right: [{ height: 0, crossing: false }] },
    {
      left: [
        { height: 2, crossing: false },
        { height: 2, crossing: false },
      ],
      right: [{ height: 2, crossing: false }],
    },
  ]);
});

test("parser reads sync crossing 6x and multiplex [26x] as a crossing six with a hold", () => {
  const pairs = parseSyncSiteswap("([26x],2)(2,6x)");
  assert.deepEqual(pairs[0].left, [
    { height: 2, crossing: false },
    { height: 6, crossing: true },
  ]);
  assert.deepEqual(pairs[0].right, [{ height: 2, crossing: false }]);
  assert.deepEqual(pairs[1].right, [{ height: 6, crossing: true }]);
  assert.deepEqual(parseSyncSiteswap("(1x,1x)")[0], {
    left: [{ height: 1, crossing: false }],
    right: [{ height: 1, crossing: false }],
  });
});

test("hybrid packet notation shares one beat clock across async and sync frames", () => {
  assert.deepEqual(parseHybridSiteswap("5(2,4)1"), [
    { kind: "async", duration: 1, throws: [5] },
    {
      kind: "sync",
      duration: 2,
      left: [{ height: 2, crossing: false }],
      right: [{ height: 4, crossing: false }],
    },
    { kind: "async", duration: 1, throws: [1] },
  ]);
  assert.equal(readSiteswap("5(2,4)1").timing, "hybrid");
  assert.equal(siteswapPeriod("5(2,4)1"), 4);
  assert.equal(siteswapBallCount("5(2,4)1"), 3);
  assert.equal(siteswapIsValid("5(2,4)1"), true);

  const live = scheduleEvents("5(2,4)1", true, 8).events.filter(
    (event) => event.beat >= 0 && event.beat < 4,
  );
  assert.deepEqual(
    live.map(({ beat, height, fromHand }) => ({ beat, height, fromHand })),
    [
      { beat: 0, height: 5, fromHand: 1 },
      { beat: 1, height: 2, fromHand: 0 },
      { beat: 1, height: 4, fromHand: 1 },
      { beat: 3, height: 1, fromHand: 0 },
    ],
  );
});

test("suppressed sync spacers import Juggling Lab mixed timing", () => {
  const source = "(0,5)!(5,0)!(0,5)!(1,0)!";
  const frames = parseHybridSiteswap(source);
  assert.ok(frames.every((frame) => frame.kind === "sync" && frame.duration === 1));
  assert.equal(readSiteswap(source).timing, "hybrid");
  assert.equal(siteswapPeriod(source), 4);
  assert.equal(siteswapBallCount(source), 4);
  assert.equal(siteswapIsValid(source), true);
});

test("validity is a total predicate for malformed source text", () => {
  assert.equal(siteswapIsValid(""), false);
  assert.equal(siteswapIsValid("("), false);
  assert.equal(siteswapIsValid("[3"), false);
  assert.equal(siteswapIsValid("?"), false);
});

test("ball count is the throw average, including multiplex", () => {
  assert.equal(siteswapBallCount([3]), 3);
  assert.equal(siteswapBallCount([0, 2]), 1);
  assert.equal(siteswapBallCount([5, 5, 5, 0, 0]), 3);
  assert.equal(siteswapBallCount("[22]2"), 3);
  assert.equal(siteswapBallCount("55500522"), 3);
  assert.equal(siteswapBallCount("555001[22]2[23]"), 3);
  assert.equal(siteswapBallCount("5550022[22]2[25]22"), 3);
  assert.equal(siteswapBallCount("55500[22]2"), 3);
  assert.equal(siteswapBallCount("[55]5000[22]2"), 3);
  assert.equal(siteswapBallCount("([44],4)(0,0)([22],2)"), 3);
  assert.equal(siteswapBallCount(THREE_UP_HOLD), 3);
  assert.equal(siteswapBallCount(HOLD_FLASH_THREE), 3);
  assert.equal(siteswapBallCount(HOLD_FLASH_FOUR), 4);
  assert.equal(siteswapBallCount(HOLD_FLASH_FIVE), 5);
});

test("collision rule accepts 02, 3, 55500, [22]2, 55500522, [55]5000[22]2 and rejects 76, 55500[22]2, and 555002[22]", () => {
  assert.equal(siteswapIsValid("02"), true);
  assert.equal(siteswapIsValid([3]), true);
  assert.equal(siteswapIsValid([5, 5, 5, 0, 0]), true);
  assert.equal(siteswapIsValid("[22]2"), true);
  assert.equal(siteswapIsValid("2[22]"), true);
  assert.equal(siteswapIsValid("55500522"), true);
  assert.equal(siteswapIsValid("555001[22]2[23]"), true);
  assert.equal(siteswapIsValid("5550022[22]2[25]22"), true);
  assert.equal(siteswapIsValid("[55]5000[22]2"), true);
  assert.equal(siteswapIsValid("([44],4)(0,0)([22],2)"), true);
  assert.equal(siteswapIsValid(THREE_UP_HOLD), true);
  assert.equal(siteswapIsValid(HOLD_FLASH_THREE), true);
  assert.equal(siteswapIsValid(HOLD_FLASH_FOUR), true);
  assert.equal(siteswapIsValid(HOLD_FLASH_FIVE), true);
  assert.equal(siteswapIsValid("[25]550022[22]2[22]2"), true);
  assert.equal(siteswapIsValid("55500[22]2"), false);
  assert.equal(siteswapIsValid("555002[22]"), false);
  assert.equal(siteswapIsValid([7, 6]), false);
});

test("flight time follows Ploeger: a - 2r in beat units", () => {
  assert.equal(flightBeats(3, 0.75), 1.5);
  assert.equal(dwellBeats(0.75), 1.5);
  assert.equal(flightBeats(2, 0.75), 0.5);
  assert.equal(flightBeats(2, 1), 0);
  assert.equal(throwFlight(3, 0.75, true), 1.5);
  assert.equal(throwFlight(3, 0, true), 3);
  assert.equal(throwFlight(3, 1, true), 1);
  assert.ok(flightBeats(1, 0.7) < 0);
  assert.ok(throwFlight(1, 0.7, true) >= 0.5);
});

test("Shannon mean held objects equals hands times dwell ratio", () => {
  assert.equal(shannonMeanHeld(2, 0.75), 1.5);
  assert.equal(shannonMeanHeld(2, 0.5), 1);
});

test("siteswap 02 with hold convention stays K", () => {
  const samples = sampleOccupancy({
    source: "02",
    dwellRatio: 0.75,
    holdTwos: true,
    durationBeats: 24,
  });
  assert.ok(samples.every((sample) => sample.state === HOLD_SIGN));
});

test("siteswap 2[22] with hold convention stays K on three objects", () => {
  const samples = sampleOccupancy({
    source: "2[22]",
    dwellRatio: 0.75,
    holdTwos: true,
    durationBeats: 24,
  });
  assert.ok(samples.every((sample) => sample.state === HOLD_SIGN));
  assert.ok(samples.every((sample) => sample.held === 3));
});

test("siteswap 3 with r >= 1/2 stays AK almost everywhere", () => {
  assert.equal(cascadeStaysMixed(0.75), true);
  assert.equal(cascadeStaysMixed(0.5), true);
  assert.equal(cascadeStaysMixed(0.4), false);
});

test("cascade occupancy still runs at zero dwell and at full dwell", () => {
  const none = sampleOccupancy({
    throws: [3],
    dwellRatio: 0,
    holdTwos: true,
    durationBeats: 8,
  });
  assert.ok(none.some((sample) => sample.state === AIRBORNE_SIGN));
  assert.ok(none.every((sample) => sample.held + sample.airborne === 3));
  const full = sampleOccupancy({
    throws: [3],
    dwellRatio: 1,
    holdTwos: true,
    durationBeats: 8,
  });
  assert.ok(full.every((sample) => sample.held + sample.airborne === 3));
  assert.ok(full.some((sample) => sample.held >= 1));
});

test("periodic 55500 visits AK and A", () => {
  const samples = sampleOccupancy({
    source: "55500",
    dwellRatio: 0.75,
    holdTwos: true,
    durationBeats: 20,
  });
  const states = new Set(samples.map((sample) => sample.state));
  assert.ok(states.has(MIXED_SIGN));
  assert.ok(states.has(AIRBORNE_SIGN));
});

test("[22]2 schedules three props and a same-hand multiplex hold", () => {
  const { events, ballCount } = scheduleEvents("[22]2", true, 8);
  assert.equal(ballCount, 3);
  const live = events.filter((event) => event.beat >= 0);
  const grouped = new Map();
  for (const event of live) {
    const group = grouped.get(event.beat) ?? [];
    group.push(event);
    grouped.set(event.beat, group);
  }
  const multiplex = [...grouped.values()].find((group) => group.length === 2);
  assert.ok(multiplex);
  assert.equal(multiplex[0].fromHand, multiplex[1].fromHand);
  assert.ok(multiplex.every((event) => event.hold));

  const pictured = trajectoryPositions({
    source: "[22]2",
    dwellRatio: 0.7,
    holdTwos: true,
    timeBeat: multiplex[0].beat + 0.4,
  });
  assert.equal(pictured.positions.length, 3);
  const heldInHand = pictured.positions.filter(
    (position) => position.held && position.hand === multiplex[0].fromHand,
  );
  assert.equal(heldInHand.length, 2);
  assert.ok(Math.abs(heldInHand[0].x - heldInHand[1].x) > 0.02);
});

test("5550022[22]2[25]22 flashes then holds all three", () => {
  const samples = sampleOccupancy({
    source: "5550022[22]2[25]22",
    dwellRatio: 0.7,
    holdTwos: true,
    durationBeats: 48,
  });
  const states = new Set(samples.map((sample) => sample.state));
  assert.ok(states.has(HOLD_SIGN));
  assert.ok(states.has(AIRBORNE_SIGN));
  assert.ok(states.has(MIXED_SIGN));
  assert.ok(samples.some((sample) => sample.held === 0));
  assert.ok(samples.some((sample) => sample.held === 3));
});

test("555001[22]2[23] flashes then holds all three", () => {
  const samples = sampleOccupancy({
    source: "555001[22]2[23]",
    dwellRatio: 0.7,
    holdTwos: true,
    durationBeats: 48,
  });
  const states = new Set(samples.map((sample) => sample.state));
  assert.ok(states.has(HOLD_SIGN));
  assert.ok(states.has(AIRBORNE_SIGN));
  assert.ok(states.has(MIXED_SIGN));
  assert.ok(samples.some((sample) => sample.held === 0));
  assert.ok(samples.some((sample) => sample.held === 3));
});

test("55500522 flashes then holds two", () => {
  const samples = sampleOccupancy({
    source: "55500522",
    dwellRatio: 0.7,
    holdTwos: true,
    durationBeats: 40,
  });
  const states = new Set(samples.map((sample) => sample.state));
  assert.ok(states.has(AIRBORNE_SIGN));
  assert.ok(states.has(MIXED_SIGN));
  assert.ok(samples.some((sample) => sample.held === 0));
  assert.ok(samples.some((sample) => sample.held === 2));
});

test("async hold-flash-hold cycles walk hold, Polymorphy, and classic flash", () => {
  const family = [
    { source: HOLD_FLASH_THREE, objects: 3, height: 5 },
    { source: HOLD_FLASH_FOUR, objects: 4, height: 7 },
    { source: HOLD_FLASH_FIVE, objects: 5, height: 9 },
  ];
  for (const { source, objects, height } of family) {
    const period = siteswapPeriod(source);
    const samples = sampleOccupancy({
      source,
      dwellRatio: 0.75,
      holdTwos: true,
      durationBeats: period * 3,
    });
    const states = new Set(samples.map((sample) => sample.state));
    assert.deepEqual(states, new Set([HOLD_SIGN, MIXED_SIGN, AIRBORNE_SIGN]), source);
    assert.ok(samples.some((sample) => sample.state === HOLD_SIGN && sample.held === objects), source);
    assert.ok(samples.some((sample) => sample.state === AIRBORNE_SIGN && sample.held === 0), source);
    const { events } = scheduleEvents(source, true, period);
    const leaving = events.filter(
      (event) => event.beat >= 0 && event.beat < period && event.height > 0 && !event.hold,
    );
    assert.equal(leaving.length, objects, source);
    assert.ok(leaving.every((event) => event.height === height), source);
  }
});

test("[55]5000[22]2 visits all-held and all-airborne occupancy", () => {
  const samples = sampleOccupancy({
    source: "[55]5000[22]2",
    dwellRatio: 0.7,
    holdTwos: true,
    durationBeats: 40,
  });
  const states = new Set(samples.map((sample) => sample.state));
  assert.ok(states.has(HOLD_SIGN));
  assert.ok(states.has(AIRBORNE_SIGN));
  assert.ok(samples.some((sample) => sample.held === 3));
  assert.ok(samples.some((sample) => sample.held === 0));
});

test("one-by-one flash-hold loops walk hold, Polymorphy, and flash", () => {
  const loops = [
    { source: "(2,2)(4x,2)(0,4x)(0,2)", objects: 2 },
    { source: THREE_UP_HOLD, objects: 3 },
    {
      source: "([22],[22])([28x],[22])(6x,[22])(0,[26x])(0,6x)(0,[22])(2,[22])",
      objects: 4,
    },
  ];
  for (const { source, objects } of loops) {
    assert.equal(siteswapIsValid(source), true, source);
    assert.equal(siteswapBallCount(source), objects, source);
    const samples = sampleOccupancy({
      source,
      dwellRatio: 0.75,
      holdTwos: true,
      durationBeats: siteswapPeriod(source) * 3,
    });
    const states = new Set(samples.map((sample) => sample.state));
    assert.deepEqual(states, new Set([HOLD_SIGN, MIXED_SIGN, AIRBORNE_SIGN]), source);
    assert.ok(samples.some((sample) => sample.state === HOLD_SIGN && sample.held === objects), source);
    assert.ok(samples.some((sample) => sample.state === AIRBORNE_SIGN && sample.held === 0), source);
    const period = siteswapPeriod(source);
    const { events } = scheduleEvents(source, true, period);
    const releases = events.filter(
      (event) => event.beat >= 0 && event.beat < period && event.height > 0 && !event.hold,
    );
    assert.ok(releases.length >= objects, source);
    assert.ok(
      releases.every((event) => event.fromHand !== event.toHand),
      source,
    );
    const releasesOnBeat = new Map();
    for (const event of releases) {
      releasesOnBeat.set(event.beat, (releasesOnBeat.get(event.beat) ?? 0) + 1);
    }
    assert.ok(
      [...releasesOnBeat.values()].every((count) => count === 1),
      source,
    );
  }
});

test("synchronous hold-flash cycle visits only hold and flash", () => {
  const source = "([22],2)([44],4)(0,0)";
  assert.equal(siteswapIsValid(source), true);
  const samples = sampleOccupancy({
    source,
    dwellRatio: 0.75,
    holdTwos: true,
    durationBeats: 24,
  });
  const states = new Set(samples.map((sample) => sample.state));
  assert.deepEqual(states, new Set([HOLD_SIGN, AIRBORNE_SIGN]));
  assert.equal(samples[0].state, HOLD_SIGN);
  assert.ok(samples.some((sample) => sample.held === 3));
  assert.ok(samples.some((sample) => sample.held === 0));
});

test("synchronous ([44],4)(0,0)([22],2) dumps all three, rests empty, then holds all three", () => {
  const samples = sampleOccupancy({
    source: "([44],4)(0,0)([22],2)",
    dwellRatio: 0.7,
    holdTwos: true,
    durationBeats: 24,
  });
  const states = new Set(samples.map((sample) => sample.state));
  assert.ok(states.has(HOLD_SIGN));
  assert.ok(states.has(AIRBORNE_SIGN));
  assert.ok(samples.some((sample) => sample.held === 3));
  assert.ok(samples.some((sample) => sample.held === 0));
  const { events, ballCount } = scheduleEvents("([44],4)(0,0)([22],2)", true, 12);
  assert.equal(ballCount, 3);
  const live = events.filter((event) => event.beat >= 0 && event.beat < 6 && event.height > 0);
  const atZero = live.filter((event) => event.beat === 0);
  const atFour = live.filter((event) => event.beat === 4);
  assert.equal(atZero.length, 3);
  assert.ok(atZero.every((event) => event.height === 4));
  assert.equal(atZero.filter((event) => event.fromHand === 0).length, 2);
  assert.equal(atZero.filter((event) => event.fromHand === 1).length, 1);
  assert.equal(atFour.length, 3);
  assert.ok(atFour.every((event) => event.hold));
});

test("synchronous 3-up-hold cycle visits three in the air and three held", () => {
  assert.equal(siteswapIsValid(THREE_UP_HOLD), true);
  const samples = sampleOccupancy({
    source: THREE_UP_HOLD,
    dwellRatio: 0.7,
    holdTwos: true,
    durationBeats: 48,
  });
  const states = new Set(samples.map((sample) => sample.state));
  assert.ok(states.has(HOLD_SIGN));
  assert.ok(states.has(AIRBORNE_SIGN));
  assert.ok(states.has(MIXED_SIGN));
  assert.ok(samples.some((sample) => sample.held === 3));
  assert.ok(samples.some((sample) => sample.held === 0));
  const { events, ballCount } = scheduleEvents(THREE_UP_HOLD, true, 24);
  assert.equal(ballCount, 3);
  assert.ok(events.some((event) => event.height === 6 && event.fromHand !== event.toHand));
});

test("cascade dwell carries a catch from the outside toward the inside", () => {
  const early = trajectoryPositions({
    throws: [3],
    dwellRatio: 0.7,
    holdTwos: true,
    timeBeat: 25.65,
  });
  const late = trajectoryPositions({
    throws: [3],
    dwellRatio: 0.7,
    holdTwos: true,
    timeBeat: 26.95,
  });
  const start = early.positions[0];
  const end = late.positions[0];
  assert.equal(start.held, true);
  assert.equal(end.held, true);
  assert.equal(start.hand, end.hand);
  assert.ok(Math.abs(end.x - 0.5) < Math.abs(start.x - 0.5) - 0.05);
});

test("02 holding hand stays continuous across a hold boundary", () => {
  const hands = [
    { x: 0.32, y: 0.84 },
    { x: 0.68, y: 0.84 },
  ];
  let previous = null;
  for (let timeBeat = 10; timeBeat <= 14; timeBeat += 0.05) {
    const pictured = trajectoryPositions({
      source: "02",
      dwellRatio: 0.7,
      holdTwos: true,
      timeBeat,
      hands,
    });
    const holding = pictured.hands[pictured.positions[0].hand];
    if (previous !== null) {
      const travel = Math.hypot(holding.x - previous.x, holding.y - previous.y);
      assert.ok(travel < 0.03, `holding hand jumped ${travel} at t=${timeBeat}`);
    }
    previous = holding;
  }
});

test("cascade empty hand recovers after a throw without snapping", () => {
  const hands = [
    { x: 0.32, y: 0.84 },
    { x: 0.68, y: 0.84 },
  ];
  let previous = null;
  for (let timeBeat = 24; timeBeat <= 28; timeBeat += 0.05) {
    const pictured = trajectoryPositions({
      throws: [3],
      dwellRatio: 0.7,
      holdTwos: true,
      timeBeat,
      hands,
    });
    pictured.hands.forEach((hand, index) => {
      if (previous !== null) {
        const travel = Math.hypot(hand.x - previous[index].x, hand.y - previous[index].y);
        assert.ok(travel < 0.03, `hand ${index} jumped ${travel} at t=${timeBeat}`);
      }
    });
    previous = pictured.hands;
  }
});

test("555001[22]2[23] zip 1 is a visible pass, not a teleport", () => {
  const hands = [
    { x: 0.32, y: 0.84 },
    { x: 0.68, y: 0.84 },
  ];
  const { events } = scheduleEvents("555001[22]2[23]", true, 24);
  const zip = events.find((event) => event.height === 1 && event.beat >= 5 && event.beat < 12);
  assert.ok(zip);
  let sawAir = false;
  let previous = null;
  for (let timeBeat = zip.beat - 0.15; timeBeat <= zip.beat + zip.height; timeBeat += 0.05) {
    const pictured = trajectoryPositions({
      source: "555001[22]2[23]",
      dwellRatio: 0.7,
      holdTwos: true,
      timeBeat,
      hands,
    });
    const ball = pictured.positions[zip.ball];
    if (!ball.held) {
      sawAir = true;
    }
    if (previous !== null) {
      const travel = Math.hypot(ball.x - previous.x, ball.y - previous.y);
      assert.ok(travel < 0.1, `zip ball jumped ${travel} at t=${timeBeat}`);
    }
    previous = ball;
  }
  assert.equal(sawAir, true);
});

test("555001[22]2[23] hands stay continuous through the zip and multiplex holds", () => {
  const hands = [
    { x: 0.32, y: 0.84 },
    { x: 0.68, y: 0.84 },
  ];
  let previous = null;
  for (let timeBeat = 4.5; timeBeat <= 10; timeBeat += 0.05) {
    const pictured = trajectoryPositions({
      source: "555001[22]2[23]",
      dwellRatio: 0.7,
      holdTwos: true,
      timeBeat,
      hands,
    });
    pictured.hands.forEach((hand, index) => {
      if (previous !== null) {
        const travel = Math.hypot(hand.x - previous[index].x, hand.y - previous[index].y);
        assert.ok(travel < 0.025, `hand ${index} jumped ${travel} at t=${timeBeat}`);
      }
    });
    previous = pictured.hands;
  }
});

test("cascade 3 balls keep a continuous identity", () => {
  let previous = null;
  for (let timeBeat = 24; timeBeat <= 30; timeBeat += 0.05) {
    const pictured = trajectoryPositions({
      throws: [3],
      dwellRatio: 0.7,
      holdTwos: true,
      timeBeat,
    });
    assert.equal(pictured.positions.length, 3);
    const current = pictured.positions[0];
    if (previous !== null) {
      const travel = Math.hypot(current.x - previous.x, current.y - previous.y);
      assert.ok(travel < 0.18, `ball 0 jumped ${travel} at t=${timeBeat}`);
    }
    previous = current;
  }
});

test("cascade 3 held count matches occupancy lamps", () => {
  for (let timeBeat = 12; timeBeat < 20; timeBeat += 0.1) {
    const pictured = trajectoryPositions({
      throws: [3],
      dwellRatio: 0.7,
      holdTwos: true,
      timeBeat,
    });
    const held = pictured.positions.filter((position) => position.held).length;
    assert.equal(held, pictured.held);
    assert.equal(pictured.positions.length - held, pictured.airborne);
  }
});

test("an unreadable siteswap paints empty hands and no objects", () => {
  const hands = [
    { x: 0.32, y: 0.84 },
    { x: 0.68, y: 0.84 },
  ];
  for (const source of ["", "("]) {
    const pictured = courtPicture({
      source,
      dwellRatio: 0.75,
      holdTwos: true,
      timeBeat: 12,
      hands,
    });
    assert.deepEqual(pictured.positions, []);
    assert.deepEqual(pictured.hands, hands);
    assert.equal(pictured.state, EMPTY_SIGN);
    assert.equal(pictured.held, 0);
    assert.equal(pictured.airborne, 0);
    assert.equal(pictured.ballCount, 0);
  }
});

test("a legal siteswap still paints its objects through courtPicture", () => {
  const pictured = courtPicture({
    source: "3",
    dwellRatio: 0.75,
    holdTwos: true,
    timeBeat: 24,
  });
  assert.equal(pictured.positions.length, 3);
  assert.notEqual(pictured.state, EMPTY_SIGN);
  assert.equal(pictured.valid, true);
});

test("siteswap 3 flight is a Gunswap ballistic: mid-air sits above the chord", () => {
  const dwellRatio = 0.7;
  const pictured = trajectoryPositions({
    throws: [3],
    dwellRatio,
    holdTwos: true,
    timeBeat: 24.4,
  });
  const airborne = pictured.positions.filter((position) => !position.held);
  assert.ok(airborne.length >= 1);
  const hands = [
    { x: 0.32, y: 0.82 },
    { x: 0.68, y: 0.82 },
  ];
  const chord = (hands[0].y + hands[1].y) / 2;
  assert.ok(airborne.every((position) => position.y < chord - 0.04));
});

test("periodic 55500 keeps staggered high throws", () => {
  const peakTimes = [null, null, null];
  const peakHeights = [Infinity, Infinity, Infinity];
  for (let timeBeat = 20; timeBeat <= 28; timeBeat += 0.02) {
    const pictured = trajectoryPositions({
      source: "55500",
      dwellRatio: 0.7,
      holdTwos: true,
      timeBeat,
    });
    pictured.positions.forEach((position, index) => {
      if (!position.held && position.y < peakHeights[index]) {
        peakHeights[index] = position.y;
        peakTimes[index] = timeBeat;
      }
    });
  }
  assert.ok(peakTimes.every((time) => time !== null));
  assert.ok(Math.max(...peakTimes) - Math.min(...peakTimes) > 1);
});
