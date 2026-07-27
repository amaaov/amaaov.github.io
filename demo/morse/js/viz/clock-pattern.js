import { normalizeMorse } from "../morse/encode.js";

/** Hard cap so the dial stays readable. */
export const MAX_CLOCK_BEATS = 16;

/**
 * Minimum tone weight for a letter to fill a clock alone.
 * O (---) is the reference: three dahs = 9 units.
 */
export const MIN_SOLO_CLOCK_WEIGHT = 9;

/** Token stream matching playback (dits, dahs, letter/word gaps). */
export function tokenizeMorse(morse) {
  return [...normalizeMorse(morse)].filter((character) => ".-/ ".includes(character));
}

export function beatsFromPattern(pattern) {
  return [...String(pattern)]
    .filter((character) => character === "." || character === "-")
    .map((character) => ({
      kind: character === "." ? "dit" : "dah",
      weight: character === "." ? 1 : 3,
    }));
}

export function patternUnitWeight(beats) {
  return beats.reduce((sum, beat) => sum + beat.weight, 0);
}

function toneCount(pattern) {
  return beatsFromPattern(pattern).length;
}

function clipPattern(pattern, maxBeats = MAX_CLOCK_BEATS) {
  let kept = "";
  for (const character of String(pattern)) {
    if (character !== "." && character !== "-") continue;
    if (kept.length >= maxBeats) break;
    kept += character;
  }
  return kept;
}

function weightOfPatterns(patterns) {
  return patternUnitWeight(beatsFromPattern(patterns.join("")));
}

/** One span per letter code in the Morse stream (gaps excluded). */
export function letterSpansFromMorse(morse) {
  const tokens = tokenizeMorse(morse);
  const spans = [];
  let start = null;
  let pattern = "";

  for (let offset = 0; offset < tokens.length; offset += 1) {
    const token = tokens[offset];
    if (token === "." || token === "-") {
      if (start === null) start = offset;
      pattern += token;
      continue;
    }
    if (pattern) {
      spans.push({ start, end: offset - 1, pattern });
      start = null;
      pattern = "";
    }
  }
  if (pattern) spans.push({ start, end: tokens.length - 1, pattern });
  return spans;
}

function tryAppendLetter(patterns, span) {
  const nextPattern = clipPattern(span.pattern);
  if (!nextPattern) return false;
  if (toneCount(patterns.join("")) + toneCount(nextPattern) > MAX_CLOCK_BEATS) {
    return false;
  }
  patterns.push(nextPattern);
  return true;
}

/**
 * Pack forward until the window is full enough for a solo-style face, or
 * no further letter fits under MAX_CLOCK_BEATS.
 */
function packForward(spans, startIndex) {
  const firstPattern = clipPattern(spans[startIndex]?.pattern || "");
  if (!firstPattern) return null;

  const patterns = [firstPattern];
  const windowSpans = [spans[startIndex]];
  let index = startIndex + 1;

  while (
    weightOfPatterns(patterns) < MIN_SOLO_CLOCK_WEIGHT &&
    index < spans.length
  ) {
    if (!tryAppendLetter(patterns, spans[index])) break;
    windowSpans.push(spans[index]);
    index += 1;
  }

  return { patterns, windowSpans, nextIndex: index };
}

/** True when packing from this index cannot reach a full-clock weight. */
function isShortOrphanGroup(spans, startIndex) {
  if (startIndex >= spans.length) return false;
  const packed = packForward(spans, startIndex);
  if (!packed) return false;
  return weightOfPatterns(packed.patterns) < MIN_SOLO_CLOCK_WEIGHT;
}

/**
 * One clock revolution: pack short letters together until O-weight (9 units)
 * or the beat cap. Absorb a trailing short orphan group when it fits so E/S
 * never sit alone when neighbors are available. O (---) may stand alone.
 */
export function clockWindowFromSpans(spans, startIndex) {
  if (!spans.length || startIndex < 0 || startIndex >= spans.length) return null;
  const packed = packForward(spans, startIndex);
  if (!packed) return null;

  const { patterns, windowSpans } = packed;
  let index = packed.nextIndex;

  while (index < spans.length && isShortOrphanGroup(spans, index)) {
    if (!tryAppendLetter(patterns, spans[index])) break;
    windowSpans.push(spans[index]);
    index += 1;
  }

  const pattern = patterns.join("");
  const beats = beatsFromPattern(pattern);
  return {
    startIndex,
    letterCount: patterns.length,
    patterns,
    pattern,
    beats,
    spans: windowSpans,
    weight: patternUnitWeight(beats),
  };
}

/** Non-overlapping windows used during play (greedy from the start). */
export function windowStartForLetterIndex(spans, letterIndex) {
  let index = 0;
  while (index < spans.length) {
    const window = clockWindowFromSpans(spans, index);
    if (!window) return letterIndex;
    const end = index + window.letterCount - 1;
    if (letterIndex >= index && letterIndex <= end) return index;
    index += window.letterCount;
  }
  return letterIndex;
}

/**
 * Idle showcase: densest readable window (prefer more beats, then more letters).
 */
export function idleClockWindow(morse) {
  const spans = letterSpansFromMorse(morse);
  let best = null;
  for (let index = 0; index < spans.length; index += 1) {
    const window = clockWindowFromSpans(spans, index);
    if (!window) continue;
    if (
      !best ||
      window.beats.length > best.beats.length ||
      (window.beats.length === best.beats.length &&
        window.letterCount > best.letterCount) ||
      (window.beats.length === best.beats.length &&
        window.letterCount === best.letterCount &&
        window.weight > best.weight)
    ) {
      best = window;
    }
  }
  return best;
}

/** @deprecated Prefer idleClockWindow — kept for call-site clarity in older traces. */
export function longestUniqueLetterPattern(morse) {
  return idleClockWindow(morse);
}

/**
 * Arc plan on the same circle as the drawn beat marks (tone weights only).
 * Intra-letter gap = 1 unit; inter-letter gap = 3 units after the last tone
 * of each letter. A lone single-letter window also keeps a 3-unit linger so a
 * final short letter (when truly alone) does not flash past.
 */
export function motionPlanForPatterns(patterns) {
  const list = (patterns || []).filter(Boolean);
  const singleLetterWindow = list.length === 1;
  const items = [];
  list.forEach((pattern, patternIndex) => {
    const letterBeats = beatsFromPattern(pattern);
    letterBeats.forEach((beat, beatIndex) => {
      const lastInLetter = beatIndex === letterBeats.length - 1;
      const lastLetter = patternIndex === list.length - 1;
      let gapUnits = 1;
      if (lastInLetter && lastLetter) gapUnits = singleLetterWindow ? 3 : 0;
      else if (lastInLetter) gapUnits = 3;
      items.push({ kind: beat.kind, weight: beat.weight, gapUnits });
    });
  });

  const total = patternUnitWeight(items) || 1;
  let cursor = 0;
  const beats = [];
  const segments = items.map((beat, index) => {
    const progressStart = cursor / total;
    cursor += beat.weight;
    beats.push({ kind: beat.kind, weight: beat.weight });
    return {
      beatIndex: index,
      kind: beat.kind,
      weight: beat.weight,
      progressStart,
      progressEnd: cursor / total,
      gapUnits: beat.gapUnits,
    };
  });
  return { beats, total, segments, patterns: list };
}

export function letterMotionPlan(pattern) {
  return motionPlanForPatterns([pattern]);
}

function labelForSpans(spans, letterAtMorse, displayText) {
  if (!displayText || !letterAtMorse) return "";
  return spans
    .map((span) => {
      const mapped = letterAtMorse[span.start];
      if (!mapped) return "";
      return String(displayText).slice(mapped.textFrom, mapped.textTo);
    })
    .join("");
}

function beatIndexInWindow(offset, window, tokens) {
  let beatIndex = 0;
  for (const span of window.spans) {
    for (let index = span.start; index <= span.end; index += 1) {
      const token = tokens[index];
      if (token !== "." && token !== "-") continue;
      if (beatIndex >= window.beats.length) return -1;
      if (index === offset) return beatIndex;
      beatIndex += 1;
    }
  }
  return -1;
}

/**
 * Clock view for the letter at `offset`, or null when on a gap.
 * One revolution covers the current packed letter window (≤16 beats).
 */
export function clockViewAt(offset, morse, letterAtMorse, displayText) {
  const tokens = tokenizeMorse(morse);
  if (!tokens.length || offset == null || offset < 0 || offset >= tokens.length) {
    return null;
  }
  const spans = letterSpansFromMorse(morse);
  const letterIndex = spans.findIndex(
    (entry) => offset >= entry.start && offset <= entry.end,
  );
  if (letterIndex < 0) return null;

  const startIndex = windowStartForLetterIndex(spans, letterIndex);
  const window = clockWindowFromSpans(spans, startIndex);
  if (!window) return null;

  const plan = motionPlanForPatterns(window.patterns);
  const beatIndex = beatIndexInWindow(offset, window, tokens);
  if (beatIndex < 0) return null;

  const segment = plan.segments[beatIndex];
  if (!segment) return null;

  return {
    beats: plan.beats,
    pattern: window.pattern,
    patterns: window.patterns,
    letterCount: window.letterCount,
    label: labelForSpans(window.spans, letterAtMorse, displayText),
    activeBeatIndex: beatIndex,
    progress: segment.progressStart,
    progressStart: segment.progressStart,
    progressEnd: segment.progressEnd,
    toneUnits: segment.weight,
    gapUnits: segment.gapUnits,
    durationUnits: segment.weight + segment.gapUnits,
  };
}
