/**
 * Morse window → siteswap unit steps.
 *
 * Preferred heights (used when the landing is free):
 *   3  dit — short cascade (cross)
 *   4  dah — fountain (same hand; visual units match Morse dah length)
 *   1  zip — intra-letter side change
 *   0  rest — inter-letter nothing
 *
 * Throws are then adjusted so the full period is a valid siteswap:
 * each beat lands in a unique slot (i + throw) mod period.
 */

export function patternsFromBeats(beats) {
  if (!beats?.length) return [];
  return [beats.map((beat) => (beat.kind === "dah" ? "-" : ".")).join("")];
}

/** Classic asynchronous siteswap validity: landings are a permutation. */
export function isValidSiteswap(throws) {
  const values = (throws || []).map((value) => Number(value));
  const period = values.length;
  if (period === 0) return true;
  if (values.some((value) => !Number.isFinite(value) || value < 0)) return false;
  const landings = new Set();
  for (let index = 0; index < period; index += 1) {
    const land = (index + values[index]) % period;
    if (landings.has(land)) return false;
    landings.add(land);
  }
  return landings.size === period;
}

function preferredThrows(kind, period) {
  const ceiling = Math.max(period + 2, 9);
  const sequence = [];
  const pushUnique = (value) => {
    if (value < 0 || value > ceiling) return;
    if (!sequence.includes(value)) sequence.push(value);
  };

  if (kind === "dit") {
    for (let height = 3; height <= ceiling; height += 2) pushUnique(height);
    pushUnique(1);
  } else if (kind === "dah") {
    for (let height = 4; height <= ceiling; height += 2) pushUnique(height);
    for (let height = 5; height <= ceiling; height += 2) pushUnique(height);
    pushUnique(3);
    pushUnique(2);
  } else if (kind === "zip") {
    for (let height = 1; height <= ceiling; height += 2) pushUnique(height);
  } else if (kind === "rest") {
    for (let height = 0; height <= ceiling; height += 2) pushUnique(height);
  }

  for (let height = 0; height <= ceiling; height += 1) pushUnique(height);
  return sequence;
}

const ASSIGN_KIND_ORDER = { rest: 0, zip: 1, dit: 2, dah: 3 };

function assignValidThrows(roles) {
  const period = roles.length;
  if (period === 0) return [];
  const throws = new Array(period);
  const taken = new Array(period).fill(false);
  const order = roles
    .map((role, index) => index)
    .sort((left, right) => {
      const kindDelta =
        (ASSIGN_KIND_ORDER[roles[left].kind] ?? 9) -
        (ASSIGN_KIND_ORDER[roles[right].kind] ?? 9);
      if (kindDelta !== 0) return kindDelta;
      return left - right;
    });

  for (const index of order) {
    let assigned = false;
    for (const height of preferredThrows(roles[index].kind, period)) {
      const land = (index + height) % period;
      if (taken[land]) continue;
      taken[land] = true;
      throws[index] = height;
      assigned = true;
      break;
    }
    if (assigned) continue;
    // Always at least one free landing while slots remain.
    const land = taken.findIndex((slot) => !slot);
    taken[land] = true;
    throws[index] = (land - index + period * 8) % period;
  }
  return throws;
}

function roleStepsFromPatterns(patterns) {
  const list = (patterns || []).filter(Boolean);
  const roles = [];
  let clockBeatIndex = 0;

  list.forEach((pattern, patternIndex) => {
    const tones = [...String(pattern)].filter(
      (character) => character === "." || character === "-",
    );
    tones.forEach((tone, toneIndex) => {
      if (tone === ".") {
        roles.push({
          kind: "dit",
          clockBeatIndex,
          phase: "tone",
          units: 1,
        });
      } else {
        roles.push({
          kind: "dah",
          clockBeatIndex,
          phase: "tone",
          units: 3,
        });
      }
      clockBeatIndex += 1;

      if (toneIndex < tones.length - 1) {
        roles.push({
          kind: "zip",
          clockBeatIndex: clockBeatIndex - 1,
          phase: "gap",
          units: 1,
        });
      } else if (patternIndex < list.length - 1) {
        for (let rest = 0; rest < 3; rest += 1) {
          roles.push({
            kind: "rest",
            clockBeatIndex: clockBeatIndex - 1,
            phase: "gap",
            units: 1,
          });
        }
      }
    });
  });

  return roles;
}

export function siteswapStepsFromPatterns(patterns) {
  const roles = roleStepsFromPatterns(patterns);
  const throws = assignValidThrows(roles);
  let hand = 0;
  return roles.map((role, index) => {
    const throwValue = throws[index];
    const entry = {
      throwValue,
      kind: role.kind,
      hand,
      clockBeatIndex: role.clockBeatIndex,
      phase: role.phase,
      units: role.units,
    };
    if (throwValue % 2 === 1) hand = 1 - hand;
    return entry;
  });
}

/** Map clock face progress (tone weights 0–1) onto siteswap unit timeline 0–1. */
export function siteswapProgressFromClock(steps, beats, progress) {
  if (!steps.length) return 0;
  const totalUnits = steps.reduce((sum, entry) => sum + entry.units, 0) || 1;
  if (!beats?.length) {
    return Math.min(1, Math.max(0, progress));
  }

  const toneTotal = beats.reduce((sum, beat) => sum + beat.weight, 0) || 1;
  const clamped = Math.min(1, Math.max(0, progress));
  let toneCursor = 0;
  let beatIndex = beats.length - 1;
  let local = 1;

  for (let index = 0; index < beats.length; index += 1) {
    const start = toneCursor / toneTotal;
    toneCursor += beats[index].weight;
    const end = toneCursor / toneTotal;
    if (clamped < end || index === beats.length - 1) {
      beatIndex = index;
      local = (clamped - start) / Math.max(0.0001, end - start);
      break;
    }
  }

  const toneSteps = steps.filter(
    (entry) => entry.clockBeatIndex === beatIndex && entry.phase === "tone",
  );
  let unitsBefore = 0;
  for (const entry of steps) {
    if (entry.clockBeatIndex === beatIndex && entry.phase === "tone") break;
    unitsBefore += entry.units;
  }
  const toneUnits = toneSteps.reduce((sum, entry) => sum + entry.units, 0) || 1;
  const within = Math.min(1, Math.max(0, local)) * toneUnits;
  return (unitsBefore + within) / totalUnits;
}

export function activeStepIndex(steps, siteswapProgress) {
  if (!steps.length) return -1;
  const totalUnits = steps.reduce((sum, entry) => sum + entry.units, 0) || 1;
  let cursor = 0;
  const target = Math.min(1, Math.max(0, siteswapProgress)) * totalUnits;
  for (let index = 0; index < steps.length; index += 1) {
    cursor += steps[index].units;
    if (target < cursor || index === steps.length - 1) return index;
  }
  return steps.length - 1;
}

/** Inverse of siteswapProgressFromClock for ladder scrubbing. */
export function clockProgressFromSiteswap(steps, beats, siteswapProgress) {
  if (!beats?.length || !steps.length) {
    return Math.min(1, Math.max(0, siteswapProgress));
  }
  const totalUnits = steps.reduce((sum, entry) => sum + entry.units, 0) || 1;
  const target = Math.min(1, Math.max(0, siteswapProgress)) * totalUnits;
  let cursor = 0;
  let stepIndex = 0;
  for (; stepIndex < steps.length; stepIndex += 1) {
    const next = cursor + steps[stepIndex].units;
    if (target < next || stepIndex === steps.length - 1) break;
    cursor = next;
  }
  const current = steps[stepIndex];
  const beatIndex = Math.max(0, current?.clockBeatIndex ?? 0);
  const toneTotal = beats.reduce((sum, beat) => sum + beat.weight, 0) || 1;
  let toneBefore = 0;
  for (let index = 0; index < beatIndex; index += 1) {
    toneBefore += beats[index].weight;
  }
  const toneSteps = steps.filter(
    (entry) => entry.clockBeatIndex === beatIndex && entry.phase === "tone",
  );
  const toneUnits = toneSteps.reduce((sum, entry) => sum + entry.units, 0) || 1;
  let toneCursor = 0;
  for (const entry of steps) {
    if (entry.clockBeatIndex !== beatIndex) {
      if (entry.clockBeatIndex > beatIndex) break;
      continue;
    }
    if (entry.phase !== "tone") continue;
    if (entry === current || steps.indexOf(entry) === stepIndex) {
      const localUnit = Math.min(
        1,
        Math.max(0, (target - cursor) / Math.max(0.0001, current.units)),
      );
      const within = (toneCursor + localUnit * entry.units) / toneUnits;
      return (toneBefore + within * beats[beatIndex].weight) / toneTotal;
    }
    toneCursor += entry.units;
  }
  return (toneBefore + beats[beatIndex].weight) / toneTotal;
}
