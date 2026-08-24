import { flightBeats } from "./schedule.js";

const ALPHA = "alpha";
const POLYMORPHY = "polymorphy";
const KAPPA = "kappa";
const MACROSTATES = [ALPHA, POLYMORPHY, KAPPA];
const TOLERANCE = 1e-10;

function validateInputs(schedule, dwellRatio, beatSeconds) {
  if (!schedule || !Array.isArray(schedule.events)) {
    throw new Error("a compiled scheduleEvents result is required");
  }
  if (!Number.isInteger(schedule.ballCount) || schedule.ballCount < 1) {
    throw new Error("compiled schedule must have a positive integer ball count");
  }
  if (!Number.isFinite(schedule.cycleLength) || schedule.cycleLength <= 0) {
    throw new Error("compiled schedule must have a positive cycle length");
  }
  if (!Number.isFinite(dwellRatio) || dwellRatio < 0 || dwellRatio > 1) {
    throw new Error("dwellRatio must lie in [0, 1]");
  }
  if (!Number.isFinite(beatSeconds) || beatSeconds <= 0) {
    throw new Error("beatSeconds must be positive");
  }
  for (const event of schedule.events) {
    if (event.height > 0 && !event.hold && flightBeats(event.height, dwellRatio) < -TOLERANCE) {
      const error = new RangeError("dwell implies negative flight for a non-hold throw");
      error.code = "infeasible-retention-timing";
      error.throwHeight = event.height;
      throw error;
    }
  }
}

function physicalFlight(event, dwellRatio) {
  if (event.height === 0 || event.hold) {
    return 0;
  }
  return Math.max(0, flightBeats(event.height, dwellRatio));
}

function physicalHoldingFlagsAtTime(schedule, timeBeat, dwellRatio) {
  const phaseByBall = new Map();
  for (const event of schedule.events) {
    const nextThrow = event.beat + event.height;
    if (timeBeat < event.beat || timeBeat >= nextThrow) {
      continue;
    }
    const inFlight = !event.hold && timeBeat < event.beat + physicalFlight(event, dwellRatio);
    phaseByBall.set(event.ball, inFlight ? "air" : "hold");
  }
  return Array.from(
    { length: schedule.ballCount },
    (_, ball) => phaseByBall.get(ball) !== "air",
  );
}

function normalizeTime(timeBeat, periodBeats) {
  const normalized = ((timeBeat % periodBeats) + periodBeats) % periodBeats;
  return Math.abs(normalized) < TOLERANCE || Math.abs(normalized - periodBeats) < TOLERANCE
    ? 0
    : normalized;
}

function transitionBoundaries(schedule, dwellRatio) {
  const boundaries = [0];
  for (const event of schedule.events) {
    if (event.height <= 0 || event.hold) {
      continue;
    }
    boundaries.push(normalizeTime(event.beat, schedule.cycleLength));
    boundaries.push(
      normalizeTime(
        event.beat + physicalFlight(event, dwellRatio),
        schedule.cycleLength,
      ),
    );
  }
  boundaries.sort((left, right) => left - right);
  return boundaries.filter((boundary, index) => {
    return index === 0 || Math.abs(boundary - boundaries[index - 1]) > TOLERANCE;
  });
}

function macrostateFor(heldCount, objectCount) {
  if (heldCount === 0) {
    return ALPHA;
  }
  if (heldCount === objectCount) {
    return KAPPA;
  }
  return POLYMORPHY;
}

function periodicSegments(schedule, dwellRatio) {
  const boundaries = transitionBoundaries(schedule, dwellRatio);
  return boundaries.map((startBeat, index) => {
    const finishBeat = boundaries[index + 1] ?? schedule.cycleLength;
    const timeBeat = startBeat + (finishBeat - startBeat) / 2;
    const heldFlags = physicalHoldingFlagsAtTime(schedule, timeBeat, dwellRatio);
    const heldCount = heldFlags.filter(Boolean).length;
    return {
      lengthBeats: finishBeat - startBeat,
      heldFlags,
      heldCount,
      macrostate: macrostateFor(heldCount, schedule.ballCount),
    };
  }).filter((segment) => segment.lengthBeats > TOLERANCE);
}

function mergedRuns(segments, keyForSegment) {
  return segments.reduce((runs, segment) => {
    const key = keyForSegment(segment);
    const previous = runs[runs.length - 1];
    if (previous && previous.key === key) {
      previous.lengthBeats += segment.lengthBeats;
    } else {
      runs.push({ key, lengthBeats: segment.lengthBeats, segment });
    }
    return runs;
  }, []);
}

function macrostateBoutMetrics(segments, macrostate, periodBeats, beatSeconds) {
  const runs = mergedRuns(segments, (segment) => segment.macrostate);
  if (runs.length > 1 && runs[0].key === runs[runs.length - 1].key) {
    runs[0].lengthBeats += runs.pop().lengthBeats;
  }
  const lengths = runs
    .filter((run) => run.key === macrostate)
    .map((run) => run.lengthBeats);
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const mean = lengths.length === 0 ? 0 : total / lengths.length;
  const maximum = lengths.length === 0 ? 0 : Math.max(...lengths);
  const constant = lengths.length === 1 && Math.abs(lengths[0] - periodBeats) <= TOLERANCE;
  return {
    entryCount: constant ? 0 : lengths.length,
    boutCount: lengths.length,
    meanLengthBeats: mean,
    maximumLengthBeats: maximum,
    meanLengthSeconds: mean * beatSeconds,
    maximumLengthSeconds: maximum * beatSeconds,
  };
}

function flagsKey(flags) {
  return flags.map((held) => (held ? "1" : "0")).join("");
}

function hammingDistance(left, right) {
  return left.reduce((distance, held, index) => distance + Number(held !== right[index]), 0);
}

function identityTurnoverMetrics(segments) {
  const runs = mergedRuns(segments, (segment) => flagsKey(segment.heldFlags));
  const packets = [];
  if (runs.length > 1) {
    runs.forEach((run, index) => {
      const next = runs[(index + 1) % runs.length];
      const before = run.segment.heldFlags;
      const after = next.segment.heldFlags;
      const stateChanges = hammingDistance(before, after);
      if (stateChanges > 0) {
        packets.push({
          stateChanges,
          occupancyNeutral: run.segment.heldCount === next.segment.heldCount,
        });
      }
    });
  }
  const total = packets.reduce((sum, packet) => sum + packet.stateChanges, 0);
  return {
    packetCount: packets.length,
    totalObjectStateChanges: total,
    meanObjectStateChangesPerPacket: packets.length === 0 ? 0 : total / packets.length,
    maximumObjectStateChangesPerPacket: packets.length === 0
      ? 0
      : Math.max(...packets.map((packet) => packet.stateChanges)),
    occupancyNeutralExchangePacketCount: packets.filter((packet) => packet.occupancyNeutral).length,
  };
}

function cleanShare(value) {
  if (Math.abs(value) <= TOLERANCE) {
    return 0;
  }
  if (Math.abs(value - 1) <= TOLERANCE) {
    return 1;
  }
  return value;
}

function entropyBits(probabilities) {
  const entropy = -probabilities.reduce((total, probability) => {
    return probability === 0 ? total : total + probability * Math.log2(probability);
  }, 0);
  return Math.abs(entropy) <= TOLERANCE ? 0 : entropy;
}

export function retentionMetrics({ schedule, dwellRatio, beatSeconds, holdTwos = true }) {
  validateInputs(schedule, dwellRatio, beatSeconds);
  const segments = periodicSegments(schedule, dwellRatio);
  const occupancyDurations = Array(schedule.ballCount + 1).fill(0);
  for (const segment of segments) {
    occupancyDurations[segment.heldCount] += segment.lengthBeats;
  }
  const occupancySharesByHeldCount = occupancyDurations.map((duration) => {
    return cleanShare(duration / schedule.cycleLength);
  });
  const pAlpha = occupancySharesByHeldCount[0];
  const pKappa = occupancySharesByHeldCount[schedule.ballCount];
  const pPolymorphy = cleanShare(1 - pAlpha - pKappa);
  const meanHeld = occupancySharesByHeldCount.reduce((total, share, heldCount) => {
    return total + share * heldCount;
  }, 0);
  const airbornePairExposure = occupancySharesByHeldCount.reduce((total, share, heldCount) => {
    const airborneCount = schedule.ballCount - heldCount;
    return total + share * airborneCount * (airborneCount - 1) / 2;
  }, 0);
  const macrostateBouts = Object.fromEntries(MACROSTATES.map((macrostate) => [
    macrostate,
    macrostateBoutMetrics(segments, macrostate, schedule.cycleLength, beatSeconds),
  ]));

  return {
    objectCount: schedule.ballCount,
    dwellRatio,
    holdTwos,
    beatSeconds,
    beatFrequencyHz: 1 / beatSeconds,
    periodBeats: schedule.cycleLength,
    periodSeconds: schedule.cycleLength * beatSeconds,
    occupancySharesByHeldCount,
    pAlpha,
    pPolymorphy,
    pKappa,
    meanNormalizedRetention: meanHeld / schedule.ballCount,
    airbornePairExposure,
    macrostateEntropyBits: entropyBits([pAlpha, pPolymorphy, pKappa]),
    macrostateBouts,
    identityTurnover: identityTurnoverMetrics(segments),
  };
}
