/**
 * Long siteswap episodes: 3–7 objects, async / sync / hybrid / multiplex,
 * named families (shower, box, columns, fountain), wild height mixes,
 * playable “impossible” transitions, and occasional third-hand (+) marks.
 * Patterns come only from the parameter-driven article generator — no shelves.
 */

import { generateSiteswap } from "../../../pages/20260819100800_grip_algebra/siteswap_generator.js";
import { siteswapIsValid, siteswapPeriod } from "../../../pages/20260819100800_grip_algebra/siteswap.js";
import { siteswapCanPlay } from "../../../pages/20260819100800_grip_algebra/siteswap_episode.js";

export const MIN_OBJECTS = 3;
export const MAX_OBJECTS = 7;
export const MAX_EPISODE_STEPS = 192;
/** Wall-clock ceiling for full/near silence; waits are beat-rhythmic under this. */
export const MAX_WAIT_SECONDS = 2;

export function isRestTrick(source) {
  return typeof source === "string" && source.startsWith("~");
}

export function restBeatCount(source) {
  if (!isRestTrick(source)) {
    return 0;
  }
  const value = Number.parseInt(source.slice(1), 10);
  return Number.isFinite(value) && value > 0 ? value : 2;
}

/**
 * Short waits stay on the grid (1–2 beats). Longer waits are rarer and less
 * rhythmic, but always capped so wall time stays under MAX_WAIT_SECONDS at bpm.
 */
export function pickWaitBeats(random, wildness = 0.55, bpm = 100) {
  const maxBeats = Math.max(1, Math.floor((MAX_WAIT_SECONDS * bpm) / 60));
  const roll = random();
  if (roll < 0.58 - wildness * 0.08) {
    return 1;
  }
  if (roll < 0.88 - wildness * 0.05) {
    return Math.min(2, maxBeats);
  }
  if (roll < 0.97) {
    return Math.min(3, maxBeats);
  }
  return Math.min(maxBeats, 4);
}

export function waitBeatsWithinLimit(beats, bpm = 100) {
  const maxBeats = Math.max(1, Math.floor((MAX_WAIT_SECONDS * bpm) / 60));
  return Math.min(Math.max(1, Math.floor(beats)), maxBeats);
}

export function trickSource(entry) {
  if (typeof entry === "string") {
    return entry;
  }
  return entry?.source ?? "3";
}

export function trickBeats(entry, fallback = 16) {
  if (typeof entry === "object" && entry && Number.isFinite(entry.beats)) {
    return Math.max(2, entry.beats);
  }
  const source = trickSource(entry);
  if (isRestTrick(source)) {
    return restBeatCount(source);
  }
  try {
    return Math.max(fallback, siteswapPeriod(source) * 2);
  } catch {
    return fallback;
  }
}

export function episodeStepCount(episode) {
  return flattenEpisode(episode).reduce((sum, entry) => {
    const source = trickSource(entry);
    if (isRestTrick(source)) {
      return sum + restBeatCount(source);
    }
    return sum + siteswapPeriodSafe(source);
  }, 0);
}

export function generateSiteswapEpisode(
  random,
  objectCount,
  throwBias = 0.45,
  wildness = 0.55,
  { bpm = 100 } = {},
) {
  const balls = clampInt(objectCount, MIN_OBJECTS, MAX_OBJECTS);
  const aim = pickEpisodeAim(random, wildness);
  const episode = [];
  let steps = 0;
  let guard = 0;
  while (steps < aim && guard < 56) {
    const role = pickPhraseRole(random, wildness, guard, aim, steps);
    const phrase = flattenEpisode([buildPhrase(random, balls, throwBias, wildness, role, bpm)]);
    episode.push(...phrase);
    steps = episodeStepCount(episode);
    guard += 1;
  }
  if (!episode.some((entry) => !isRestTrick(trickSource(entry)))) {
    episode.unshift(buildPhrase(random, balls, throwBias, wildness, "cascade", bpm));
  }
  return clampEpisodeWaits(flattenEpisode(episode), bpm);
}

export function clampEpisodeWaits(episode, bpm = 100) {
  return episode.map((entry) => {
    const source = trickSource(entry);
    if (!isRestTrick(source)) {
      return entry;
    }
    const beats = waitBeatsWithinLimit(restBeatCount(source), bpm);
    if (typeof entry === "string") {
      return `~${beats}`;
    }
    return {
      ...entry,
      source: `~${beats}`,
      beats,
      silence: entry.silence ?? (beats <= 1 ? "gap" : "tail"),
    };
  });
}

function pickEpisodeAim(random, wildness) {
  if (wildness > 0.5 && random() < 0.45 + wildness * 0.35) {
    return integerBetween(random, 128, Math.min(MAX_EPISODE_STEPS, 128 + Math.round(wildness * 64)));
  }
  return integerBetween(random, 48 + Math.round(wildness * 24), 120 + Math.round(wildness * 40));
}

const PHRASE_ROLE_WEIGHTS = [
  ["shower", 14],
  ["box", 14],
  ["multiplex", 12],
  ["hybrid", 10],
  ["sync", 10],
  ["fountain", 9],
  ["flash", 8],
  ["columns", 7],
  ["impossible", 6],
  ["third_hand", 5],
  ["hold", 5],
  ["drop", 5],
  ["cascade", 6],
  ["marathon", 3],
  ["wait", 2],
];

function pickWeightedRole(random, weights) {
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let ticket = random() * total;
  for (const [role, weight] of weights) {
    ticket -= weight;
    if (ticket <= 0) {
      return role;
    }
  }
  return weights[weights.length - 1][0];
}

function pickPhraseRole(random, wildness, index, aim, stepsSoFar) {
  // Opening phrase: force a named family so episodes do not start as cascade/columns.
  if (index === 0) {
    return pick(random, ["shower", "box", "multiplex", "hybrid", "fountain", "sync", "flash"]);
  }
  const weights = PHRASE_ROLE_WEIGHTS.filter(([role]) => {
    if (role === "wait" && index === 0) {
      return false;
    }
    if (role === "marathon") {
      return index >= 2 && stepsSoFar > aim * 0.2 && stepsSoFar < aim * 0.55;
    }
    return true;
  }).map(([role, weight]) => {
    if (role === "cascade") {
      return [role, Math.max(2, weight - Math.round(wildness * 3))];
    }
    if (role === "shower" || role === "box" || role === "multiplex") {
      return [role, weight + Math.round(wildness * 4)];
    }
    return [role, weight];
  });
  return pickWeightedRole(random, weights);
}

function buildPhrase(random, objectCount, throwBias, wildness, role, bpm = 100) {
  if (role === "wait") {
    const beats = pickWaitBeats(random, wildness, bpm);
    return {
      source: `~${beats}`,
      beats,
      kind: "wait",
      silence: beats <= 1 && random() < 0.18 ? "gap" : "tail",
    };
  }
  if (role === "drop") {
    const silence = pickWaitBeats(random, wildness * 0.7, bpm);
    const flash = phraseSiteswap(random, objectCount, throwBias, wildness, {
      timing: pick(random, ["async", "async", "hybrid"]),
      periodBeats: integerBetween(random, 5, 10),
      restStyle: "ending",
      zeroRate: 0.18 + wildness * 0.12,
      multiplex: true,
    });
    return [
      {
        source: flash,
        beats: Math.max(siteswapPeriodSafe(flash) * 2, 8),
        kind: "drop",
      },
      {
        source: `~${silence}`,
        beats: silence,
        kind: "wait",
        // Rare full gap only on the shortest waits; longer rests hang in FX.
        silence: silence <= 1 && random() < 0.22 ? "gap" : "tail",
      },
    ];
  }
  if (role === "impossible") {
    const source = phraseSiteswap(random, objectCount, throwBias, wildness, {
      timing: pick(random, ["async", "sync", "hybrid"]),
      periodBeats: integerBetween(random, 3, 8),
      extraHand: pick(random, ["+", "-"]),
      multiplex: random() < 0.35,
    });
    return {
      source,
      beats: Math.max(siteswapPeriodSafe(source) * 2, 8),
      kind: "impossible",
    };
  }
  if (role === "third_hand") {
    const source = phraseSiteswap(random, objectCount, throwBias, wildness, {
      timing: pick(random, ["async", "sync"]),
      periodBeats: integerBetween(random, 2, 6),
      extraHand: "+",
    });
    return {
      source,
      beats: Math.max(siteswapPeriodSafe(source) * 2, 10),
      kind: "third_hand",
    };
  }
  if (role === "marathon") {
    const steps = integerBetween(random, 24, Math.min(64, 24 + Math.round(wildness * 40)));
    const source = longGeneratedCycle(random, objectCount, throwBias, wildness, steps);
    return { source, beats: Math.max(steps, siteswapPeriodSafe(source)), kind: "marathon" };
  }
  if (role === "shower" || role === "box" || role === "columns" || role === "fountain") {
    const source = phraseSiteswap(random, objectCount, throwBias, wildness, { family: role });
    return {
      source,
      beats: Math.max(siteswapPeriodSafe(source) * integerBetween(random, 3, 6), 10),
      kind: role,
    };
  }

  const timing =
    role === "sync"
      ? "sync"
      : role === "hybrid"
        ? "hybrid"
        : role === "multiplex"
          ? pick(random, ["async", "sync", "hybrid"])
          : pick(random, ["async", "async", "hybrid", "sync"]);
  let periodBeats = integerBetween(
    random,
    role === "flash" ? 5 : 6,
    role === "flash" ? 12 : 8 + Math.round(8 + wildness * 12),
  );
  periodBeats = Math.min(periodBeats, 24);

  const restStyle =
    role === "flash"
      ? "ending"
      : role === "hold"
        ? pick(random, ["none", "scattered", "middle"])
        : pick(random, ["none", "none", "scattered", "middle", "breath"]);
  const zeroRate =
    role === "hold"
      ? 0.08 + wildness * 0.08
      : role === "flash"
        ? 0.12 + wildness * 0.1
        : restStyle === "none"
          ? 0
          : 0.05 + wildness * 0.1;

  const source = phraseSiteswap(random, objectCount, throwBias, wildness, {
    timing,
    periodBeats,
    restStyle,
    zeroRate,
    multiplex: role === "multiplex" || random() < 0.2,
  });
  const loops = role === "cascade" ? integerBetween(random, 2, 4) : 2;
  return {
    source,
    beats: Math.max(periodBeats * loops, siteswapPeriodSafe(source) * loops),
    kind: role,
  };
}

function phraseSiteswap(random, objectCount, throwBias, wildness, options = {}) {
  const periodBeats = options.periodBeats ?? integerBetween(random, 2, 8 + Math.round(wildness * 8));
  const family = options.family ?? null;
  return generateSiteswap({
    objectCount,
    periodBeats: Math.min(periodBeats, family ? 6 : 8),
    timing: options.timing ?? "async",
    maximumThrow: Math.min(
      35,
      objectCount + 2 + Math.round(throwBias * 10 + wildness * 4),
    ),
    minimumThrow: options.minimumThrow ?? 0,
    restStyle: options.restStyle ?? "none",
    zeroRate: options.zeroRate ?? 0,
    multiplex: Boolean(options.multiplex),
    family,
    extraHand: options.extraHand ?? null,
    throwBias,
    random,
    limit: family ? 4 : 3,
    searchBudget: family ? 4_000 : periodBeats > 8 ? 5_000 : 8_000,
  });
}

function longGeneratedCycle(random, objectCount, throwBias, wildness, steps) {
  const base = phraseSiteswap(random, objectCount, throwBias, wildness, {
    timing: pick(random, ["async", "async", "sync"]),
    periodBeats: integerBetween(random, 2, 6),
  });
  if (/^[0-9a-z]+$/i.test(base) && ![...base].some((ch) => "()[]x+-".includes(ch))) {
    let out = "";
    while (out.length < steps) {
      out += base;
    }
    return out.slice(0, steps);
  }
  const period = siteswapPeriodSafe(base);
  const repeats = Math.max(1, Math.ceil(steps / period));
  return base.repeat(repeats);
}

function siteswapPeriodSafe(source) {
  try {
    return siteswapPeriod(source);
  } catch {
    try {
      if (siteswapCanPlay(source)) {
        // Playable marks may not have a classical period; approximate by digit length.
        return Math.max(4, String(source).replace(/[^0-9a-z()[\]]/gi, "").length || 8);
      }
    } catch {
      /* ignore */
    }
    return 8;
  }
}

function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}

function integerBetween(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function clampInt(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function flattenEpisode(entries) {
  const out = [];
  for (const entry of entries) {
    if (Array.isArray(entry)) {
      out.push(...flattenEpisode(entry));
    } else {
      out.push(entry);
    }
  }
  return out;
}

export function episodeSources(episode) {
  return flattenEpisode(episode).map((entry) => trickSource(entry));
}

export function validateEpisode(episode) {
  return flattenEpisode(episode).every((entry) => {
    const source = trickSource(entry);
    if (isRestTrick(source)) {
      return restBeatCount(source) > 0;
    }
    try {
      if (siteswapIsValid(source)) {
        return true;
      }
    } catch {
      /* fall through to can-play */
    }
    return siteswapCanPlay(source);
  });
}
