function skipSpace(text, index) {
  while (index < text.length && (text[index] === "." || /\s/.test(text[index]))) {
    index += 1;
  }
  return index;
}

function parseThrowHeight(character) {
  if (character >= "0" && character <= "9") {
    return Number(character);
  }
  if (character >= "a" && character <= "z") {
    return 10 + character.charCodeAt(0) - 97;
  }
  throw new Error(`unsupported siteswap character: ${character}`);
}

function parseDomainMarks(text, index) {
  let add = 0;
  let remove = 0;
  while (index < text.length) {
    index = skipSpace(text, index);
    if (index >= text.length) {
      break;
    }
    if (text[index] === "+") {
      add += 1;
      index += 1;
      continue;
    }
    if (text[index] === "-") {
      remove += 1;
      index += 1;
      continue;
    }
    break;
  }
  return { add, remove, index };
}

function parseThrowToken(text, index) {
  index = skipSpace(text, index);
  if (index >= text.length) {
    throw new Error("unexpected end of siteswap");
  }
  const height = parseThrowHeight(text[index]);
  index += 1;
  let crossing = height % 2 === 1;
  let crossingExplicit = false;
  if (text[index] === "x" || text[index] === "X") {
    crossing = !crossing;
    crossingExplicit = true;
    index += 1;
  }
  const marks = parseDomainMarks(text, index);
  return {
    height,
    crossing,
    crossingExplicit,
    addAfter: marks.add,
    removeAfter: marks.remove,
    index: marks.index,
  };
}

function throwValue(parsed, keepCrossing) {
  const hasMarks = parsed.addAfter > 0 || parsed.removeAfter > 0;
  if (!keepCrossing && !parsed.crossingExplicit && !hasMarks) {
    return parsed.height;
  }
  const token = { height: parsed.height, crossing: parsed.crossing };
  if (parsed.addAfter > 0) {
    token.addAfter = parsed.addAfter;
  }
  if (parsed.removeAfter > 0) {
    token.removeAfter = parsed.removeAfter;
  }
  return token;
}

function bumpTokenMarks(token, add, remove) {
  if (add === 0 && remove === 0) {
    return token;
  }
  const next = typeof token === "number"
    ? { height: token, crossing: token % 2 === 1 }
    : { ...token };
  if (add > 0) {
    next.addAfter = (next.addAfter ?? 0) + add;
  }
  if (remove > 0) {
    next.removeAfter = (next.removeAfter ?? 0) + remove;
  }
  return next;
}

function parseHandThrows(text, index, keepCrossing) {
  index = skipSpace(text, index);
  if (index >= text.length) {
    throw new Error("unexpected end of siteswap");
  }
  const leading = parseDomainMarks(text, index);
  index = leading.index;
  index = skipSpace(text, index);
  if (index >= text.length) {
    throw new Error("unexpected end of siteswap");
  }
  if (text[index] === "[") {
    const close = text.indexOf("]", index);
    if (close < 0) {
      throw new Error("unclosed multiplex");
    }
    const group = [];
    let cursor = index + 1;
    while (cursor < close) {
      cursor = skipSpace(text, cursor);
      if (cursor >= close) {
        break;
      }
      const token = parseThrowToken(text, cursor);
      group.push(throwValue(token, keepCrossing));
      cursor = token.index;
    }
    if (group.length === 0) {
      throw new Error("empty multiplex");
    }
    const trailing = parseDomainMarks(text, close + 1);
    group[group.length - 1] = bumpTokenMarks(
      group[group.length - 1],
      trailing.add,
      trailing.remove,
    );
    return {
      heights: group,
      index: trailing.index,
      addBefore: leading.add,
      removeBefore: leading.remove,
    };
  }
  const parsed = parseThrowToken(text, index);
  return {
    heights: [throwValue(parsed, keepCrossing)],
    index: parsed.index,
    addBefore: leading.add,
    removeBefore: leading.remove,
  };
}

export function parseSiteswap(source) {
  const beats = [];
  const text = String(source).trim();
  let index = 0;
  while (index < text.length) {
    index = skipSpace(text, index);
    if (index >= text.length) {
      break;
    }
    const parsed = parseHandThrows(text, index, false);
    beats.push(parsed.heights);
    index = parsed.index;
  }
  if (beats.length === 0) {
    throw new Error("empty siteswap");
  }
  return beats;
}

export function parseSyncSiteswap(source) {
  const pairs = [];
  const text = String(source).trim();
  let index = 0;
  while (index < text.length) {
    index = skipSpace(text, index);
    if (index >= text.length) {
      break;
    }
    const parsed = parseSyncPair(text, index);
    pairs.push(parsed.pair);
    index = parsed.index;
    if (text[index] === "!") {
      index += 1;
    }
  }
  if (pairs.length === 0) {
    throw new Error("empty siteswap");
  }
  return pairs;
}

function parseSyncPair(text, index) {
  if (text[index] !== "(") {
    throw new Error("sync siteswap expected a pair");
  }
  const left = parseHandThrows(text, index + 1, true);
  index = skipSpace(text, left.index);
  if (text[index] !== ",") {
    throw new Error("sync pair missing comma");
  }
  const right = parseHandThrows(text, index + 1, true);
  index = skipSpace(text, right.index);
  if (text[index] !== ")") {
    throw new Error("unclosed sync pair");
  }
  const pair = { left: left.heights, right: right.heights };
  if (left.addBefore > 0) {
    pair.leftAddBefore = left.addBefore;
  }
  if (left.removeBefore > 0) {
    pair.leftRemoveBefore = left.removeBefore;
  }
  if (right.addBefore > 0) {
    pair.rightAddBefore = right.addBefore;
  }
  if (right.removeBefore > 0) {
    pair.rightRemoveBefore = right.removeBefore;
  }
  return {
    pair,
    index: index + 1,
  };
}

function attachPendingDomain(frame, pending) {
  if (pending.add > 0) {
    frame.addBefore = (frame.addBefore ?? 0) + pending.add;
    pending.add = 0;
  }
  if (pending.remove > 0) {
    frame.removeBefore = (frame.removeBefore ?? 0) + pending.remove;
    pending.remove = 0;
  }
}

export function parseHybridSiteswap(source) {
  const frames = [];
  const text = String(source).trim();
  const pending = { add: 0, remove: 0 };
  let index = 0;
  while (index < text.length) {
    index = skipSpace(text, index);
    if (index >= text.length) {
      break;
    }
    if (text[index] === "+" || text[index] === "-") {
      const mark = text[index];
      index += 1;
      if (frames.length === 0) {
        if (mark === "+") {
          pending.add += 1;
        } else {
          pending.remove += 1;
        }
      } else if (mark === "+") {
        const last = frames[frames.length - 1];
        last.addAfter = (last.addAfter ?? 0) + 1;
      } else {
        const last = frames[frames.length - 1];
        last.removeAfter = (last.removeAfter ?? 0) + 1;
      }
      continue;
    }
    if (text[index] === "(") {
      const parsed = parseSyncPair(text, index);
      const shortBeat = text[parsed.index] === "!";
      const frame = { kind: "sync", duration: shortBeat ? 1 : 2, ...parsed.pair };
      attachPendingDomain(frame, pending);
      frames.push(frame);
      index = parsed.index;
      if (shortBeat) {
        index += 1;
      }
      continue;
    }
    const parsed = parseHandThrows(text, index, false);
    const frame = { kind: "async", duration: 1, throws: parsed.heights };
    attachPendingDomain(frame, pending);
    if (parsed.addBefore > 0) {
      frame.addBefore = (frame.addBefore ?? 0) + parsed.addBefore;
    }
    if (parsed.removeBefore > 0) {
      frame.removeBefore = (frame.removeBefore ?? 0) + parsed.removeBefore;
    }
    frames.push(frame);
    index = parsed.index;
  }
  if (frames.length === 0) {
    throw new Error("empty siteswap");
  }
  return frames;
}

export function parseVanillaSiteswap(source) {
  return parseSiteswap(source).map((beat) => {
    if (beat.length !== 1) {
      throw new Error("vanilla parser cannot read multiplex");
    }
    return beat[0];
  });
}

export function asBeats(input) {
  if (typeof input === "string") {
    return parseSiteswap(input);
  }
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error("empty siteswap");
  }
  if (Array.isArray(input[0])) {
    return input;
  }
  return input.map((height) => [height]);
}

export function readSiteswap(input) {
  if (typeof input === "string") {
    const frames = parseHybridSiteswap(input);
    const hasAsync = frames.some((frame) => frame.kind === "async");
    const hasSync = frames.some((frame) => frame.kind === "sync");
    const hasSuppressedSyncBeat = frames.some(
      (frame) => frame.kind === "sync" && frame.duration === 1,
    );
    const hasDomain = frames.some((frame) => frameHasDomain(frame));
    if ((hasAsync && hasSync) || hasSuppressedSyncBeat || hasDomain) {
      return { timing: "hybrid", frames };
    }
    if (hasSync) {
      return {
        timing: "sync",
        pairs: frames.map(({ left, right }) => ({ left, right })),
      };
    }
    return { timing: "async", beats: frames.map((frame) => frame.throws) };
  }
  return { timing: "async", beats: asBeats(input) };
}

function tokenHasDomain(token) {
  return typeof token === "object" && Boolean(token.addAfter || token.removeAfter);
}

function heightsHaveDomain(heights = []) {
  return heights.some((token) => tokenHasDomain(token));
}

export function frameHasDomain(frame) {
  return Boolean(
    frame.addBefore ||
      frame.addAfter ||
      frame.removeBefore ||
      frame.removeAfter ||
      frame.leftAddBefore ||
      frame.leftRemoveBefore ||
      frame.rightAddBefore ||
      frame.rightRemoveBefore ||
      heightsHaveDomain(frame.throws) ||
      heightsHaveDomain(frame.left) ||
      heightsHaveDomain(frame.right),
  );
}

export function framesOf(pattern) {
  if (pattern.timing === "hybrid") {
    return pattern.frames;
  }
  if (pattern.timing === "sync") {
    return pattern.pairs.map((pair) => ({ kind: "sync", duration: 2, ...pair }));
  }
  return pattern.beats.map((throws) => ({ kind: "async", duration: 1, throws }));
}

export function throwHeightOf(token) {
  return typeof token === "number" ? token : token.height;
}

function throwCrosses(token) {
  if (typeof token === "number") {
    return token % 2 === 1;
  }
  return token.crossing;
}

function sumHeights(heights) {
  return heights.reduce((total, token) => total + throwHeightOf(token), 0);
}

function highestIn(heights) {
  return heights.reduce((highest, token) => Math.max(highest, throwHeightOf(token)), 0);
}

export function siteswapBallCount(input) {
  const pattern = readSiteswap(input);
  const frames = framesOf(pattern);
  const sum = frames.reduce((total, frame) => {
    if (frame.kind === "sync") {
      return total + sumHeights(frame.left) + sumHeights(frame.right);
    }
    return total + sumHeights(frame.throws);
  }, 0);
  return sum / frames.reduce((total, frame) => total + frame.duration, 0);
}

export function siteswapHighest(input) {
  const pattern = readSiteswap(input);
  return framesOf(pattern).reduce((highest, frame) => {
    if (frame.kind === "sync") {
      return Math.max(highest, highestIn(frame.left), highestIn(frame.right));
    }
    return Math.max(highest, highestIn(frame.throws));
  }, 0);
}

export function siteswapPeriod(input) {
  const pattern = readSiteswap(input);
  return framesOf(pattern).reduce((total, frame) => total + frame.duration, 0);
}

export function siteswapIsValid(input) {
  try {
    const pattern = readSiteswap(input);
    if (framesOf(pattern).some((frame) => frameHasDomain(frame))) {
      return false;
    }
    const average = siteswapBallCount(input);
    if (!Number.isInteger(average) || average < 1) {
      return false;
    }
    scheduleEvents(input, true, siteswapPeriod(input) * 4);
    return true;
  } catch {
    return false;
  }
}

export function handForBeat(beat) {
  return ((Math.floor(beat) % 2) + 2) % 2 === 0 ? 1 : 0;
}

function landingKey(landing) {
  return JSON.stringify(landing);
}

export function advanceHands(landing) {
  const available = [[], []];
  for (let hand = 0; hand < 2; hand += 1) {
    available[hand] = landing[hand].shift();
    landing[hand].push([]);
  }
  return available;
}

export function ensureLandingDepth(landing, height) {
  const needed = Math.max(height, 1);
  for (const hand of landing) {
    while (hand.length < needed) {
      hand.push([]);
    }
  }
}

export function tossFromHand(
  heights,
  landing,
  available,
  intro,
  throwHand,
  beat,
  holdTwos,
  record,
  supplyBall = null,
) {
  const events = [];
  for (const token of heights) {
    const height = throwHeightOf(token);
    const addAfter = typeof token === "object" ? (token.addAfter ?? 0) : 0;
    const removeAfter = typeof token === "object" ? (token.removeAfter ?? 0) : 0;
    if (height === 0) {
      if (available[throwHand].length > 0) {
        throw new Error(`prop landing on 0 toss at beat ${beat}`);
      }
      if (record) {
        applyRemoveMarks(landing, events, removeAfter);
        for (let index = 0; index < addAfter; index += 1) {
          events.push(parkAddedObject(landing, throwHand, beat, supplyOrThrow(supplyBall, intro, beat)));
        }
      }
      continue;
    }
    let ball = available[throwHand].shift();
    if (ball === undefined && typeof supplyBall === "function") {
      ball = supplyBall();
    }
    if (ball === undefined) {
      ball = intro.shift();
    }
    if (ball === undefined) {
      throw new Error(`no prop available at beat ${beat}`);
    }
    const crossing = throwCrosses(token);
    const catchHand = crossing ? 1 - throwHand : throwHand;
    const hold = Boolean(holdTwos) && height === 2 && !crossing;
    const event = {
      beat,
      height,
      ball,
      fromHand: throwHand,
      toHand: catchHand,
      hold,
      juggler: 0,
      targetJuggler: 0,
    };
    if (record) {
      events.push(event);
    }
    ensureLandingDepth(landing, height);
    landing[catchHand][height - 1].push(ball);
    if (record) {
      applyRemoveMarks(landing, [event], removeAfter);
      for (let index = 0; index < addAfter; index += 1) {
        events.push(parkAddedObject(landing, throwHand, beat, supplyOrThrow(supplyBall, intro, beat)));
      }
    }
  }
  return events;
}

function supplyOrThrow(supplyBall, intro, beat) {
  if (typeof supplyBall === "function") {
    return supplyBall();
  }
  const ball = intro.shift();
  if (ball === undefined) {
    throw new Error(`no prop available at beat ${beat}`);
  }
  return ball;
}

export function parkAddedObject(landing, hand, beat, ball) {
  ensureLandingDepth(landing, 1);
  landing[hand][0].push(ball);
  return {
    beat,
    height: 1,
    ball,
    fromHand: hand,
    toHand: hand,
    hold: true,
    parked: true,
    juggler: 0,
    targetJuggler: 0,
  };
}

export function applyRemoveMarks(landing, events, count) {
  for (let index = 0; index < count; index += 1) {
    const event = [...events].reverse().find((item) => !item.dump && !item.drop && !item.parked);
    if (!event) {
      throw new Error("no object to remove");
    }
    const height = throwHeightOf(event);
    pullLanding(landing, event.toHand, height, event.ball);
    if (event.hold) {
      event.dump = true;
    } else {
      event.drop = true;
    }
  }
}

function pullLanding(landing, hand, height, ball) {
  ensureLandingDepth(landing, height);
  const slot = landing[hand][height - 1];
  const found = slot.lastIndexOf(ball);
  if (found >= 0) {
    slot.splice(found, 1);
  }
}

export function rejectIdleLanding(available, beat) {
  if (available[0].length > 0 || available[1].length > 0) {
    throw new Error(`prop landing with no toss at beat ${beat}`);
  }
}

function frameAtBeat(pattern, beat) {
  const frames = framesOf(pattern);
  const period = frames.reduce((total, frame) => total + frame.duration, 0);
  const localBeat = ((beat % period) + period) % period;
  let offset = 0;
  for (const frame of frames) {
    if (localBeat === offset) {
      return frame;
    }
    if (localBeat < offset + frame.duration) {
      return null;
    }
    offset += frame.duration;
  }
  return null;
}

function applyTimeBeat(pattern, landing, available, intro, throwHand, beat, holdTwos, record) {
  const frame = frameAtBeat(pattern, beat);
  if (frame === null) {
    rejectIdleLanding(available, beat);
    return [];
  }
  if (frame.kind === "sync") {
    const events = [
      ...tossFromHand(frame.left, landing, available, intro, 0, beat, holdTwos, record),
      ...tossFromHand(frame.right, landing, available, intro, 1, beat, holdTwos, record),
    ];
    rejectIdleLanding(available, beat);
    return events;
  }
  const events = tossFromHand(
    frame.throws,
    landing,
    available,
    intro,
    throwHand,
    beat,
    holdTwos,
    record,
  );
  rejectIdleLanding(available, beat);
  return events;
}

export function scheduleEvents(input, holdTwos = true, untilBeat = 64) {
  const pattern = readSiteswap(input);
  const ballCount = siteswapBallCount(input);
  if (!Number.isInteger(ballCount) || ballCount < 1) {
    throw new Error("siteswap ball count must be a positive integer");
  }
  const highest = siteswapHighest(input);
  const period = siteswapPeriod(input);
  const depth = Math.max(highest, 1);
  const landing = [
    Array.from({ length: depth }, () => []),
    Array.from({ length: depth }, () => []),
  ];
  const intro = Array.from({ length: ballCount }, (_, id) => id);
  const cycleTosses = [];
  let initComplete = false;
  let beat = 0;
  let throwHand = 1;
  let startKey = null;
  let cycleLength = 0;

  for (let step = 0; step < 2000; step += 1) {
    const available = advanceHands(landing);
    const recorded = applyTimeBeat(
      pattern,
      landing,
      available,
      intro,
      throwHand,
      beat,
      holdTwos,
      initComplete,
    );
    cycleTosses.push(...recorded);

    if (initComplete) {
      if (startKey === null) {
        startKey = landingKey(landing);
      } else if (beat > 0 && beat % period === 0 && landingKey(landing) === startKey) {
        while (cycleTosses.length > 0 && cycleTosses[cycleTosses.length - 1].beat === beat) {
          cycleTosses.pop();
        }
        cycleLength = beat;
        break;
      }
    } else if (intro.length === 0 && (beat + 1) % period === 0) {
      initComplete = true;
      beat = -1;
    }

    beat += 1;
    throwHand = 1 - throwHand;
  }

  if (cycleLength === 0) {
    throw new Error("pattern did not repeat");
  }

  const events = [];
  const earliest = -Math.max(highest, 8);
  const copies = Math.ceil(untilBeat / cycleLength) + 4;
  for (const toss of cycleTosses) {
    for (let copy = -4; copy <= copies; copy += 1) {
      const absolute = toss.beat + copy * cycleLength;
      if (absolute < earliest || absolute > untilBeat) {
        continue;
      }
      events.push({ ...toss, beat: absolute });
    }
  }
  return {
    beats: pattern.beats ?? pattern.pairs ?? pattern.frames,
    ballCount,
    highest,
    events,
    cycleLength,
    period,
    timing: pattern.timing,
  };
}
