import {
  bernoulliTemporalLaw,
  oneBitFirstPassage,
  twoObjectPhaseLaw,
} from "./formal_laws.js";

function percentagePointChange(current, previous) {
  return (current - previous) * 100;
}

function centralExpectation(objectCount) {
  const heldCount = Math.floor(objectCount / 2);
  return {
    heldCount,
    expectation: oneBitFirstPassage(objectCount)[heldCount],
  };
}

function firstCentralThreshold(threshold) {
  for (let objectCount = 2; objectCount <= 64; objectCount += 1) {
    if (centralExpectation(objectCount).expectation >= threshold) {
      return objectCount;
    }
  }
  return null;
}

export function firstPassageGrowthObservation(objectCount) {
  const current = centralExpectation(objectCount);
  const previous = objectCount > 2 ? centralExpectation(objectCount - 1) : null;
  return {
    centralHeldCount: current.heldCount,
    expectation: current.expectation,
    previousExpectation: previous?.expectation ?? null,
    percentageIncrease: previous
      ? ((current.expectation / previous.expectation) - 1) * 100
      : null,
    crossedThousand: Boolean(
      previous
      && previous.expectation < 1000
      && current.expectation >= 1000
    ),
    firstThousandObjectCount: firstCentralThreshold(1000),
  };
}

export function bernoulliObjectObservation({
  objectCount,
  retentionProbability,
}) {
  const current = bernoulliTemporalLaw({ objectCount, retentionProbability });
  const previous = bernoulliTemporalLaw({
    objectCount: objectCount - 1,
    retentionProbability,
  });
  return {
    polymorphy: current.pPolymorphy,
    previousPolymorphy: previous.pPolymorphy,
    polymorphyPercentagePointChange: percentagePointChange(
      current.pPolymorphy,
      previous.pPolymorphy,
    ),
    homogeneous: current.pAlpha + current.pKappa,
    previousHomogeneous: previous.pAlpha + previous.pKappa,
  };
}

export function phaseStepObservation({
  retentionDuty,
  phaseOffset,
  step,
}) {
  const current = twoObjectPhaseLaw({ retentionDuty, phaseOffset });
  const nextPhaseOffset = phaseOffset < 0.5
    ? Math.min(0.5, phaseOffset + step)
    : Math.max(0, phaseOffset - step);
  const next = twoObjectPhaseLaw({
    retentionDuty,
    phaseOffset: nextPhaseOffset,
  });
  const changes = {
    alpha: percentagePointChange(next.pAlpha, current.pAlpha),
    polymorphy: percentagePointChange(next.pPolymorphy, current.pPolymorphy),
    kappa: percentagePointChange(next.pKappa, current.pKappa),
  };
  return {
    nextPhaseOffset,
    alphaBoutCount: current.alphaBoutCount,
    nextAlphaBoutCount: next.alphaBoutCount,
    sharePercentagePointChanges: changes,
    sharePlateau: Object.values(changes).every((change) => Math.abs(change) < 1e-10),
    boutCountChanged: current.alphaBoutCount !== next.alphaBoutCount,
  };
}
