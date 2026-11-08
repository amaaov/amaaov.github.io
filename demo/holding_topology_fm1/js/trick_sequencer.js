import {
  isRestTrick,
  restBeatCount,
  trickBeats,
  trickSource,
} from "./siteswap_episode.js";

export function createTrickSequencer(tricks, beatsPerTrick = 16) {
  const patterns = normalizeTricks(tricks, beatsPerTrick);
  return {
    patterns,
    beatsPerTrick: Math.max(4, beatsPerTrick),
    index: 0,
    elapsedInTrick: 0,
  };
}

export function currentTrick(sequencer) {
  const entry = sequencer.patterns[sequencer.index % sequencer.patterns.length];
  return trickSource(entry);
}

export function currentTrickEntry(sequencer) {
  return sequencer.patterns[sequencer.index % sequencer.patterns.length];
}

export function currentTrickBeats(sequencer) {
  const entry = currentTrickEntry(sequencer);
  return trickBeats(entry, sequencer.beatsPerTrick);
}

export function advanceTrickSequencer(sequencer, deltaBeats, { loopTricks = true } = {}) {
  let next = {
    ...sequencer,
    elapsedInTrick: sequencer.elapsedInTrick + deltaBeats,
  };
  let changed = false;
  while (next.elapsedInTrick >= currentTrickBeats(next)) {
    const span = currentTrickBeats(next);
    next = {
      ...next,
      elapsedInTrick: next.elapsedInTrick - span,
      index: next.index + 1,
    };
    changed = true;
    if (!loopTricks && next.index >= next.patterns.length) {
      return {
        sequencer: {
          ...next,
          index: next.patterns.length - 1,
          elapsedInTrick: currentTrickBeats({
            ...next,
            index: next.patterns.length - 1,
          }),
        },
        changed: true,
        finished: true,
      };
    }
  }
  const wrapped = {
    ...next,
    index: ((next.index % next.patterns.length) + next.patterns.length) % next.patterns.length,
  };
  return {
    sequencer: wrapped,
    changed: changed || wrapped.index !== sequencer.index,
    finished: false,
  };
}

export function sequencerGlobalBeat(sequencer) {
  let total = 0;
  for (let index = 0; index < sequencer.index; index += 1) {
    total += trickBeats(sequencer.patterns[index], sequencer.beatsPerTrick);
  }
  return total + sequencer.elapsedInTrick;
}

function normalizeTricks(tricks, fallbackBeats) {
  const list = Array.isArray(tricks) && tricks.length > 0 ? tricks : ["3"];
  const out = [];
  for (const entry of list) {
    if (Array.isArray(entry)) {
      out.push(...normalizeTricks(entry, fallbackBeats));
      continue;
    }
    if (typeof entry === "string") {
      out.push({
        source: entry,
        beats: isRestTrick(entry) ? restBeatCount(entry) : trickBeats(entry, fallbackBeats),
        kind: isRestTrick(entry) ? "wait" : "pattern",
      });
      continue;
    }
    const source = trickSource(entry);
    out.push({
      source,
      beats: trickBeats(entry, fallbackBeats),
      kind: entry.kind ?? (isRestTrick(source) ? "wait" : "pattern"),
      silence: entry.silence,
    });
  }
  return out.length > 0 ? out : [{ source: "3", beats: fallbackBeats, kind: "pattern" }];
}
