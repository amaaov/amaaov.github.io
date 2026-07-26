import { normalizeMorse } from "../morse/encode.js";

/** Hard cap so the dial stays readable. */
export const MAX_CLOCK_BEATS = 16;

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

/**
 * One or two consecutive letters, never more than MAX_CLOCK_BEATS tones.
 * Adds a second letter only when both fit under the cap.
 */
export function clockWindowFromSpans(spans, startIndex) {
  if (!spans.length || startIndex < 0 || startIndex >= spans.length) return null;
  const firstPattern = clipPattern(spans[startIndex].pattern);
  if (!firstPattern) return null;

  const patterns = [firstPattern];
  const windowSpans = [spans[startIndex]];
  const second = spans[startIndex + 1];
  if (second) {
    const secondPattern = clipPattern(second.pattern);
    if (
      secondPattern &&
      toneCount(firstPattern) + toneCount(secondPattern) <= MAX_CLOCK_BEATS
    ) {
      patterns.push(secondPattern);
      windowSpans.push(second);
    }
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
 * Idle showcase: densest readable window (prefer more beats, then two letters).
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
 * final E (one dit) does not flash past before the next revolution.
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
 * One revolution covers the current 1–2 letter window (≤16 beats).
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
