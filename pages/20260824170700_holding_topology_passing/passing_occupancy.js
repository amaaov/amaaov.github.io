const MACROSTATES = ["alpha", "polymorphy", "kappa"];

function ticksPerBeat(dwellRatio) {
  for (let denominator = 1; denominator <= 64; denominator += 1) {
    const numerator = dwellRatio * denominator;
    if (Math.abs(numerator - Math.round(numerator)) < 1e-12) {
      return denominator;
    }
  }
  return 1024;
}

function splitInterval(start, length, period) {
  if (length === 0) {
    return [];
  }
  if (length >= period) {
    return [[0, period]];
  }
  const normalized = ((start % period) + period) % period;
  const finish = normalized + length;
  if (finish <= period) {
    return [[normalized, finish]];
  }
  return [[normalized, period], [0, finish - period]];
}

function mergeAdjacent(segments, field) {
  return segments.reduce((merged, segment) => {
    const previous = merged[merged.length - 1];
    if (previous === undefined || previous[field] !== segment[field]) {
      merged.push({ ...segment });
    } else {
      previous.finish = segment.finish;
      previous.length += segment.length;
    }
    return merged;
  }, []);
}

export function heldIntervalsFromCycle(cycleTosses, cycleLength, dwellRatio) {
  const ticks = ticksPerBeat(dwellRatio);
  const dwellTicks = 2 * dwellRatio * ticks;
  const byObject = new Map();
  cycleTosses.forEach((event) => {
    if (event.kind === "empty" || event.ball === null) {
      return;
    }
    if (!byObject.has(event.ball)) {
      byObject.set(event.ball, []);
    }
    if (event.kind === "hold") {
      byObject.get(event.ball).push({
        start: event.beat * ticks,
        length: event.height * ticks,
        hand: event.fromHand,
        body: event.fromBody,
      });
      return;
    }
    byObject.get(event.ball).push({
      start: event.beat * ticks + event.height * ticks - dwellTicks,
      length: dwellTicks,
      hand: event.toHand,
      body: event.toBody,
    });
  });
  return {
    ticks,
    periodTicks: cycleLength * ticks,
    intervals: [...byObject.entries()].sort((left, right) => left[0] - right[0]).map(([, rows]) => rows),
  };
}

export function occupancyFromHeldIntervals(heldIntervals, period) {
  const objectCount = heldIntervals.length;
  const segments = heldIntervals.map((intervals) => {
    return intervals.flatMap((interval) => {
      return splitInterval(interval.start, interval.length, period);
    });
  });
  const boundaries = [0, period, ...segments.flat(1)].flat().filter((value, index, values) => {
    return values.indexOf(value) === index;
  }).sort((left, right) => left - right);
  const membership = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const finish = boundaries[index + 1];
    const heldCount = segments.filter((objectSegments) => {
      return objectSegments.some(([heldStart, heldFinish]) => {
        return heldStart <= start && finish <= heldFinish;
      });
    }).length;
    membership.push({ start, finish, length: finish - start, heldCount });
  }
  const occupancyTicks = Array.from({ length: objectCount + 1 }, () => 0);
  mergeAdjacent(membership, "heldCount").forEach((segment) => {
    occupancyTicks[segment.heldCount] += segment.length;
  });
  const occupancyShares = occupancyTicks.map((ticks) => ticks / period);
  return {
    objectCount,
    occupancyShares,
    pAlpha: occupancyTicks[0] / period,
    pPolymorphy: occupancyTicks.slice(1, -1).reduce((sum, ticks) => sum + ticks, 0) / period,
    pKappa: occupancyTicks[objectCount] / period,
  };
}

export function passingOccupancy(schedule, dwellRatio) {
  const held = heldIntervalsFromCycle(schedule.cycleTosses, schedule.cycleLength, dwellRatio);
  return occupancyFromHeldIntervals(held.intervals, held.periodTicks);
}

export function macrostateName(heldCount, objectCount) {
  if (heldCount === 0) {
    return MACROSTATES[0];
  }
  if (heldCount === objectCount) {
    return MACROSTATES[2];
  }
  return MACROSTATES[1];
}

export function akrateiaPresent(sign) {
  return sign === "alpha" || sign === "polymorphy";
}

export function kratosPresent(sign) {
  return sign === "kappa" || sign === "polymorphy";
}
