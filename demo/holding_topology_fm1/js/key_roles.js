/**
 * Seeded keyboard roles for the 27 FM-1 keys (midi 0…26).
 * Each patch seed remaps what every key does: play voices, nudge the court
 * environment, or both — so the board feels alive without a fixed layout.
 */

import { seededRandom } from "../../../pages/20260819100800_grip_algebra/siteswap_generator.js";
import { VOICE_COUNT } from "./control_map.js";

export const KEY_MIDI_COUNT = 27;

/** Environment / mix targets a key may nudge. */
export const KEY_PARAM_IDS = [
  "feedback",
  "delay",
  "drive",
  "scatter",
  "reverb",
  "lfoDepth",
  "tempo",
  "master",
  "compress",
  "eqHigh",
  "env",
  "wild",
];

const ROLE_KINDS = ["play", "modulate", "combo", "burst", "mute"];

/**
 * @returns {Array<{
 *   midi: number,
 *   kind: string,
 *   voices: number[],
 *   params: Array<{ id: string, delta: number, mode: 'nudge'|'pulse' }>,
 *   height: number,
 *   velocity: number,
 * }>}
 */
export function createKeyMap(seed, { voiceCount = VOICE_COUNT } = {}) {
  const random = seededRandom((seed >>> 0) ^ 0x4b455931);
  const map = [];
  for (let midi = 0; midi < KEY_MIDI_COUNT; midi += 1) {
    map.push(buildKeyRole(random, midi, voiceCount));
  }
  return map;
}

export function describeKeyRole(role) {
  if (!role) {
    return "key";
  }
  if (role.kind === "mute" && role.voices.length === 1) {
    return `mute V${role.voices[0] + 1}`;
  }
  const play =
    role.voices.length > 0
      ? role.voices.length === 1
        ? `V${role.voices[0] + 1}`
        : `V${role.voices.map((index) => index + 1).join("+")}`
      : null;
  const mods =
    role.params.length > 0
      ? role.params.map((param) => `${param.id}${param.delta >= 0 ? "+" : "−"}`).join("·")
      : null;
  if (play && mods) {
    return `${play} · ${mods}`;
  }
  return play ?? mods ?? role.kind;
}

function buildKeyRole(random, midi, voiceCount) {
  const roll = random();
  let kind;
  if (roll < 0.28) {
    kind = "play";
  } else if (roll < 0.52) {
    kind = "modulate";
  } else if (roll < 0.78) {
    kind = "combo";
  } else if (roll < 0.92) {
    kind = "burst";
  } else {
    kind = "mute";
  }

  // First twelve white-ish slots bias toward play/mute so the left board still
  // feels like a voice strip, without freezing the layout.
  if (midi < 12 && kind === "modulate" && random() < 0.55) {
    kind = random() < 0.35 ? "mute" : "play";
  }

  const voices = pickVoices(random, kind, voiceCount, midi);
  const params = pickParams(random, kind);
  return {
    midi,
    kind,
    voices,
    params,
    height: 2 + Math.floor(random() * 7),
    velocity: 70 + Math.floor(random() * 50),
  };
}

function pickVoices(random, kind, voiceCount, midi) {
  if (kind === "modulate") {
    return [];
  }
  if (kind === "mute") {
    return [midi % voiceCount];
  }
  if (kind === "play") {
    if (random() < 0.7) {
      return [Math.floor(random() * voiceCount)];
    }
    const a = Math.floor(random() * voiceCount);
    const b = (a + 1 + Math.floor(random() * (voiceCount - 1))) % voiceCount;
    return a === b ? [a] : [a, b];
  }
  if (kind === "combo") {
    return [Math.floor(random() * voiceCount)];
  }
  // burst — chord cluster
  const count = 2 + Math.floor(random() * 3);
  const start = Math.floor(random() * voiceCount);
  const voices = [];
  for (let index = 0; index < count; index += 1) {
    voices.push((start + index * (1 + Math.floor(random() * 2))) % voiceCount);
  }
  return [...new Set(voices)];
}

function pickParams(random, kind) {
  if (kind === "play" || kind === "mute") {
    return [];
  }
  const count =
    kind === "burst"
      ? 2 + Math.floor(random() * 3)
      : kind === "combo"
        ? 1 + (random() < 0.45 ? 1 : 0)
        : 1 + (random() < 0.4 ? 1 : 0);
  const params = [];
  const pool = [...KEY_PARAM_IDS];
  for (let index = 0; index < count && pool.length > 0; index += 1) {
    const pick = Math.floor(random() * pool.length);
    const id = pool.splice(pick, 1)[0];
    const magnitude = 0.04 + random() * 0.18;
    const delta = random() < 0.5 ? magnitude : -magnitude;
    const mode = kind === "burst" && random() < 0.35 ? "pulse" : "nudge";
    params.push({ id, delta, mode });
  }
  return params;
}

export function assertKeyMapShape(map) {
  if (!Array.isArray(map) || map.length !== KEY_MIDI_COUNT) {
    return false;
  }
  return map.every(
    (role) =>
      role &&
      ROLE_KINDS.includes(role.kind) &&
      Array.isArray(role.voices) &&
      Array.isArray(role.params),
  );
}
