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

struct HtStageEngine {
  HtVoiceBank voices;
  HtControls controls;
  HtPatchBias bias;
  HtGenTuring turing;
  HtGenAtlas atlas;
  HtCourtFrame court;
  HtActionLooper action_loop;
  HtOccupancySign last_occ;
  HtEngineAssign engine_assign;
  uint32_t note_serial;
  char siteswap[HT_SITESWAP_MAX_STRING];
  const char *hand_style;
  uint32_t seed;
  float pattern_beat;
  float phrase_until;
  uint8_t phrase_index;
  int16_t last_throw_beat;
  int8_t octave;
  uint8_t gen_armed;
  uint8_t tape_recording;
  uint8_t episode_resting;
  uint8_t episode_gap;
  double rest_until_ms;
  double clock_ms;
  double sample_rate;
  double step_accum_ms;
  double step_period_ms;
  double last_wall_ms;
  uint8_t has_wall;
  int32_t render_scratch[HT_STAGE_RENDER_MAX * 2u];
};

static const char *HAND_STYLES[HT_STAGE_HAND_COUNT] = {
    "(10)(32.5).",
    "(32.5)(10).",
    "(-30)(2.5).(30)(-2.5).(-30)(0).",
    "(0)(25).(-20)(10).(20)(10).",
    "(25)(-5).(-25)(5).(25)(-5).",
};

static uint8_t pick_family(uint32_t mix, uint8_t opener) {
  static const uint8_t weighted[] = {
      HT_SS_FAMILY_SHOWER, HT_SS_FAMILY_SHOWER, HT_SS_FAMILY_BOX, HT_SS_FAMILY_BOX,
      HT_SS_FAMILY_MULTIPLEX, HT_SS_FAMILY_FOUNTAIN, HT_SS_FAMILY_SHOWER, HT_SS_FAMILY_BOX,
      HT_SS_FAMILY_MULTIPLEX, HT_SS_FAMILY_FOUNTAIN, HT_SS_FAMILY_COLUMNS, HT_SS_FAMILY_NONE,
      HT_SS_FAMILY_SHOWER, HT_SS_FAMILY_MULTIPLEX};
  static const uint8_t openers[] = {HT_SS_FAMILY_SHOWER, HT_SS_FAMILY_BOX, HT_SS_FAMILY_MULTIPLEX,
                                    HT_SS_FAMILY_FOUNTAIN, HT_SS_FAMILY_SHOWER, HT_SS_FAMILY_BOX};
  if (opener) {
    return openers[mix % (sizeof(openers) / sizeof(openers[0]))];
  }
  return weighted[mix % (sizeof(weighted) / sizeof(weighted[0]))];
}

static void sync_tempo(HtStageEngine *stage) {
  stage->controls.knob4 = ht_tempo_knob_from_bpm(stage->bias.bpm);
  stage->step_period_ms = 60000.0 / ((double)stage->bias.bpm * 4.0);
  if (stage->step_period_ms < 20.0) {
    stage->step_period_ms = 20.0;
  }
}

static void sync_voice_bus(HtStageEngine *stage) {
  HtVoiceBus bus;
  HtMixGlobals globals;
  HtComposition composition;
  HtWeather weather;
  memset(&bus, 0, sizeof(bus));
  memset(&weather, 0, sizeof(weather));
  weather.storm = stage->court.storm;
  weather.chaos = stage->court.chaos;
  weather.moon = stage->court.moon;
  weather.feedback = stage->bias.total_feedback;
  ht_composition_init_default(&composition, stage->seed, stage->bias.wildness);
  /* Same silence flags as device app.c — tail keeps gate open, gap ducks. */
  stage->court.episode_wait = stage->episode_resting;
  stage->court.episode_gap = stage->episode_gap;
  globals = ht_live_mix_globals(&composition, &weather, ht_court_silence_mode(&stage->court));
  bus.feedback = stage->controls.knob1;
  bus.scatter = ht_scatter_from_fx_knob(stage->controls.fx);
  bus.drive = ht_drive_from_edit_knob(stage->controls.edit);
  bus.delay_time = ht_delay_from_fx_knob(stage->controls.fx);
  bus.lfo_depth = ht_lfo_depth_from_knob(stage->controls.knob2);
  bus.wildness = stage->controls.glo;
  bus.compress = 0.35f + stage->controls.glo * 0.4f;
  bus.court_gate = globals.court_gate > 0.05f ? globals.court_gate : 1.0f;
  bus.dry = globals.dry > 0.05f ? globals.dry : 0.85f;
  bus.wet = globals.wet > 0.05f ? globals.wet : 0.28f;
  bus.filter_hz = globals.filter_hz > 100.0f ? globals.filter_hz : 3800.0f;
  bus.eq_lows = 0.5f + stage->controls.presets * 0.15f;
  bus.eq_mids = 0.55f;
  bus.eq_highs = 0.45f + stage->controls.algorithm * 0.2f;
  bus.sidechain_depth = 0.4f + bus.scatter * 0.5f;
  bus.analog = ht_analog_defaults();
  bus.analog.drive = bus.drive;
  bus.analog.warmth = 0.3f + stage->controls.edit * 0.4f;
  bus.analog.wow = 0.2f + stage->controls.knob2 * 0.35f;
  bus.analog.flutter = 0.15f + stage->controls.fx * 0.25f;
  bus.analog.hiss = 0.06f + stage->bias.wildness * 0.08f;
  bus.analog.mix = 0.35f + stage->controls.edit * 0.35f;
  bus.tape_seconds = 0.12f + stage->controls.select * 0.08f;
  bus.tape_dry = 0.45f + stage->controls.presets * 0.4f;
  bus.tape_speed = 0.85f + stage->controls.algorithm * 0.4f;
  bus.tape_recording = stage->tape_recording;
  bus.tape_held = stage->episode_resting && !stage->episode_gap ? 1u : 0u;
  bus.silence_mode = (uint8_t)globals.mode;
  ht_voice_set_bus(&stage->voices, &bus);
  stage->voices.envelope =
      ht_envelope_from_env_knob(0.28f + stage->controls.env * 0.35f);
}

static void begin_episode_rest(HtStageEngine *stage, uint8_t gap) {
  stage->episode_resting = 1;
  stage->episode_gap = gap ? 1 : 0;
  /* Match JS rest tricks: short gap ~0.2s, longer tail rest ~0.6–1.2s. */
  stage->rest_until_ms = stage->clock_ms + (gap ? 220.0 : 700.0 + (double)(stage->phrase_index % 5u) * 80.0);
  stage->court.airborne_count = 0;
  stage->court.hand_hold_count = 0;
  sync_voice_bus(stage);
}

static void pick_phrase(HtStageEngine *stage, uint32_t mix) {
  HtSiteswapGenParams gen;
  uint8_t objects =
      ht_soft_object_count(stage->bias.object_count_prefer, mix, stage->bias.wildness, stage->bias.object_count);
  uint8_t family = pick_family(mix >> 3, stage->phrase_index == 0);
  uint8_t timing = HT_SS_ASYNC;
  uint8_t period = (uint8_t)(2u + (mix % 7u));
  uint8_t attempt;
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
  }
  for (attempt = 0; attempt < 4u; attempt += 1) {
    gen.object_count = attempt == 0u ? objects
                                     : ht_soft_object_count(stage->bias.object_count_prefer,
                                                            mix ^ (uint32_t)(attempt * 97u), 1.0f,
                                                            stage->bias.object_count);
    gen.period = period;
    gen.max_throw = (uint8_t)(gen.object_count + 3u + ((mix >> 8) & 7u));
    gen.min_throw = 0;
    gen.timing = timing;
    gen.family = attempt == 0u ? family : pick_family(mix + attempt * 17u, 0);
    gen.rest_slots = ((mix >> 4) & 3u) == 0u ? 1u : 0u;
    gen.search_budget = 400u;
    gen.seed = (mix ? mix : 1u) ^ ((uint32_t)attempt * 0x9e3779b9u);
    if (ht_siteswap_generate(&gen, stage->siteswap, (uint16_t)sizeof(stage->siteswap)) != HT_SS_OK) {
      stage->siteswap[0] = (char)('0' + gen.object_count);
      stage->siteswap[1] = 0;
    }
    if (attempt == 3u || stage->siteswap[0]) {
      objects = gen.object_count;
      break;
    }
  }
  stage->bias.object_count = objects;
  stage->controls.knob3 = (float)(objects - 3u) / 4.0f;
  stage->hand_style = HAND_STYLES[(mix >> 5) % HT_STAGE_HAND_COUNT];
  stage->court.siteswap = stage->siteswap;
  stage->court.hand_style = stage->hand_style;
  stage->court.hold_twos = 1;
  stage->last_throw_beat = -999;
  stage->last_occ = HT_OCC_EMPTY;
  /* Match device app.c phrase length so siteswap arcs stay readable. */
  stage->phrase_until = stage->pattern_beat + 12.0f + (float)((mix >> 3) % 20u);
  stage->court.storm = 0.15f + (float)((mix >> 9) & 7u) * 0.05f;
  stage->court.moon = 0.35f + (float)((mix >> 12) & 7u) * 0.07f;
  stage->court.episode_wait = 0;
  stage->court.episode_gap = 0;
  {
    HtDrumEnvelopes envelopes = ht_drum_envelopes_from_seed(stage->seed, stage->siteswap);
    ht_voice_set_drum_envelopes(&stage->voices, &envelopes);
  }
}

static uint8_t stage_melodic_engine(HtStageEngine *stage, uint32_t salt) {
  stage->note_serial = stage->note_serial + 1u;
  return ht_engine_assign_pick(&stage->engine_assign, salt ^ stage->note_serial);
}

static void apply_seed(HtStageEngine *stage, uint32_t next) {
  stage->seed = next ? next : 1u;
  stage->bias = ht_bias_from_controls(&stage->controls);
  stage->bias.object_count =
      ht_soft_object_count(stage->bias.object_count_prefer, stage->seed, stage->bias.wildness, 0);
  stage->bias.bpm = ht_soft_bpm(stage->bias.bpm, stage->seed ^ 0xb10bu, stage->bias.wildness);
  sync_tempo(stage);
  ht_gen_turing_init(&stage->turing, 8, (uint8_t)(10u + (uint32_t)(stage->bias.wildness * 50.0f)), 2,
                     stage->seed);
  ht_gen_atlas_init(&stage->atlas, (uint8_t)(stage->seed & 0xffu),
                    (uint8_t)((stage->seed >> 8) & 0xffu),
                    (uint8_t)(50u + (uint32_t)(stage->bias.wildness * 40.0f)),
                    (uint8_t)(5u + (uint32_t)(stage->bias.wildness * 30.0f)), stage->seed ^ 0x4d07u);
  ht_voice_set_seed(&stage->voices, stage->seed);
  ht_voice_panic(&stage->voices);
  ht_action_loop_rebind(&stage->action_loop, stage->seed);
  stage->pattern_beat = 0.0f;
  stage->phrase_index = 0;
  stage->step_accum_ms = 0.0;
  stage->episode_resting = 0;
  stage->episode_gap = 0;
  ht_court_clear_trails();
  ht_engine_assign_voices(&stage->engine_assign, stage->seed, stage->bias.patch_type,
                          stage->bias.wildness, HT_ENGINE_ASSIGN_SLOTS);
  stage->note_serial = 0;
  pick_phrase(stage, stage->seed);
  stage->gen_armed = 1;
  sync_voice_bus(stage);
  ht_voice_note_on(&stage->voices, ht_scale_note(stage->bias.scale_index, 60.0f, 0, stage->octave),
                   90, stage_melodic_engine(stage, stage->seed));
}

static void siteswap_tick(HtStageEngine *stage) {
  HtSiteswapSchedule schedule;
  HtModFactors factors;
  HtModVector sustain;
  HtOccupancySign sign;
  uint16_t i;
  uint8_t held = 0;
  uint8_t airborne = 0;
  {
    float previous_beat = stage->pattern_beat;
    stage->pattern_beat += 0.25f;
    if (stage->pattern_beat >= stage->phrase_until) {
      stage->phrase_index = (uint8_t)(stage->phrase_index + 1u);
      /* Occasional rest like JS ~N tricks — not every phrase. */
      if ((stage->phrase_index % 5u) == 0u) {
        begin_episode_rest(stage, (uint8_t)((stage->phrase_index / 5u) & 1u));
      }
      pick_phrase(stage, stage->seed ^ ((uint32_t)stage->phrase_index * 0x9e3779b9u));
    }
  stage->court.time_beat = stage->pattern_beat;
  stage->court.siteswap = stage->siteswap;
  stage->court.hand_style = stage->hand_style;
  stage->court.dwell_ratio = stage->bias.dwell_ratio;
  stage->court.hold_twos = 1;
  if (ht_siteswap_schedule(stage->siteswap, 1, (int16_t)(stage->pattern_beat + 8), &schedule) !=
      HT_SS_OK) {
    pick_phrase(stage, stage->seed ^ 0x51e51e51u ^ stage->phrase_index);
    return;
  }
  for (i = 0; i < schedule.event_count; i += 1) {
    const HtSiteswapEvent *ev = &schedule.events[i];
    float flight;
    if (ev->height == 0) {
      continue;
    }
    flight = ev->hold ? 0.0f : (float)ev->height * (1.0f - stage->bias.dwell_ratio);
    /* JS-style edge: fire when throw beat crosses the step window. */
    if (!ev->hold && ev->beat != stage->last_throw_beat && (float)ev->beat > previous_beat &&
        (float)ev->beat <= stage->pattern_beat + 0.0001f) {
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
        float midi =
            ht_scale_note(stage->bias.scale_index, 48.0f, (uint8_t)(ev->height % 12), stage->octave);
        uint8_t vel = (uint8_t)(70 + burst.burst_gain * 40.0f);
        uint8_t engine =
            stage_melodic_engine(stage, (uint32_t)ev->height * 17u + (uint32_t)ev->from_hand);
        ht_voice_note_on(&stage->voices, midi, vel, engine);
      }
    }
    if (stage->pattern_beat >= (float)ev->beat &&
        stage->pattern_beat < (float)ev->beat + (ev->hold ? 1.0f : flight)) {
      if (ev->hold || stage->pattern_beat >= (float)ev->beat + flight) {
        held = (uint8_t)(held + 1);
      } else {
        airborne = (uint8_t)(airborne + 1);
      }
    }
  }
  stage->court.airborne_count = airborne;
  stage->court.hand_hold_count = held;
  sign = ht_occupancy_sign(held, airborne, schedule.ball_count);
  memset(&factors, 0, sizeof(factors));
  factors.state = sign;
  factors.object_count = schedule.ball_count;
  factors.object_index = (uint8_t)((uint32_t)stage->pattern_beat % 7u);
  factors.hand = ((int)stage->pattern_beat & 1) ? 1 : 0;
  factors.dwell_phase = schedule.ball_count ? (float)held / (float)schedule.ball_count : 0.5f;
  factors.transition =
      (sign != stage->last_occ && stage->last_occ != HT_OCC_EMPTY) ? HT_MOD_STATE_EDGE : HT_MOD_SUSTAIN;
  sustain = ht_mod_matrix_combine(&factors);
  if (factors.transition == HT_MOD_STATE_EDGE && sustain.audible) {
    float midi =
        ht_scale_note(stage->bias.scale_index, 40.0f, (uint8_t)(sustain.engine_bias * 6.0f), stage->octave);
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
  note = ht_gen_turing_step(&stage->turing);
  if (note.gate) {
    uint8_t midi = (uint8_t)(note.midi + 12 * stage->octave);
    ht_voice_note_on(&stage->voices, midi, note.velocity,
                     stage_melodic_engine(stage, (uint32_t)midi * 3u));
  }
  drum_count = ht_gen_atlas_step(&stage->atlas, drums);
  for (index = 0; index < drum_count; index += 1) {
    if (drums[index].gate) {
      ht_voice_note_on(&stage->voices, drums[index].midi, drums[index].velocity,
                       ht_voice_pick_engine(stage->seed, drums[index].midi, 1));
    }
  }
  /* Keep melodic voices short so the court throws define the rhythm. */
  ht_voice_release_aged(&stage->voices, 0.28f);
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
  stage->court.time_beat =
      stage->pattern_beat +
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
  stage->controls.env = 0.22f;
  ht_voice_init(&stage->voices);
  ht_action_loop_init(&stage->action_loop, 1u);
  stage->octave = 0;
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
  if (roll < 0.22f) {
    ht_stage_new_patch(stage);
    return;
  }
  if (roll < 0.55f) {
    float value = (float)(ht_gen_stream(stage->seed + 17u) % 1000u) / 1000.0f;
    uint32_t which = ht_gen_stream(stage->seed + 23u) % 8u;
    if (which == 0) {
      stage->controls.knob1 = value;
    } else if (which == 1) {
      stage->controls.knob2 = value;
    } else if (which == 2) {
      stage->controls.knob3 = value;
      stage->bias.object_count_prefer = ht_object_count_from_siteswap_knob(value);
    } else if (which == 3) {
      stage->controls.knob4 = value;
      stage->bias.bpm = ht_bpm_from_tempo_knob(value);
      sync_tempo(stage);
    } else if (which == 4) {
      stage->controls.fx = value;
    } else if (which == 5) {
      stage->controls.edit = value;
    } else if (which == 6) {
      stage->controls.glo = value;
    } else {
      stage->controls.master = 0.55f + value * 0.45f;
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
  if (roll < 0.9f) {
    stage->court.cosmology = (uint8_t)!stage->court.cosmology;
    stage->court.storm = stage->court.cosmology ? 0.55f : 0.2f;
    pick_phrase(stage, stage->seed ^ 0xc0a1u ^ (uint32_t)stage->pattern_beat);
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
  int32_t *scratch;
  uint32_t i;
  uint32_t master_q12;
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
  scratch = stage->render_scratch;
  master_q12 = (uint32_t)(stage->controls.master * stage->controls.master * 4096.0f);
  if (master_q12 < 1400u) {
    master_q12 = 1400u;
  }
  memset(scratch, 0, (size_t)use_frames * 2u * sizeof(int32_t));
  ht_voice_render(&stage->voices, scratch, use_frames, master_q12);
  for (i = 0; i < use_frames; i += 1) {
    interleaved[2u * i] = (float)scratch[2u * i] / 9200000.0f;
    interleaved[2u * i + 1u] = (float)scratch[2u * i + 1u] / 9200000.0f;
  }
  for (; i < frames; i += 1) {
    interleaved[2u * i] = 0.0f;
    interleaved[2u * i + 1u] = 0.0f;
  }
}

void ht_stage_court_rgba(HtStageEngine *stage, uint8_t *rgba) {
  int y;
  int x;
  uint16_t row[HT_COURT_WIDTH];
  if (!stage || !rgba) {
    return;
  }
  stage->court.time_beat =
      stage->pattern_beat +
      (float)(stage->step_period_ms > 0.0 ? stage->step_accum_ms / stage->step_period_ms : 0.0);
  stage->court.siteswap = stage->siteswap;
  stage->court.hand_style = stage->hand_style;
  stage->court.hold_twos = 1;
  for (y = 0; y < HT_COURT_HEIGHT; y += 1) {
    ht_court_draw_frame(row, y, &stage->court);
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
