import { EMPTY_SIGN, occupancyState } from "./holding.js";
import { scheduleEvents, siteswapBallCount, siteswapIsValid } from "./siteswap.js";
import { eventPhase, maxThrow, throwFlight } from "./schedule.js";

const COURT_PEAK_LIFT = 0.56;
const MULTIPLEX_SPREAD = 0.038;
const EMPTY_RECOVER_BEATS = 1.15;

function gravityForFlight(flight) {
  const duration = Math.max(flight, 0.25);
  return (COURT_PEAK_LIFT * 8) / (duration * duration);
}

function ballisticPoint(from, to, progress, gravity, flight, wind = { x: 0, y: 0 }) {
  const lift = 0.5 * gravity * flight * flight * (progress - progress * progress);
  const gust = 4 * progress * (1 - progress);
  return {
    x: from.x + (to.x - from.x) * progress + (wind.x ?? 0) * gust,
    y: from.y + (to.y - from.y) * progress - lift + (wind.y ?? 0) * gust,
  };
}

function catchPose(hands, hand) {
  const rest = hands[hand];
  const outward = hand === 0 ? -0.045 : 0.045;
  return { x: rest.x + outward, y: rest.y - 0.045 };
}

function throwPose(hands, hand) {
  const rest = hands[hand];
  const inward = hand === 0 ? 0.05 : -0.05;
  return { x: rest.x + inward, y: rest.y + 0.02 };
}

function holdIdlePose(hands, hand, timeBeat) {
  const rest = catchPose(hands, hand);
  const side = hand === 0 ? -1 : 1;
  const sway = 0.008 * Math.sin(Math.PI * timeBeat);
  return {
    x: rest.x + side * sway,
    y: rest.y + 0.005 * Math.sin(Math.PI * timeBeat + 0.5),
  };
}

function mixPoses(from, to, blend) {
  return {
    x: from.x + (to.x - from.x) * blend,
    y: from.y + (to.y - from.y) * blend,
  };
}

function easeInOut(progress) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function dwellPoint(from, to, progress) {
  const eased = easeInOut(progress);
  const travel = Math.hypot(to.x - from.x, to.y - from.y);
  const scoop = Math.min(0.025, travel * 0.35) * Math.sin(Math.PI * Math.min(Math.max(progress, 0), 1));
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased + scoop,
  };
}

function isLeavingToss(event) {
  return !event.hold && event.height > 0;
}

function nextEventForBall(events, event) {
  const landing = event.beat + event.height;
  for (const other of events) {
    if (other.ball === event.ball && other.beat === landing) {
      return other;
    }
  }
  return null;
}

function holdCarryPose(hands, hand, timeBeat, events) {
  const idle = holdIdlePose(hands, hand, timeBeat);
  const throwAt = throwPose(hands, hand);
  const blendWindow = 0.55;
  let lastRelease = -Infinity;
  let nextRelease = Infinity;
  for (const event of events) {
    if (event.fromHand !== hand || !isLeavingToss(event)) {
      continue;
    }
    if (event.beat <= timeBeat && event.beat >= lastRelease) {
      lastRelease = event.beat;
    }
    if (event.beat > timeBeat && event.beat < nextRelease) {
      nextRelease = event.beat;
    }
  }
  const since = timeBeat - lastRelease;
  const until = nextRelease - timeBeat;
  let blend = 0;
  if (since >= 0 && since < blendWindow) {
    blend = 1 - since / blendWindow;
  }
  if (until >= 0 && until < blendWindow) {
    blend = Math.max(blend, 1 - until / blendWindow);
  }
  return mixPoses(idle, throwAt, easeInOut(blend));
}

function catchTimeOf(event, dwellRatio, holdTwos) {
  if (event.hold) {
    return event.beat;
  }
  return event.beat + throwFlight(event.height, dwellRatio, holdTwos);
}

function emptyHandPose(hands, hand, timeBeat, events, dwellRatio, holdTwos) {
  let lastThrowBeat = -Infinity;
  let nextCatchTime = Infinity;
  for (const event of events) {
    if (event.height === 0) {
      continue;
    }
    if (
      isLeavingToss(event) &&
      event.fromHand === hand &&
      event.beat <= timeBeat &&
      event.beat >= lastThrowBeat
    ) {
      lastThrowBeat = event.beat;
    }
    const catchTime = catchTimeOf(event, dwellRatio, holdTwos);
    if (event.toHand === hand && catchTime > timeBeat && catchTime < nextCatchTime) {
      nextCatchTime = catchTime;
    }
  }
  if (lastThrowBeat === -Infinity) {
    return { x: hands[hand].x, y: hands[hand].y };
  }
  const vacantEnd = Number.isFinite(nextCatchTime) ? nextCatchTime : lastThrowBeat + EMPTY_RECOVER_BEATS;
  const recoverFor = Math.min(Math.max(vacantEnd - lastThrowBeat, 1e-6), EMPTY_RECOVER_BEATS);
  const progress = Math.min(Math.max((timeBeat - lastThrowBeat) / recoverFor, 0), 1);
  return dwellPoint(throwPose(hands, hand), catchPose(hands, hand), progress);
}

function flagsFromCounts(held, ballCount) {
  return Array.from({ length: ballCount }, (_, index) => index < held);
}

function spreadHeldInHand(positions) {
  const groups = [[], []];
  for (const position of positions) {
    if (position.held) {
      groups[position.hand].push(position);
    }
  }
  for (const group of groups) {
    if (group.length < 2) {
      continue;
    }
    group.forEach((position, slot) => {
      position.x += (slot - (group.length - 1) / 2) * MULTIPLEX_SPREAD;
    });
  }
}

const DEFAULT_HANDS = [
  { x: 0.32, y: 0.82 },
  { x: 0.68, y: 0.82 },
];

export function emptyCourtPicture(hands = DEFAULT_HANDS) {
  return {
    positions: [],
    hands: hands.map((hand) => ({ x: hand.x, y: hand.y })),
    state: EMPTY_SIGN,
    held: 0,
    airborne: 0,
    ballCount: 0,
    heldFlags: [],
  };
}

export function courtPicture(options) {
  const input = options.source ?? options.throws;
  if (input == null || !siteswapIsValid(input)) {
    return emptyCourtPicture(options.hands);
  }
  return trajectoryPositions(options);
}

export function trajectoryPositions({
  source,
  throws,
  dwellRatio,
  holdTwos = true,
  timeBeat,
  gravityScale = 1,
  wind = { x: 0, y: 0 },
  hands = [
    { x: 0.32, y: 0.82 },
    { x: 0.68, y: 0.82 },
  ],
}) {
  const input = source ?? throws;
  const ballCount = siteswapBallCount(input);
  const highest = maxThrow(input);
  const { events } = scheduleEvents(input, holdTwos, Math.ceil(timeBeat) + highest + 2);
  const positions = Array.from({ length: ballCount }, (_, index) => ({
    x: hands[index % 2].x,
    y: hands[index % 2].y,
    held: true,
    hand: index % 2,
  }));
  const handNow = hands.map((hand) => ({ x: hand.x, y: hand.y }));
  const occupied = [false, false];
  const maxFlight = events.reduce((longest, event) => {
    return Math.max(longest, throwFlight(event.height, dwellRatio, holdTwos));
  }, 0.3);
  const gravity = gravityForFlight(maxFlight) / Math.max(0.35, gravityScale);

  for (const event of events) {
    const phase = eventPhase(event, timeBeat, dwellRatio, holdTwos);
    if (!phase) {
      continue;
    }
    const flight = throwFlight(event.height, dwellRatio, holdTwos);
    const throwTime = event.beat;
    const catchTime = catchTimeOf(event, dwellRatio, holdTwos);
    const nextThrow = throwTime + event.height;
    const from = throwPose(hands, event.fromHand);
    const to = catchPose(hands, event.toHand);
    if (phase === "air") {
      const progress = (timeBeat - throwTime) / Math.max(flight, 1e-6);
      const point = ballisticPoint(from, to, progress, gravity, flight, wind);
      positions[event.ball] = { x: point.x, y: point.y, held: false, hand: event.fromHand };
    } else if (event.hold) {
      const point = holdCarryPose(hands, event.toHand, timeBeat, events);
      positions[event.ball] = { x: point.x, y: point.y, held: true, hand: event.toHand };
      handNow[event.toHand] = point;
      occupied[event.toHand] = true;
    } else {
      const dwell = Math.max(nextThrow - catchTime, 1e-6);
      const progress = (timeBeat - catchTime) / dwell;
      const following = nextEventForBall(events, event);
      const carryTo = following?.hold
        ? holdIdlePose(hands, event.toHand, nextThrow)
        : throwPose(hands, event.toHand);
      const point = dwellPoint(to, carryTo, Math.min(progress, 1));
      positions[event.ball] = { x: point.x, y: point.y, held: true, hand: event.toHand };
      handNow[event.toHand] = point;
      occupied[event.toHand] = true;
    }
  }

  spreadHeldInHand(positions);

  for (let hand = 0; hand < 2; hand += 1) {
    if (!occupied[hand]) {
      handNow[hand] = emptyHandPose(hands, hand, timeBeat, events, dwellRatio, holdTwos);
    }
  }

  const heldFlags = positions.map((position) => position.held);
  const held = heldFlags.filter(Boolean).length;
  return {
    positions,
    hands: handNow,
    state: occupancyState(flagsFromCounts(held, ballCount)),
    held,
    airborne: ballCount - held,
    ballCount,
    heldFlags,
  };
}
