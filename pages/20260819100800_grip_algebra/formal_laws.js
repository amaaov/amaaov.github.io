function clean(value) {
  if (Math.abs(value) < 1e-12) return 0;
  if (Math.abs(value - 1) < 1e-12) return 1;
  return Number(value.toFixed(12));
}

function requireRange(value, minimum, maximum, label, openMaximum = false) {
  const valid = Number.isFinite(value)
    && value >= minimum
    && (openMaximum ? value < maximum : value <= maximum);
  if (!valid) {
    throw new RangeError(`${label} must lie in [${minimum}, ${maximum}${openMaximum ? ")" : "]"}`);
  }
}

export function twoObjectPhaseLaw({ retentionDuty, phaseOffset }) {
  if (!Number.isFinite(retentionDuty) || retentionDuty <= 0 || retentionDuty >= 1) {
    throw new RangeError("retention duty must lie in (0, 1)");
  }
  requireRange(phaseOffset, 0, 0.5, "phase offset");
  const positivePart = (value) => Math.max(value, 0);
  const pKappa = clean(
    positivePart(retentionDuty - phaseOffset)
      + positivePart(retentionDuty + phaseOffset - 1),
  );
  const pAlpha = clean(
    positivePart(1 - retentionDuty - phaseOffset)
      + positivePart(phaseOffset - retentionDuty),
  );
  const pAmphoteron = clean(1 - pAlpha - pKappa);
  const alphaBoutFractions = [
    phaseOffset - retentionDuty,
    1 - retentionDuty - phaseOffset,
  ].filter((value) => value > 1e-12).map(clean).sort((left, right) => left - right);
  return {
    pAlpha,
    pAmphoteron,
    pKappa,
    macrostateShares: [pAlpha, pAmphoteron, pKappa],
    alphaBoutFractions,
    alphaBoutCount: alphaBoutFractions.length,
  };
}

export function bernoulliTemporalLaw({ objectCount, retentionProbability }) {
  if (!Number.isInteger(objectCount) || objectCount < 1) {
    throw new RangeError("object count must be a positive integer");
  }
  requireRange(retentionProbability, 0, 1, "retention probability");
  const pAlpha = clean((1 - retentionProbability) ** objectCount);
  const pKappa = clean(retentionProbability ** objectCount);
  return {
    pAlpha,
    pAmphoteron: clean(1 - pAlpha - pKappa),
    pKappa,
  };
}

function binomial(total, selected) {
  const count = Math.min(selected, total - selected);
  let result = 1;
  for (let index = 1; index <= count; index += 1) {
    result = result * (total - count + index) / index;
  }
  return result;
}

export function oneBitFirstPassage(objectCount) {
  if (!Number.isInteger(objectCount) || objectCount < 2) {
    throw new RangeError("object count must be an integer of at least two");
  }
  const expectations = [0];
  for (let heldCount = 1; heldCount < objectCount; heldCount += 1) {
    let expectation = 0;
    for (let index = 0; index < heldCount; index += 1) {
      let cumulativeStates = 0;
      for (let weight = 0; weight <= index; weight += 1) {
        cumulativeStates += binomial(objectCount, weight);
      }
      expectation += (
        (2 ** (objectCount - 1) - cumulativeStates)
        / binomial(objectCount - 1, index)
      );
    }
    expectations.push(expectation);
  }
  expectations.push(0);
  return expectations;
}

export function sampleLawCurve(evaluate, { minimum, maximum, steps }) {
  if (!Number.isInteger(steps) || steps < 1 || maximum <= minimum) {
    throw new RangeError("curve sampling needs an ordered interval and positive step count");
  }
  return Array.from({ length: steps + 1 }, (_, index) => {
    const x = minimum + ((maximum - minimum) * index) / steps;
    return { x: clean(x), y: clean(evaluate(x)) };
  });
}
