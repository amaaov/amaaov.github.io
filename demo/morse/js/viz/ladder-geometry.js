import {
  activeStepIndex,
  clockProgressFromSiteswap,
  patternsFromBeats,
  siteswapProgressFromClock,
  siteswapStepsFromPatterns,
} from "./ladder-siteswap.js";

export function ladderLayout(width, height, beats, patterns) {
  const marginX = width * 0.18;
  const top = height * 0.16;
  const bottom = height * 0.86;
  const leftRail = marginX;
  const rightRail = width - marginX;
  const span = bottom - top;
  const resolvedPatterns =
    patterns?.length > 0 ? patterns : patternsFromBeats(beats);
  const steps = siteswapStepsFromPatterns(resolvedPatterns);
  const totalUnits = steps.reduce((sum, step) => sum + step.units, 0) || 1;
  const nodes = [];
  let cursor = 0;

  steps.forEach((step, index) => {
    const start = cursor / totalUnits;
    cursor += step.units;
    nodes.push({
      index,
      throwValue: step.throwValue,
      kind: step.kind,
      hand: step.hand,
      phase: step.phase,
      clockBeatIndex: step.clockBeatIndex,
      units: step.units,
      progressStart: start,
      progressEnd: cursor / totalUnits,
      x: step.hand === 0 ? leftRail : rightRail,
      y: bottom - start * span,
    });
  });

  return {
    leftRail,
    rightRail,
    top,
    bottom,
    span,
    nodes,
    steps,
    siteswapText: steps.map((step) => String(step.throwValue)).join(""),
  };
}

export function throwCurve(node, next, top, span, nodesLength) {
  const wrap = node.index === nodesLength - 1;
  const toX = next?.x ?? node.x;
  const toY = wrap ? top - span * 0.02 : next.y;
  const midX = (node.x + toX) / 2;

  if (node.throwValue === 0) {
    return { toX: node.x, toY: node.y, midX: node.x, peak: node.y, style: "rest" };
  }
  if (node.throwValue === 2) {
    const peak = node.y - span * 0.045;
    return {
      toX: node.x,
      toY:
        next && next.hand === node.hand && !wrap
          ? next.y
          : node.y - span * 0.02,
      midX: node.x + (node.hand === 0 ? -1 : 1) * span * 0.04,
      peak,
      style: "hold",
    };
  }
  if (node.throwValue === 1) {
    const peak = (node.y + toY) / 2 - span * 0.02;
    return { toX, toY, midX, peak, style: "zip" };
  }
  if (node.throwValue % 2 === 0) {
    // Fountain (4, 6, …): same-hand arc, taller than a dit
    const landY =
      next && next.hand === node.hand && !wrap
        ? next.y
        : node.y - span * Math.min(0.22, 0.05 * node.throwValue);
    const peak = Math.min(node.y, landY) - span * (0.1 + node.throwValue * 0.015);
    return {
      toX: node.x,
      toY: landY,
      midX: node.x + (node.hand === 0 ? -1 : 1) * span * 0.06,
      peak,
      style: "fountain",
    };
  }

  // Odd cascade (3, 5, …): cross to other rail
  const peak =
    Math.min(node.y, toY) - span * (node.throwValue >= 5 ? 0.16 : 0.08);
  return { toX, toY, midX, peak, style: "throw" };
}

export function quadPoint(x0, y0, x1, y1, x2, y2, t) {
  const u = 1 - t;
  return {
    x: u * u * x0 + 2 * u * t * x1 + t * t * x2,
    y: u * u * y0 + 2 * u * t * y1 + t * t * y2,
  };
}

export function ladderProgress(beats, patterns, progress) {
  const resolved =
    patterns?.length > 0 ? patterns : patternsFromBeats(beats);
  const steps = siteswapStepsFromPatterns(resolved);
  const siteswapProgress = siteswapProgressFromClock(steps, beats, progress);
  return {
    steps,
    siteswapProgress,
    activeIndex: activeStepIndex(steps, siteswapProgress),
  };
}

export function pointerToLadderProgress(clientX, clientY, canvas) {
  const rect = canvas.getBoundingClientRect();
  const top = rect.height * 0.16;
  const bottom = rect.height * 0.86;
  const y = clientY - rect.top;
  if (bottom <= top) return 0;
  return Math.min(1, Math.max(0, (bottom - y) / (bottom - top)));
}

/** Pointer Y on ladder → clock tone progress (0–1). */
export function pointerToClockProgressFromLadder(
  clientX,
  clientY,
  canvas,
  beats,
  patterns,
) {
  const siteswapProgress = pointerToLadderProgress(clientX, clientY, canvas);
  const resolved =
    patterns?.length > 0 ? patterns : patternsFromBeats(beats);
  const steps = siteswapStepsFromPatterns(resolved);
  return clockProgressFromSiteswap(steps, beats, siteswapProgress);
}
