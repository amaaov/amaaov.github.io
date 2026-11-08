/** Occupancy × object × hand mod matrix — mirrors firmware/ht_mod_matrix.c */

export const OCC_EMPTY = "∅";
export const OCC_KRATOS = "κ";
export const OCC_AKRATEIA = "α";
export const OCC_MIXED = "ακ";

export const MOD_SUSTAIN = "sustain";
export const MOD_STATE_EDGE = "state_edge";
export const MOD_THROW = "throw";
export const MOD_CATCH = "catch";
export const MOD_HAND_EXTREME = "hand_extreme";

const STATE_TABLE = {
  [OCC_EMPTY]: [0, 0, 0, 0, 0, 0, 0],
  [OCC_KRATOS]: [0.55, 0.72, 0.8, 0.45, 0.5, 0.6, 0.35],
  [OCC_AKRATEIA]: [1.15, 0.95, 0.55, 1.1, 0.5, 0.85, 0.7],
  [OCC_MIXED]: [0.85, 0.88, 0.92, 0.78, 0.5, 0.95, 1],
};

export function occupancySign(held, airborne, ballCount) {
  if (!ballCount || (held === 0 && airborne === 0)) {
    return OCC_EMPTY;
  }
  if (held > 0 && airborne > 0) {
    return OCC_MIXED;
  }
  if (held === 0) {
    return OCC_AKRATEIA;
  }
  if (airborne === 0) {
    return OCC_KRATOS;
  }
  return OCC_MIXED;
}

function objectFactor(objectCount, objectIndex, channel) {
  const countScale = 0.7 + 0.06 * Math.max(1, objectCount || 1);
  const indexScale = 0.85 + 0.05 * ((objectIndex || 0) % 7);
  const bump = channel === 6 ? 0.9 + 0.04 * (objectIndex || 0) : 1;
  return countScale * indexScale * bump;
}

function handFactor(hand, dwellPhase, channel) {
  const side = hand === 0 ? 0.92 : 1.08;
  const phase = 0.75 + 0.5 * (dwellPhase || 0);
  if (channel === 4) {
    return hand === 0 ? 0.35 : 0.65;
  }
  return side * phase;
}

/**
 * @param {{ state: string, objectCount: number, objectIndex?: number, hand?: number, dwellPhase?: number, transition?: string }} factors
 */
export function modMatrixCombine(factors) {
  const state = factors?.state ?? OCC_EMPTY;
  const row = STATE_TABLE[state] ?? STATE_TABLE[OCC_EMPTY];
  if (state === OCC_EMPTY) {
    return {
      detune: 0,
      cutoff: 0,
      feedback: 0,
      fmIndex: 0,
      pan: 0,
      engineBias: 0,
      burstGain: 0,
      audible: false,
    };
  }
  const objectCount = factors.objectCount ?? 3;
  const objectIndex = factors.objectIndex ?? 0;
  const hand = factors.hand ?? 1;
  const dwellPhase = factors.dwellPhase ?? 0.5;
  const values = row.map(
    (stateValue, channel) =>
      stateValue * objectFactor(objectCount, objectIndex, channel) * handFactor(hand, dwellPhase, channel),
  );
  const transition = factors.transition ?? MOD_SUSTAIN;
  let burstGain = values[6];
  let fmIndex = values[3];
  if (transition === MOD_SUSTAIN) {
    burstGain *= 0.15;
  } else {
    burstGain *= 1.35;
    fmIndex *= 1.2;
  }
  return {
    detune: values[0],
    cutoff: values[1],
    feedback: values[2],
    fmIndex,
    pan: values[4],
    engineBias: values[5],
    burstGain,
    audible: true,
  };
}
