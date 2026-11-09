#include "ht_mix.h"

#include <math.h>
#include <string.h>

static float clampf(float value, float min, float max) {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

/* Same seed mixer family as js/court_gen.js (SplitMix32-style). */
static uint32_t mix_hash(uint32_t seed) {
  uint32_t z = (seed ^ 0x9e3779b9u) * 0x85ebca6bu + 0x27d4eb2du;
  z = (z ^ (z >> 15)) * 0xc2b2ae35u;
  z ^= z >> 13;
  return z ? z : 0xa511e9b3u;
}

static float mix_unit(uint32_t *state) {
  uint32_t x = *state ? *state : mix_hash(0);
  x ^= x << 7;
  x ^= x >> 9;
  x ^= x << 8;
  x *= 0x2545f491u;
  *state = x ? x : 1u;
  return ((*state) & 0xffffffu) / (float)0xffffffu;
}

static float mix_between(uint32_t *state, float min, float max) {
  return min + mix_unit(state) * (max - min);
}

HtSilenceMode ht_normalize_silence_mode(int silent_flag, HtSilenceMode mode) {
  if (mode == HT_SILENCE_GAP || mode == HT_SILENCE_TAIL || mode == HT_SILENCE_OPEN) {
    if (silent_flag && mode == HT_SILENCE_OPEN) {
      /* JS: normalizeSilenceMode(true) → tail */
      return HT_SILENCE_TAIL;
    }
    return mode;
  }
  return silent_flag ? HT_SILENCE_TAIL : HT_SILENCE_OPEN;
}

static void fill_section(HtMixSection *section, uint32_t *state, float wildness, uint8_t kind,
                         const HtTrackMix tracks[HT_TRACK_COUNT]) {
  uint8_t index;
  float beats = 8.0f + mix_unit(state) * 16.0f;
  if (kind == 1u) {
    beats = 4.0f + mix_unit(state) * 8.0f; /* break */
  } else if (kind == 2u) {
    beats = 6.0f + mix_unit(state) * 10.0f; /* intro/outro */
  }
  memset(section, 0, sizeof(*section));
  section->beats = beats;
  section->feedback = mix_between(state, 0.15f, 0.3f + wildness * 0.5f);
  section->reverb = mix_between(state, 0.2f, 0.4f + wildness * 0.45f);
  section->density = kind == 1u ? mix_between(state, 0.35f, 0.6f) : mix_between(state, 0.45f, 0.85f);
  for (index = 0; index < HT_TRACK_COUNT; index += 1) {
    const HtTrackMix *track = &tracks[index];
    if (!track->active) {
      section->mutes[index] = 1;
      continue;
    }
    section->mutes[index] = 0;
    if (kind == 1u && track->role != HT_TRACK_PERC && mix_unit(state) > 0.35f) {
      section->levels[index] = mix_between(state, 0.05f, 0.35f);
    } else if (kind == 2u && track->role == HT_TRACK_LEAD) {
      section->levels[index] = mix_between(state, 0.2f, 0.55f);
    } else {
      section->levels[index] = mix_between(state, 0.55f, 1.0f);
    }
    if (kind == 1u && track->role == HT_TRACK_PAD && mix_unit(state) > 0.75f) {
      section->mutes[index] = 1;
    }
    section->pan_offsets[index] = mix_between(state, -0.2f * wildness, 0.2f * wildness);
    section->reverb_sends[index] = mix_between(state, 0.7f, 1.25f + wildness * 0.4f);
    section->chain_sends[index] = mix_between(state, 0.6f, 1.2f + wildness * 0.5f);
  }
}

static void build_sections(HtComposition *comp, uint32_t *state, float wildness, uint8_t patch_type) {
  uint8_t count = 3;
  uint8_t kinds[HT_MIX_MAX_SECTIONS];
  uint8_t i;
  if (patch_type == HT_PATCH_JINGLE || patch_type == HT_PATCH_STUTTER) {
    count = 1;
    kinds[0] = 0;
  } else if (patch_type == HT_PATCH_DRONE || patch_type == HT_PATCH_VOWEL_CHANT ||
             patch_type == HT_PATCH_ORBIT) {
    count = 2;
    kinds[0] = 2;
    kinds[1] = 0;
  } else if (patch_type == HT_PATCH_ATLAS_DRUMS || patch_type == HT_PATCH_EUCLID_GROOVE) {
    count = 4;
    kinds[0] = 2;
    kinds[1] = 0;
    kinds[2] = 1;
    kinds[3] = 0;
  } else {
    count = 3 + (uint8_t)(mix_unit(state) * 2.0f);
    if (count > HT_MIX_MAX_SECTIONS) {
      count = HT_MIX_MAX_SECTIONS;
    }
    kinds[0] = 2;
    for (i = 1; i < count; i += 1) {
      kinds[i] = (i == count - 1u) ? 2u : (mix_unit(state) > 0.72f ? 1u : 0u);
    }
  }
  comp->section_count = count;
  for (i = 0; i < count; i += 1) {
    fill_section(&comp->sections[i], state, wildness, kinds[i], comp->tracks);
  }
}

void ht_composition_init(HtComposition *comp, uint32_t seed, float wildness, uint8_t patch_type) {
  uint32_t state = mix_hash(seed);
  float w = clampf(wildness, 0.0f, 1.0f);
  uint8_t active = 2 + (uint8_t)(mix_unit(&state) * 3.0f);
  uint8_t index;
  if (active > HT_TRACK_COUNT) {
    active = HT_TRACK_COUNT;
  }
  memset(comp, 0, sizeof(*comp));
  comp->active_tracks = active;
  for (index = 0; index < HT_TRACK_COUNT; index += 1) {
    HtTrackMix *track = &comp->tracks[index];
    track->index = index;
    track->role = index;
    track->active = index < active;
    if (!track->active) {
      continue;
    }
    {
      float level_min = index == HT_TRACK_BASS ? 0.55f : 0.35f;
      track->level = mix_between(&state, level_min, 0.95f);
      track->pan = mix_between(&state, -0.85f, 0.85f);
      track->reverb_send = mix_between(&state, 0.12f, 0.35f + w * 0.55f);
      track->chain_send = mix_between(&state, 0.08f, 0.25f + w * 0.45f);
    }
  }
  comp->base_reverb = mix_between(&state, 0.2f, 0.35f + w * 0.5f);
  comp->base_feedback = mix_between(&state, 0.1f, 0.55f + w * 0.3f);
  comp->base_filter_hz = mix_between(&state, 280.0f, 4200.0f);
  comp->base_return = mix_between(&state, 0.15f, 0.35f + w * 0.4f);
  build_sections(comp, &state, w, patch_type);
}

void ht_composition_init_default(HtComposition *comp, uint32_t seed, float wildness) {
  ht_composition_init(comp, seed, wildness, HT_PATCH_LOOPING);
}

int ht_composition_section_at_beat(const HtComposition *comp, float beat, HtMixSection *out,
                                   uint8_t *index_out) {
  float total = 0.0f;
  float cursor;
  uint8_t i;
  if (!comp || comp->section_count == 0) {
    return 0;
  }
  for (i = 0; i < comp->section_count; i += 1) {
    total += comp->sections[i].beats;
  }
  if (total <= 0.0f) {
    if (out) {
      *out = comp->sections[0];
    }
    if (index_out) {
      *index_out = 0;
    }
    return 1;
  }
  cursor = fmodf(beat, total);
  if (cursor < 0.0f) {
    cursor += total;
  }
  for (i = 0; i < comp->section_count; i += 1) {
    if (cursor < comp->sections[i].beats) {
      if (out) {
        *out = comp->sections[i];
      }
      if (index_out) {
        *index_out = i;
      }
      return 1;
    }
    cursor -= comp->sections[i].beats;
  }
  if (out) {
    *out = comp->sections[comp->section_count - 1u];
  }
  if (index_out) {
    *index_out = (uint8_t)(comp->section_count - 1u);
  }
  return 1;
}

void ht_live_mix_snapshot(const HtComposition *comp, float elapsed_seconds, uint32_t seed,
                          const HtWeather *weather, HtSilenceMode mode,
                          HtTrackMix out[HT_TRACK_COUNT]) {
  float storm = weather ? weather->storm : 0.0f;
  float chaos = weather ? weather->chaos : 0.0f;
  float moon = weather ? weather->moon : 0.0f;
  float feedback = weather ? weather->feedback : 0.0f;
  float motion = 0.12f + storm * 0.55f + chaos * 0.25f;
  float reverb_lift = feedback * 0.35f;
  HtSilenceMode silence = ht_normalize_silence_mode(0, mode);
  uint8_t index;

  for (index = 0; index < HT_TRACK_COUNT; index += 1) {
    const HtTrackMix *row = &comp->tracks[index];
    float phase =
        elapsed_seconds * (0.11f + motion * 0.4f) + index * 1.7f + (seed % 97u) * 0.01f;
    float breathe = 0.55f + 0.45f * (0.5f + 0.5f * sinf(phase));
    float pan_swing = sinf(phase * 0.73f + index) * (0.08f + motion * 0.45f);
    float level_mul = breathe * (0.75f + storm * 0.15f + moon * 0.08f);
    float reverb_send =
        clampf(row->reverb_send * (0.85f + reverb_lift) * (0.7f + 0.3f * breathe), 0.0f, 1.4f);
    float chain_send = clampf(row->chain_send * (0.8f + storm * 0.35f), 0.0f, 1.3f);
    uint8_t active = row->active;
    if (silence == HT_SILENCE_TAIL) {
      level_mul *= 0.12f;
      reverb_send = clampf(fmaxf(reverb_send, 0.55f) * 1.15f, 0.0f, 1.5f);
      chain_send = clampf(fmaxf(chain_send, 0.45f) * 1.2f, 0.0f, 1.4f);
    } else if (silence == HT_SILENCE_GAP) {
      level_mul = 0.02f;
      reverb_send = 0.02f;
      chain_send = 0.02f;
      active = 0;
    }
    out[index].index = row->index;
    out[index].role = row->role;
    out[index].active = active && row->active;
    out[index].level = clampf(row->level * level_mul, 0.0f, 1.2f);
    out[index].pan = clampf(row->pan + pan_swing, -1.0f, 1.0f);
    out[index].reverb_send = reverb_send;
    out[index].chain_send = chain_send;
  }
}

void ht_live_mix_snapshot_beat(const HtComposition *comp, float beat, float elapsed_seconds,
                               uint32_t seed, const HtWeather *weather, HtSilenceMode mode,
                               HtTrackMix out[HT_TRACK_COUNT], HtMixSection *section_out) {
  HtMixSection section;
  uint8_t index;
  uint8_t i;
  ht_live_mix_snapshot(comp, elapsed_seconds, seed, weather, mode, out);
  if (!ht_composition_section_at_beat(comp, beat, &section, &index)) {
    if (section_out) {
      memset(section_out, 0, sizeof(*section_out));
    }
    return;
  }
  if (section_out) {
    *section_out = section;
  }
  for (i = 0; i < HT_TRACK_COUNT; i += 1) {
    if (section.mutes[i]) {
      out[i].active = 0;
      out[i].level = 0.0f;
      continue;
    }
    out[i].level = clampf(out[i].level * section.levels[i], 0.0f, 1.2f);
    out[i].pan = clampf(out[i].pan + section.pan_offsets[i], -1.0f, 1.0f);
    out[i].reverb_send = clampf(out[i].reverb_send * section.reverb_sends[i], 0.0f, 1.5f);
    out[i].chain_send = clampf(out[i].chain_send * section.chain_sends[i], 0.0f, 1.4f);
  }
}

HtMixGlobals ht_live_mix_globals(const HtComposition *comp, const HtWeather *weather,
                                 HtSilenceMode mode) {
  return ht_live_mix_globals_section(comp, weather, mode, NULL);
}

HtMixGlobals ht_live_mix_globals_section(const HtComposition *comp, const HtWeather *weather,
                                         HtSilenceMode mode, const HtMixSection *section) {
  HtMixGlobals globals;
  float storm = weather ? weather->storm : 0.0f;
  float feedback_weather = weather ? weather->feedback : 0.0f;
  float return_level = comp->base_return;
  float cross_feedback = comp->base_feedback;
  float filter_base = comp->base_filter_hz > 0.0f ? comp->base_filter_hz : 4200.0f;
  float base_reverb = comp->base_reverb;
  HtSilenceMode silence = ht_normalize_silence_mode(0, mode);
  if (section) {
    cross_feedback = section->feedback;
    base_reverb = section->reverb;
  }
  globals.mode = (uint8_t)silence;

  if (silence == HT_SILENCE_TAIL) {
    globals.reverb =
        clampf(base_reverb + 0.28f + feedback_weather * 0.2f, 0.35f, 0.95f);
    globals.feedback = clampf(cross_feedback + 0.18f + storm * 0.1f, 0.28f, 0.78f);
    globals.filter_hz =
        clampf(filter_base * (0.75f - storm * 0.1f), 700.0f, 4800.0f);
    globals.wet = clampf(0.4f + return_level * 0.55f, 0.28f, 0.85f);
    globals.dry = 0.22f;
    globals.court_gate = 0.85f;
    return globals;
  }
  if (silence == HT_SILENCE_GAP) {
    globals.reverb = 0.04f;
    globals.feedback = 0.05f;
    globals.filter_hz = clampf(filter_base * 0.4f, 500.0f, 2800.0f);
    globals.wet = 0.04f;
    globals.dry = 0.02f;
    globals.court_gate = 0.02f;
    return globals;
  }
  globals.reverb = clampf(base_reverb + feedback_weather * 0.25f, 0.05f, 0.85f);
  globals.feedback =
      clampf(cross_feedback + feedback_weather * 0.2f + storm * 0.1f, 0.05f, 0.75f);
  globals.filter_hz = clampf(filter_base * (1.0f - storm * 0.25f), 600.0f, 5200.0f);
  globals.wet = clampf(return_level * 1.15f + storm * 0.08f, 0.04f, 0.75f);
  globals.dry = clampf(0.92f - return_level * 0.55f, 0.35f, 0.95f);
  globals.court_gate = 1.0f;
  return globals;
}
