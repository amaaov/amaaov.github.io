import { MIXED_SIGN, occupancyState } from "./holding.js";
import { scheduleEvents, siteswapHighest, siteswapPeriod } from "./siteswap.js";

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

export function playbackWindowBeats(input, holdTwos = true) {
  if (input == null || input === "") {
    return 48;
  }
  try {
    return scheduleEvents(input, holdTwos, 1).cycleLength;
  } catch {
    return 48;
  }
}

export function playbackTimeBeat(elapsedBeats, { reverse = false, windowBeats = 48 } = {}) {
  const span = windowBeats > 0 ? windowBeats : 48;
  const forward = ((elapsedBeats % span) + span) % span;
  if (!reverse) {
    return forward;
  }
  return (span - forward) % span;
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
  const schedule = scheduleEvents(input, holdTwos, Math.ceil(timeBeat) + highest + 2);
  const heldFlags = holdingFlagsAtTime(schedule, timeBeat, dwellRatio, holdTwos);
  const held = heldFlags.filter(Boolean).length;
  return { held, airborne: schedule.ballCount - held, ballCount: schedule.ballCount, heldFlags };
}

export function holdingFlagsAtTime(schedule, timeBeat, dwellRatio, holdTwos = true) {
  const { events, ballCount } = schedule;
  const phaseByBall = new Map();
  for (const event of events) {
    const phase = eventPhase(event, timeBeat, dwellRatio, holdTwos);
    if (phase) {
      phaseByBall.set(event.ball, phase);
    }
  }
  return Array.from({ length: ballCount }, (_, ball) => phaseByBall.get(ball) !== "air");
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
  const start = period * 4;
  const end = start + durationBeats;
  const samples = [];
  for (let timeBeat = start; timeBeat <= end + 1e-9; timeBeat += step) {
    const occupancy = occupancyAtTime(input, timeBeat, dwellRatio, holdTwos);
    samples.push({
      timeBeat,
      held: occupancy.held,
      airborne: occupancy.airborne,
      state: occupancyState(occupancy.heldFlags),
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
