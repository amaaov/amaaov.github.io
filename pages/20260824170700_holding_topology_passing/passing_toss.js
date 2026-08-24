import { passingOccupancy } from "./passing_occupancy.js";
import { schedulePassingEvents } from "./passing_schedule.js";
import { add, bodyStances, restHands, subtract } from "./passing_space.js";
import { normalizeProp, propSamplePoints } from "./passing_prop.js";
import { bodyRetention, groupRetention } from "./passing_state.js";

const MINIMUM_VISIBLE_FLIGHT = 0.5;

export { restHands };

export function shannonFlight(height, dwellRatio, hold) {
  if (hold || height === 0) {
    return 0;
  }
  return height - 2 * dwellRatio;
}

export function visibleFlight(height, dwellRatio, hold) {
  const shannon = shannonFlight(height, dwellRatio, hold);
  if (shannon <= 0) {
    return 0;
  }
  if (shannon >= MINIMUM_VISIBLE_FLIGHT) {
    return shannon;
  }
  return Math.min(MINIMUM_VISIBLE_FLIGHT, Math.max(height - 0.15, 0.2));
}

function ballisticPoint(from, to, progress, peakLift) {
  const along = add(from, subtract(to, from), progress);
  const lift = 4 * peakLift * progress * (1 - progress);
  return { x: along.x, y: along.y + lift, z: along.z };
}

function eventPhase(event, timeBeat, dwellRatio) {
  const nextThrow = event.beat + event.height;
  if (timeBeat < event.beat || timeBeat >= nextThrow || event.kind === "empty") {
    return null;
  }
  const flight = shannonFlight(event.height, dwellRatio, event.hold);
  if (!event.hold && timeBeat < event.beat + flight) {
    return "air";
  }
  return "hold";
}

export function passingCourtPicture({
  source,
  arrangement = "circle",
  dwellRatio = 0.25,
  holdTwos = true,
  timeBeat = 0,
  prop = "club",
}) {
  const chosenProp = normalizeProp(prop);
  const schedule = schedulePassingEvents(source, holdTwos, Math.ceil(timeBeat) + 16);
  const bodies = bodyStances(schedule.bodyCount, arrangement);
  const hands = restHands(schedule.bodyCount, arrangement);
  const occupancy = passingOccupancy(schedule, dwellRatio);
  const positions = Array.from({ length: schedule.ballCount }, (_, ball) => ({
    ...hands[ball % hands.length],
    held: true,
    ball,
    hand: ball % hands.length,
    pass: false,
    from: null,
    to: null,
    progress: 0,
    height: 0,
    timeBeat,
  }));

  schedule.events.forEach((event) => {
    const phase = eventPhase(event, timeBeat, dwellRatio);
    if (phase === null || event.ball === null) {
      return;
    }
    const from = hands[event.fromHand];
    const to = hands[event.toHand];
    if (phase === "air") {
      const flight = visibleFlight(event.height, dwellRatio, event.hold);
      const progress = (timeBeat - event.beat) / Math.max(flight, 1e-6);
      const peakLift = 0.22 + 0.12 * Math.max(event.height - 2, 0);
      const point = ballisticPoint(from, to, Math.min(Math.max(progress, 0), 1), peakLift);
      positions[event.ball] = {
        ...point,
        held: false,
        ball: event.ball,
        hand: event.fromHand,
        pass: event.pass,
        from,
        to,
        progress: Math.min(Math.max(progress, 0), 1),
        height: event.height,
        timeBeat,
        beat: event.beat,
        hold: event.hold,
        flightBeats: shannonFlight(event.height, dwellRatio, event.hold),
        dwellBeats: 2 * dwellRatio,
      };
      return;
    }
    positions[event.ball] = {
      ...to,
      held: true,
      ball: event.ball,
      hand: event.toHand,
      pass: false,
      from,
      to,
      progress: 1,
      height: event.height,
      timeBeat,
      beat: event.beat,
      hold: event.hold,
      flightBeats: shannonFlight(event.height, dwellRatio, event.hold),
      dwellBeats: 2 * dwellRatio,
    };
  });

  const heldFlags = positions.map((position) => position.held);
  const held = heldFlags.filter(Boolean).length;
  const group = groupRetention(held, schedule.ballCount);
  return {
    positions,
    hands,
    bodies,
    held,
    airborne: group.airborne,
    ballCount: schedule.ballCount,
    bodyCount: schedule.bodyCount,
    heldFlags,
    occupancy,
    passing: schedule.bodyCount > 1,
    prop: chosenProp,
    timeBeat,
    groupSign: group.sign,
    group,
    bodyRetention: bodyRetention(positions, schedule.bodyCount),
    dwellRatio,
    holdTwos,
  };
}

export function pictureWorldPoints(picture) {
  return [
    ...picture.hands,
    ...picture.bodies.map((body) => body.head),
    ...picture.positions.flatMap((position) => propSamplePoints(position, picture)),
  ];
}
