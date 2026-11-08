import {
  readSiteswap,
  siteswapBallCount,
  siteswapHighest,
  siteswapIsValid,
  siteswapPeriod,
} from "./siteswap.js";

const DEFAULT_SEARCH_BUDGET = 250_000;

export function seededRandom(seed) {
  let state = Number(seed) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function heightCharacter(height) {
  if (height < 10) {
    return String(height);
  }
  return String.fromCharCode(87 + height);
}

function shuffled(values, random) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function wildcardDomains(mask, maximumThrow, random, allowOddSyncThrows, minimumThrow = 0) {
  const domains = [];
  let pairDepth = 0;
  const floor = Math.max(0, minimumThrow | 0);
  for (const character of mask) {
    if (character === "(") {
      pairDepth += 1;
    } else if (character === ")") {
      pairDepth -= 1;
    } else if (character === "?") {
      // 0 stays legal for holds/empties; other heights respect minimumThrow.
      const values = Array.from({ length: maximumThrow + 1 }, (_, height) => height).filter(
        (height) =>
          (height === 0 || height >= floor) &&
          (pairDepth === 0 || allowOddSyncThrows || height % 2 === 0),
      );
      domains.push(shuffled(values.length > 0 ? values : [0], random));
    }
    if (pairDepth < 0) {
      throw new Error("mask has an unmatched closing parenthesis");
    }
  }
  if (pairDepth !== 0) {
    throw new Error("mask has an unclosed synchronous packet");
  }
  return domains;
}

function substituteMask(mask, heights) {
  let wildcard = 0;
  return [...mask]
    .map((character) => {
      if (character !== "?") {
        return character;
      }
      const replacement = heightCharacter(heights[wildcard]);
      wildcard += 1;
      return replacement;
    })
    .join("");
}

function result(patterns, status, visited, message = "") {
  return { patterns, status, visited, message };
}

export function completeSiteswapMask({
  mask,
  objectCount,
  maximumThrow,
  minimumThrow = 0,
  limit = 16,
  searchBudget = DEFAULT_SEARCH_BUDGET,
  random = Math.random,
  requireActiveRhythms = false,
}) {
  const sourceMask = String(mask).replace(/\s+/g, "");
  if (!Number.isInteger(objectCount) || objectCount < 1) {
    return result([], "invalid-request", 0, "object count must be a positive integer");
  }
  if (!Number.isInteger(maximumThrow) || maximumThrow < 0 || maximumThrow > 35) {
    return result([], "invalid-request", 0, "maximum throw must be between 0 and 35");
  }
  if (!Number.isInteger(minimumThrow) || minimumThrow < 0 || minimumThrow > maximumThrow) {
    return result([], "invalid-request", 0, "minimum throw must be between 0 and maximumThrow");
  }
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(searchBudget) || searchBudget < 1) {
    return result([], "invalid-request", 0, "search limits must be positive integers");
  }

  try {
    const emptyCompletion = sourceMask.replaceAll("?", "0");
    const periodBeats = siteswapPeriod(emptyCompletion);
    const maskTiming = readSiteswap(emptyCompletion).timing;
    const fixedHeightTotal = siteswapBallCount(emptyCompletion) * periodBeats;
    if (siteswapHighest(emptyCompletion) > maximumThrow) {
      return result([], "unsatisfiable", 0, "a fixed throw exceeds the maximum");
    }
    const targetWildcardTotal = objectCount * periodBeats - fixedHeightTotal;
    const domains = wildcardDomains(
      sourceMask,
      maximumThrow,
      random,
      maskTiming === "hybrid",
      minimumThrow,
    );
    if (!Number.isInteger(targetWildcardTotal) || targetWildcardTotal < 0) {
      return result([], "unsatisfiable", 0, "fixed throws exceed the requested object count");
    }

    const patterns = [];
    const seen = new Set();
    const chosen = Array(domains.length).fill(0);
    let visited = 0;
    let budgetReached = false;
    let limitReached = false;

    const search = (wildcardIndex, total) => {
      if (budgetReached || limitReached) {
        return;
      }
      if (visited >= searchBudget) {
        budgetReached = true;
        return;
      }
      visited += 1;
      const remaining = domains.length - wildcardIndex;
      if (total > targetWildcardTotal || total + remaining * maximumThrow < targetWildcardTotal) {
        return;
      }
      if (wildcardIndex === domains.length) {
        if (total !== targetWildcardTotal) {
          return;
        }
        const candidate = substituteMask(sourceMask, chosen);
        if (
          !seen.has(candidate) &&
          siteswapIsValid(candidate) &&
          (!requireActiveRhythms || hasActiveRhythmFamilies(candidate))
        ) {
          seen.add(candidate);
          patterns.push(candidate);
          limitReached = patterns.length >= limit;
        }
        return;
      }
      for (const height of domains[wildcardIndex]) {
        chosen[wildcardIndex] = height;
        search(wildcardIndex + 1, total + height);
        if (budgetReached || limitReached) {
          break;
        }
      }
    };

    search(0, 0);
    if (patterns.length === 0) {
      return result(
        patterns,
        budgetReached ? "budget-exhausted" : "unsatisfiable",
        visited,
        budgetReached ? "search budget reached before a legal completion" : "no legal completion",
      );
    }
    return result(
      patterns,
      budgetReached ? "budget-exhausted" : limitReached ? "limit-reached" : "complete",
      visited,
    );
  } catch (error) {
    return result([], "invalid-mask", 0, error.message);
  }
}

export function createGenerationMask({ timing, periodBeats, random = Math.random }) {
  if (!Number.isInteger(periodBeats) || periodBeats < 1) {
    throw new Error("period must be a positive integer");
  }
  if (timing === "async") {
    return "?".repeat(periodBeats);
  }
  if (timing === "sync") {
    if (periodBeats % 2 !== 0) {
      throw new Error("synchronous period must be even");
    }
    return "(?,?)".repeat(periodBeats / 2);
  }
  if (timing === "hybrid") {
    if (periodBeats < 3) {
      throw new Error("hybrid period must be at least three beats");
    }
    const asyncCount = periodBeats - 2;
    const syncPosition = Math.floor(random() * (asyncCount + 1));
    const frames = Array.from({ length: asyncCount }, () => "?");
    frames.splice(syncPosition, 0, "(?,?)");
    return frames.join("");
  }
  throw new Error(`unsupported timing: ${timing}`);
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

function heightOf(token) {
  return typeof token === "number" ? token : token.height;
}

function crosses(token) {
  return typeof token === "number" ? token % 2 === 1 : token.crossing;
}

function maximumCircularEmptyRun(packetCounts) {
  const empty = packetCounts.map((count) => count === 0);
  if (empty.every(Boolean)) {
    return empty.length;
  }
  let current = 0;
  let maximum = 0;
  for (const isEmpty of [...empty, ...empty]) {
    current = isEmpty ? current + 1 : 0;
    maximum = Math.max(maximum, current);
  }
  return Math.min(maximum, empty.length);
}

function tokensOf(frame) {
  return frame.kind === "sync" ? [...frame.left, ...frame.right] : frame.throws;
}

function hasActiveRhythmFamilies(source) {
  const frames = framesOf(readSiteswap(source));
  const activeKinds = new Set(
    frames
      .filter((frame) => tokensOf(frame).some((token) => heightOf(token) > 0))
      .map((frame) => frame.kind),
  );
  return activeKinds.has("async") && activeKinds.has("sync");
}

export function siteswapFeatures(source, holdTwos = true) {
  const pattern = readSiteswap(source);
  const frames = framesOf(pattern);
  const packetReleaseCounts = [];
  const packetTossCounts = [];
  let zeroPackets = 0;
  let zeroTokens = 0;
  let holdTokens = 0;
  let multiplexPackets = 0;
  const positiveHeights = [];

  for (const frame of frames) {
    const handGroups = frame.kind === "sync" ? [frame.left, frame.right] : [frame.throws];
    const tokens = tokensOf(frame);
    const positive = tokens.filter((token) => heightOf(token) > 0);
    positiveHeights.push(...positive.map(heightOf));
    const releases = positive.filter(
      (token) => !(holdTwos && heightOf(token) === 2 && !crosses(token)),
    );
    packetTossCounts.push(positive.length);
    packetReleaseCounts.push(releases.length);
    zeroTokens += tokens.length - positive.length;
    holdTokens += positive.length - releases.length;
    zeroPackets += positive.length === 0 ? 1 : 0;
    multiplexPackets += handGroups.some((group) => group.length > 1) ? 1 : 0;
  }

  const meanReleasePacket =
    packetReleaseCounts.reduce((sum, count) => sum + count, 0) / packetReleaseCounts.length;
  const packetSizeVariance =
    packetReleaseCounts.reduce((sum, count) => sum + (count - meanReleasePacket) ** 2, 0) /
    packetReleaseCounts.length;
  const meanThrowHeight =
    positiveHeights.reduce((sum, height) => sum + height, 0) / positiveHeights.length;
  const throwHeightVariance = positiveHeights.reduce(
    (sum, height) => sum + (height - meanThrowHeight) ** 2,
    0,
  ) / positiveHeights.length;
  const releaseTotal = packetReleaseCounts.reduce((sum, count) => sum + count, 0);
  const releaseConcentration = releaseTotal === 0
    ? 0
    : packetReleaseCounts.reduce((sum, count) => sum + count * (count - 1), 0) /
      releaseTotal;
  const switchingCount = frames.reduce((count, frame, index) => {
    return count + Number(frame.kind !== frames[(index + 1) % frames.length].kind);
  }, 0);
  return {
    timing: pattern.timing,
    objectCount: siteswapBallCount(source),
    periodBeats: siteswapPeriod(source),
    maximumThrow: siteswapHighest(source),
    eventPacketCount: frames.length,
    releaseTokenCount: packetReleaseCounts.reduce((sum, count) => sum + count, 0),
    zeroTokenCount: zeroTokens,
    holdTokenCount: holdTokens,
    maximumEmptyPacketRun: maximumCircularEmptyRun(packetTossCounts),
    maximumReleasePacket: Math.max(...packetReleaseCounts),
    maximumTossPacket: Math.max(...packetTossCounts),
    meanReleasePacket,
    packetSizeVariance,
    meanThrowHeight,
    throwHeightVariance,
    releaseConcentration,
    switchingDensity: switchingCount / siteswapPeriod(source),
    zeroPacketShare: zeroPackets / frames.length,
    syncPacketShare: frames.filter((frame) => frame.kind === "sync").length / frames.length,
    multiplexPacketShare: multiplexPackets / frames.length,
  };
}

function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}

/**
 * Force some wildcards to 0 for holds / drops / flash endings.
 */
export function applyRestMask(mask, restStyle = "none", zeroRate = 0, random = Math.random) {
  if (restStyle === "none" || zeroRate <= 0) {
    return mask;
  }
  const chars = [...mask];
  const wildIndexes = [];
  for (let index = 0; index < chars.length; index += 1) {
    if (chars[index] === "?") {
      wildIndexes.push(index);
    }
  }
  if (wildIndexes.length < 3) {
    return mask;
  }
  const targets = new Set();
  if (restStyle === "ending") {
    const count = Math.min(wildIndexes.length - 2, Math.max(1, Math.floor(wildIndexes.length * 0.35)));
    for (let offset = 0; offset < count; offset += 1) {
      targets.add(wildIndexes[wildIndexes.length - 1 - offset]);
    }
  } else if (restStyle === "middle") {
    const mid = Math.floor(wildIndexes.length / 2);
    const count = Math.min(wildIndexes.length - 2, 1 + Math.floor(wildIndexes.length * 0.2));
    for (let offset = 0; offset < count; offset += 1) {
      targets.add(wildIndexes[Math.min(wildIndexes.length - 1, mid - Math.floor(count / 2) + offset)]);
    }
  } else if (restStyle === "breath") {
    const step = Math.max(2, Math.floor(1 / Math.max(0.15, zeroRate)));
    for (let index = step; index < wildIndexes.length - 1; index += step) {
      targets.add(wildIndexes[index]);
    }
  } else {
    for (const index of wildIndexes) {
      if (random() < zeroRate && targets.size < wildIndexes.length - 2) {
        targets.add(index);
      }
    }
  }
  for (const index of targets) {
    chars[index] = "0";
  }
  return chars.join("");
}

function injectAsyncMultiplex(mask, random) {
  const chars = [...mask];
  const wilds = [];
  for (let index = 0; index < chars.length; index += 1) {
    if (chars[index] === "?") {
      wilds.push(index);
    }
  }
  if (wilds.length === 0) {
    return mask;
  }
  const index = wilds[Math.floor(random() * wilds.length)];
  chars[index] = pick(random, ["[??]", "[???]"]);
  return chars.join("");
}

/**
 * Multiplex-capable generation mask for async / sync / hybrid timing.
 */
export function createMultiplexMask({ timing, periodBeats, random = Math.random }) {
  if (timing === "sync") {
    if (periodBeats % 2 !== 0) {
      throw new Error("synchronous period must be even");
    }
    const pairs = Math.max(1, Math.floor(periodBeats / 2));
    return Array.from({ length: pairs }, () =>
      random() < 0.55 ? pick(random, ["([??],?)", "(?,[??])", "([??],[??])"]) : "(?,?)",
    ).join("");
  }
  if (timing === "hybrid") {
    return injectAsyncMultiplex(createGenerationMask({ timing: "hybrid", periodBeats, random }), random);
  }
  const slots = [];
  let remaining = periodBeats;
  while (remaining > 0) {
    if (remaining >= 1 && random() < 0.32 && slots.length + 1 < periodBeats) {
      slots.push(pick(random, ["[??]", "[??]", "[???]", "[?]"]));
      remaining -= 1;
    } else {
      slots.push("?");
      remaining -= 1;
    }
  }
  if (!slots.some((slot) => slot.includes("["))) {
    const index = Math.floor(random() * slots.length);
    slots[index] = "[??]";
  }
  return slots.join("");
}

/**
 * Structural masks for named families — wildcards only; heights come from search.
 * shower: short async. box: crossed sync diagonals. columns: sync with a hold slot.
 * fountain: plain sync pairs.
 */
export function createFamilyMask({ family, periodBeats, random = Math.random }) {
  if (family === "shower") {
    const length = Math.max(2, periodBeats);
    return "?".repeat(length);
  }
  if (family === "box") {
    const pairs = Math.max(1, Math.floor(Math.max(4, periodBeats) / 2));
    let mask = "";
    for (let index = 0; index < pairs; index += 1) {
      mask += index % 2 === 0 ? "(?,?x)" : "(?x,?)";
    }
    return mask;
  }
  if (family === "columns") {
    const pairs = Math.max(2, Math.floor(Math.max(4, periodBeats) / 2));
    const holdSide = random() < 0.5 ? "left" : "right";
    let mask = "";
    for (let index = 0; index < pairs; index += 1) {
      if (index === pairs - 1) {
        mask += holdSide === "left" ? "(0,?)" : "(?,0)";
      } else {
        mask += "(?,?)";
      }
    }
    return mask;
  }
  if (family === "fountain") {
    const pairs = Math.max(1, Math.floor(Math.max(2, periodBeats) / 2));
    return "(?,?)".repeat(pairs);
  }
  return null;
}

function familyDefaults(family, objectCount, throwBias) {
  if (family === "shower") {
    return {
      timing: "async",
      periodBeats: 2,
      maximumThrow: Math.min(35, objectCount + 4 + Math.round(throwBias * 8)),
      preferHighVariance: true,
    };
  }
  if (family === "box") {
    return {
      timing: "sync",
      periodBeats: 4,
      maximumThrow: Math.min(35, objectCount + 3 + Math.round(throwBias * 6)),
    };
  }
  if (family === "columns") {
    return {
      timing: "sync",
      periodBeats: 4,
      maximumThrow: Math.min(35, objectCount + 2 + Math.round(throwBias * 4)),
      restStyle: "none",
    };
  }
  if (family === "fountain") {
    return {
      timing: "sync",
      periodBeats: 2,
      maximumThrow: Math.min(35, objectCount + 2 + Math.round(throwBias * 4)),
    };
  }
  return {};
}

function trivialSiteswap(objectCount, timing) {
  if (timing === "sync") {
    const high = objectCount + (objectCount % 2 === 0 ? 0 : 1);
    const low = objectCount * 2 - high;
    return `(${heightCharacter(high)},${heightCharacter(low)})`;
  }
  return heightCharacter(objectCount);
}

function evenHeight(value) {
  const rounded = Math.max(0, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function validSiteswapOrNull(source, objectCount) {
  try {
    if (siteswapIsValid(source) && siteswapBallCount(source) === objectCount) {
      return source;
    }
  } catch {
    /* invalid */
  }
  return null;
}

/**
 * Parametric family construction — heights from objectCount + throwBias + random,
 * not a fixed shelf of named patterns.
 */
export function constructFamilySiteswap(family, objectCount, throwBias = 0.45, random = Math.random) {
  const n = objectCount;
  const spread = 1 + Math.floor(random() * (1 + Math.round(throwBias * 4)));
  if (family === "shower") {
    const candidates = [];
    for (let delta = spread; delta <= spread + 3; delta += 1) {
      let high = n + delta;
      let low = n - delta;
      if (low < 0) {
        continue;
      }
      if (high % 2 === 0) {
        high += 1;
        low = 2 * n - high;
      }
      if (low < 0 || high > 35) {
        continue;
      }
      candidates.push(`${heightCharacter(high)}${heightCharacter(low)}`);
      if (delta >= 2) {
        candidates.push(
          `${heightCharacter(high)}${heightCharacter(low)}${heightCharacter(high)}${heightCharacter(low)}`,
        );
      }
    }
    for (const candidate of shuffled(candidates, random)) {
      const ok = validSiteswapOrNull(candidate, n);
      if (ok) {
        return ok;
      }
    }
    return null;
  }
  if (family === "box") {
    const shapes = [];
    const maxSpread = Math.max(1, Math.floor(n / 2));
    for (let delta = 1; delta <= maxSpread + 1; delta += 1) {
      const high = evenHeight(n + delta);
      const low = evenHeight(2 * n - high);
      if (low < 2 || high > 35) {
        continue;
      }
      shapes.push(`(${heightCharacter(high)}x,${heightCharacter(low)}x)`);
      shapes.push(`(${heightCharacter(low)}x,${heightCharacter(high)}x)`);
      shapes.push(
        `(${heightCharacter(high)}x,${heightCharacter(low)})(${heightCharacter(high)},${heightCharacter(low)}x)`,
      );
      shapes.push(
        `(${heightCharacter(high)}x,${heightCharacter(low)}x)(${heightCharacter(low)},${heightCharacter(high)})`,
      );
    }
    for (const candidate of shuffled(shapes, random)) {
      const ok = validSiteswapOrNull(candidate, n);
      if (ok) {
        return ok;
      }
    }
    return null;
  }
  if (family === "columns") {
    const shapes = [];
    // Period-4 sync with one hold: 2*column + held = 4*n.
    for (let column = 2; column <= Math.min(35, 2 * n + 2); column += 2) {
      const held = 4 * n - 2 * column;
      if (held < 0 || held > 35 || held % 2 !== 0) {
        continue;
      }
      const c = heightCharacter(column);
      const h = heightCharacter(held);
      shapes.push(`(${c},${c})(${h},0)`, `(${c},${c})(0,${h})`, `(${h},0)(${c},${c})`, `(0,${h})(${c},${c})`);
      shapes.push(`(${c},${h})(${c},0)`, `(${h},${c})(0,${c})`, `(${c},0)(${c},${h})`, `(0,${c})(${h},${c})`);
    }
    for (const candidate of shuffled(shapes, random)) {
      const ok = validSiteswapOrNull(candidate, n);
      if (ok) {
        return ok;
      }
    }
    return null;
  }
  if (family === "fountain") {
    const high = evenHeight(n + (n % 2));
    const low = evenHeight(Math.max(0, 2 * n - high));
    const shapes = [
      `(${heightCharacter(high)},${heightCharacter(low)})`,
      `(${heightCharacter(high)},${heightCharacter(low)})(${heightCharacter(low)},${heightCharacter(high)})`,
      `(${heightCharacter(high)},${heightCharacter(low)})(${heightCharacter(high)},${heightCharacter(low)})`,
    ];
    if (n % 2 === 0) {
      shapes.push(`(${heightCharacter(n)},${heightCharacter(n)})`);
      shapes.push(`(${heightCharacter(n)},${heightCharacter(n)})(${heightCharacter(n)},${heightCharacter(n)})`);
    }
    for (const candidate of shuffled(shapes, random)) {
      const ok = validSiteswapOrNull(candidate, n);
      if (ok) {
        return ok;
      }
    }
    return null;
  }
  if (family === "multiplex") {
    const shapes = [];
    for (let high = Math.max(2, n - 1); high <= Math.min(35, n + 4); high += 1) {
      for (let low = 0; low <= high; low += 1) {
        const rest = 3 * n - high - low;
        if (rest < 0 || rest > 35) {
          continue;
        }
        shapes.push(`[${heightCharacter(high)}${heightCharacter(low)}]${heightCharacter(rest)}`);
        shapes.push(`${heightCharacter(rest)}[${heightCharacter(high)}${heightCharacter(low)}]`);
        if (low > 0) {
          shapes.push(`[${heightCharacter(high)}${heightCharacter(low)}]`);
        }
      }
    }
    for (const candidate of shuffled(shapes, random)) {
      const ok = validSiteswapOrNull(candidate, n);
      if (ok) {
        return ok;
      }
    }
    return null;
  }
  return null;
}

function pickPreferred(patterns, random, preferHighVariance) {
  if (patterns.length === 0) {
    return null;
  }
  if (!preferHighVariance || patterns.length === 1) {
    return patterns[Math.floor(random() * Math.min(5, patterns.length))];
  }
  const ranked = [...patterns].sort(
    (left, right) =>
      siteswapFeatures(right).throwHeightVariance - siteswapFeatures(left).throwHeightVariance,
  );
  const top = ranked.slice(0, Math.min(5, ranked.length));
  return top[Math.floor(random() * top.length)];
}

function finishSiteswap(source, extraHand) {
  if (extraHand === "+" || extraHand === "-") {
    return `${source}${extraHand}`;
  }
  return source;
}

/**
 * Parameter-driven siteswap generation (article generator surface).
 * Named families use parametric construction first; DFS search is a tight backup.
 */
export function generateSiteswap({
  objectCount,
  periodBeats,
  timing = "async",
  maximumThrow,
  minimumThrow = 0,
  restStyle = "none",
  zeroRate = 0,
  multiplex = false,
  family = null,
  extraHand = null,
  throwBias = 0.45,
  random = Math.random,
  limit = 6,
  searchBudget = 8_000,
} = {}) {
  if (!Number.isInteger(objectCount) || objectCount < 1) {
    throw new Error("objectCount must be a positive integer");
  }
  const defaults = familyDefaults(family, objectCount, throwBias);
  let resolvedTiming = defaults.timing ?? timing;
  let resolvedPeriod = defaults.periodBeats ?? periodBeats ?? objectCount;
  let resolvedMax =
    defaults.maximumThrow ??
    maximumThrow ??
    Math.min(35, objectCount + 2 + Math.round(throwBias * 10));
  let resolvedRest = defaults.restStyle ?? restStyle;
  if (resolvedTiming === "sync" && resolvedPeriod % 2 !== 0) {
    resolvedPeriod += 1;
  }
  if (resolvedTiming === "hybrid" && resolvedPeriod < 3) {
    resolvedPeriod = 3;
  }

  if (family) {
    const constructed = constructFamilySiteswap(family, objectCount, throwBias, random);
    if (constructed) {
      return finishSiteswap(constructed, extraHand);
    }
    for (const sibling of shuffled(
      ["shower", "box", "fountain", "columns", "multiplex"].filter((name) => name !== family),
      random,
    ).slice(0, 2)) {
      const siblingPattern = constructFamilySiteswap(sibling, objectCount, throwBias, random);
      if (siblingPattern) {
        return finishSiteswap(siblingPattern, extraHand);
      }
    }
  }

  if (multiplex && !family) {
    const multi = constructFamilySiteswap("multiplex", objectCount, throwBias, random);
    if (multi && random() < 0.55) {
      return finishSiteswap(multi, extraHand);
    }
  }

  const familyMask = family ? createFamilyMask({ family, periodBeats: resolvedPeriod, random }) : null;
  let mask =
    familyMask ??
    (multiplex
      ? createMultiplexMask({ timing: resolvedTiming, periodBeats: Math.min(resolvedPeriod, 6), random })
      : createGenerationMask({
          timing: resolvedTiming,
          periodBeats: Math.min(resolvedPeriod, resolvedTiming === "hybrid" ? 6 : 8),
          random,
        }));
  mask = applyRestMask(mask, resolvedRest, zeroRate, random);
  const budget = Math.min(12_000, Math.max(2_000, searchBudget));

  const backupTiming = resolvedTiming === "hybrid" ? "async" : resolvedTiming;
  const backupPeriod =
    backupTiming === "sync"
      ? Math.max(2, Math.min(resolvedPeriod, 4))
      : Math.max(2, Math.min(resolvedPeriod, 5));
  const attempts = [
    { maximumThrow: resolvedMax, minimumThrow, searchBudget: budget, mask },
    {
      maximumThrow: Math.min(35, resolvedMax + 2),
      minimumThrow: 0,
      searchBudget: budget,
      mask: createGenerationMask({
        timing: backupTiming,
        periodBeats: backupPeriod,
        random,
      }),
    },
  ];

  for (const attempt of attempts) {
    const search = completeSiteswapMask({
      mask: attempt.mask,
      objectCount,
      maximumThrow: attempt.maximumThrow,
      minimumThrow: attempt.minimumThrow,
      limit: Math.min(limit, 4),
      searchBudget: attempt.searchBudget,
      random,
      requireActiveRhythms: false,
    });
    const preferVar = attempt.preferHighVariance ?? defaults.preferHighVariance ?? Boolean(family);
    let candidates = search.patterns;
    if (family && candidates.length > 1) {
      const varied = candidates.filter((pattern) => pattern !== heightCharacter(objectCount));
      if (varied.length > 0) {
        candidates = varied;
      }
    }
    const chosen = pickPreferred(candidates, random, preferVar);
    if (chosen) {
      return finishSiteswap(chosen, extraHand);
    }
  }

  if (family) {
    const lastTry = constructFamilySiteswap(
      pick(random, ["shower", "box", "fountain", "columns"]),
      objectCount,
      throwBias,
      random,
    );
    if (lastTry) {
      return finishSiteswap(lastTry, extraHand);
    }
  }

  return finishSiteswap(trivialSiteswap(objectCount, resolvedTiming), extraHand);
}
