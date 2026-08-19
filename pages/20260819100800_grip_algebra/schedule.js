import { MIXED_SIGN, occupancyState } from "./holding.js";
import { scheduleEvents, siteswapBallCount, siteswapHighest, siteswapPeriod } from "./siteswap.js";

export function dwellBeats(dwellRatio) {
  return 2 * dwellRatio;
}

export function flightBeats(throwHeight, dwellRatio) {
  return throwHeight - dwellBeats(dwellRatio);
}

export function shannonMeanHeld(hands, dwellRatio) {
  return hands * dwellRatio;
}

const MINIMUM_VISIBLE_FLIGHT = 0.5;

export function throwFlight(throwHeight, dwellRatio, holdTwos) {
  if (throwHeight === 0) {
    return 0;
  }
  if (throwHeight === 2 && holdTwos) {
    return 0;
  }
  const shannon = flightBeats(throwHeight, dwellRatio);
  if (shannon >= MINIMUM_VISIBLE_FLIGHT) {
    return shannon;
  }
  // Shannon D=2r can make a 1 have negative flight; the court still needs a short pass.
  const ceiling = Math.max(throwHeight - 0.15, 0.2);
  return Math.min(MINIMUM_VISIBLE_FLIGHT, ceiling);
}

export function maxThrow(input) {
  return siteswapHighest(input);
}

export function handIndex(beat) {
  return ((Math.floor(beat) % 2) + 2) % 2 === 0 ? 1 : 0;
}

export function eventPhase(event, timeBeat, dwellRatio, holdTwos) {
  const nextThrow = event.beat + event.height;
  if (timeBeat < event.beat || timeBeat >= nextThrow) {
    return null;
  }
  const flight = throwFlight(event.height, dwellRatio, holdTwos);
  if (!event.hold && timeBeat < event.beat + flight) {
    return "air";
  }
  return "hold";
}

export function occupancyAtTime(input, timeBeat, dwellRatio, holdTwos) {
  const highest = maxThrow(input);
  const { events, ballCount } = scheduleEvents(input, holdTwos, Math.ceil(timeBeat) + highest + 2);
  const phaseByBall = new Map();
  for (const event of events) {
    const phase = eventPhase(event, timeBeat, dwellRatio, holdTwos);
    if (phase) {
      phaseByBall.set(event.ball, phase);
    }
  }
  let held = 0;
  let airborne = 0;
  for (let ball = 0; ball < ballCount; ball += 1) {
    if (phaseByBall.get(ball) === "air") {
      airborne += 1;
    } else {
      held += 1;
    }
  }
  return { held, airborne, ballCount };
}

function flagsFromCounts(held, ballCount) {
  return Array.from({ length: ballCount }, (_, index) => index < held);
}

export function sampleOccupancy({
  throws,
  source,
  dwellRatio,
  holdTwos = true,
  durationBeats = 24,
  step = 0.05,
}) {
  const input = source ?? throws;
  const period = siteswapPeriod(input);
  const ballCount = siteswapBallCount(input);
  const start = period * 4;
  const end = start + durationBeats;
  const samples = [];
  for (let timeBeat = start; timeBeat <= end + 1e-9; timeBeat += step) {
    const occupancy = occupancyAtTime(input, timeBeat, dwellRatio, holdTwos);
    samples.push({
      timeBeat,
      held: occupancy.held,
      airborne: occupancy.airborne,
      state: occupancyState(flagsFromCounts(occupancy.held, ballCount)),
    });
  }
  return samples;
}

export function cascadeStaysMixed(dwellRatio) {
  const samples = sampleOccupancy({
    throws: [3],
    dwellRatio,
    holdTwos: true,
    durationBeats: 8,
    step: 0.02,
  });
  const interior = samples.slice(Math.floor(samples.length * 0.05), Math.floor(samples.length * 0.95));
  const mixedShare = interior.filter((sample) => sample.state === MIXED_SIGN).length / interior.length;
  return mixedShare > 0.98;
}

export function cascadeHoldingFlags(timeBeat, dwellRatio) {
  const flight = flightBeats(3, dwellRatio);
  return [0, 1, 2].map((ball) => {
    const local = (((timeBeat - ball) % 3) + 3) % 3;
    return local >= flight;
  });
}
