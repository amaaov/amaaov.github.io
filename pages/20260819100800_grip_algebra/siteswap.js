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
  return { height, crossing, crossingExplicit, index };
}

function parseHandThrows(text, index, keepCrossing) {
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
      group.push(
        keepCrossing || token.crossingExplicit
          ? { height: token.height, crossing: token.crossing }
          : token.height,
      );
      cursor = token.index;
    }
    if (group.length === 0) {
      throw new Error("empty multiplex");
    }
    return { heights: group, index: close + 1 };
  }
  const token = parseThrowToken(text, index);
  const heights = keepCrossing || token.crossingExplicit
    ? [{ height: token.height, crossing: token.crossing }]
    : [token.height];
  return { heights, index: token.index };
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
  return {
    pair: { left: left.heights, right: right.heights },
    index: index + 1,
  };
}

export function parseHybridSiteswap(source) {
  const frames = [];
  const text = String(source).trim();
  let index = 0;
  while (index < text.length) {
    index = skipSpace(text, index);
    if (index >= text.length) {
      break;
    }
    if (text[index] === "(") {
      const parsed = parseSyncPair(text, index);
      const shortBeat = text[parsed.index] === "!";
      frames.push({ kind: "sync", duration: shortBeat ? 1 : 2, ...parsed.pair });
      index = parsed.index;
      if (shortBeat) {
        index += 1;
      }
      continue;
    }
    const parsed = parseHandThrows(text, index, false);
    frames.push({ kind: "async", duration: 1, throws: parsed.heights });
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
    if ((hasAsync && hasSync) || hasSuppressedSyncBeat) {
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

function framesOf(pattern) {
  if (pattern.timing === "hybrid") {
    return pattern.frames;
  }
  if (pattern.timing === "sync") {
    return pattern.pairs.map((pair) => ({ kind: "sync", duration: 2, ...pair }));
  }
  return pattern.beats.map((throws) => ({ kind: "async", duration: 1, throws }));
}

function throwHeightOf(token) {
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

function advanceHands(landing) {
  const available = [[], []];
  for (let hand = 0; hand < 2; hand += 1) {
    available[hand] = landing[hand].shift();
    landing[hand].push([]);
  }
  return available;
}

function tossFromHand(heights, landing, available, intro, throwHand, beat, holdTwos, record) {
  const events = [];
  for (const token of heights) {
    const height = throwHeightOf(token);
    if (height === 0) {
      if (available[throwHand].length > 0) {
        throw new Error(`prop landing on 0 toss at beat ${beat}`);
      }
      continue;
    }
    let ball = available[throwHand].shift();
    if (ball === undefined) {
      ball = intro.shift();
    }
    if (ball === undefined) {
      throw new Error(`no prop available at beat ${beat}`);
    }
    const crossing = throwCrosses(token);
    const catchHand = crossing ? 1 - throwHand : throwHand;
    const hold = Boolean(holdTwos) && height === 2 && !crossing;
    if (record) {
      events.push({
        beat,
        height,
        ball,
        fromHand: throwHand,
        toHand: catchHand,
        hold,
        juggler: 0,
        targetJuggler: 0,
      });
    }
    landing[catchHand][height - 1].push(ball);
  }
  return events;
}

function rejectIdleLanding(available, beat) {
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
