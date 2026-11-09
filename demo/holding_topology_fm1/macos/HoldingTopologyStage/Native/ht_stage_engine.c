/* SPDX-License-Identifier: MIT
 * Native stage engine — C DSP + portable ht_* generators (macOS host). */
#include "ht_stage_engine.h"

#include <math.h>
#include <stdlib.h>
#include <string.h>

#include "ht_action_loop.h"
#include "ht_controls.h"
#include "ht_court.h"
#include "ht_engine_assign.h"
#include "ht_fx.h"
#include "ht_gen.h"
#include "ht_mix.h"
#include "ht_mod_matrix.h"
#include "ht_siteswap.h"
#include "ht_tuning.h"
#include "ht_voice.h"

#ifndef HT_STAGE_HAND_COUNT
#define HT_STAGE_HAND_COUNT 5
#endif

#ifndef HT_STAGE_RENDER_MAX
#define HT_STAGE_RENDER_MAX 4096u
#endif

/* Mirrors js/rnd_patch.js profileMix — delay / drive / feedback character per timbre. */
typedef struct HtStageProfileMix {
  float delay_time;
  float drive;
  float feedback;
  float reverb;
  float filter_hz;
  float scatter;
  float wet;
  float dry;
} HtStageProfileMix;

struct HtStageEngine {
  HtVoiceBank voices;
  HtControls controls;
  HtPatchBias bias;
  HtGenTuring turing;
  HtGenEuclid euclid;
  HtGenMarkov markov;
  HtGenMorph morph;
  HtGenAtlas atlas;
  HtCourtFrame court;
  HtActionLooper action_loop;
  HtOccupancySign last_occ;
  HtEngineAssign engine_assign;
  HtComposition composition;
  HtMixSection section;
  HtStageProfileMix profile_mix;
  uint8_t section_index;
  uint8_t gen_kind; /* HtGenKind for melodic fireGenerators */
  uint32_t note_serial;
  char siteswap[HT_SITESWAP_MAX_STRING];
  const char *hand_style;
  uint32_t seed;
  float pattern_beat;
  float phrase_until;
  uint8_t phrase_index;
  int16_t last_throw_beat;
  int8_t octave;
  float root_midi;
  uint8_t gen_armed;
  uint8_t tape_recording;
  uint8_t episode_resting;
  uint8_t episode_gap;
  uint8_t rest_after_phrase; /* drop role → rest once flash phrase ends */
  uint16_t gen_step;
  double rest_until_ms;
  double clock_ms;
  double sample_rate;
  double step_accum_ms;
  double step_period_ms;
  double last_wall_ms;
  uint8_t has_wall;
  int32_t render_scratch[HT_STAGE_RENDER_MAX * 2u];
};

/* Lab hand paths (inside, outside, mills mess, tennis, windmill) — not a siteswap shelf. */
static const char *HAND_STYLES[HT_STAGE_HAND_COUNT] = {
    "(10)(32.5).",
    "(32.5)(10).",
    "(-30)(2.5).(30)(-2.5).(-30)(0).",
    "(0)(25).(-20)(10).(20)(10).",
    "(25)(-5).(-25)(5).(25)(-5).",
};

static const char *pick_hand_style(uint32_t mix, float wildness) {
  /* Clean cascade hands stay common; wildness unlocks styled paths (JS pickHandStyle). */
  uint32_t ticket = mix % 100u;
  uint32_t unlock = (uint32_t)(22.0f + wildness * 45.0f);
  if (ticket >= unlock) {
    return NULL;
  }
  return HAND_STYLES[(mix >> 5) % HT_STAGE_HAND_COUNT];
}

static uint8_t pick_family(uint32_t mix, uint8_t opener) {
  /* Mirror js/siteswap_episode PHRASE_ROLE_WEIGHTS — named families dominate cascade. */
  static const uint8_t weighted[] = {
      HT_SS_FAMILY_SHOWER,    HT_SS_FAMILY_SHOWER,    HT_SS_FAMILY_BOX,       HT_SS_FAMILY_BOX,
      HT_SS_FAMILY_MULTIPLEX, HT_SS_FAMILY_MULTIPLEX, HT_SS_FAMILY_FOUNTAIN,  HT_SS_FAMILY_COLUMNS,
      HT_SS_FAMILY_SHOWER,    HT_SS_FAMILY_BOX,       HT_SS_FAMILY_FOUNTAIN,  HT_SS_FAMILY_MULTIPLEX,
      HT_SS_FAMILY_COLUMNS,   HT_SS_FAMILY_NONE,      HT_SS_FAMILY_SHOWER,    HT_SS_FAMILY_BOX};
  static const uint8_t openers[] = {HT_SS_FAMILY_SHOWER, HT_SS_FAMILY_BOX, HT_SS_FAMILY_MULTIPLEX,
                                    HT_SS_FAMILY_FOUNTAIN, HT_SS_FAMILY_BOX, HT_SS_FAMILY_SHOWER};
  if (opener) {
    return openers[mix % (sizeof(openers) / sizeof(openers[0]))];
  }
  return weighted[mix % (sizeof(weighted) / sizeof(weighted[0]))];
}

/* Parametric family + search — never shelf-hardcode; cascade digit only as last resort. */
static int generate_siteswap(char *out, uint16_t cap, uint8_t objects, uint8_t family,
                             uint32_t mix) {
  HtSiteswapGenParams gen;
  uint8_t attempt;
  uint8_t n = objects < 3u ? 3u : objects;
  if (n > 7u) {
    n = 7u;
  }
  if (!out || cap < 8u) {
    return 0;
  }
  for (attempt = 0; attempt < 14u; attempt += 1) {
    uint8_t try_family = attempt == 0u ? family : pick_family(mix + attempt * 17u, 0);
    uint8_t timing = HT_SS_ASYNC;
    uint8_t period = (uint8_t)(2u + ((mix >> (attempt + 1)) % 7u));
    uint8_t rest = 0;
    if (try_family == HT_SS_FAMILY_BOX || try_family == HT_SS_FAMILY_COLUMNS) {
      timing = HT_SS_SYNC;
      period = (uint8_t)(4u + 2u * ((mix >> attempt) & 1u));
    } else if (try_family == HT_SS_FAMILY_FOUNTAIN) {
      timing = HT_SS_SYNC;
      period = (uint8_t)(2u + 2u * ((mix >> (attempt + 2)) & 1u));
    } else if (try_family == HT_SS_FAMILY_SHOWER) {
      period = (uint8_t)(2u + ((mix >> attempt) & 3u));
    } else if (try_family == HT_SS_FAMILY_MULTIPLEX) {
      period = (uint8_t)(2u + ((mix >> attempt) % 4u));
    } else if (((mix + attempt) & 3u) == 1u) {
      timing = HT_SS_SYNC;
      if (period & 1u) {
        period = (uint8_t)(period + 1u);
      }
    } else if (((mix + attempt) & 7u) == 3u) {
      timing = HT_SS_HYBRID;
    }
    /* Flash / hold endings: trailing zeros (JS restStyle). */
    if (try_family == HT_SS_FAMILY_NONE && ((mix >> attempt) & 5u) == 1u) {
      rest = (uint8_t)(1u + ((mix >> 3) & 1u));
    }
    memset(&gen, 0, sizeof(gen));
    gen.object_count = n;
    gen.period = period < 2u ? 2u : period;
    gen.max_throw = (uint8_t)(n + 2u + ((mix >> 8) & 7u));
    if (gen.max_throw > 35u) {
      gen.max_throw = 35u;
    }
    gen.min_throw = 0u;
    gen.timing = timing;
    gen.family = try_family;
    gen.rest_slots = rest;
    gen.search_budget = 2400u;
    gen.seed = (mix ? mix : 1u) ^ ((uint32_t)attempt * 0x9e3779b9u) ^ ((uint32_t)n << 8);
    out[0] = 0;
    if (ht_siteswap_generate(&gen, out, cap) == HT_SS_OK && ht_siteswap_valid(out)) {
      return 1;
    }
  }
  /* Named-family failure: try every constructive family before cascade digit. */
  {
    static const uint8_t last_families[] = {HT_SS_FAMILY_SHOWER, HT_SS_FAMILY_BOX,
                                            HT_SS_FAMILY_FOUNTAIN, HT_SS_FAMILY_COLUMNS,
                                            HT_SS_FAMILY_MULTIPLEX};
    uint8_t fi;
    for (fi = 0; fi < 5u; fi += 1) {
      if (ht_siteswap_construct_family(last_families[fi], n, mix ^ (0x51e51eu + fi), out, cap) ==
              HT_SS_OK &&
          ht_siteswap_valid(out)) {
        return 1;
      }
    }
  }
  if ((n & 1u) == 0u) {
    n = (uint8_t)(n - 1u);
  }
  if (n < 3u) {
    n = 3u;
  }
  out[0] = (char)('0' + n);
  out[1] = 0;
  return ht_siteswap_valid(out);
}

static void sync_tempo(HtStageEngine *stage) {
  stage->controls.knob4 = ht_tempo_knob_from_bpm(stage->bias.bpm);
  stage->step_period_ms = 60000.0 / ((double)stage->bias.bpm * 4.0);
  if (stage->step_period_ms < 20.0) {
    stage->step_period_ms = 20.0;
  }
}

static float mix_unit01(uint32_t *state) {
  return (float)(ht_engine_assign_next(state) & 0xffffu) / 65535.0f;
}

static float mix_between(uint32_t *state, float lo, float hi) {
  return lo + mix_unit01(state) * (hi - lo);
}

/* Same ranges as js/rnd_patch.js profileMix. */
static void stage_apply_profile_mix(HtStageEngine *stage, uint32_t seed) {
  uint32_t state = seed ? seed : 1u;
  uint8_t profile = stage->engine_assign.timbre_profile;
  HtStageProfileMix *pm = &stage->profile_mix;
  memset(pm, 0, sizeof(*pm));
  if (profile == HT_TIMBRE_LYRA_ORGAN) {
    pm->delay_time = mix_between(&state, 0.22f, 0.42f);
    pm->drive = mix_between(&state, 0.25f, 0.55f);
    pm->feedback = mix_between(&state, 0.4f, 0.7f);
    pm->reverb = mix_between(&state, 0.15f, 0.35f);
    pm->filter_hz = mix_between(&state, 3500.0f, 7500.0f);
  } else if (profile == HT_TIMBRE_ACID_ROOM) {
    pm->delay_time = mix_between(&state, 0.12f, 0.28f);
    pm->drive = mix_between(&state, 0.45f, 0.8f);
    pm->feedback = mix_between(&state, 0.2f, 0.45f);
    pm->reverb = mix_between(&state, 0.1f, 0.25f);
    pm->filter_hz = mix_between(&state, 900.0f, 2800.0f);
  } else if (profile == HT_TIMBRE_GLASS_PAD) {
    pm->delay_time = mix_between(&state, 0.35f, 0.6f);
    pm->drive = mix_between(&state, 0.1f, 0.35f);
    pm->feedback = mix_between(&state, 0.35f, 0.65f);
    pm->reverb = mix_between(&state, 0.35f, 0.65f);
    pm->filter_hz = mix_between(&state, 4500.0f, 9000.0f);
  } else if (profile == HT_TIMBRE_NOISE_RITUAL) {
    pm->delay_time = mix_between(&state, 0.2f, 0.5f);
    pm->drive = mix_between(&state, 0.35f, 0.75f);
    pm->feedback = mix_between(&state, 0.45f, 0.75f);
    pm->reverb = mix_between(&state, 0.25f, 0.55f);
    pm->filter_hz = mix_between(&state, 1200.0f, 4000.0f);
  } else if (profile == HT_TIMBRE_CHOIR_CAVE) {
    pm->delay_time = mix_between(&state, 0.3f, 0.55f);
    pm->drive = mix_between(&state, 0.15f, 0.4f);
    pm->feedback = mix_between(&state, 0.4f, 0.7f);
    pm->reverb = mix_between(&state, 0.4f, 0.7f);
    pm->filter_hz = mix_between(&state, 2500.0f, 5500.0f);
  } else if (profile == HT_TIMBRE_PULSE_GRID) {
    pm->delay_time = mix_between(&state, 0.1f, 0.25f);
    pm->drive = mix_between(&state, 0.3f, 0.6f);
    pm->feedback = mix_between(&state, 0.15f, 0.4f);
    pm->reverb = mix_between(&state, 0.08f, 0.22f);
    pm->filter_hz = mix_between(&state, 2000.0f, 5000.0f);
  } else if (profile == HT_TIMBRE_KARPLUS_HALL) {
    pm->delay_time = mix_between(&state, 0.25f, 0.5f);
    pm->drive = mix_between(&state, 0.2f, 0.5f);
    pm->feedback = mix_between(&state, 0.3f, 0.6f);
    pm->reverb = mix_between(&state, 0.3f, 0.55f);
    pm->filter_hz = mix_between(&state, 3000.0f, 7000.0f);
  } else if (profile == HT_TIMBRE_STRING_COURT) {
    pm->delay_time = mix_between(&state, 0.18f, 0.4f);
    pm->drive = mix_between(&state, 0.15f, 0.4f);
    pm->feedback = mix_between(&state, 0.25f, 0.5f);
    pm->reverb = mix_between(&state, 0.25f, 0.5f);
    pm->filter_hz = mix_between(&state, 2800.0f, 6500.0f);
  } else if (profile == HT_TIMBRE_WIND_COURT) {
    pm->delay_time = mix_between(&state, 0.28f, 0.55f);
    pm->drive = mix_between(&state, 0.25f, 0.55f);
    pm->feedback = mix_between(&state, 0.4f, 0.7f);
    pm->reverb = mix_between(&state, 0.3f, 0.6f);
    pm->filter_hz = mix_between(&state, 1600.0f, 4500.0f);
  } else if (profile == HT_TIMBRE_AMAZON_CANOPY) {
    pm->delay_time = mix_between(&state, 0.32f, 0.62f);
    pm->drive = mix_between(&state, 0.12f, 0.38f);
    pm->feedback = mix_between(&state, 0.35f, 0.65f);
    pm->reverb = mix_between(&state, 0.4f, 0.72f);
    pm->filter_hz = mix_between(&state, 2200.0f, 6200.0f);
  } else if (profile == HT_TIMBRE_JAMAICA_DUB) {
    pm->delay_time = mix_between(&state, 0.28f, 0.55f);
    pm->drive = mix_between(&state, 0.2f, 0.5f);
    pm->feedback = mix_between(&state, 0.45f, 0.78f);
    pm->reverb = mix_between(&state, 0.25f, 0.5f);
    pm->filter_hz = mix_between(&state, 900.0f, 2800.0f);
  } else if (profile == HT_TIMBRE_FM_STORM) {
    pm->delay_time = mix_between(&state, 0.2f, 0.45f);
    pm->drive = mix_between(&state, 0.35f, 0.7f);
    pm->feedback = mix_between(&state, 0.35f, 0.65f);
    pm->reverb = mix_between(&state, 0.2f, 0.45f);
    pm->filter_hz = mix_between(&state, 1800.0f, 5500.0f);
  } else {
    pm->delay_time = mix_between(&state, 0.15f, 0.45f);
    pm->drive = mix_between(&state, 0.35f, 0.75f);
    pm->feedback = mix_between(&state, 0.35f, 0.7f);
    pm->reverb = mix_between(&state, 0.15f, 0.45f);
    pm->filter_hz = mix_between(&state, 1800.0f, 6500.0f);
  }
  /* JS feedback_mix defaults: dryBlend 0.85, wetBlend 0.28, scatter from fx. */
  pm->dry = 0.82f;
  pm->wet = ht_clampf(0.22f + pm->feedback * 0.25f, 0.22f, 0.48f);
  pm->scatter = ht_clampf(0.2f + pm->delay_time * 0.55f, 0.18f, 0.65f);
}

static void stage_morph_controls(HtStageEngine *stage, uint32_t mix);

static void sync_voice_bus(HtStageEngine *stage) {
  HtVoiceBus bus;
  HtMixGlobals globals;
  HtTrackMix live[HT_TRACK_COUNT];
  HtWeather weather;
  memset(&bus, 0, sizeof(bus));
  memset(&weather, 0, sizeof(weather));
  weather.storm = stage->court.storm;
  weather.chaos = stage->court.chaos;
  weather.moon = stage->court.moon;
  weather.feedback = stage->bias.total_feedback;
  /* Same silence flags as device app.c — tail keeps gate open, gap ducks. */
  stage->court.episode_wait = stage->episode_resting;
  stage->court.episode_gap = stage->episode_gap;
  ht_live_mix_snapshot_beat(&stage->composition, stage->pattern_beat,
                            (float)(stage->clock_ms * 0.001), stage->seed, &weather,
                            ht_court_silence_mode(&stage->court), live, &stage->section);
  globals = ht_live_mix_globals_section(&stage->composition, &weather,
                                        ht_court_silence_mode(&stage->court), &stage->section);
  /* All tracks live (composition often mutes perc). Sends follow JS mix returns. */
  {
    uint8_t ti;
    for (ti = 0; ti < HT_TRACK_COUNT; ti += 1) {
      live[ti].active = 1;
      if (live[ti].level < 0.45f) {
        live[ti].level = 0.5f + (float)((stage->seed >> (ti * 3)) & 7u) * 0.05f;
      }
      live[ti].reverb_send =
          ht_clampf(0.12f + stage->profile_mix.reverb * 0.55f, 0.1f, 0.55f);
      live[ti].chain_send =
          ht_clampf(0.1f + stage->profile_mix.feedback * 0.35f, 0.08f, 0.45f);
    }
    if (live[3].level < 0.65f) {
      live[3].level = 0.7f;
    }
  }
  ht_voice_set_tracks(&stage->voices, live);
  /* Blend profileMix (js/rnd_patch) with live knobs — echo/drive like the web stage. */
  {
    float knob_fb = ht_feedback_from_knob(stage->controls.knob1);
    float knob_scatter = ht_scatter_from_fx_knob(stage->controls.fx);
    float knob_drive = ht_drive_from_edit_knob(stage->controls.edit);
    float knob_delay = ht_delay_from_fx_knob(stage->controls.fx);
    bus.feedback = ht_clampf(stage->profile_mix.feedback * 0.65f + knob_fb * 0.35f, 0.18f, 0.78f);
    bus.scatter =
        ht_clampf(stage->profile_mix.scatter * 0.55f + knob_scatter * 0.45f, 0.15f, 0.75f);
    bus.drive = ht_clampf(stage->profile_mix.drive * 0.7f + knob_drive * 0.3f, 0.18f, 0.85f);
    bus.delay_time =
        ht_clampf(stage->profile_mix.delay_time * 0.7f + knob_delay * 0.3f, 0.12f, 0.62f);
  }
  bus.lfo_depth = ht_clampf(ht_lfo_depth_from_knob(stage->controls.knob2), 0.12f, 0.85f);
  bus.lfo_destination = stage->bias.lfo_destination;
  bus.wildness = stage->controls.glo;
  bus.compress = 0.22f + stage->controls.glo * 0.28f;
  bus.court_gate = globals.court_gate < 0.15f ? globals.court_gate : 1.0f;
  bus.dry = ht_clampf(stage->profile_mix.dry, 0.7f, 0.92f);
  bus.wet = ht_clampf(stage->profile_mix.wet * 0.55f + globals.wet * 0.45f, 0.22f, 0.55f);
  bus.reverb = ht_clampf(stage->profile_mix.reverb * 0.65f + globals.reverb * 0.35f, 0.12f, 0.7f);
  bus.env_amount = stage->controls.env;
  bus.filter_hz = ht_clampf(stage->profile_mix.filter_hz * 0.7f + globals.filter_hz * 0.3f, 900.0f,
                            9000.0f);
  bus.eq_lows = 0.55f + stage->controls.presets * 0.15f;
  bus.eq_mids = 0.58f + stage->controls.edit * 0.12f;
  bus.eq_highs = 0.52f + stage->controls.algorithm * 0.22f;
  bus.sidechain_depth = 0.18f + bus.scatter * 0.25f;
  bus.analog = ht_analog_defaults();
  bus.analog.drive = ht_clampf(bus.drive, 0.15f, 0.85f);
  bus.analog.warmth = 0.32f + stage->controls.edit * 0.35f;
  bus.analog.wow = 0.28f + stage->controls.knob2 * 0.35f;
  bus.analog.flutter = 0.18f + stage->controls.fx * 0.3f;
  bus.analog.hiss = 0.04f + stage->bias.wildness * 0.06f;
  bus.analog.mix = 0.4f + stage->controls.edit * 0.35f;
  bus.tape_seconds = 2.0f + stage->controls.select * 5.0f;
  bus.tape_dry = 0.55f + stage->controls.presets * 0.35f;
  bus.tape_speed = 0.75f + stage->controls.algorithm * 0.45f;
  bus.tape_recording = stage->tape_recording;
  bus.tape_held = stage->episode_resting && !stage->episode_gap ? 1u : 0u;
  bus.silence_mode = (uint8_t)globals.mode;
  ht_voice_set_bus(&stage->voices, &bus);
  /* Stereo ping ≈ JS dual-delay (delayA/delayB). */
  stage->voices.ping_delay = (uint32_t)(bus.delay_time * HT_DSP_SAMPLE_RATE);
  if (stage->voices.ping_delay < 120u) {
    stage->voices.ping_delay = 120u;
  }
  if (stage->voices.ping_delay > 47900u) {
    stage->voices.ping_delay = 47900u;
  }
}

static void begin_episode_rest(HtStageEngine *stage, uint8_t gap) {
  stage->episode_resting = 1;
  stage->episode_gap = gap ? 1 : 0;
  /* Match JS rest tricks: short gap ~0.2s, longer tail rest ~0.6–1.2s. */
  stage->rest_until_ms = stage->clock_ms + (gap ? 220.0 : 700.0 + (double)(stage->phrase_index % 5u) * 80.0);
  stage->court.airborne_count = 0;
  stage->court.hand_hold_count = 0;
  stage->court.episode_wait = 1;
  stage->court.episode_gap = stage->episode_gap;
  sync_voice_bus(stage);
}

/* Mirror js/siteswap_episode.js PHRASE_ROLE_WEIGHTS for drop / third_hand / wait. */
enum {
  HT_PHRASE_PLAY = 0,
  HT_PHRASE_WAIT = 1,
  HT_PHRASE_DROP = 2,
  HT_PHRASE_THIRD = 3
};

static uint8_t pick_phrase_role(uint32_t mix, uint8_t phrase_index) {
  uint32_t ticket;
  /* First three phrases stay in PLAY so the court can settle on a real pattern. */
  if (phrase_index < 3u) {
    return HT_PHRASE_PLAY;
  }
  ticket = mix % 100u;
  if (ticket < 2u) {
    return HT_PHRASE_WAIT;
  }
  if (ticket < 5u) {
    return HT_PHRASE_DROP;
  }
  if (ticket < 7u) {
    return HT_PHRASE_THIRD;
  }
  return HT_PHRASE_PLAY;
}

static void append_siteswap_mark(char *siteswap, uint16_t cap, char mark) {
  size_t len = 0;
  while (siteswap[len] && len + 1u < cap) {
    len += 1;
  }
  if (len + 1u < cap) {
    siteswap[len] = mark;
    siteswap[len + 1u] = 0;
  }
}

static void pick_phrase(HtStageEngine *stage, uint32_t mix) {
  uint8_t objects =
      ht_soft_object_count(stage->bias.object_count_prefer, mix, stage->bias.wildness,
                           stage->bias.object_count);
  uint8_t family = pick_family(mix >> 3, stage->phrase_index == 0);
  uint8_t role = pick_phrase_role(mix, stage->phrase_index);

  if (objects < 3u) {
    objects = 3u;
  }
  if (objects > 7u) {
    objects = 7u;
  }
  if (role == HT_PHRASE_WAIT) {
    begin_episode_rest(stage, ((mix >> 6) & 3u) == 0u ? 1u : 0u);
    stage->rest_after_phrase = 0;
    stage->court.third_hand = 0;
    stage->phrase_until = stage->pattern_beat + 8.0f + (float)((mix >> 2) & 3u);
    return;
  }
  if (role == HT_PHRASE_DROP) {
    family = HT_SS_FAMILY_SHOWER;
  }

  stage->siteswap[0] = 0;
  if (!generate_siteswap(stage->siteswap, (uint16_t)sizeof(stage->siteswap), objects, family,
                         mix)) {
    stage->siteswap[0] = '3';
    stage->siteswap[1] = 0;
    objects = 3u;
  } else {
    HtSiteswapPattern parsed;
    if (ht_siteswap_parse(stage->siteswap, &parsed) == HT_SS_OK) {
      float balls = ht_siteswap_ball_count(&parsed);
      if (balls >= 2.5f && balls <= 7.5f) {
        objects = (uint8_t)(balls + 0.5f);
      }
    }
  }

  if (role == HT_PHRASE_THIRD) {
    append_siteswap_mark(stage->siteswap, (uint16_t)sizeof(stage->siteswap), '+');
    stage->court.third_hand = 1;
  } else if (role == HT_PHRASE_DROP) {
    append_siteswap_mark(stage->siteswap, (uint16_t)sizeof(stage->siteswap), '-');
    stage->court.third_hand = 0;
  } else {
    stage->court.third_hand = 0;
  }
  stage->bias.object_count = objects;
  stage->controls.knob3 = (float)(objects - 3u) / 4.0f;
  stage->hand_style = pick_hand_style(mix, stage->bias.wildness);
  stage->court.siteswap = stage->siteswap;
  stage->court.hand_style = stage->hand_style;
  stage->court.hold_twos = 1;
  stage->last_throw_beat = -999;
  stage->last_occ = HT_OCC_EMPTY;
  if (role == HT_PHRASE_DROP) {
    stage->phrase_until = stage->pattern_beat + 6.0f + (float)((mix >> 3) % 4u);
    stage->rest_after_phrase = 1;
  } else {
    /* Short phrases so the court and sound morph quickly within a seed. */
    stage->phrase_until = stage->pattern_beat + 10.0f + (float)((mix >> 3) % 14u);
    stage->rest_after_phrase = 0;
  }
  stage->court.storm = 0.15f + (float)((mix >> 9) & 7u) * 0.05f;
  stage->court.moon = 0.35f + (float)((mix >> 12) & 7u) * 0.07f;
  stage->court.chaos = 0.15f + (float)((mix >> 6) & 7u) * 0.06f;
  ht_engine_assign_voices(&stage->engine_assign, stage->seed ^ mix, stage->bias.patch_type,
                          stage->bias.wildness, HT_ENGINE_ASSIGN_SLOTS);
  stage_apply_profile_mix(stage, stage->seed ^ mix ^ 0x71B3Eu);
  if (stage->phrase_index > 0u && (mix & 3u) == 0u) {
    stage_morph_controls(stage, mix ^ 0xa11ce55u);
  }
  {
    HtDrumEnvelopes envelopes = ht_drum_envelopes_from_seed(stage->seed ^ mix, stage->siteswap);
    ht_voice_set_drum_envelopes(&stage->voices, &envelopes);
  }
  sync_voice_bus(stage);
}

static uint8_t stage_gen_kind_for_patch(uint8_t patch_type) {
  if (patch_type == HT_PATCH_EUCLID_GROOVE) {
    return HT_GEN_EUCLID;
  }
  if (patch_type == HT_PATCH_MARKOV_WALK) {
    return HT_GEN_MARKOV;
  }
  if (patch_type == HT_PATCH_TURING_LINE) {
    return HT_GEN_TURING;
  }
  if (patch_type == HT_PATCH_ORBIT || patch_type == HT_PATCH_STUTTER ||
      patch_type == HT_PATCH_CALL_RESPONSE) {
    return HT_GEN_MORPH;
  }
  return HT_GEN_TURING;
}

static uint8_t stage_melodic_engine(HtStageEngine *stage, uint32_t salt) {
  /* Prefer the phrase assign table, but roam the full catalog so vowel / nature /
   * physical / dub stay audible instead of locking onto one sine-like engine. */
  static const uint8_t rich[] = {
      HT_ENGINE_VOWEL,      HT_ENGINE_BIRD,        HT_ENGINE_FOREST,    HT_ENGINE_BUBBLE,
      HT_ENGINE_FIRE,       HT_ENGINE_DOLPHIN,      HT_ENGINE_DUB_BASS,  HT_ENGINE_VARGAN,
      HT_ENGINE_DIDGERIDOO, HT_ENGINE_PIPE,         HT_ENGINE_SAXOPHONE, HT_ENGINE_GUITAR,
      HT_ENGINE_VIOLIN,     HT_ENGINE_KARPLUS,      HT_ENGINE_PIANO,     HT_ENGINE_ORGAN,
      HT_ENGINE_ADDITIVE,   HT_ENGINE_SUPERSAW,     HT_ENGINE_ACID,      HT_ENGINE_FM,
      HT_ENGINE_PWM,        HT_ENGINE_GRANULAR,     HT_ENGINE_WAVETABLE, HT_ENGINE_WAVESHAPE,
      HT_ENGINE_RING_MOD,   HT_ENGINE_AM,           HT_ENGINE_PHASE_DISTORTION,
      HT_ENGINE_SUBTRACTIVE, HT_ENGINE_NOISE};
  uint32_t pick;
  stage->note_serial = (uint32_t)(stage->note_serial + 1u);
  pick = salt ^ stage->note_serial * 0x9e3779b9u ^ stage->seed;
  if ((pick & 3u) != 0u) {
    return rich[pick % (uint32_t)(sizeof(rich) / sizeof(rich[0]))];
  }
  return ht_engine_assign_pick(&stage->engine_assign, pick);
}

/* Full PLAY roll from seed — patch type, scale, FX, tempo prefer (JS createRndPatch). */
static void stage_roll_controls_from_seed(HtStageEngine *stage, uint32_t mix) {
  uint32_t state = mix ? mix : 1u;
  static const float k_roots[] = {33.0f, 36.0f, 38.0f, 40.0f, 41.0f, 43.0f, 45.0f, 48.0f, 50.0f};
  stage->controls.fx = mix_between(&state, 0.12f, 0.88f);
  stage->controls.edit = mix_between(&state, 0.1f, 0.85f);
  stage->controls.env = mix_between(&state, 0.15f, 0.9f);
  stage->controls.lfo = mix_between(&state, 0.08f, 0.92f);
  stage->controls.glo = mix_between(&state, 0.55f, 1.0f);
  stage->controls.knob1 = mix_between(&state, 0.15f, 0.85f);
  stage->controls.knob2 = mix_between(&state, 0.12f, 0.88f);
  stage->controls.knob3 = mix_between(&state, 0.05f, 0.95f);
  stage->controls.knob4 = mix_between(&state, 0.15f, 0.85f);
  stage->controls.algorithm = mix_unit01(&state);
  stage->controls.presets = mix_unit01(&state);
  stage->controls.select = mix_unit01(&state);
  stage->octave = (int8_t)((ht_engine_assign_next(&state) % 3u)) - 1;
  stage->root_midi = k_roots[ht_engine_assign_next(&state) % 9u];
}

static void stage_morph_controls(HtStageEngine *stage, uint32_t mix) {
  stage_roll_controls_from_seed(stage, mix);
  stage->bias = ht_bias_from_controls(&stage->controls);
  stage->gen_kind = stage_gen_kind_for_patch(stage->bias.patch_type);
  ht_engine_assign_voices(&stage->engine_assign, stage->seed ^ mix, stage->bias.patch_type,
                          stage->bias.wildness, HT_ENGINE_ASSIGN_SLOTS);
  stage_apply_profile_mix(stage, stage->seed ^ mix ^ 0x71B3Eu);
  stage->tape_recording = stage->bias.wildness > 0.4f || stage->controls.select > 0.45f ? 1u : 0u;
}

static HtGenOut stage_melodic_gen_step(HtStageEngine *stage) {
  if (stage->gen_kind == HT_GEN_EUCLID) {
    return ht_gen_euclid_step(&stage->euclid);
  }
  if (stage->gen_kind == HT_GEN_MARKOV) {
    return ht_gen_markov_step(&stage->markov);
  }
  if (stage->gen_kind == HT_GEN_MORPH) {
    return ht_gen_morph_step(&stage->morph);
  }
  return ht_gen_turing_step(&stage->turing);
}

static void apply_seed(HtStageEngine *stage, uint32_t next) {
  uint8_t prev_type = stage->bias.patch_type;
  uint8_t prev_scale = stage->bias.scale_index;
  uint8_t prev_timbre = stage->engine_assign.timbre_profile;
  uint8_t prev_objects = stage->bias.object_count;
  uint8_t attempt;
  stage->seed = next ? next : 1u;
  /* Distinct PLAY: re-roll until type/scale/timbre move (JS createDistinctRndPatch). */
  for (attempt = 0; attempt < 6u; attempt += 1) {
    uint32_t mix = stage->seed ^ (attempt * 0x9e3779b9u);
    stage_roll_controls_from_seed(stage, mix ^ 0xa11ce55u);
    stage->bias = ht_bias_from_controls(&stage->controls);
    stage->bias.object_count =
        ht_soft_object_count(stage->bias.object_count_prefer, stage->seed ^ mix, stage->bias.wildness,
                             attempt > 0u ? prev_objects : 0u);
    stage->bias.bpm = ht_soft_bpm(stage->bias.bpm, stage->seed ^ 0xb10bu ^ mix, stage->bias.wildness);
    if (stage->bias.bpm > 148.0f) {
      stage->bias.bpm = 92.0f + (stage->bias.bpm - 148.0f) * 0.3f;
    }
    ht_engine_assign_voices(&stage->engine_assign, stage->seed ^ mix, stage->bias.patch_type,
                            stage->bias.wildness, HT_ENGINE_ASSIGN_SLOTS);
    stage_apply_profile_mix(stage, stage->seed ^ mix ^ 0x71B3Eu);
    if (stage->bias.patch_type != prev_type || stage->bias.scale_index != prev_scale ||
        stage->engine_assign.timbre_profile != prev_timbre ||
        stage->bias.object_count != prev_objects) {
      break;
    }
  }
  sync_tempo(stage);
  stage->gen_kind = stage_gen_kind_for_patch(stage->bias.patch_type);
  ht_gen_turing_init(&stage->turing, 8, (uint8_t)(10u + (uint32_t)(stage->bias.wildness * 50.0f)), 2,
                     stage->seed);
  ht_gen_euclid_init(&stage->euclid, 8, (uint8_t)(2u + (uint32_t)(stage->bias.wildness * 5.0f)),
                     (uint8_t)(stage->seed & 7u), 48, stage->seed);
  ht_gen_markov_init(&stage->markov, (uint8_t)(30u + (uint32_t)(stage->bias.wildness * 50.0f)),
                     (uint8_t)(40u + (uint32_t)(stage->bias.wildness * 60.0f)), 2, stage->seed ^ 0x1111u);
  ht_gen_morph_init(&stage->morph, (uint8_t)(20u + (uint32_t)(stage->bias.wildness * 90.0f)),
                    stage->seed ^ 0x2222u);
  ht_gen_atlas_init(&stage->atlas, (uint8_t)(stage->seed & 0xffu),
                    (uint8_t)((stage->seed >> 8) & 0xffu),
                    (uint8_t)(78u + (uint32_t)(stage->bias.wildness * 20.0f)),
                    (uint8_t)(18u + (uint32_t)(stage->bias.wildness * 36.0f)), stage->seed ^ 0x4d07u);
  ht_composition_init(&stage->composition, stage->seed, stage->bias.wildness, stage->bias.patch_type);
  stage->section_index = 255;
  memset(&stage->section, 0, sizeof(stage->section));
  ht_voice_set_seed(&stage->voices, stage->seed);
  ht_voice_panic(&stage->voices);
  ht_action_loop_rebind(&stage->action_loop, stage->seed);
  stage->pattern_beat = 0.0f;
  stage->phrase_index = 0;
  stage->gen_step = 0;
  stage->step_accum_ms = 0.0;
  stage->episode_resting = 0;
  stage->episode_gap = 0;
  stage->rest_after_phrase = 0;
  stage->rest_until_ms = 0.0;
  stage->court.third_hand = 0;
  stage->court.episode_wait = 0;
  stage->court.episode_gap = 0;
  stage->court.time_beat = 0.0f;
  stage->last_throw_beat = -999;
  stage->last_occ = HT_OCC_EMPTY;
  ht_court_clear_trails();
  stage->tape_recording = stage->bias.wildness > 0.4f || stage->controls.select > 0.45f ? 1u : 0u;
  stage->note_serial = 0;
  pick_phrase(stage, stage->seed);
  stage->gen_armed = 1;
  sync_voice_bus(stage);
  ht_voice_note_on(&stage->voices,
                   ht_scale_note(stage->bias.scale_index, stage->root_midi, 0, stage->octave), 90,
                   stage_melodic_engine(stage, stage->seed));
}

static void siteswap_tick(HtStageEngine *stage) {
  HtSiteswapSchedule schedule;
  HtModFactors factors;
  HtModVector sustain;
  HtOccupancySign sign;
  uint16_t i;
  uint8_t held = 0;
  uint8_t airborne = 0;
  float previous_beat = stage->pattern_beat;
  /* step_period_ms is one 16th; advance a quarter-beat so wall tempo matches JS bpm. */
  stage->pattern_beat += 0.25f;
  if (stage->pattern_beat >= stage->phrase_until) {
    stage->phrase_index = (uint8_t)(stage->phrase_index + 1u);
    if (stage->rest_after_phrase) {
      stage->rest_after_phrase = 0;
      begin_episode_rest(stage, 0);
      stage->phrase_until = stage->pattern_beat + 64.0f;
      return;
    }
    pick_phrase(stage, stage->seed ^ ((uint32_t)stage->phrase_index * 0x9e3779b9u));
  }
  stage->court.time_beat = stage->pattern_beat;
  stage->court.siteswap = stage->siteswap;
  stage->court.hand_style = stage->hand_style;
  stage->court.dwell_ratio = stage->bias.dwell_ratio;
  stage->court.hold_twos = 1;
  if (ht_siteswap_schedule_playable(stage->siteswap, 1, (int16_t)(stage->pattern_beat + 16),
                                    &schedule) != HT_SS_OK) {
    pick_phrase(stage, stage->seed ^ 0x51e51e51u ^ stage->phrase_index);
    return;
  }
  {
    /* Per-ball α/κ like toss.js occupancyState(heldFlags) — dwell counts as held. */
    uint8_t ball_held[HT_SITESWAP_MAX_BALLS];
    uint8_t ball_air[HT_SITESWAP_MAX_BALLS];
    uint8_t ball_live[HT_SITESWAP_MAX_BALLS];
    float dwell = stage->bias.dwell_ratio > 0.05f ? stage->bias.dwell_ratio : 0.5f;
    memset(ball_held, 0, sizeof(ball_held));
    memset(ball_air, 0, sizeof(ball_air));
    memset(ball_live, 0, sizeof(ball_live));
    for (i = 0; i < schedule.event_count; i += 1) {
      const HtSiteswapEvent *ev = &schedule.events[i];
      float flight;
      float throw_time;
      float next_throw;
      float shannon;
      if (ev->ball >= HT_SITESWAP_MAX_BALLS) {
        continue;
      }
      if (ev->dump && stage->pattern_beat >= (float)ev->beat + (float)(ev->height > 0 ? ev->height : 0)) {
        continue;
      }
      if (ev->drop) {
        if (stage->pattern_beat >= (float)ev->beat) {
          ball_live[ev->ball] = 1;
          ball_held[ev->ball] = 0;
          ball_air[ev->ball] = 0; /* abandoned: out of live occupancy */
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
        flight = shannon >= 0.5f ? shannon : fminf(0.5f, fmaxf((float)ev->height - 0.15f, 0.2f));
      }
      /* JS fireThrows: event.beat in (previousBeat, beat]. */
      if (!ev->hold && !ev->parked && ev->beat != stage->last_throw_beat &&
          (float)ev->beat > previous_beat && (float)ev->beat <= stage->pattern_beat + 0.0001f) {
        HtModFactors edge;
        HtModVector burst;
        memset(&edge, 0, sizeof(edge));
        stage->last_throw_beat = ev->beat;
        edge.state = stage->last_occ == HT_OCC_EMPTY ? HT_OCC_MIXED : stage->last_occ;
        edge.object_count = schedule.ball_count;
        edge.object_index = (uint8_t)(ev->height % 7);
        edge.hand = ev->from_hand;
        edge.dwell_phase = 0.0f;
        edge.transition = HT_MOD_THROW;
        burst = ht_mod_matrix_combine(&edge);
        {
          float midi = ht_scale_note(stage->bias.scale_index, stage->root_midi,
                                     (uint8_t)(ev->height % 12), stage->octave);
          uint8_t vel =
              (uint8_t)ht_clampf(78.0f + burst.burst_gain * 42.0f + (float)(ev->height % 5) * 2.0f,
                                 60.0f, 127.0f);
          uint8_t engine =
              stage_melodic_engine(stage, (uint32_t)ev->height * 17u + (uint32_t)ev->from_hand);
          ht_voice_set_pending_pan(&stage->voices, ev->from_hand ? 0.72f : -0.72f);
          ht_voice_set_pending_track(&stage->voices, ev->height >= 5 ? 2u : 1u);
          ht_voice_note_on(&stage->voices, midi, vel, engine);
        }
      }
      if (stage->pattern_beat >= throw_time && stage->pattern_beat < next_throw) {
        ball_live[ev->ball] = 1;
        if (!ev->hold && stage->pattern_beat < throw_time + flight) {
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
  stage->court.airborne_count = airborne;
  stage->court.hand_hold_count = held;
  sign = ht_occupancy_sign(held, airborne, (uint8_t)(held + airborne));
  memset(&factors, 0, sizeof(factors));
  factors.state = sign;
  factors.object_count = schedule.ball_count;
  factors.object_index = (uint8_t)((uint32_t)stage->pattern_beat % 7u);
  factors.hand = ((int)stage->pattern_beat & 1) ? 1 : 0;
  factors.dwell_phase = schedule.ball_count ? (float)held / (float)schedule.ball_count : 0.5f;
  factors.transition =
      (sign != stage->last_occ && stage->last_occ != HT_OCC_EMPTY) ? HT_MOD_STATE_EDGE : HT_MOD_SUSTAIN;
  sustain = ht_mod_matrix_combine(&factors);
  stage->bias.total_feedback = 0.25f + sustain.feedback * 0.45f;
  if (factors.transition == HT_MOD_STATE_EDGE && sustain.audible) {
    float midi = ht_scale_note(stage->bias.scale_index, stage->root_midi - 12.0f,
                               (uint8_t)(sustain.engine_bias * 6.0f), stage->octave);
    ht_voice_note_on(&stage->voices, midi, (uint8_t)(60 + sustain.burst_gain * 50.0f),
                     stage_melodic_engine(stage, (uint32_t)(sustain.engine_bias * 100.0f)));
  }
  stage->last_occ = sign;
}

static void generator_tick(HtStageEngine *stage) {
  HtGenOut note;
  HtGenOut drums[3];
  int drum_count;
  int index;
  if (!stage->gen_armed) {
    return;
  }
  if (stage->episode_resting) {
    return;
  }
  siteswap_tick(stage);
  if (stage->episode_resting) {
    return;
  }
  stage->gen_step = (uint16_t)(stage->gen_step + 1u);
  /* Without release, 12 slots pin forever and every new note steals slot 0 → one crappy voice. */
  ht_voice_release_aged(&stage->voices, 0.55f + stage->bias.wildness * 0.45f);
  /* JS fireGenerators uses eighths (step 0.5); 16ths stacked with throws sounded fragmented. */
  if ((stage->gen_step & 1u) != 0u) {
    sync_voice_bus(stage);
    return;
  }
  {
    /* Match js/instrument.js fireGenerators density gating + section density. */
    float density = 0.58f + stage->bias.wildness * 0.32f;
    float chance;
    HtActionEvent due[8];
    uint8_t due_count;
    uint8_t due_i;
    if (stage->section.density > 0.05f) {
      density *= stage->section.density / 0.65f;
    }
    chance =
        (float)(ht_gen_stream(stage->seed ^ ((uint32_t)stage->gen_step * 2654435761u)) % 1000u) /
        1000.0f;
    due_count = ht_action_loop_tick(&stage->action_loop, stage->pattern_beat, due, 8);
    if (due_count > 0u) {
      stage->action_loop.replaying = 1;
      for (due_i = 0; due_i < due_count; due_i += 1) {
        if (due[due_i].kind == HT_ACTION_KNOB) {
          if (due[due_i].id == 0) {
            stage->controls.knob1 = due[due_i].value;
          } else if (due[due_i].id == 1) {
            stage->controls.knob2 = due[due_i].value;
          } else if (due[due_i].id == 2) {
            stage->controls.knob3 = due[due_i].value;
          } else {
            stage->controls.knob4 = due[due_i].value;
          }
        } else if (due[due_i].kind == HT_ACTION_BUTTON) {
          stage->tape_recording = due[due_i].value > 0.5f ? 1u : 0u;
        } else if (due[due_i].kind == HT_ACTION_KEY) {
          float midi =
              ht_scale_note(stage->bias.scale_index, stage->root_midi, due[due_i].id % 12u, stage->octave);
          ht_voice_note_on(&stage->voices, midi, (uint8_t)(40 + due[due_i].value * 80.0f),
                           stage_melodic_engine(stage, (uint32_t)due[due_i].id));
        }
      }
      stage->bias = ht_bias_from_controls(&stage->controls);
      stage->action_loop.replaying = 0;
    }
    note = stage_melodic_gen_step(stage);
    if (note.gate && chance < density) {
      uint8_t midi = (uint8_t)(note.midi + 12 * stage->octave);
      float pan = (((float)(midi % 12) - 5.5f) / 6.0f);
      uint8_t track_hint = midi < 48 ? 0 : midi > 64 ? 2 : 1;
      uint8_t engine = stage_melodic_engine(stage, (uint32_t)midi * 3u + track_hint * 11u);
      ht_voice_set_pending_pan(&stage->voices, pan);
      ht_voice_set_pending_track(&stage->voices, track_hint);
      ht_voice_note_on(&stage->voices, midi, note.velocity, engine);
    }
    /* Drums are independent of melodic density — atlas gates alone. */
    drum_count = ht_gen_atlas_step(&stage->atlas, drums);
    for (index = 0; index < drum_count; index += 1) {
      if (!drums[index].gate) {
        continue;
      }
      /* Hat only on every other eighth (JS tick & 1). */
      if (drums[index].midi == 42 && (stage->gen_step & 2u) != 0u) {
        continue;
      }
      {
        float pan = drums[index].midi == 36 ? -0.2f : drums[index].midi == 38 ? 0.25f : 0.55f;
        uint8_t vel = drums[index].midi == 42 ? (uint8_t)((float)drums[index].velocity * 0.75f)
                                               : drums[index].velocity;
        if (vel < 70u) {
          vel = 70u;
        }
        ht_voice_set_pending_pan(&stage->voices, pan);
        ht_voice_set_pending_track(&stage->voices, 3u);
        ht_voice_note_on(&stage->voices, drums[index].midi, vel, HT_ENGINE_NOISE);
      }
    }
  }
  sync_voice_bus(stage);
}

static void advance_clock(HtStageEngine *stage, double dt_ms) {
  if (dt_ms < 0.0) {
    dt_ms = 0.0;
  }
  if (dt_ms > 100.0) {
    dt_ms = 100.0;
  }
  stage->clock_ms += dt_ms;
  if (stage->episode_resting && stage->clock_ms >= stage->rest_until_ms) {
    stage->episode_resting = 0;
    stage->episode_gap = 0;
    stage->court.airborne_count = 3;
    sync_voice_bus(stage);
  }
  stage->step_accum_ms += dt_ms;
  while (stage->step_period_ms > 0.0 && stage->step_accum_ms >= stage->step_period_ms) {
    stage->step_accum_ms -= stage->step_period_ms;
    generator_tick(stage);
  }
  /* Interpolate only the 16th-note span (0.25 beat), not a full beat. */
  stage->court.time_beat =
      stage->pattern_beat +
      0.25f *
          (float)(stage->step_period_ms > 0.0 ? stage->step_accum_ms / stage->step_period_ms : 0.0);
  stage->court.siteswap = stage->siteswap;
  stage->court.hand_style = stage->hand_style;
  stage->court.dwell_ratio = stage->bias.dwell_ratio;
  stage->court.hold_twos = 1;
  ht_court_push_trail(&stage->court);
}

HtStageEngine *ht_stage_create(double sample_rate) {
  HtStageEngine *stage = (HtStageEngine *)calloc(1, sizeof(HtStageEngine));
  if (!stage) {
    return NULL;
  }
  stage->sample_rate = sample_rate > 8000.0 ? sample_rate : (double)HT_DSP_SAMPLE_RATE;
  ht_controls_init(&stage->controls);
  stage->controls.master = 0.85f;
  ht_voice_init(&stage->voices);
  ht_action_loop_init(&stage->action_loop, 1u);
  stage->octave = 0;
  stage->root_midi = 48.0f;
  stage->court.airborne_count = 3;
  stage->court.dwell_ratio = 0.5f;
  stage->court.hold_twos = 1;
  apply_seed(stage, ht_unique_seed(0x48545331u));
  return stage;
}

void ht_stage_destroy(HtStageEngine *stage) {
  free(stage);
}

void ht_stage_set_master(HtStageEngine *stage, float master01) {
  if (!stage) {
    return;
  }
  if (master01 < 0.0f) {
    master01 = 0.0f;
  }
  if (master01 > 1.0f) {
    master01 = 1.0f;
  }
  stage->controls.master = master01;
}

void ht_stage_new_patch(HtStageEngine *stage) {
  if (!stage) {
    return;
  }
  apply_seed(stage, ht_unique_seed(stage->seed ^ 0x9e3779b9u));
}

void ht_stage_chaos(HtStageEngine *stage) {
  float roll;
  if (!stage) {
    return;
  }
  roll = (float)(ht_gen_stream(stage->seed ^ (uint32_t)(stage->pattern_beat * 1000.0f)) % 1000u) / 1000.0f;
  /* Most clicks hard-reset the scene; soft knob chaos stays rare. */
  if (roll < 0.62f) {
    ht_stage_new_patch(stage);
    return;
  }
  if (roll < 0.55f) {
    float value = (float)(ht_gen_stream(stage->seed + 17u) % 1000u) / 1000.0f;
    uint32_t which = ht_gen_stream(stage->seed + 23u) % 8u;
    uint8_t host = 255u;
    HtActionLoopMode mode;
    if (which == 0) {
      stage->controls.knob1 = value;
      host = 0;
    } else if (which == 1) {
      stage->controls.knob2 = value;
      host = 1;
    } else if (which == 2) {
      stage->controls.knob3 = value;
      stage->bias.object_count_prefer = ht_object_count_from_siteswap_knob(value);
      host = 2;
    } else if (which == 3) {
      stage->controls.knob4 = value;
      stage->bias.bpm = ht_bpm_from_tempo_knob(value);
      sync_tempo(stage);
      host = 3;
    } else if (which == 4) {
      stage->controls.fx = value;
    } else if (which == 5) {
      stage->controls.edit = value;
    } else if (which == 6) {
      stage->controls.glo = value;
    } else {
      stage->controls.master = 0.55f + value * 0.45f;
    }
    if (host != 255u) {
      mode = ht_action_loop_on_host(&stage->action_loop, value, stage->pattern_beat,
                                    stage->seed ^ (uint32_t)stage->clock_ms);
      if (mode == HT_ACTION_IDLE && !stage->action_loop.replaying) {
        ht_action_loop_capture(&stage->action_loop, HT_ACTION_KNOB, host, value, stage->pattern_beat);
      }
    }
    stage->bias = ht_bias_from_controls(&stage->controls);
    sync_voice_bus(stage);
    return;
  }
  if (roll < 0.78f) {
    stage->controls.env = fmodf(stage->controls.env + 0.12f, 1.0f);
    stage->controls.lfo = fmodf(stage->controls.lfo + 0.15f, 1.0f);
    stage->bias = ht_bias_from_controls(&stage->controls);
    sync_voice_bus(stage);
    return;
  }
  if (roll < 0.88f) {
    stage->court.cosmology = (uint8_t)!stage->court.cosmology;
    stage->court.storm = stage->court.cosmology ? 0.55f : 0.2f;
    pick_phrase(stage, stage->seed ^ 0xc0a1u ^ (uint32_t)stage->pattern_beat);
    return;
  }
  if (roll < 0.94f) {
    begin_episode_rest(stage, 1);
    return;
  }
  {
    float midi = (float)(53 + (ht_gen_stream(stage->seed + 99u) % 24) + 12 * stage->octave);
    ht_voice_note_on(&stage->voices, midi, 100, stage_melodic_engine(stage, (uint32_t)midi));
  }
}

void ht_stage_tick_ms(HtStageEngine *stage, double wall_ms) {
  double dt;
  if (!stage) {
    return;
  }
  if (!stage->has_wall) {
    stage->last_wall_ms = wall_ms;
    stage->has_wall = 1;
    return;
  }
  dt = wall_ms - stage->last_wall_ms;
  stage->last_wall_ms = wall_ms;
  advance_clock(stage, dt);
}

void ht_stage_render(HtStageEngine *stage, float *interleaved, uint32_t frames) {
  uint32_t i;
  float master;
  uint32_t use_frames;
  if (!stage || !interleaved || frames == 0u) {
    return;
  }
  use_frames = frames;
  if (use_frames > HT_STAGE_RENDER_MAX) {
    use_frames = HT_STAGE_RENDER_MAX;
  }
  /* Musical clock follows audio buffers so the court and notes stay locked. */
  advance_clock(stage, 1000.0 * (double)use_frames / stage->sample_rate);
  master = stage->controls.master * stage->controls.master;
  if (master < 0.35f) {
    master = 0.35f;
  }
  memset(interleaved, 0, (size_t)use_frames * 2u * sizeof(float));
  ht_voice_render_f32(&stage->voices, interleaved, use_frames, master);
  for (i = use_frames; i < frames; i += 1) {
    interleaved[2u * i] = 0.0f;
    interleaved[2u * i + 1u] = 0.0f;
  }
}

static float interpolated_beat(const HtStageEngine *stage) {
  return stage->pattern_beat +
         0.25f *
             (float)(stage->step_period_ms > 0.0 ? stage->step_accum_ms / stage->step_period_ms
                                                 : 0.0);
}

void ht_stage_snapshot_court(const HtStageEngine *stage, HtStageCourtSnapshot *out) {
  if (!stage || !out) {
    return;
  }
  memset(out, 0, sizeof(*out));
  out->frame = stage->court;
  out->frame.time_beat = interpolated_beat(stage);
  out->frame.dwell_ratio = stage->bias.dwell_ratio;
  out->frame.hold_twos = 1;
  strncpy(out->siteswap, stage->siteswap, sizeof(out->siteswap) - 1u);
  if (stage->hand_style) {
    strncpy(out->hand_style, stage->hand_style, sizeof(out->hand_style) - 1u);
  }
  out->frame.siteswap = out->siteswap;
  out->frame.hand_style = out->hand_style[0] ? out->hand_style : NULL;
  out->bpm = stage->bias.bpm;
  out->pattern_beat = stage->pattern_beat;
  out->clock_ms = stage->clock_ms;
}

void ht_stage_draw_court_rgba(const HtStageCourtSnapshot *snap, float time_beat, uint8_t *rgba) {
  HtCourtFrame frame;
  int y;
  int x;
  uint16_t row[HT_COURT_WIDTH];
  if (!snap || !rgba) {
    return;
  }
  frame = snap->frame;
  frame.time_beat = time_beat;
  frame.siteswap = snap->siteswap;
  frame.hand_style = snap->hand_style[0] ? snap->hand_style : NULL;
  for (y = 0; y < HT_COURT_HEIGHT; y += 1) {
    ht_court_draw_frame(row, y, &frame);
    for (x = 0; x < HT_COURT_WIDTH; x += 1) {
      uint16_t px = row[x];
      uint8_t r = (uint8_t)(((px >> 11) & 0x1f) * 255 / 31);
      uint8_t g = (uint8_t)(((px >> 5) & 0x3f) * 255 / 63);
      uint8_t b = (uint8_t)((px & 0x1f) * 255 / 31);
      size_t index = ((size_t)y * HT_COURT_WIDTH + (size_t)x) * 4u;
      rgba[index] = r;
      rgba[index + 1u] = g;
      rgba[index + 2u] = b;
      rgba[index + 3u] = 255;
    }
  }
}

void ht_stage_court_rgba(HtStageEngine *stage, uint8_t *rgba) {
  HtStageCourtSnapshot snap;
  if (!stage || !rgba) {
    return;
  }
  ht_stage_snapshot_court(stage, &snap);
  ht_stage_draw_court_rgba(&snap, snap.frame.time_beat, rgba);
}

double ht_stage_sample_rate(const HtStageEngine *stage) {
  return stage ? stage->sample_rate : (double)HT_DSP_SAMPLE_RATE;
}

float ht_stage_bpm(const HtStageEngine *stage) {
  return stage ? stage->bias.bpm : 100.0f;
}

float ht_stage_pattern_beat(const HtStageEngine *stage) {
  return stage ? stage->pattern_beat : 0.0f;
}

uint32_t ht_stage_seed(const HtStageEngine *stage) {
  return stage ? stage->seed : 0u;
}

const char *ht_stage_siteswap(const HtStageEngine *stage) {
  return stage ? stage->siteswap : "";
}
