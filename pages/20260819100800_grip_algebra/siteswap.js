function skipSpace(text, index) {
  while (index < text.length && (text[index] === " " || text[index] === ".")) {
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
  if (text[index] === "x" || text[index] === "X") {
    crossing = true;
    index += 1;
  }
  return { height, crossing, index };
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
      group.push(keepCrossing ? { height: token.height, crossing: token.crossing } : token.height);
      cursor = token.index;
    }
    if (group.length === 0) {
      throw new Error("empty multiplex");
    }
    return { heights: group, index: close + 1 };
  }
  const token = parseThrowToken(text, index);
  const heights = keepCrossing ? [{ height: token.height, crossing: token.crossing }] : [token.height];
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
    pairs.push({ left: left.heights, right: right.heights });
    index += 1;
  }
  if (pairs.length === 0) {
    throw new Error("empty siteswap");
  }
  return pairs;
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
  if (typeof input === "string" && input.trim().startsWith("(")) {
    return { timing: "sync", pairs: parseSyncSiteswap(input) };
  }
  return { timing: "async", beats: asBeats(input) };
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
  if (pattern.timing === "sync") {
    const sum = pattern.pairs.reduce(
      (total, pair) => total + sumHeights(pair.left) + sumHeights(pair.right),
      0,
    );
    return sum / (2 * pattern.pairs.length);
  }
  const beats = pattern.beats;
  const sum = beats.reduce((total, beat) => total + sumHeights(beat), 0);
  return sum / beats.length;
}

export function siteswapHighest(input) {
  const pattern = readSiteswap(input);
  if (pattern.timing === "sync") {
    return pattern.pairs.reduce(
      (highest, pair) => Math.max(highest, highestIn(pair.left), highestIn(pair.right)),
      0,
    );
  }
  return pattern.beats.reduce((highest, beat) => Math.max(highest, highestIn(beat)), 0);
}

export function siteswapPeriod(input) {
  const pattern = readSiteswap(input);
  if (pattern.timing === "sync") {
    return pattern.pairs.length * 2;
  }
  return pattern.beats.length;
}

export function siteswapIsValid(input) {
  const average = siteswapBallCount(input);
  if (!Number.isInteger(average) || average < 1) {
    return false;
  }
  try {
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

function applyTimeBeat(pattern, landing, available, intro, throwHand, beat, holdTwos, record) {
  if (pattern.timing === "sync") {
    if (beat % 2 !== 0) {
      rejectIdleLanding(available, beat);
      return [];
    }
    const pairCount = pattern.pairs.length;
    const pair = pattern.pairs[(((beat / 2) % pairCount) + pairCount) % pairCount];
    const events = [
      ...tossFromHand(pair.left, landing, available, intro, 0, beat, holdTwos, record),
      ...tossFromHand(pair.right, landing, available, intro, 1, beat, holdTwos, record),
    ];
    rejectIdleLanding(available, beat);
    return events;
  }
  const beats = pattern.beats;
  const heights = beats[((beat % beats.length) + beats.length) % beats.length];
  const events = tossFromHand(heights, landing, available, intro, throwHand, beat, holdTwos, record);
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
  return { beats: pattern.beats ?? pattern.pairs, ballCount, highest, events, cycleLength };
}
