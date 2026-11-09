/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1
 *
 * FM-1 panel and audio surface for Holding Topology. Platform APIs from fm1-base
 * (plat.h). Generators and bias maps from the portable ht_* contract. */
#include "fastmath.h"
#include "ht_action_loop.h"
#include "ht_controls.h"
#include "ht_court.h"
#include "ht_fx.h"
#include "ht_gen.h"
#include "ht_keys.h"
#include "ht_mix.h"
#include "ht_mod_matrix.h"
#include "ht_siteswap.h"
#include "ht_patch.h"
#include "ht_tuning.h"
#include "ht_voice.h"
#include "touch.h"

#ifndef NULL
#define NULL ((void *)0)
#endif

/* Freestanding: no libc string.h on the device build. */
static int ht_strcmp(const char *a, const char *b) {
  while (*a && *a == *b) {
    a += 1;
    b += 1;
  }
  return (unsigned char)*a - (unsigned char)*b;
}

static void sync_tempo_knob(void);

/* Hand-style Lab strings are path presets (not siteswap shelves). */
static const char *HAND_STYLE_CATALOG[] = {
    "(10)(32.5).",
    "(32.5)(10).",
    "(-30)(2.5).(30)(-2.5).(-30)(0).",
    "(0)(25).(-20)(10).(20)(10).",
    "(25)(-5).(-25)(5).(25)(-5).",
};
#define HAND_STYLE_COUNT (sizeof(HAND_STYLE_CATALOG) / sizeof(HAND_STYLE_CATALOG[0]))

static char generated_siteswap[HT_SITESWAP_MAX_STRING];

#define SET_MAGIC 0x48543131u /* "HT11" */

typedef struct {
  uint32_t magic;
  int8_t octave;
  uint8_t pad[3];
} settings_t;

static settings_t set;
static uint8_t set_dirty;

static HtControls controls;
static HtPatchBias bias;
/* Delay lines and voice state are too large for the 96 KiB .bss region. */
static HtVoiceBank voices PLAT_POOL;
static HtGenTuring turing;
static HtGenAtlas atlas;
static HtKeyRole key_roles[HT_KEY_MIDI_COUNT];
static HtComposition composition;
static uint32_t seed;
static uint32_t step_ms_accum;
static uint32_t step_period_ms;
static uint8_t gen_armed;
static uint8_t tape_recording;
static uint8_t episode_resting;
static uint8_t episode_gap;
static uint8_t rest_after_phrase;
static uint32_t rest_until_ms;
static float knob01[NE];
static HtCourtFrame court;
static HtWeather weather;
static const char *active_siteswap = "3";
static const char *active_hand_style = NULL;
static float pattern_beat;
static float phrase_until_beat;
static uint8_t phrase_index;
static int16_t last_throw_beat = -999;
static HtOccupancySign last_occ = HT_OCC_EMPTY;
static HtActionLooper action_loop;
static char previous_siteswap[HT_SITESWAP_MAX_STRING];
static uint8_t previous_objects;
static uint8_t previous_patch_type;
static uint8_t previous_scale;
static uint8_t previous_bpm_bucket;

static uint8_t pick_family(uint32_t mix, uint8_t opener) {
  /* Weighted like js/siteswap_episode.js — showers/boxes/multiplex over cascade/columns. */
  static const uint8_t weighted[] = {
      HT_SS_FAMILY_SHOWER,    HT_SS_FAMILY_SHOWER,    HT_SS_FAMILY_BOX,       HT_SS_FAMILY_BOX,
      HT_SS_FAMILY_MULTIPLEX, HT_SS_FAMILY_FOUNTAIN,  HT_SS_FAMILY_SHOWER,    HT_SS_FAMILY_BOX,
      HT_SS_FAMILY_MULTIPLEX, HT_SS_FAMILY_FOUNTAIN,  HT_SS_FAMILY_COLUMNS,   HT_SS_FAMILY_NONE,
      HT_SS_FAMILY_SHOWER,    HT_SS_FAMILY_MULTIPLEX};
  static const uint8_t openers[] = {HT_SS_FAMILY_SHOWER, HT_SS_FAMILY_BOX, HT_SS_FAMILY_MULTIPLEX,
                                    HT_SS_FAMILY_FOUNTAIN, HT_SS_FAMILY_SHOWER, HT_SS_FAMILY_BOX};
  if (opener) {
    return openers[mix % (sizeof(openers) / sizeof(openers[0]))];
  }
  return weighted[mix % (sizeof(weighted) / sizeof(weighted[0]))];
}

static void refresh_drum_envelopes(void) {
  HtDrumEnvelopes envelopes = ht_drum_envelopes_from_seed(seed, active_siteswap);
  ht_voice_set_drum_envelopes(&voices, &envelopes);
}

enum {
  HT_PHRASE_PLAY = 0,
  HT_PHRASE_WAIT = 1,
  HT_PHRASE_DROP = 2,
  HT_PHRASE_THIRD = 3
};

static uint8_t pick_phrase_role(uint32_t mix, uint8_t index) {
  uint32_t ticket;
  if (index == 0) {
    return HT_PHRASE_PLAY;
  }
  ticket = mix % 100u;
  if (ticket < 5u) {
    return HT_PHRASE_WAIT;
  }
  if (ticket < 12u) {
    return HT_PHRASE_DROP;
  }
  if (ticket < 19u) {
    return HT_PHRASE_THIRD;
  }
  return HT_PHRASE_PLAY;
}

static void append_siteswap_mark(char *siteswap, uint16_t cap, char mark) {
  uint16_t len = 0;
  while (siteswap[len] && (uint16_t)(len + 1u) < cap) {
    len = (uint16_t)(len + 1u);
  }
  if ((uint16_t)(len + 1u) < cap) {
    siteswap[len] = mark;
    siteswap[len + 1u] = 0;
  }
}

static void begin_episode_rest(uint8_t gap);

static void pick_siteswap_phrase(uint32_t mix) {
  HtSiteswapGenParams gen;
  uint8_t objects =
      ht_soft_object_count(bias.object_count_prefer, mix, bias.wildness, previous_objects);
  uint8_t family = pick_family(mix >> 3, phrase_index == 0);
  uint8_t timing = HT_SS_ASYNC;
  uint8_t period = (uint8_t)(2u + (mix % 7u));
  uint8_t attempt;
  uint8_t role = pick_phrase_role(mix, phrase_index);
  char prior[HT_SITESWAP_MAX_STRING];
  uint16_t i;

  if (role == HT_PHRASE_WAIT) {
    begin_episode_rest(((mix >> 6) & 3u) == 0u ? 1u : 0u);
    rest_after_phrase = 0;
    court.third_hand = 0;
    phrase_until_beat = pattern_beat + 64.0f;
    return;
  }

  for (i = 0; i < HT_SITESWAP_MAX_STRING; i += 1) {
    prior[i] = generated_siteswap[i];
    if (!generated_siteswap[i]) {
      break;
    }
  }
  if (family == HT_SS_FAMILY_BOX || family == HT_SS_FAMILY_COLUMNS) {
    timing = HT_SS_SYNC;
    period = 4u;
  } else if (family == HT_SS_FAMILY_FOUNTAIN) {
    timing = HT_SS_SYNC;
    period = 2u;
  } else if (family == HT_SS_FAMILY_SHOWER) {
    period = 2u;
  } else if (family == HT_SS_FAMILY_MULTIPLEX) {
    period = 3u;
  } else if ((mix & 3u) == 1u) {
    timing = HT_SS_SYNC;
    if (period & 1u) {
      period = (uint8_t)(period + 1u);
    }
  }
  if (role == HT_PHRASE_DROP) {
    period = (uint8_t)(2u + (mix % 4u));
    family = HT_SS_FAMILY_SHOWER;
    timing = HT_SS_ASYNC;
  } else if (role == HT_PHRASE_THIRD) {
    period = (uint8_t)(2u + (mix % 5u));
  }
  bias.object_count = objects;
  for (attempt = 0; attempt < 4u; attempt += 1) {
    gen.object_count = attempt == 0u ? objects
                                     : ht_soft_object_count(bias.object_count_prefer,
                                                            mix ^ (uint32_t)(attempt * 97u),
                                                            1.0f, previous_objects);
    gen.period = period;
    gen.max_throw = (uint8_t)(gen.object_count + 3u + ((mix >> 8) & 7u));
    gen.min_throw = 0;
    gen.timing = timing;
    gen.family = attempt == 0u ? family : pick_family(mix + attempt * 17u, 0);
    gen.rest_slots = (mix & 0x30u) == 0x30u ? 1u : 0u;
    gen.search_budget = 400u;
    gen.seed = (mix ? mix : 1u) ^ ((uint32_t)attempt * 0x9e3779b9u);
    if (ht_siteswap_generate(&gen, generated_siteswap, (uint16_t)sizeof(generated_siteswap)) !=
        HT_SS_OK) {
      generated_siteswap[0] = (char)('0' + gen.object_count);
      generated_siteswap[1] = 0;
    }
    if (ht_strcmp(generated_siteswap, prior) != 0 || attempt == 3u) {
      objects = gen.object_count;
      break;
    }
  }
  if (role == HT_PHRASE_THIRD) {
    append_siteswap_mark(generated_siteswap, (uint16_t)sizeof(generated_siteswap), '+');
    court.third_hand = 1;
  } else if (role == HT_PHRASE_DROP) {
    append_siteswap_mark(generated_siteswap, (uint16_t)sizeof(generated_siteswap), '-');
    court.third_hand = 0;
  } else {
    court.third_hand = 0;
  }
  bias.object_count = objects;
  controls.knob3 = (float)(objects - 3u) / 4.0f;
  knob01[EN_K3] = controls.knob3;
  active_siteswap = generated_siteswap;
  active_hand_style = (role == HT_PHRASE_THIRD || role == HT_PHRASE_DROP)
                          ? NULL
                          : HAND_STYLE_CATALOG[(mix >> 5) % HAND_STYLE_COUNT];
  court.siteswap = active_siteswap;
  court.hand_style = active_hand_style;
  last_throw_beat = -999;
  last_occ = HT_OCC_EMPTY;
  if (role == HT_PHRASE_DROP || role == HT_PHRASE_THIRD) {
    HtSiteswapSchedule horizon;
    float span = 8.0f;
    if (ht_siteswap_schedule_playable(generated_siteswap, 1, 48, &horizon) == HT_SS_OK) {
      float end = (float)(horizon.break_beat >= 0 ? horizon.break_beat + 2 : horizon.cycle_length + 2);
      if (end < 4.0f) {
        end = 4.0f;
      }
      if (end > 18.0f) {
        end = 18.0f;
      }
      span = end;
    }
    phrase_until_beat = pattern_beat + span;
    rest_after_phrase = role == HT_PHRASE_DROP ? 1u : 0u;
  } else {
    phrase_until_beat = pattern_beat + 12.0f + (float)((mix >> 3) % 20u);
    rest_after_phrase = 0;
  }
  refresh_drum_envelopes();
}

static void sync_voice_bus(void) {
  HtVoiceBus bus;
  HtMixGlobals globals;
  court.episode_wait = episode_resting;
  court.episode_gap = episode_gap;
  court.storm = weather.storm;
  court.moon = weather.moon;
  court.chaos = weather.chaos;
  court.feedback = weather.feedback;
  {
    HtTrackMix live[HT_TRACK_COUNT];
    globals = ht_live_mix_globals(&composition, &weather, ht_court_silence_mode(&court));
    ht_live_mix_snapshot_beat(&composition, pattern_beat, (float)plat_ms() * 0.001f, seed, &weather,
                              ht_court_silence_mode(&court), live, NULL);
    ht_voice_set_tracks(&voices, live);
  }
  bus.feedback = controls.knob1;
  bus.scatter = ht_scatter_from_fx_knob(controls.fx);
  bus.drive = ht_drive_from_edit_knob(controls.edit);
  bus.delay_time = ht_delay_from_fx_knob(controls.fx);
  bus.lfo_depth = ht_lfo_depth_from_knob(controls.knob2);
  bus.wildness = controls.glo;
  bus.compress = 0.35f + controls.glo * 0.4f;
  bus.court_gate = globals.court_gate;
  bus.dry = globals.dry;
  bus.wet = globals.wet;
  bus.reverb = globals.reverb;
  bus.env_amount = controls.env;
  bus.filter_hz = globals.filter_hz;
  bus.eq_lows = 0.5f + controls.presets * 0.15f;
  bus.eq_mids = 0.55f;
  bus.eq_highs = 0.45f + controls.algorithm * 0.2f;
  bus.sidechain_depth = 0.4f + bus.scatter * 0.5f;
  bus.analog = ht_analog_defaults();
  bus.analog.drive = bus.drive;
  bus.analog.warmth = 0.3f + controls.edit * 0.4f;
  bus.analog.wow = 0.2f + controls.knob2 * 0.35f;
  bus.analog.flutter = 0.15f + controls.fx * 0.25f;
  bus.analog.hiss = 0.06f + bias.wildness * 0.08f;
  bus.analog.mix = 0.35f + controls.edit * 0.35f;
  bus.tape_seconds = 0.12f + controls.select * 0.08f;
  bus.tape_dry = 0.45f + controls.presets * 0.4f;
  bus.tape_speed = 0.85f + controls.algorithm * 0.4f;
  bus.tape_recording = tape_recording;
  bus.tape_held = episode_resting && !episode_gap;
  bus.silence_mode = (uint8_t)globals.mode;
  ht_voice_set_bus(&voices, &bus);
}

static struct {
  char msg[2][24];
  uint32_t msg_until;
  uint32_t keys;
  uint32_t btn;
  uint8_t redraw;
} ui;

static void text_cat(char *d, const char *s) {
  while (*d) {
    d++;
  }
  while (*s) {
    *d++ = *s++;
  }
  *d = 0;
}

static float clampf(float value, float lo, float hi) {
  if (value < lo) {
    return lo;
  }
  if (value > hi) {
    return hi;
  }
  return value;
}

static uint8_t knob_host_id(int role) {
  if (role == EN_K1) {
    return 0;
  }
  if (role == EN_K2) {
    return 1;
  }
  if (role == EN_K3) {
    return 2;
  }
  if (role == EN_K4) {
    return 3;
  }
  return 255;
}

static void apply_knob_role(int role, float value) {
  knob01[role] = clampf(value, 0.0f, 1.0f);
  switch (role) {
    case EN_K1:
      controls.knob1 = knob01[role];
      break;
    case EN_K2:
      controls.knob2 = knob01[role];
      break;
    case EN_K3:
      controls.knob3 = knob01[role];
      break;
    case EN_K4:
      controls.knob4 = knob01[role];
      break;
    case EN_PRESET:
      controls.presets = knob01[role];
      break;
    case EN_ALGO:
      controls.algorithm = knob01[role];
      break;
    case EN_SELECT:
      controls.select = knob01[role];
      break;
    default:
      break;
  }
}

static void knob_nudge(int role, int32_t detents) {
  float next = knob01[role] + (float)detents * 0.02f;
  uint8_t host = knob_host_id(role);
  HtActionLoopMode mode;
  apply_knob_role(role, next);
  if (host != 255u && host == action_loop.host) {
    mode = ht_action_loop_on_host(&action_loop, knob01[role], pattern_beat, seed ^ plat_ms());
    if (mode == HT_ACTION_RECORDING) {
      app_say("ACT", "REC");
    } else if (mode == HT_ACTION_LOOPING) {
      app_say("ACT", "LOOP");
    }
  } else if (host != 255u && !action_loop.replaying) {
    ht_action_loop_capture(&action_loop, HT_ACTION_KNOB, host, knob01[role], pattern_beat);
  }
  bias = ht_bias_from_controls(&controls);
  bias.object_count_prefer = ht_object_count_from_siteswap_knob(controls.knob3);
  sync_tempo_knob();
  sync_voice_bus();
}

static uint8_t bpm_bucket(float bpm) {
  return (uint8_t)((bpm + 6.0f) / 12.0f);
}

static int patch_axes_distinct(uint8_t objects, uint8_t patch_type, uint8_t scale, uint8_t bpm_b,
                               const char *siteswap) {
  int score = 0;
  if (objects != previous_objects) {
    score += 2;
  }
  if (patch_type != previous_patch_type) {
    score += 2;
  }
  if (scale != previous_scale) {
    score += 1;
  }
  if (bpm_b != previous_bpm_bucket) {
    score += 1;
  }
  if (!previous_siteswap[0] || ht_strcmp(siteswap, previous_siteswap) != 0) {
    score += 2;
  }
  return score >= 4;
}

static void remember_patch_axes(void) {
  uint16_t i;
  previous_objects = bias.object_count;
  previous_patch_type = bias.patch_type;
  previous_scale = bias.scale_index;
  previous_bpm_bucket = bpm_bucket(bias.bpm);
  for (i = 0; i < HT_SITESWAP_MAX_STRING; i += 1) {
    previous_siteswap[i] = generated_siteswap[i];
    if (!generated_siteswap[i]) {
      break;
    }
  }
}

static void sync_tempo_knob(void) {
  controls.knob4 = ht_tempo_knob_from_bpm(bias.bpm);
  knob01[EN_K4] = controls.knob4;
  step_period_ms = (uint32_t)(60000.0f / (bias.bpm * 4.0f));
  if (step_period_ms < 40u) {
    step_period_ms = 40u;
  }
}

static void apply_seed(uint32_t next_seed) {
  uint8_t attempt;
  float bpm_prefer;
  seed = next_seed ? next_seed : 1u;
  bias = ht_bias_from_controls(&controls);
  bpm_prefer = bias.bpm;
  bias.object_count =
      ht_soft_object_count(bias.object_count_prefer, seed, bias.wildness, previous_objects);
  bias.bpm = ht_soft_bpm(bpm_prefer, seed ^ 0xb10bu, bias.wildness);
  controls.knob3 = (float)(bias.object_count - 3u) / 4.0f;
  knob01[EN_K3] = controls.knob3;
  sync_tempo_knob();
  for (attempt = 0; attempt < 5u; attempt += 1) {
    uint32_t try_seed = seed ^ ((uint32_t)attempt * 0x9e3779b9u);
    if (attempt > 0u) {
      bias.object_count =
          ht_soft_object_count(bias.object_count_prefer, try_seed, 1.0f, previous_objects);
      bias.bpm = ht_soft_bpm(bpm_prefer, try_seed ^ 0xb10bu, 1.0f);
      controls.knob3 = (float)(bias.object_count - 3u) / 4.0f;
      knob01[EN_K3] = controls.knob3;
      sync_tempo_knob();
      bias.patch_type = (uint8_t)((bias.patch_type + 1u + attempt) % HT_PATCH_TYPE_COUNT);
      bias.scale_index = (uint8_t)((bias.scale_index + 2u + attempt) % HT_SCALE_COUNT);
    }
    ht_gen_turing_init(&turing, 8, (uint8_t)(10u + (uint32_t)(bias.wildness * 50.0f)), 2, try_seed);
    ht_gen_atlas_init(&atlas, (uint8_t)(try_seed & 0xffu), (uint8_t)((try_seed >> 8) & 0xffu),
                      (uint8_t)(50u + (uint32_t)(bias.wildness * 40.0f)),
                      (uint8_t)(5u + (uint32_t)(bias.wildness * 30.0f)), try_seed ^ 0x4d07u);
    ht_key_map_build(try_seed, key_roles);
    ht_composition_init(&composition, try_seed, bias.wildness, bias.patch_type);
    (void)composition.active_tracks;
    ht_voice_set_seed(&voices, try_seed);
    step_ms_accum = 0;
    pattern_beat = 0.0f;
    phrase_index = 0;
    pick_siteswap_phrase(try_seed);
    if (patch_axes_distinct(bias.object_count, bias.patch_type, bias.scale_index,
                            bpm_bucket(bias.bpm), generated_siteswap) ||
        attempt == 4u) {
      seed = try_seed;
      break;
    }
  }
  ht_action_loop_rebind(&action_loop, seed);
  remember_patch_axes();
  ht_court_clear_trails();
  gen_armed = 1;
  sync_voice_bus();
  /* Audible seed mark so a silent bus is obvious in the emulator. */
  ht_voice_note_on(&voices, ht_scale_note(bias.scale_index, 60.0f, 0, set.octave), 110,
                   ht_voice_pick_engine(seed, 60.0f, 0));
}

static void settings_defaults(void) {
  set.magic = SET_MAGIC;
  set.octave = 0;
}

void app_init(void) {
  uint32_t index;
  ht_controls_init(&controls);
  ht_voice_init(&voices);
  for (index = 0; index < NE; index += 1) {
    knob01[index] = 0.5f;
  }
  knob01[EN_K1] = controls.knob1;
  knob01[EN_K2] = controls.knob2;
  knob01[EN_K3] = controls.knob3;
  knob01[EN_K4] = controls.knob4;
  knob01[EN_PRESET] = controls.presets;
  knob01[EN_ALGO] = controls.algorithm;
  knob01[EN_SELECT] = controls.select;
  if (plat_store_load(OBJ_SETTINGS, &set, sizeof set) != (int)sizeof set || set.magic != SET_MAGIC ||
      set.octave < -2 || set.octave > 2) {
    settings_defaults();
  }
  tape_recording = 0;
  episode_resting = 0;
  episode_gap = 0;
  rest_after_phrase = 0;
  court.third_hand = 0;
  rest_until_ms = 0;
  previous_siteswap[0] = 0;
  previous_objects = 0;
  previous_patch_type = 255;
  previous_scale = 255;
  previous_bpm_bucket = 255;
  ht_action_loop_init(&action_loop, 1u);
  weather.storm = 0.2f;
  weather.chaos = 0.15f;
  weather.moon = 0.3f;
  weather.feedback = 0.35f;
  court.cosmology = 0;
  court.airborne_count = 3;
  court.hand_hold_count = 0;
  ht_court_clear_trails();
  apply_seed(ht_unique_seed(plat_ms() ^ 0x4854u));
}

void app_panic(void) {
  ht_voice_panic(&voices);
  gen_armed = 0;
}

void app_say(const char *a, const char *b) {
  uint32_t i;
  char t[48];
  /* LCD stays props-only (JS pixel court). Keep announcements for screen readers. */
  for (i = 0; i < 23u && a && a[i]; i++) {
    ui.msg[0][i] = a[i];
  }
  ui.msg[0][i] = 0;
  for (i = 0; i < 23u && b && b[i]; i++) {
    ui.msg[1][i] = b[i];
  }
  ui.msg[1][i] = 0;
  ui.msg_until = 0;
  if (ann_on()) {
    t[0] = 0;
    text_cat(t, ui.msg[0]);
    if (ui.msg[1][0]) {
      text_cat(t, " ");
      text_cat(t, ui.msg[1]);
    }
    ann_say(t, 0, ANN_NOW);
  }
}

static void siteswap_tick(void) {
  HtSiteswapSchedule schedule;
  HtModFactors factors;
  HtModVector sustain;
  HtOccupancySign sign;
  uint16_t i;
  uint8_t held = 0;
  uint8_t airborne = 0;
  /* step_period_ms is one 16th; advance a quarter-beat so wall tempo matches JS bpm. */
  pattern_beat += 0.25f;
  if (pattern_beat >= phrase_until_beat) {
    phrase_index = (uint8_t)(phrase_index + 1u);
    if (rest_after_phrase) {
      rest_after_phrase = 0;
      begin_episode_rest(0);
      phrase_until_beat = pattern_beat + 64.0f;
      return;
    }
    pick_siteswap_phrase(seed ^ ((uint32_t)phrase_index * 0x9e3779b9u));
  }
  court.time_beat = pattern_beat;
  court.siteswap = active_siteswap;
  court.hand_style = active_hand_style;
  court.dwell_ratio = bias.dwell_ratio;
  court.hold_twos = 1;
  if (ht_siteswap_schedule_playable(active_siteswap, 1, (int16_t)(pattern_beat + 16), &schedule) !=
      HT_SS_OK) {
    pick_siteswap_phrase(seed ^ 0x51e51e51u ^ phrase_index);
    return;
  }
  {
    uint8_t ball_held[HT_SITESWAP_MAX_BALLS];
    uint8_t ball_air[HT_SITESWAP_MAX_BALLS];
    uint8_t ball_live[HT_SITESWAP_MAX_BALLS];
    float dwell = bias.dwell_ratio > 0.05f ? bias.dwell_ratio : 0.5f;
    for (i = 0; i < HT_SITESWAP_MAX_BALLS; i += 1) {
      ball_held[i] = 0;
      ball_air[i] = 0;
      ball_live[i] = 0;
    }
    for (i = 0; i < schedule.event_count; i += 1) {
      const HtSiteswapEvent *ev = &schedule.events[i];
      float flight;
      float throw_time;
      float next_throw;
      float shannon;
      if (ev->ball >= HT_SITESWAP_MAX_BALLS) {
        continue;
      }
      if (ev->dump && pattern_beat >= (float)ev->beat + (float)(ev->height > 0 ? ev->height : 0)) {
        continue;
      }
      if (ev->drop) {
        if (pattern_beat >= (float)ev->beat) {
          ball_live[ev->ball] = 1;
          ball_held[ev->ball] = 0;
          ball_air[ev->ball] = 0;
        }
        continue;
      }
      if (ev->height == 0) {
        continue;
      }
      throw_time = (float)ev->beat;
      next_throw = throw_time + (float)ev->height;
      if (ev->hold) {
        flight = 0.0f;
      } else {
        shannon = (float)ev->height - 2.0f * dwell;
        {
          float ceiling = (float)ev->height - 0.15f;
          if (ceiling < 0.2f) {
            ceiling = 0.2f;
          }
          flight = shannon >= 0.5f ? shannon : (ceiling < 0.5f ? ceiling : 0.5f);
        }
      }
      if (ev->beat == (int16_t)pattern_beat && !ev->hold && !ev->parked && ev->beat != last_throw_beat) {
        HtModFactors edge = {0};
        HtModVector burst;
        last_throw_beat = ev->beat;
        edge.state = last_occ == HT_OCC_EMPTY ? HT_OCC_MIXED : last_occ;
        edge.object_count = schedule.ball_count;
        edge.object_index = (uint8_t)(ev->height % 7);
        edge.hand = ev->from_hand;
        edge.dwell_phase = 0.0f;
        edge.transition = HT_MOD_THROW;
        burst = ht_mod_matrix_combine(&edge);
        {
          float midi = ht_scale_note(bias.scale_index, 48.0f, (uint8_t)(ev->height % 12), set.octave);
          uint8_t vel = (uint8_t)(70 + burst.burst_gain * 40.0f);
          ht_voice_note_on(&voices, midi, vel, ht_voice_pick_engine(seed, midi, 0));
        }
      }
      if (pattern_beat >= throw_time && pattern_beat < next_throw) {
        ball_live[ev->ball] = 1;
        if (!ev->hold && pattern_beat < throw_time + flight) {
          ball_held[ev->ball] = 0;
          ball_air[ev->ball] = 1;
        } else {
          ball_held[ev->ball] = 1;
          ball_air[ev->ball] = 0;
        }
      }
    }
    held = 0;
    airborne = 0;
    for (i = 0; i < HT_SITESWAP_MAX_BALLS; i += 1) {
      if (!ball_live[i]) {
        continue;
      }
      if (ball_held[i]) {
        held = (uint8_t)(held + 1);
      } else if (ball_air[i]) {
        airborne = (uint8_t)(airborne + 1);
      }
    }
  }
  court.airborne_count = airborne;
  court.hand_hold_count = held;
  sign = ht_occupancy_sign(held, airborne, (uint8_t)(held + airborne));
  factors.state = sign;
  factors.object_count = schedule.ball_count;
  factors.object_index = (uint8_t)((uint32_t)pattern_beat % 7u);
  factors.hand = ((int)pattern_beat & 1) ? 1 : 0;
  factors.dwell_phase = schedule.ball_count ? (float)held / (float)schedule.ball_count : 0.5f;
  factors.transition = (sign != last_occ && last_occ != HT_OCC_EMPTY) ? HT_MOD_STATE_EDGE : HT_MOD_SUSTAIN;
  sustain = ht_mod_matrix_combine(&factors);
  weather.feedback = 0.25f + sustain.feedback * 0.45f;
  if (factors.transition == HT_MOD_STATE_EDGE && sustain.audible) {
    float midi =
        ht_scale_note(bias.scale_index, 40.0f, (uint8_t)(sustain.engine_bias * 6.0f), set.octave);
    ht_voice_note_on(&voices, midi, (uint8_t)(60 + sustain.burst_gain * 50.0f),
                     ht_voice_pick_engine(seed, midi, 0));
  }
  last_occ = sign;
}

static void replay_action_events(void) {
  HtActionEvent due[8];
  uint8_t count = ht_action_loop_tick(&action_loop, pattern_beat, due, 8);
  uint8_t i;
  if (count == 0u) {
    return;
  }
  action_loop.replaying = 1;
  for (i = 0; i < count; i += 1) {
    if (due[i].kind == HT_ACTION_KNOB) {
      int role = due[i].id == 0 ? EN_K1 : due[i].id == 1 ? EN_K2 : due[i].id == 2 ? EN_K3 : EN_K4;
      apply_knob_role(role, due[i].value);
    } else if (due[i].kind == HT_ACTION_BUTTON && due[i].id == B_REC) {
      tape_recording = due[i].value > 0.5f ? 1u : 0u;
    } else if (due[i].kind == HT_ACTION_KEY) {
      ht_voice_note_on(&voices, (float)(53 + due[i].id + 12 * set.octave),
                       (uint8_t)(40 + due[i].value * 80.0f),
                       ht_voice_pick_engine(seed, (float)(53 + due[i].id), 0));
    }
  }
  bias = ht_bias_from_controls(&controls);
  sync_voice_bus();
  action_loop.replaying = 0;
}

static void generator_tick(void) {
  HtGenOut note;
  HtGenOut drums[3];
  int drum_count;
  int index;
  if (!gen_armed) {
    return;
  }
  if (episode_resting) {
    return;
  }
  siteswap_tick();
  replay_action_events();
  note = ht_gen_turing_step(&turing);
  if (note.gate) {
    uint8_t midi = (uint8_t)(note.midi + 12 * set.octave);
    uint8_t engine = ht_voice_pick_engine(seed, midi, 0);
    ht_voice_note_on(&voices, midi, note.velocity, engine);
  }
  drum_count = ht_gen_atlas_step(&atlas, drums);
  for (index = 0; index < drum_count; index += 1) {
    if (drums[index].gate) {
      ht_voice_note_on(&voices, drums[index].midi, drums[index].velocity,
                       ht_voice_pick_engine(seed, drums[index].midi, 1));
    }
  }
  sync_voice_bus();
}

static void begin_episode_rest(uint8_t gap) {
  episode_resting = 1;
  episode_gap = gap ? 1 : 0;
  rest_until_ms = plat_ms() + (gap ? 180u : 420u);
  court.airborne_count = 0;
  sync_voice_bus();
  app_say(gap ? "GAP" : "TAIL", "REST");
}

void app_render(int32_t *lr, uint32_t n, uint32_t master_q12) {
  uint32_t pkt;
  int port;
  uint32_t gain = master_q12;
  /* Keep this ISR-thin: no bus reconfigure (8 KiB audio stack). Bus sync lives in app_frame. */
  while (plat_midi_in(&pkt, &port)) {
    uint32_t st = (pkt >> 8) & 0xFFu;
    uint32_t d1 = (pkt >> 16) & 0x7Fu;
    uint32_t d2 = pkt >> 24;
    if ((st & 0xF0u) == 0x90u && d2) {
      ht_voice_note_on(&voices, (uint8_t)d1, (uint8_t)d2,
                       ht_voice_pick_engine(seed, (uint8_t)d1, 0));
    } else if ((st & 0xF0u) == 0x80u || ((st & 0xF0u) == 0x90u && !d2)) {
      ht_voice_note_off(&voices, (uint8_t)d1);
    }
  }
  /* Platform already applied APP_GAIN; keep a hard floor if a build skips it. */
  if (gain < 1400u) {
    gain = 1400u;
  }
  controls.master = (float)gain / 4096.0f;
  ht_voice_render(&voices, lr, n, gain);
}

static void play_fresh_seed(void) {
  char hex[12];
  uint32_t next = ht_unique_seed(plat_ms() ^ seed ^ plat_buttons());
  apply_seed(next);
  hex[0] = '0';
  hex[1] = 'x';
  {
    static const char H[] = "0123456789ABCDEF";
    int pos;
    for (pos = 0; pos < 8; pos += 1) {
      hex[2 + pos] = H[(next >> (28 - 4 * pos)) & 0xfu];
    }
    hex[10] = 0;
  }
  app_say(active_siteswap, hex);
}

static void handle_key(uint32_t k, int down, uint32_t velocity) {
  HtKeyRole *role = &key_roles[k % HT_KEY_MIDI_COUNT];
  uint8_t midi = (uint8_t)(53 + k + 12 * set.octave);
  if (!down) {
    ht_voice_note_off(&voices, midi);
    return;
  }
  if (!action_loop.replaying) {
    ht_action_loop_capture(&action_loop, HT_ACTION_KEY, (uint8_t)(k % 127u),
                           (float)velocity / 127.0f, pattern_beat);
  }
  if (role->kind == HT_KEY_MUTE) {
    return;
  }
  if (role->kind == HT_KEY_BURST) {
    ht_voice_note_on(&voices, midi, (uint8_t)velocity, ht_voice_pick_engine(seed, midi, 0));
    ht_voice_note_on(&voices, (uint8_t)(midi + 7),
                     (uint8_t)(velocity > 20 ? velocity - 20 : velocity),
                     ht_voice_pick_engine(seed ^ 0x11u, (uint8_t)(midi + 7), 0));
    return;
  }
  ht_voice_note_on(&voices, midi, (uint8_t)velocity, ht_voice_pick_engine(seed, midi, 0));
  plat_midi_send(0x09u | 0x90u << 8 | (uint32_t)midi << 16 | velocity << 24, TO_USB | TO_BLE);
}

static void input(void) {
  uint32_t keys;
  uint32_t btn = plat_buttons();
  uint32_t k;
  int32_t e;
  touch_poll();
  keys = touch_keys();
  for (k = 0; k < NKEYS; k += 1) {
    uint32_t bit = 1u << k;
    if ((keys & bit) && !(ui.keys & bit)) {
      handle_key(k, 1, touch_vel(k));
    } else if (!(keys & bit) && (ui.keys & bit)) {
      handle_key(k, 0, 0);
      plat_midi_send(0x08u | 0x80u << 8 | (uint32_t)(53 + k + 12 * set.octave) << 16, TO_USB | TO_BLE);
    }
  }
  for (k = 0; k < NB; k += 1) {
    uint32_t bit = 1u << k;
    if (!(btn & bit) || (ui.btn & bit)) {
      continue;
    }
    if (k == B_PLAY) {
      play_fresh_seed();
    } else if (!action_loop.replaying) {
      ht_action_loop_capture(&action_loop, HT_ACTION_BUTTON, (uint8_t)k, 1.0f, pattern_beat);
    }
    if (k == B_OCTDN) {
      set.octave = (int8_t)clamp(set.octave - 1, -2, 2);
      set_dirty = 1;
      app_say("OCTAVE", set.octave < 0 ? "-" : "+");
    } else if (k == B_OCTUP) {
      set.octave = (int8_t)clamp(set.octave + 1, -2, 2);
      set_dirty = 1;
      app_say("OCTAVE", set.octave < 0 ? "-" : "+");
    } else if (k == B_SAVE) {
      if (plat_store_save(OBJ_SETTINGS, &set, sizeof set) == 0) {
        set_dirty = 0;
        controls.seed_locked = 1;
        app_say("SAVED", "");
      } else {
        app_say("SAVE", "FAILED");
      }
    } else if (k == B_REC) {
      tape_recording = (uint8_t)!tape_recording;
      sync_voice_bus();
      app_say("TAPE", tape_recording ? "REC" : "PLAY");
    } else if (k == B_SEL) {
      court.cosmology = (uint8_t)!court.cosmology;
      weather.storm = court.cosmology ? 0.55f : 0.2f;
      weather.chaos = court.cosmology ? 0.4f : 0.15f;
      sync_voice_bus();
      app_say("COSMO", court.cosmology ? "ON" : "OFF");
    } else if (k == B_ARP) {
      begin_episode_rest(1);
    } else if (k == B_SEQ) {
      apply_seed(ht_unique_seed(seed ^ 0x5e11u));
      begin_episode_rest(0);
      app_say("SEQ", active_siteswap);
    } else if (k == B_HOME) {
      ht_controls_init(&controls);
      knob01[EN_K1] = controls.knob1;
      knob01[EN_K2] = controls.knob2;
      knob01[EN_K3] = controls.knob3;
      knob01[EN_K4] = controls.knob4;
      bias = ht_bias_from_controls(&controls);
      sync_voice_bus();
      app_say("HOME", "RECALL");
    } else if (k == B_ENV) {
      controls.env = clampf(controls.env + 0.08f, 0.0f, 1.0f);
      bias = ht_bias_from_controls(&controls);
      sync_voice_bus();
      app_say("ENV", "UP");
    } else if (k == B_LFO) {
      controls.lfo = clampf(controls.lfo + 0.08f, 0.0f, 1.0f);
      bias = ht_bias_from_controls(&controls);
      sync_voice_bus();
      app_say("LFO", "UP");
    } else if (k == B_FX) {
      controls.fx = clampf(controls.fx + 0.08f, 0.0f, 1.0f);
      bias = ht_bias_from_controls(&controls);
      sync_voice_bus();
      app_say("FX", "UP");
    } else if (k == B_EDIT) {
      controls.edit = clampf(controls.edit + 0.08f, 0.0f, 1.0f);
      bias = ht_bias_from_controls(&controls);
      sync_voice_bus();
      app_say("DRIVE", "UP");
    } else if (k == B_GLO) {
      controls.glo = clampf(controls.glo + 0.08f, 0.0f, 1.0f);
      bias = ht_bias_from_controls(&controls);
      sync_voice_bus();
      app_say("WILD", "UP");
    }
  }
  for (k = 0; k < NE; k += 1) {
    if ((e = plat_enc((int)k)) == 0) {
      continue;
    }
    knob_nudge((int)k, e);
    ui.redraw = 1;
  }
  if (keys != ui.keys || btn != ui.btn) {
    ui.redraw = 1;
  }
  ui.keys = keys;
  ui.btn = btn;
  plat_glow(1);
  plat_leds(btn | (set_dirty ? 1u << B_SAVE : 0u) | (gen_armed ? 1u << B_PLAY : 0u) |
                (tape_recording ? 1u << B_REC : 0u),
            keys);
}

void app_input_only(void) { input(); }

static void draw_court(void) {
  /* Full 240×240 in horizontal strips (canvas budget is APP_CANVAS_PX). */
  const uint32_t strip = 120u;
  uint32_t y0;
  court.dwell_ratio = bias.dwell_ratio;
  court.hold_twos = 1;
  court.siteswap = active_siteswap;
  court.hand_style = active_hand_style;
  court.time_beat = pattern_beat + (step_period_ms ? (float)step_ms_accum / (float)step_period_ms : 0.0f);
  ht_court_push_trail(&court);
  for (y0 = 0; y0 < (uint32_t)HT_COURT_HEIGHT; y0 += strip) {
    uint32_t h = strip;
    uint32_t row;
    if (y0 + h > (uint32_t)HT_COURT_HEIGHT) {
      h = (uint32_t)HT_COURT_HEIGHT - y0;
    }
    cv_begin(240u, h, C_BLACK);
    for (row = 0; row < h; row += 1) {
      uint16_t line[HT_COURT_WIDTH];
      uint32_t x;
      ht_court_draw_frame(line, (int)(y0 + row), &court);
      for (x = 0; x < (uint32_t)HT_COURT_WIDTH; x += 1) {
        cv_px[row * 240u + x] = swap16(line[x]);
      }
    }
    cv_blit(0, y0);
  }
}

void app_ui_init(void) {
  touch_on(1);
  lcd_fill(0, 0, 240, 240, C_BLACK);
  ui.redraw = 1;
}

void app_frame(void) {
  uint32_t now = plat_ms();
  static uint32_t last_ms;
  uint32_t dt;
  input();
  if (episode_resting && now >= rest_until_ms) {
    episode_resting = 0;
    episode_gap = 0;
    court.airborne_count = 3;
    ui.redraw = 1;
  }
  if (!last_ms) {
    last_ms = now;
  }
  dt = now - last_ms;
  last_ms = now;
  step_ms_accum += dt;
  while (step_period_ms && step_ms_accum >= step_period_ms) {
    step_ms_accum -= step_period_ms;
    generator_tick();
    ui.redraw = 1;
  }
  /* ~20 Hz court blit: full 240×240 SPI every frame starves the 8 KiB audio ISR in emu. */
  {
    static uint8_t court_div;
    court_div = (uint8_t)(court_div + 1u);
    if ((court_div % 3u) == 0u || ui.redraw) {
      draw_court();
    }
  }
  ui.redraw = 0;
  (void)now;
}

#ifdef PLAT_HOST
#include <string.h>
int app_expect(const char *what, int *got) {
  if (!strcmp(what, "octave")) {
    *got = set.octave;
  } else if (!strcmp(what, "seed")) {
    *got = (int)(seed & 0xffffu);
  } else if (!strcmp(what, "armed")) {
    *got = gen_armed;
  } else if (!strcmp(what, "dirty")) {
    *got = set_dirty;
  } else {
    return 0;
  }
  return 1;
}
#endif
