import { macrostateName } from "./passing_occupancy.js";

export const COURT_DWELL_RATIO = 0.25;
export const COURT_BEATS_PER_MINUTE = 150;

const SIGN_LABELS = {
  alpha: "α",
  polymorphy: "ακ",
  kappa: "κ",
  empty: "—",
};

export function signLabel(sign) {
  return SIGN_LABELS[sign] ?? sign;
}

export function normalizeDwellRatio(value) {
  const dwellRatio = Number(value);
  if (!Number.isFinite(dwellRatio)) {
    return COURT_DWELL_RATIO;
  }
  return Math.min(0.4, Math.max(0.1, dwellRatio));
}

export function normalizeBeatsPerMinute(value) {
  const beatsPerMinute = Number(value);
  if (!Number.isFinite(beatsPerMinute)) {
    return COURT_BEATS_PER_MINUTE;
  }
  return Math.min(210, Math.max(60, beatsPerMinute));
}

export function beatSecondsFromTempo(beatsPerMinute) {
  return 60 / normalizeBeatsPerMinute(beatsPerMinute);
}

export function advanceCourtClock(clock, stamp) {
  let elapsed = clock.elapsed;
  if (clock.lastStamp !== 0 && !clock.paused) {
    elapsed += (stamp - clock.lastStamp) / 1000;
  }
  return { ...clock, elapsed, lastStamp: stamp };
}

export function toggleCourtPause(clock) {
  return { ...clock, paused: !clock.paused };
}

export function stepCourtClock(clock, beatSeconds, beats = 1) {
  return {
    ...clock,
    elapsed: clock.elapsed + beatSeconds * beats,
    paused: true,
  };
}

export function bodyRetention(positions, bodyCount) {
  const rows = Array.from({ length: bodyCount }, (_, body) => ({
    body,
    held: 0,
    inbound: 0,
  }));
  positions.forEach((position) => {
    if (position.held) {
      const body = Math.floor(position.hand / 2);
      if (rows[body]) {
        rows[body].held += 1;
      }
      return;
    }
    const body = position.to?.body;
    if (rows[body]) {
      rows[body].inbound += 1;
    }
  });
  return rows.map((row) => {
    const local = row.held + row.inbound;
    return {
      ...row,
      local,
      sign: local === 0 ? "empty" : macrostateName(row.held, local),
    };
  });
}

export function groupRetention(held, objectCount) {
  const sign = macrostateName(held, objectCount);
  return {
    held,
    objectCount,
    airborne: objectCount - held,
    sign,
  };
}
