import {
  advanceHands,
  applyRemoveMarks,
  ensureLandingDepth,
  framesOf,
  parkAddedObject,
  readSiteswap,
  rejectIdleLanding,
  scheduleEvents,
  siteswapIsValid,
  tossFromHand,
} from "./siteswap.js";

function linearFrameAt(frames, beat) {
  let offset = 0;
  for (const frame of frames) {
    if (beat === offset) {
      return frame;
    }
    if (beat > offset && beat < offset + frame.duration) {
      return null;
    }
    offset += frame.duration;
  }
  return undefined;
}

function writtenPeriod(frames) {
  return frames.reduce((total, frame) => total + frame.duration, 0);
}

function breakFromError(error, beat) {
  const message = String(error.message ?? error);
  if (message.includes("no prop available")) {
    return { beat, kind: "no-prop" };
  }
  if (message.includes("landing on 0") || message.includes("landing with no toss")) {
    return { beat, kind: "uncaught" };
  }
  return { beat, kind: "collision" };
}

function applyPrelude(available, events, hand, beat, addCount, removeCount, supplyBall) {
  for (let index = 0; index < addCount; index += 1) {
    available[hand].push(supplyBall());
  }
  for (let index = 0; index < removeCount; index += 1) {
    const ball = available[hand].pop();
    if (ball === undefined) {
      throw new Error("no prop available at beat " + beat);
    }
    events.push({
      beat,
      height: 0,
      ball,
      fromHand: hand,
      toHand: hand,
      hold: true,
      dump: true,
      juggler: 0,
      targetJuggler: 0,
    });
  }
}

function queuesEmpty(landing, available) {
  const pending = landing.some((hand) => hand.some((slot) => slot.length > 0));
  const held = available[0].length > 0 || available[1].length > 0;
  return !pending && !held;
}

export function siteswapCanPlay(input) {
  if (input == null || String(input).trim() === "") {
    return false;
  }
  try {
    readSiteswap(input);
    return true;
  } catch {
    return false;
  }
}

export function scheduleEpisode(input, holdTwos = true) {
  const pattern = readSiteswap(input);
  const frames = framesOf(pattern);
  const period = writtenPeriod(frames);
  const landing = [[], []];
  const intro = [];
  const events = [];
  let nextBall = 0;
  let beat = 0;
  let throwHand = 1;
  let broken = null;
  let available = [[], []];

  const supplyBall = () => {
    const ball = nextBall;
    nextBall += 1;
    return ball;
  };

  for (let step = 0; step < 512; step += 1) {
    ensureLandingDepth(landing, 1);
    available = advanceHands(landing);
    const frame = linearFrameAt(frames, beat);
    try {
      if (frame === undefined) {
        rejectIdleLanding(available, beat);
        if (queuesEmpty(landing, available)) {
          break;
        }
      } else if (frame === null) {
        rejectIdleLanding(available, beat);
      } else {
        const domainHand = frame.kind === "sync" ? 1 : throwHand;
        applyPrelude(
          available,
          events,
          domainHand,
          beat,
          frame.addBefore ?? 0,
          frame.removeBefore ?? 0,
          supplyBall,
        );
        if (frame.kind === "sync") {
          applyPrelude(
            available,
            events,
            0,
            beat,
            frame.leftAddBefore ?? 0,
            frame.leftRemoveBefore ?? 0,
            supplyBall,
          );
          applyPrelude(
            available,
            events,
            1,
            beat,
            frame.rightAddBefore ?? 0,
            frame.rightRemoveBefore ?? 0,
            supplyBall,
          );
        }
        const recorded = [];
        if (frame.kind === "sync") {
          recorded.push(
            ...tossFromHand(frame.left, landing, available, intro, 0, beat, holdTwos, true, supplyBall),
            ...tossFromHand(frame.right, landing, available, intro, 1, beat, holdTwos, true, supplyBall),
          );
        } else {
          recorded.push(
            ...tossFromHand(
              frame.throws,
              landing,
              available,
              intro,
              throwHand,
              beat,
              holdTwos,
              true,
              supplyBall,
            ),
          );
        }
        rejectIdleLanding(available, beat);
        events.push(...recorded);
        applyRemoveMarks(landing, recorded, frame.removeAfter ?? 0);
        for (let index = 0; index < (frame.addAfter ?? 0); index += 1) {
          events.push(parkAddedObject(landing, domainHand, beat, supplyBall()));
        }
      }
    } catch (error) {
      broken = breakFromError(error, beat);
      for (const hand of [0, 1]) {
        for (const ball of available[hand]) {
          events.push({
            beat,
            height: 1,
            ball,
            fromHand: hand,
            toHand: hand,
            drop: true,
            failedCatch: true,
            juggler: 0,
            targetJuggler: 0,
          });
        }
      }
      break;
    }
    beat += 1;
    throwHand = 1 - throwHand;
    if (frame === undefined && beat > period + 32) {
      broken = { beat, kind: "uncaught" };
      break;
    }
  }

  const lastBeat = events.reduce((latest, event) => Math.max(latest, event.beat + Math.max(event.height, 1)), 0);
  const horizonBeats = Math.max((broken?.beat ?? lastBeat) + 1, 1);
  return {
    beats: pattern.beats ?? pattern.pairs ?? pattern.frames,
    ballCount: Math.max(nextBall, 1),
    highest: events.reduce((highest, event) => Math.max(highest, event.height), 0),
    events,
    cycleLength: horizonBeats,
    period,
    timing: pattern.timing,
    cyclic: false,
    break: broken,
    horizonBeats,
  };
}

export function schedulePlayable(input, holdTwos = true, untilBeat = 64) {
  if (siteswapIsValid(input)) {
    const cyclic = scheduleEvents(input, holdTwos, untilBeat);
    return {
      ...cyclic,
      cyclic: true,
      break: null,
      horizonBeats: cyclic.cycleLength,
    };
  }
  return scheduleEpisode(input, holdTwos);
}
