/**
 * Generative composition + mix plan: up to four mixable tracks with pan,
 * reverb send, and a court feedback chain.
 */

import { DEFAULT_ANALOG } from "./analog_character.js";

export const TRACK_COUNT = 4;
export const TRACK_ROLES = ["bass", "pad", "lead", "perc"];

export function createComposition(random, {
  wildness = 0.55,
  voiceCount = 12,
  patchType = "looping",
} = {}) {
  const activeSet = pickActiveTrackSet(random, patchType);
  const tracks = TRACK_ROLES.map((role, index) => {
    const active = activeSet.has(index);
    const voiceIndexes = voiceIndexesForTrack(index, voiceCount);
    return {
      index,
      role,
      active,
      level: active ? between(random, role === "bass" ? 0.55 : 0.35, 0.95) : 0,
      pan: active ? between(random, -0.85, 0.85) : 0,
      reverbSend: active ? between(random, 0.12, 0.35 + wildness * 0.55) : 0,
      chainSend: active ? between(random, 0.08, 0.25 + wildness * 0.45) : 0,
      voiceIndexes,
    };
  });
  const activeTracks = activeSet.size;

  const sectionPlan = sectionNamesForPatch(patchType, random);
  const sections = sectionPlan.map((name) =>
    createSection(random, name, tracks, wildness, patchType),
  );

  return {
    trackCount: TRACK_COUNT,
    activeTracks,
    tracks,
    sections,
    mix: {
      reverb: between(random, 0.2, 0.35 + wildness * 0.5),
      reverbDecay: between(random, 1.4, 3.2 + wildness),
      master: between(random, 0.55, 0.85),
      compress: between(random, 0.25, 0.55 + wildness * 0.35),
      scatter: between(random, 0.05, 0.25 + wildness * 0.45),
      tape: between(random, 2, 8 + wildness * 12),
      tapeDry: between(random, 0.45, 0.9),
      speed: between(random, 0.7, 1.25) * (random() > 0.88 ? -1 : 1),
      eq: {
        eqLows: between(random, 0.4, 0.7),
        eqMids: between(random, 0.45, 0.72),
        eqHighs: between(random, 0.38, 0.65),
      },
      compressor: {
        threshold: between(random, -28, -12),
        knee: between(random, 6, 24),
        ratio: between(random, 2.5, 8),
        attack: between(random, 0.003, 0.04),
        release: between(random, 0.08, 0.35),
      },
      chain: {
        filterHz: between(random, 280, 4200),
        filterQ: between(random, 0.4, 4 + wildness * 6),
        delay: between(random, 0.08, 0.55),
        drive: between(random, 0.15, 0.75),
        returnLevel: between(random, 0.15, 0.35 + wildness * 0.4),
        crossFeedback: between(random, 0.1, 0.55 + wildness * 0.3),
        modulate: random() > 0.4,
      },
      autoPanDepth: between(random, 0, wildness * 0.35),
      autoPanRate: between(random, 0.05, 0.35),
      analog: {
        drive: between(random, 0.22, 0.45 + wildness * 0.25),
        warmth: between(random, 0.28, 0.55 + wildness * 0.2),
        wow: between(random, 0.15, 0.4 + wildness * 0.25),
        flutter: between(random, 0.1, 0.3 + wildness * 0.2),
        hiss: between(random, 0.05, 0.12 + wildness * 0.1),
        drift: between(random, 0.25, 0.55 + wildness * 0.3),
        mix: between(random, DEFAULT_ANALOG.mix * 0.75, 0.85),
      },
    },
  };
}

export function sectionAtBeat(composition, beat) {
  if (!composition?.sections?.length) {
    return { section: null, index: -1, localBeat: beat, totalBeats: 0 };
  }
  const total = composition.sections.reduce((sum, section) => sum + section.beats, 0);
  if (total <= 0) {
    return { section: composition.sections[0], index: 0, localBeat: 0, totalBeats: 0 };
  }
  let cursor = ((beat % total) + total) % total;
  for (let index = 0; index < composition.sections.length; index += 1) {
    const section = composition.sections[index];
    if (cursor < section.beats) {
      return { section, index, localBeat: cursor, totalBeats: total };
    }
    cursor -= section.beats;
  }
  const last = composition.sections.length - 1;
  return {
    section: composition.sections[last],
    index: last,
    localBeat: 0,
    totalBeats: total,
  };
}

export function mixSnapshotForSection(composition, section) {
  if (!composition || !section) {
    return null;
  }
  return composition.tracks.map((track, index) => ({
    index,
    role: track.role,
    active: track.active && !section.mutes[index],
    level: track.active ? track.level * (section.levels[index] ?? 1) : 0,
    pan: clamp(track.pan + (section.panOffsets[index] ?? 0), -1, 1),
    reverbSend: track.reverbSend * (section.reverbSends[index] ?? 1),
    chainSend: track.chainSend * (section.chainSends[index] ?? 1),
    voiceIndexes: track.voiceIndexes,
  }));
}

function createSection(random, name, tracks, wildness, patchType) {
  const beats = beatsForSection(name, patchType, random);
  const levels = tracks.map((track) => {
    if (!track.active) {
      return 0;
    }
    if (name === "break" && track.role !== "perc" && random() > 0.35) {
      return between(random, 0.05, 0.35);
    }
    if (name === "intro" && track.role === "lead") {
      return between(random, 0.2, 0.55);
    }
    if (name === "outro" && track.role === "bass") {
      return between(random, 0.4, 0.8);
    }
    return between(random, 0.55, 1);
  });
  const mutes = tracks.map((track) => {
    if (!track.active) {
      return true;
    }
    // Prefer level dips over hard mutes — hard mutes read as fragmented dropouts
    if (name === "break" && track.role === "pad" && random() > 0.75) {
      return true;
    }
    return false;
  });
  return {
    name,
    beats,
    levels,
    mutes,
    panOffsets: tracks.map(() => between(random, -0.2 * wildness, 0.2 * wildness)),
    reverbSends: tracks.map((track) =>
      track.active ? between(random, 0.7, 1.25 + wildness * 0.4) : 0,
    ),
    chainSends: tracks.map((track) =>
      track.active ? between(random, 0.6, 1.2 + wildness * 0.5) : 0,
    ),
    feedback: between(random, 0.15, 0.3 + wildness * 0.5),
    reverb: between(random, 0.2, 0.4 + wildness * 0.45),
    density: name === "break" ? between(random, 0.35, 0.6) : between(random, 0.45, 0.85),
  };
}

function sectionNamesForPatch(patchType, random) {
  if (patchType === "jingle" || patchType === "stutter") {
    return ["body"];
  }
  if (patchType === "drone" || patchType === "vowel_chant" || patchType === "orbit") {
    return pick(random, [
      ["intro", "body"],
      ["body", "outro"],
      ["intro", "body", "outro"],
    ]);
  }
  if (patchType === "atlas_drums" || patchType === "euclid_groove") {
    return ["intro", "body", "break", "body", "outro"];
  }
  return pick(random, [
    ["intro", "body", "outro"],
    ["intro", "body", "break", "body", "outro"],
    ["body", "break", "body", "outro"],
  ]);
}

function beatsForSection(name, patchType, random) {
  if (patchType === "jingle" || patchType === "stutter") {
    return integerBetween(random, 8, 16);
  }
  if (name === "intro") {
    return integerBetween(random, 8, 16);
  }
  if (name === "break") {
    return integerBetween(random, 4, 12);
  }
  if (name === "outro") {
    return integerBetween(random, 8, 20);
  }
  return integerBetween(random, 16, 32);
}

function pickActiveTrackSet(random, patchType) {
  const count = (() => {
    if (patchType === "drone" || patchType === "vowel_chant") {
      return 2 + Math.floor(random() * 2);
    }
    if (patchType === "jingle") {
      return 1 + Math.floor(random() * 3);
    }
    if (patchType === "atlas_drums" || patchType === "euclid_groove") {
      return 3 + Math.floor(random() * 2);
    }
    return 2 + Math.floor(random() * 3);
  })();
  const pool = [0, 1, 2, 3];
  // Fisher–Yates so bass/pad/lead/perc are not always the first N roles.
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const tmp = pool[index];
    pool[index] = pool[swap];
    pool[swap] = tmp;
  }
  const chosen = new Set(pool.slice(0, Math.min(count, pool.length)));
  // Groove / atlas patches always keep the perc bus for drums.
  if (patchType === "atlas_drums" || patchType === "euclid_groove" || random() > 0.35) {
    chosen.add(3);
  }
  return chosen;
}

function voiceIndexesForTrack(trackIndex, voiceCount) {
  const perTrack = Math.ceil(voiceCount / TRACK_COUNT);
  const start = trackIndex * perTrack;
  return Array.from({ length: perTrack }, (_, offset) => start + offset).filter(
    (index) => index < voiceCount,
  );
}

function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}

function between(random, min, max) {
  return min + random() * (max - min);
}

function integerBetween(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
