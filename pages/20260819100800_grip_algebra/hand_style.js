/**
 * Clean-room Lab hand-style strings (documented format only; no Lab source).
 * Group per beat, '.' separates beats. Each group: throw then catch coords.
 * Shorthand (30,10) → x=30, z=10, y=0. Left hand mirrors x.
 */

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function parseNumber(text, index) {
  let cursor = index;
  while (cursor < text.length && /[-\d.]/.test(text[cursor])) {
    cursor += 1;
  }
  if (cursor === index) {
    throw new Error("hand style expected a number");
  }
  const value = Number(text.slice(index, cursor));
  if (!Number.isFinite(value)) {
    throw new Error("hand style bad number");
  }
  return { value, index: cursor };
}

function skipStyleSpace(text, index) {
  while (index < text.length && /\s/.test(text[index])) {
    index += 1;
  }
  return index;
}

function parseCoord(text, index) {
  index = skipStyleSpace(text, index);
  if (text[index] === "-") {
    return { hold: true, index: index + 1 };
  }
  if (text[index] !== "(") {
    throw new Error("hand style expected '('");
  }
  index += 1;
  const x = parseNumber(text, index);
  index = skipStyleSpace(text, x.index);
  let y = 0;
  let z = 0;
  if (text[index] === ",") {
    const second = parseNumber(text, index + 1);
    index = skipStyleSpace(text, second.index);
    if (text[index] === ",") {
      const third = parseNumber(text, index + 1);
      y = second.value;
      z = third.value;
      index = skipStyleSpace(text, third.index);
    } else {
      z = second.value;
    }
  }
  if (text[index] !== ")") {
    throw new Error("hand style unclosed coordinate");
  }
  return { x: x.value, y, z, index: index + 1 };
}

function parsePoint(text, index) {
  index = skipStyleSpace(text, index);
  let role = null;
  if (text[index] === "t" || text[index] === "c") {
    role = text[index];
    index += 1;
  }
  const coord = parseCoord(text, index);
  return { ...coord, role };
}

/**
 * @returns {{ beats: Array<Array<{x:number,y:number,z:number,role?:string|null,hold?:boolean}>> }}
 */
export function parseHandStyle(source) {
  const text = String(source).trim();
  if (!text) {
    throw new Error("empty hand style");
  }
  if (text.includes("<") || text.includes("|")) {
    throw new Error("multi-juggler hand styles are not supported");
  }
  const beats = [];
  let index = 0;
  let current = [];
  while (index < text.length) {
    index = skipStyleSpace(text, index);
    if (index >= text.length) {
      break;
    }
    if (text[index] === ".") {
      beats.push(current);
      current = [];
      index += 1;
      continue;
    }
    const point = parsePoint(text, index);
    current.push(point);
    index = point.index;
  }
  if (current.length > 0) {
    beats.push(current);
  }
  if (beats.length === 0) {
    throw new Error("empty hand style");
  }
  return { beats };
}

export const HAND_STYLE_PRESETS = {
  inside: "(10)(32.5).",
  outside: "(32.5)(10).",
  millsMess: "(-30)(2.5).(30)(-2.5).(-30)(0).",
  /** Crossing path with a high catch — tennis-ish Lab shorthand. */
  tennis: "(0)(25).(-20)(10).(20)(10).",
  windmill: "(25)(-5).(-25)(5).(25)(-5).",
};

export const HAND_STYLE_PRESET_NAMES = Object.keys(HAND_STYLE_PRESETS);

export function pickHandStyle(random, wildness = 0.5) {
  // Clean cascade hands stay common; wildness unlocks styled paths.
  if (random() > 0.22 + wildness * 0.45) {
    return null;
  }
  const name = HAND_STYLE_PRESET_NAMES[Math.floor(random() * HAND_STYLE_PRESET_NAMES.length)];
  return HAND_STYLE_PRESETS[name];
}

function pointAt(beatPoints, kind) {
  if (!beatPoints || beatPoints.length === 0) {
    return null;
  }
  if (kind === "throw") {
    const marked = beatPoints.find((point) => point.role === "t");
    return marked || beatPoints[0];
  }
  const marked = [...beatPoints].reverse().find((point) => point.role === "c");
  return marked || beatPoints[beatPoints.length - 1];
}

function stylePose(point, hand) {
  if (!point || point.hold) {
    return null;
  }
  const mirror = hand === 0 ? -1 : 1;
  // Map Lab cm offsets into court unit space (~±0.12 around rest).
  return {
    x: (mirror * point.x) / 250,
    y: -point.z / 250,
  };
}

/**
 * Sample a hand pose in court-local deltas for one beat fraction.
 * progress 0 = throw, 1 = catch within the dwell window.
 */
export function sampleHandStyle(style, hand, timeBeat, progress = 0) {
  const parsed = typeof style === "string" ? parseHandStyle(style) : style;
  const period = parsed.beats.length;
  const beatIndex = ((Math.floor(timeBeat) % period) + period) % period;
  const points = parsed.beats[beatIndex];
  const throwAt = stylePose(pointAt(points, "throw"), hand);
  const catchAt = stylePose(pointAt(points, "catch"), hand);
  if (!throwAt && !catchAt) {
    return null;
  }
  const from = throwAt || catchAt;
  const to = catchAt || throwAt;
  const blend = clamp01(progress);
  const midpoints = points.filter((point) => point.role !== "t" && point.role !== "c" && !point.hold);
  if (midpoints.length === 0) {
    return {
      x: from.x + (to.x - from.x) * blend,
      y: from.y + (to.y - from.y) * blend,
      atThrow: blend < 0.08,
      atCatch: blend > 0.92,
    };
  }
  const path = [from, ...midpoints.map((point) => stylePose(point, hand)).filter(Boolean), to];
  const span = path.length - 1;
  const place = blend * span;
  const slot = Math.min(span - 1, Math.floor(place));
  const local = place - slot;
  const a = path[slot];
  const b = path[slot + 1];
  return {
    x: a.x + (b.x - a.x) * local,
    y: a.y + (b.y - a.y) * local,
    atThrow: blend < 0.08,
    atCatch: blend > 0.92,
  };
}

export function handStyleRestOffset(style, hand, timeBeat) {
  const sample = sampleHandStyle(style, hand, timeBeat, 0.5);
  return sample ? { x: sample.x, y: sample.y } : { x: 0, y: 0 };
}
