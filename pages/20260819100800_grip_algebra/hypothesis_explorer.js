import { scheduleEvents, siteswapHighest, siteswapPeriod } from "./siteswap.js";
import { siteswapFeatures } from "./siteswap_generator.js";
import { retentionMetrics } from "./siteswap_metrics.js";

export const HYPOTHESIS_SPECS = [
  {
    id: "release-concentration",
    horizontal: "releaseConcentration",
    vertical: "pAlpha",
  },
  {
    id: "zero-packets",
    horizontal: "zeroPacketShare",
    vertical: "pAlpha",
  },
  {
    id: "empty-run",
    horizontal: "maximumEmptyPacketRun",
    vertical: "alphaMaximumBoutSeconds",
  },
  {
    id: "fragmentation",
    horizontal: "pAlpha",
    vertical: "alphaEntryRateHz",
  },
  {
    id: "pair-exposure",
    horizontal: "meanAirborneCount",
    vertical: "airbornePairExposure",
  },
  {
    id: "height-dispersion",
    horizontal: "throwHeightVariance",
    vertical: "pPolymorphy",
  },
  {
    id: "switching-density",
    horizontal: "switchingDensity",
    vertical: "alphaEntryRateHz",
  },
  {
    id: "identity-cycle",
    horizontal: "notationPeriodBeats",
    vertical: "routingCycleBeats",
  },
  {
    id: "microstate-turnover",
    horizontal: "pPolymorphy",
    vertical: "microstateChangeRateHz",
  },
];

export function analyzeSiteswap({ source, dwellRatio, beatSeconds, holdTwos = true }) {
  const untilBeat = Math.max(64, siteswapPeriod(source) * 8 + siteswapHighest(source));
  let schedule = scheduleEvents(source, holdTwos, untilBeat);
  const completeCycleHorizon = schedule.cycleLength + schedule.highest;
  if (completeCycleHorizon > untilBeat) {
    schedule = scheduleEvents(source, holdTwos, completeCycleHorizon);
  }
  const structure = siteswapFeatures(source, holdTwos);
  const base = {
    source,
    ...structure,
    notationPeriodBeats: structure.periodBeats,
    routingCycleBeats: schedule.cycleLength,
    routingCycleRatio: schedule.cycleLength / structure.periodBeats,
  };
  let retention;
  try {
    retention = retentionMetrics({ schedule, dwellRatio, beatSeconds, holdTwos });
  } catch (error) {
    if (error.code !== "infeasible-retention-timing") {
      throw error;
    }
    return {
      ...base,
      physicalMetricsFeasible: false,
      infeasibleThrowHeight: error.throwHeight,
    };
  }
  const alphaBouts = retention.macrostateBouts.alpha;
  const polymorphyBouts = retention.macrostateBouts.polymorphy;
  const kappaBouts = retention.macrostateBouts.kappa;
  return {
    ...base,
    ...retention,
    physicalMetricsFeasible: true,
    microstateChangeRateHz:
      retention.identityTurnover.totalObjectStateChanges / retention.periodSeconds,
    meanAirborneCount: structure.objectCount * (1 - retention.meanNormalizedRetention),
    alphaEntryRateHz: alphaBouts.entryCount / retention.periodSeconds,
    alphaMeanBoutSeconds: alphaBouts.meanLengthSeconds,
    alphaMaximumBoutSeconds: alphaBouts.maximumLengthSeconds,
    polymorphyEntryRateHz: polymorphyBouts.entryCount / retention.periodSeconds,
    polymorphyMeanBoutSeconds: polymorphyBouts.meanLengthSeconds,
    kappaEntryRateHz: kappaBouts.entryCount / retention.periodSeconds,
    kappaMeanBoutSeconds: kappaBouts.meanLengthSeconds,
  };
}

export function analyzeSiteswaps({ sources, dwellRatio, beatSeconds, holdTwos = true }) {
  return [...new Set(sources)].map((source) => {
    return analyzeSiteswap({ source, dwellRatio, beatSeconds, holdTwos });
  });
}

export function correlationCoefficient(rows, horizontal, vertical) {
  const pairs = rows
    .map((row) => [Number(row[horizontal]), Number(row[vertical])])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pairs.length < 2) {
    return null;
  }
  const meanX = pairs.reduce((sum, [x]) => sum + x, 0) / pairs.length;
  const meanY = pairs.reduce((sum, [, y]) => sum + y, 0) / pairs.length;
  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;
  for (const [x, y] of pairs) {
    covariance += (x - meanX) * (y - meanY);
    varianceX += (x - meanX) ** 2;
    varianceY += (y - meanY) ** 2;
  }
  if (varianceX === 0 || varianceY === 0) {
    return null;
  }
  return covariance / Math.sqrt(varianceX * varianceY);
}

function scale(value, minimum, maximum, low, high) {
  if (minimum === maximum) {
    return (low + high) / 2;
  }
  return low + ((value - minimum) / (maximum - minimum)) * (high - low);
}

export function hypothesisContrastPair(rows, horizontal, vertical) {
  const finiteRows = rows.filter((row) => {
    return Number.isFinite(Number(row[horizontal])) && Number.isFinite(Number(row[vertical]));
  });
  if (finiteRows.length < 2) {
    return null;
  }
  const horizontalValues = finiteRows.map((row) => Number(row[horizontal]));
  const verticalValues = finiteRows.map((row) => Number(row[vertical]));
  const horizontalSpan = Math.max(...horizontalValues) - Math.min(...horizontalValues);
  const verticalSpan = Math.max(...verticalValues) - Math.min(...verticalValues);
  let bestPair = [finiteRows[0], finiteRows[1]];
  let bestScore = -1;
  for (let leftIndex = 0; leftIndex < finiteRows.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < finiteRows.length; rightIndex += 1) {
      const left = finiteRows[leftIndex];
      const right = finiteRows[rightIndex];
      const horizontalDistance = horizontalSpan === 0
        ? 0
        : Math.abs(left[horizontal] - right[horizontal]) / horizontalSpan;
      const verticalDistance = verticalSpan === 0
        ? 0
        : Math.abs(left[vertical] - right[vertical]) / verticalSpan;
      const score = horizontalDistance + verticalDistance;
      if (score > bestScore) {
        bestScore = score;
        bestPair = [left, right];
      }
    }
  }
  return bestPair;
}

export function scatterLayout(rows, horizontal, vertical, width, height, inset = 28) {
  const finiteRows = rows.filter((row) => {
    return Number.isFinite(Number(row[horizontal])) && Number.isFinite(Number(row[vertical]));
  });
  if (finiteRows.length === 0) {
    return [];
  }
  const horizontalValues = finiteRows.map((row) => Number(row[horizontal]));
  const verticalValues = finiteRows.map((row) => Number(row[vertical]));
  const minimumX = Math.min(...horizontalValues);
  const maximumX = Math.max(...horizontalValues);
  const minimumY = Math.min(...verticalValues);
  const maximumY = Math.max(...verticalValues);
  const scaled = finiteRows.map((row) => ({
    ...row,
    x: scale(Number(row[horizontal]), minimumX, maximumX, inset, width - inset),
    y: scale(Number(row[vertical]), minimumY, maximumY, height - inset, inset),
  }));
  const occupied = new Set();
  return scaled.map((point) => {
    const spacing = 10;
    for (let ring = 0; ring <= 12; ring += 1) {
      for (let horizontalOffset = -ring; horizontalOffset <= ring; horizontalOffset += 1) {
        for (let verticalOffset = -ring; verticalOffset <= ring; verticalOffset += 1) {
          if (Math.max(Math.abs(horizontalOffset), Math.abs(verticalOffset)) !== ring) {
            continue;
          }
          const x = point.x + horizontalOffset * spacing;
          const y = point.y + verticalOffset * spacing;
          const key = `${x.toFixed(6)},${y.toFixed(6)}`;
          if (
            x >= inset && x <= width - inset &&
            y >= inset && y <= height - inset &&
            !occupied.has(key)
          ) {
            occupied.add(key);
            return { ...point, x, y };
          }
        }
      }
    }
    return point;
  });
}
