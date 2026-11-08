#include <math.h>
#include <stdio.h>

#include "ht_controls.h"
#include "ht_court.h"
#include "ht_fx.h"
#include "ht_gen.h"
#include "ht_keys.h"
#include "ht_mix.h"
#include "ht_patch.h"

static int failures = 0;

static void expect_true(const char *name, int condition) {
  if (!condition) {
    fprintf(stderr, "FAIL %s\n", name);
    failures += 1;
  }
}

static void expect_eq_u8(const char *name, uint8_t got, uint8_t want) {
  if (got != want) {
    fprintf(stderr, "FAIL %s got=%u want=%u\n", name, got, want);
    failures += 1;
  }
}

static void expect_near(const char *name, float got, float want, float eps) {
  if (fabsf(got - want) > eps) {
    fprintf(stderr, "FAIL %s got=%f want=%f\n", name, got, want);
    failures += 1;
  }
}

int main(void) {
  uint32_t seed_a = ht_unique_seed(0x1111);
  uint32_t seed_b = ht_unique_seed(0x1111);
  expect_true("unique seeds differ", seed_a != seed_b);

  expect_eq_u8("VOICE_COUNT", HT_VOICE_COUNT, 12);
  expect_eq_u8("TRACK_COUNT", HT_TRACK_COUNT, 4);
  expect_eq_u8("PATCH_TYPE_COUNT", HT_PATCH_TYPE_COUNT, 12);
  expect_eq_u8("ENGINE_COUNT", HT_ENGINE_COUNT, 23);
  expect_eq_u8("TIMBRE_COUNT", HT_TIMBRE_COUNT, 10);
  expect_eq_u8("KEY_MIDI_COUNT", HT_KEY_MIDI_COUNT, 27);

  HtControls controls;
  ht_controls_init(&controls);
  expect_near("master", controls.master, 0.72f, 0.0001f);
  expect_eq_u8("mute0", controls.voice_mute[0], 0);
  expect_eq_u8("mute11", controls.voice_mute[11], 0);

  HtPatchBias bias = ht_bias_from_controls(&controls);
  expect_eq_u8("objects", bias.object_count, 5);
  expect_near("bpm", bias.bpm, HT_BPM_MIN + 0.55f * (HT_BPM_MAX - HT_BPM_MIN), 0.01f);
  expect_near("bpm min", ht_bpm_from_tempo_knob(0.0f), HT_BPM_MIN, 0.01f);
  expect_near("bpm max", ht_bpm_from_tempo_knob(1.0f), HT_BPM_MAX, 0.01f);
  expect_near("bpm mid", ht_bpm_from_tempo_knob(0.5f), 130.0f, 0.01f);
  expect_near("tempo knob from 40", ht_tempo_knob_from_bpm(40.0f), 0.0f, 0.001f);
  expect_near("tempo knob from 220", ht_tempo_knob_from_bpm(220.0f), 1.0f, 0.001f);
  {
    float soft = ht_soft_bpm(100.0f, 0x51e51eu, 0.8f);
    expect_true("soft bpm in range", soft >= HT_BPM_MIN - 0.01f && soft <= HT_BPM_MAX + 0.01f);
    expect_near("soft bpm locks", ht_soft_bpm(96.0f, 1u, 0.0f), 96.0f, 0.01f);
  }
  expect_near("scatter", bias.scatter, ht_scatter_from_fx_knob(0.45f), 0.0001f);
  expect_true("generative atlas", ht_patch_is_generative(HT_PATCH_ATLAS_DRUMS));
  expect_true("not generative looping", !ht_patch_is_generative(HT_PATCH_LOOPING));
  expect_true("pipe is wind", ht_engine_is_wind(HT_ENGINE_PIPE));
  expect_true("guitar is string", ht_engine_is_string(HT_ENGINE_GUITAR));
  expect_true("organ not physical", !ht_engine_is_physical(HT_ENGINE_ORGAN));

  int hits = 0;
  for (uint8_t step = 0; step < 8; step += 1) {
    hits += ht_euclid_hit(step, 8, 3, 0);
  }
  expect_eq_u8("euclid 8/3 hits", (uint8_t)hits, 3);

  HtGenTuring turing;
  ht_gen_turing_init(&turing, 8, 25, 2, 42);
  HtGenOut note = ht_gen_turing_step(&turing);
  expect_true("turing midi range", note.midi >= 36 && note.midi <= 84);

  HtGenAtlas atlas;
  ht_gen_atlas_init(&atlas, 128, 96, 70, 15, 9);
  HtGenOut drum_outs[3];
  int drum_count = ht_gen_atlas_step(&atlas, drum_outs);
  expect_true("atlas step count", drum_count >= 0 && drum_count <= 3);

  HtComposition comp;
  ht_composition_init_default(&comp, 7, 0.55f);
  expect_true("active tracks", comp.active_tracks >= 2 && comp.active_tracks <= 4);

  HtWeather weather = {.storm = 0.4f, .chaos = 0.2f, .moon = 0.3f, .feedback = 0.5f};
  HtTrackMix live[HT_TRACK_COUNT];
  ht_live_mix_snapshot(&comp, 1.5f, 7, &weather, HT_SILENCE_GAP, live);
  expect_true("gap inactive", !live[0].active);
  expect_near("gap reverb send", live[0].reverb_send, 0.02f, 0.0001f);

  HtMixGlobals gap = ht_live_mix_globals(&comp, &weather, HT_SILENCE_GAP);
  expect_near("gap court gate", gap.court_gate, 0.02f, 0.0001f);
  expect_near("gap dry", gap.dry, 0.02f, 0.0001f);

  HtMixGlobals open = ht_live_mix_globals(&comp, &weather, HT_SILENCE_OPEN);
  expect_near("open court gate", open.court_gate, 1.0f, 0.0001f);
  expect_true("open dry above wet floor", open.dry >= 0.35f);
  expect_true("open wet tracks return", open.wet <= 0.75f);

  HtMixGlobals tail = ht_live_mix_globals(&comp, &weather, HT_SILENCE_TAIL);
  expect_near("tail court gate", tail.court_gate, 0.85f, 0.0001f);
  expect_true("tail wet elevated", tail.wet >= 0.28f);

  HtCourtFrame frame = {0};
  frame.airborne_count = 0;
  frame.hand_hold_count = 0;
  expect_true("empty court open", !ht_court_is_silent(&frame));
  expect_eq_u8("empty silence open", (uint8_t)ht_court_silence_mode(&frame), HT_SILENCE_OPEN);
  frame.episode_wait = 1;
  expect_true("wait silent", ht_court_is_silent(&frame));
  expect_eq_u8("wait silence tail", (uint8_t)ht_court_silence_mode(&frame), HT_SILENCE_TAIL);
  frame.episode_gap = 1;
  expect_eq_u8("wait silence gap", (uint8_t)ht_court_silence_mode(&frame), HT_SILENCE_GAP);
  expect_near("gate gap", ht_court_gate_amount(&frame), 0.02f, 0.001f);

  {
    uint16_t row[HT_COURT_WIDTH];
    uint16_t blank = 0;
    int px;
    frame.siteswap = "3";
    frame.time_beat = 2.5f;
    frame.airborne_count = 2;
    frame.hand_hold_count = 1;
    frame.episode_wait = 0;
    frame.episode_gap = 0;
    for (px = 0; px < HT_COURT_WIDTH; px += 1) {
      row[px] = 0;
    }
    ht_court_draw_frame(row, 120, &frame);
    for (px = 0; px < HT_COURT_WIDTH; px += 1) {
      blank = (uint16_t)(blank | row[px]);
    }
    expect_true("court draw paints mid row", blank != 0);
  }

  expect_eq_u8("soft objects prefer lock", ht_soft_object_count(5, 1u, 0.0f, 0), 5);
  expect_true("soft objects exclude", ht_soft_object_count(5, 0x51e51eu, 1.0f, 5) != 5);
  {
    uint8_t soft = ht_soft_object_count(5, 0xabcdefu, 0.9f, 0);
    expect_true("soft objects range", soft >= 3 && soft <= 7);
  }

  HtEnvelope envelope = ht_envelope_from_env_knob(0.5f);
  expect_true("adsr attack", envelope.attack > 0.01f && envelope.attack < 0.5f);
  expect_near("adsr sustain mid", envelope.sustain, 0.28f + 0.5f * 0.55f, 0.001f);
  expect_near("env sustain level", ht_envelope_level(1.0f, &envelope, 0), envelope.sustain, 0.001f);
  expect_eq_u8("lfo dest pitch", ht_lfo_destination_from_knob(0.0f), 0);
  expect_eq_u8("lfo dest pan", ht_lfo_destination_from_knob(0.99f), HT_LFO_DEST_COUNT - 1);
  expect_near("scatter from fx", ht_scatter_from_fx_knob(1.0f), 0.85f, 0.001f);
  expect_near("eq flat", ht_eq_shelf_gain(0.5f), 0.0f, 0.001f);
  HtTapePlan tape = ht_tape_plan(4.0f, 0.8f, 1.0f, 1, 0, 0);
  expect_true("tape recording", tape.tape_recording);
  expect_near("tape wet", tape.tape_wet, 0.8f, 0.001f);
  HtScatterPlan scatter = ht_scatter_plan(0.5f, 1.0f);
  expect_true("scatter open", scatter.gain > 0.7f);
  expect_true("warmth darker", ht_warmth_cutoff_hz(0.8f, 44100.0f) < ht_warmth_cutoff_hz(0.2f, 44100.0f));
  expect_true("wow depth", ht_wow_depth_seconds(1.0f) > ht_wow_depth_seconds(0.0f));
  expect_near("hiss quiet", ht_hiss_gain(0.1f), 0.0028f, 0.0001f);
  HtAnalog analog = ht_analog_defaults();
  expect_near("analog mix", analog.mix, 0.45f, 0.0001f);
  expect_true("pipe fb cap", ht_pipe_feedback_cap(HT_ENGINE_PIPE, 0.4f) < 0.6f);
  expect_true("string fb cap", ht_string_feedback_cap(HT_ENGINE_GUITAR, 0.4f) < 0.9f);
  expect_near("wind out gain", ht_physical_output_gain(HT_ENGINE_SAXOPHONE), 0.42f, 0.0001f);

  HtKeyRole keys[HT_KEY_MIDI_COUNT];
  ht_key_map_build(0xaced42u, keys);
  expect_eq_u8("key0 midi", keys[0].midi, 0);
  expect_eq_u8("key26 midi", keys[26].midi, 26);
  expect_true("key kind range", keys[3].kind <= HT_KEY_MUTE);
  HtKeyRole keys_b[HT_KEY_MIDI_COUNT];
  ht_key_map_build(0xaced42u, keys_b);
  expect_eq_u8("key map deterministic kind", keys[5].kind, keys_b[5].kind);
  expect_eq_u8("key map deterministic voices", keys[5].voice_count, keys_b[5].voice_count);

  if (failures) {
    fprintf(stderr, "%d failure(s)\n", failures);
    return 1;
  }
  puts("ht_smoke ok");
  return 0;
}
