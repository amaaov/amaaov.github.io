/**
 * Parity gate: JS control map / patch lists must match firmware/include/ht_patch.h
 * and DEFAULT_CONTROLS in ht_controls.c.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  ALGORITHM_PATCH_TYPES,
  BPM_MAX,
  BPM_MIN,
  DEFAULT_CONTROLS,
  VOICE_COUNT,
  bpmFromTempoKnob,
  envelopeFromEnvKnob,
  objectCountFromSiteswapKnob,
  patchTypeFromAlgorithm,
  scatterFromFxKnob,
} from "./control_map.js";
import {
  ENGINES,
  PATCH_TYPES,
  SCALE_NAMES,
  TIMBRE_PROFILES,
  GENERATIVE_PATCH_TYPES,
} from "./rnd_patch.js";
import { TRACK_COUNT } from "./mix_composition.js";
import { euclidHit, genStream, genNext } from "./court_gen.js";
import { LFO_DESTINATIONS, LFO_SHAPES, TAPE_LOOP_MAXIMUM_SECONDS } from "./ht_fx.js";
import { DEFAULT_ANALOG } from "./analog_character.js";
import { KEY_MIDI_COUNT, KEY_PARAM_IDS } from "./key_roles.js";
import { PIPE_KINDS } from "./pipe_synth.js";
import { STRING_KINDS } from "./string_synth.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const patchHeader = readFileSync(join(root, "firmware/include/ht_patch.h"), "utf8");
const fxHeader = readFileSync(join(root, "firmware/include/ht_fx.h"), "utf8");
const keysHeader = readFileSync(join(root, "firmware/include/ht_keys.h"), "utf8");
const mixHeader = readFileSync(join(root, "firmware/include/ht_mix.h"), "utf8");
const controlsSource = readFileSync(join(root, "firmware/src/ht_controls.c"), "utf8");
const fxSource = readFileSync(join(root, "firmware/src/ht_fx.c"), "utf8");

function defineInt(name) {
  const match = patchHeader.match(new RegExp(`#define\\s+${name}\\s+(\\d+)`));
  assert.ok(match, `missing ${name} in ht_patch.h`);
  return Number(match[1]);
}

test("firmware constants match JS voice/track/type counts", () => {
  assert.equal(defineInt("HT_VOICE_COUNT"), VOICE_COUNT);
  assert.equal(defineInt("HT_TRACK_COUNT"), TRACK_COUNT);
  assert.equal(defineInt("HT_PATCH_TYPE_COUNT"), PATCH_TYPES.length);
  assert.equal(defineInt("HT_ENGINE_COUNT"), ENGINES.length);
  assert.equal(defineInt("HT_TIMBRE_COUNT"), TIMBRE_PROFILES.length);
  assert.equal(defineInt("HT_SCALE_COUNT"), SCALE_NAMES.length);
  assert.equal(ALGORITHM_PATCH_TYPES.length, PATCH_TYPES.length);
  assert.deepEqual(ALGORITHM_PATCH_TYPES, PATCH_TYPES);
});

test("firmware DEFAULT_CONTROLS match JS", () => {
  for (const [key, value] of Object.entries(DEFAULT_CONTROLS)) {
    if (key === "voiceMute") {
      assert.equal(value.length, VOICE_COUNT);
      assert.match(controlsSource, /for \(int index = 0; index < HT_VOICE_COUNT/);
      continue;
    }
    const pattern = new RegExp(`controls->${key}\\s*=\\s*${String(value)}f?\\s*;`);
    assert.match(controlsSource, pattern, `controls->${key} = ${value}`);
  }
});

test("bias maps agree on defaults", () => {
  assert.equal(objectCountFromSiteswapKnob(DEFAULT_CONTROLS.knob3), 5);
  assert.equal(bpmFromTempoKnob(DEFAULT_CONTROLS.knob4), Math.round(40 + 0.55 * 180));
  assert.equal(patchTypeFromAlgorithm(DEFAULT_CONTROLS.algorithm), "cascade_choir");
  assert.ok(GENERATIVE_PATCH_TYPES.has("atlas_drums"));
  assert.ok(!GENERATIVE_PATCH_TYPES.has("looping"));
});

test("euclid and stream primitives stay portable", () => {
  const hits = Array.from({ length: 8 }, (_, step) => euclidHit(step, 8, 3, 0));
  assert.equal(hits.filter(Boolean).length, 3);
  const stream = { value: genStream(1) };
  const a = genNext(stream);
  const b = genNext(stream);
  assert.notEqual(a, 0);
  assert.notEqual(a, b);
});

test("firmware ht_fx.h mirrors JS HT FX maps", () => {
  assert.match(fxHeader, /#define\s+HT_LFO_DEST_COUNT\s+5/);
  assert.match(fxHeader, /#define\s+HT_LFO_SHAPE_COUNT\s+4/);
  assert.match(fxHeader, /HT_TAPE_LOOP_MAXIMUM_SECONDS\s+30/);
  assert.equal(LFO_DESTINATIONS.length, 5);
  assert.equal(LFO_SHAPES.length, 4);
  assert.equal(TAPE_LOOP_MAXIMUM_SECONDS, 30);
  const mid = envelopeFromEnvKnob(0.5);
  assert.ok(Math.abs(mid.sustain - (0.28 + 0.5 * 0.55)) < 1e-6);
  assert.equal(scatterFromFxKnob(1), 0.85);
  assert.match(fxSource, new RegExp(`analog\\.mix\\s*=\\s*${DEFAULT_ANALOG.mix}f`));
  assert.match(fxHeader, /ht_pipe_feedback_cap/);
  assert.match(fxHeader, /ht_string_feedback_cap/);
});

test("firmware keys and silence modes match JS contracts", () => {
  assert.match(keysHeader, new RegExp(`#define\\s+HT_KEY_MIDI_COUNT\\s+${KEY_MIDI_COUNT}`));
  assert.match(keysHeader, new RegExp(`#define\\s+HT_KEY_PARAM_ID_COUNT\\s+${KEY_PARAM_IDS.length}`));
  assert.match(mixHeader, /HT_SILENCE_OPEN/);
  assert.match(mixHeader, /HT_SILENCE_TAIL/);
  assert.match(mixHeader, /HT_SILENCE_GAP/);
  assert.match(patchHeader, /ht_engine_is_wind/);
  assert.match(patchHeader, /ht_engine_is_string/);
  assert.equal(PIPE_KINDS.length, 4);
  assert.equal(STRING_KINDS.length, 4);
  assert.match(controlsSource, /bias\.scatter\s*=/);
});

test("firmware siteswap and mod-matrix headers exist for Solo Lab spine", () => {
  const siteswapHeader = readFileSync(join(root, "firmware/include/ht_siteswap.h"), "utf8");
  const modHeader = readFileSync(join(root, "firmware/include/ht_mod_matrix.h"), "utf8");
  const handHeader = readFileSync(join(root, "firmware/include/ht_hand_style.h"), "utf8");
  assert.match(siteswapHeader, /ht_siteswap_schedule/);
  assert.match(siteswapHeader, /HT_SITESWAP_MAX_EVENTS/);
  assert.match(siteswapHeader, /ht_siteswap_construct_family/);
  assert.match(siteswapHeader, /HT_SS_FAMILY_MULTIPLEX/);
  assert.match(modHeader, /ht_mod_matrix_combine/);
  assert.match(modHeader, /HT_OCC_KRATOS/);
  assert.match(handHeader, /ht_hand_style_sample/);
});

test("firmware follows tempo grain drum and action-loop features", () => {
  const controlsHeader = readFileSync(join(root, "firmware/include/ht_controls.h"), "utf8");
  const actionHeader = readFileSync(join(root, "firmware/include/ht_action_loop.h"), "utf8");
  assert.match(controlsHeader, /#define\s+HT_BPM_MIN\s+40/);
  assert.match(controlsHeader, /#define\s+HT_BPM_MAX\s+220/);
  assert.match(controlsHeader, /ht_soft_bpm/);
  assert.match(controlsHeader, /ht_soft_object_count/);
  assert.match(fxHeader, /ht_drum_envelopes_from_seed/);
  assert.match(fxHeader, /ht_grain_plan/);
  assert.match(actionHeader, /ht_action_loop_on_host/);
  assert.match(actionHeader, /HT_ACTION_LOOP_HOST_COUNT\s+4/);
  assert.equal(BPM_MIN, 40);
  assert.equal(BPM_MAX, 220);
});
