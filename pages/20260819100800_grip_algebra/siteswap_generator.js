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

function wildcardDomains(mask, maximumThrow, random, allowOddSyncThrows) {
  const domains = [];
  let pairDepth = 0;
  for (const character of mask) {
    if (character === "(") {
      pairDepth += 1;
    } else if (character === ")") {
      pairDepth -= 1;
    } else if (character === "?") {
      const values = Array.from({ length: maximumThrow + 1 }, (_, height) => height).filter(
        (height) => pairDepth === 0 || allowOddSyncThrows || height % 2 === 0,
      );
      domains.push(shuffled(values, random));
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
