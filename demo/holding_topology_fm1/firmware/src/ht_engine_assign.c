/* SPDX-License-Identifier: MIT
 * Voice engine assignment — lockstep with js/rnd_patch.js trackEngineBias / pickVoiceEngine. */
#include "ht_engine_assign.h"

#include <string.h>

uint32_t ht_engine_assign_next(uint32_t *state) {
  uint32_t z = *state ? *state : 1u;
  z ^= z << 13;
  z ^= z >> 17;
  z ^= z << 5;
  *state = z ? z : 0xA511E9B3u;
  return *state;
}

uint8_t ht_timbre_from_seed(uint32_t seed) {
  return (uint8_t)(seed % HT_TIMBRE_COUNT);
}

static uint8_t pick_from(uint32_t *state, const uint8_t *list, uint8_t count) {
  if (!list || count == 0u) {
    return HT_ENGINE_SUBTRACTIVE;
  }
  return list[ht_engine_assign_next(state) % count];
}

static uint8_t fill_bias(uint8_t profile, uint8_t patch_type, uint8_t track_index, uint8_t *out,
                         uint8_t cap) {
  uint8_t n = 0;
#define PUSH(e)                                                                                    \
  do {                                                                                             \
    if (n < cap) {                                                                                 \
      out[n++] = (uint8_t)(e);                                                                     \
    }                                                                                              \
  } while (0)

  if (patch_type == HT_PATCH_VOWEL_CHANT || patch_type == HT_PATCH_CASCADE_CHOIR) {
    PUSH(HT_ENGINE_VOWEL);
    PUSH(HT_ENGINE_ORGAN);
    PUSH(HT_ENGINE_ADDITIVE);
    return n;
  }
  if (profile == HT_TIMBRE_LYRA_ORGAN) {
    PUSH(HT_ENGINE_ORGAN);
    PUSH(HT_ENGINE_VOWEL);
    PUSH(HT_ENGINE_ADDITIVE);
    PUSH(HT_ENGINE_PIPE);
    PUSH(HT_ENGINE_KARPLUS);
    PUSH(HT_ENGINE_FM);
    return n;
  }
  if (profile == HT_TIMBRE_CHOIR_CAVE) {
    if (track_index == 3u) {
      PUSH(HT_ENGINE_NOISE);
      PUSH(HT_ENGINE_PWM);
      PUSH(HT_ENGINE_KARPLUS);
      PUSH(HT_ENGINE_GRANULAR);
    } else {
      PUSH(HT_ENGINE_VOWEL);
      PUSH(HT_ENGINE_ORGAN);
      PUSH(HT_ENGINE_ADDITIVE);
    }
    return n;
  }
  if (profile == HT_TIMBRE_ACID_ROOM) {
    PUSH(HT_ENGINE_ACID);
    PUSH(HT_ENGINE_SUBTRACTIVE);
    PUSH(HT_ENGINE_PWM);
    PUSH(HT_ENGINE_SUPERSAW);
    PUSH(HT_ENGINE_FM);
    return n;
  }
  if (profile == HT_TIMBRE_NOISE_RITUAL) {
    PUSH(HT_ENGINE_NOISE);
    PUSH(HT_ENGINE_GRANULAR);
    PUSH(HT_ENGINE_WAVESHAPE);
    PUSH(HT_ENGINE_PWM);
    PUSH(HT_ENGINE_RING_MOD);
    PUSH(HT_ENGINE_AM);
    PUSH(HT_ENGINE_PIPE);
    PUSH(HT_ENGINE_VARGAN);
    PUSH(HT_ENGINE_DIDGERIDOO);
    return n;
  }
  if (profile == HT_TIMBRE_GLASS_PAD) {
    PUSH(HT_ENGINE_WAVETABLE);
    PUSH(HT_ENGINE_ADDITIVE);
    PUSH(HT_ENGINE_PHASE_DISTORTION);
    PUSH(HT_ENGINE_ORGAN);
    PUSH(HT_ENGINE_FM);
    PUSH(HT_ENGINE_PIPE);
    PUSH(HT_ENGINE_VIOLIN);
    return n;
  }
  if (profile == HT_TIMBRE_PULSE_GRID) {
    PUSH(HT_ENGINE_PWM);
    PUSH(HT_ENGINE_SUBTRACTIVE);
    PUSH(HT_ENGINE_FM);
    PUSH(HT_ENGINE_ACID);
    PUSH(HT_ENGINE_SUPERSAW);
    return n;
  }
  if (profile == HT_TIMBRE_KARPLUS_HALL) {
    PUSH(HT_ENGINE_KARPLUS);
    PUSH(HT_ENGINE_GUITAR);
    PUSH(HT_ENGINE_PIANO);
    PUSH(HT_ENGINE_VIOLIN);
    PUSH(HT_ENGINE_ORGAN);
    PUSH(HT_ENGINE_PIPE);
    return n;
  }
  if (profile == HT_TIMBRE_STRING_COURT) {
    PUSH(HT_ENGINE_GUITAR);
    PUSH(HT_ENGINE_VIOLIN);
    PUSH(HT_ENGINE_PIANO);
    PUSH(HT_ENGINE_KARPLUS);
    PUSH(HT_ENGINE_ORGAN);
    return n;
  }
  if (profile == HT_TIMBRE_WIND_COURT) {
    PUSH(HT_ENGINE_PIPE);
    PUSH(HT_ENGINE_SAXOPHONE);
    PUSH(HT_ENGINE_DIDGERIDOO);
    PUSH(HT_ENGINE_VARGAN);
    PUSH(HT_ENGINE_VOWEL);
    return n;
  }
  if (profile == HT_TIMBRE_FM_STORM) {
    PUSH(HT_ENGINE_FM);
    PUSH(HT_ENGINE_PHASE_DISTORTION);
    PUSH(HT_ENGINE_WAVESHAPE);
    PUSH(HT_ENGINE_RING_MOD);
    PUSH(HT_ENGINE_AM);
    PUSH(HT_ENGINE_SAXOPHONE);
    return n;
  }
  if (profile == HT_TIMBRE_AMAZON_CANOPY) {
    if (track_index == 0u) {
      PUSH(HT_ENGINE_BUBBLE);
      PUSH(HT_ENGINE_FOREST);
      PUSH(HT_ENGINE_FIRE);
      PUSH(HT_ENGINE_DUB_BASS);
      PUSH(HT_ENGINE_SUBTRACTIVE);
    } else {
      PUSH(HT_ENGINE_BIRD);
      PUSH(HT_ENGINE_DOLPHIN);
      PUSH(HT_ENGINE_FOREST);
      PUSH(HT_ENGINE_BUBBLE);
      PUSH(HT_ENGINE_FIRE);
      PUSH(HT_ENGINE_GRANULAR);
      PUSH(HT_ENGINE_NOISE);
    }
    return n;
  }
  if (profile == HT_TIMBRE_JAMAICA_DUB) {
    if (track_index == 0u) {
      PUSH(HT_ENGINE_DUB_BASS);
      PUSH(HT_ENGINE_SUBTRACTIVE);
      PUSH(HT_ENGINE_ACID);
      PUSH(HT_ENGINE_ORGAN);
    } else {
      PUSH(HT_ENGINE_DUB_BASS);
      PUSH(HT_ENGINE_PWM);
      PUSH(HT_ENGINE_ORGAN);
      PUSH(HT_ENGINE_FM);
      PUSH(HT_ENGINE_FOREST);
      PUSH(HT_ENGINE_NOISE);
    }
    return n;
  }
  if (patch_type == HT_PATCH_ATLAS_DRUMS && track_index == 3u) {
    PUSH(HT_ENGINE_NOISE);
    PUSH(HT_ENGINE_PWM);
    PUSH(HT_ENGINE_SUBTRACTIVE);
    PUSH(HT_ENGINE_WAVESHAPE);
    return n;
  }
  {
    uint8_t i;
    for (i = 0; i < HT_ENGINE_COUNT && n < cap; i += 1) {
      PUSH(i);
    }
  }
#undef PUSH
  return n;
}

static int profile_prefers_bias(uint8_t profile) {
  return profile == HT_TIMBRE_AMAZON_CANOPY || profile == HT_TIMBRE_JAMAICA_DUB ||
         profile == HT_TIMBRE_WIND_COURT || profile == HT_TIMBRE_STRING_COURT ||
         profile == HT_TIMBRE_KARPLUS_HALL || profile == HT_TIMBRE_CHOIR_CAVE;
}

static uint8_t pick_voice_engine(uint32_t *state, uint8_t profile, uint8_t patch_type,
                                 uint8_t track_index, float wildness, uint8_t force_vowel) {
  uint8_t bias[16];
  uint8_t bias_n;
  float unit;
  if (force_vowel) {
    return HT_ENGINE_VOWEL;
  }
  bias_n = fill_bias(profile, patch_type, track_index, bias, (uint8_t)sizeof(bias));
  unit = (float)(ht_engine_assign_next(state) & 0xffffu) / 65535.0f;
  if (profile_prefers_bias(profile)) {
    /* Nature / court profiles keep bias engines audible (birds, vargan, strings). */
    if (unit < 0.58f + wildness * 0.22f) {
      return pick_from(state, bias, bias_n);
    }
    return (uint8_t)(ht_engine_assign_next(state) % HT_ENGINE_COUNT);
  }
  if (unit < 0.62f + wildness * 0.28f) {
    return (uint8_t)(ht_engine_assign_next(state) % HT_ENGINE_COUNT);
  }
  return pick_from(state, bias, bias_n);
}

static void ensure_spread(uint8_t *engines, uint8_t count, uint32_t *state, uint8_t min_distinct) {
  uint8_t used[HT_ENGINE_COUNT];
  uint8_t distinct = 0;
  uint8_t i;
  uint8_t guard = 0;
  uint8_t want;
  memset(used, 0, sizeof(used));
  for (i = 0; i < count; i += 1) {
    if (engines[i] < HT_ENGINE_COUNT && !used[engines[i]]) {
      used[engines[i]] = 1;
      distinct = (uint8_t)(distinct + 1u);
    }
  }
  want = min_distinct;
  if (want > count) {
    want = count;
  }
  if (want > HT_ENGINE_COUNT) {
    want = HT_ENGINE_COUNT;
  }
  while (distinct < want && guard < 24u) {
    uint8_t slot = (uint8_t)(ht_engine_assign_next(state) % count);
    uint8_t engine = (uint8_t)(ht_engine_assign_next(state) % HT_ENGINE_COUNT);
    if (!used[engine]) {
      used[engine] = 1;
      distinct = (uint8_t)(distinct + 1u);
    }
    engines[slot] = engine;
    guard = (uint8_t)(guard + 1u);
  }
}

void ht_engine_assign_voices(HtEngineAssign *assign, uint32_t seed, uint8_t patch_type,
                             float wildness, uint8_t slot_count) {
  uint32_t state = seed ? seed : 1u;
  uint8_t i;
  uint8_t force_vowel;
  float wander = wildness;
  if (!assign) {
    return;
  }
  if (wander < 0.0f) {
    wander = 0.0f;
  }
  if (wander > 1.0f) {
    wander = 1.0f;
  }
  if (slot_count == 0u || slot_count > HT_ENGINE_ASSIGN_SLOTS) {
    slot_count = HT_ENGINE_ASSIGN_SLOTS;
  }
  memset(assign, 0, sizeof(*assign));
  assign->timbre_profile = ht_timbre_from_seed(seed ^ 0x71B3Eu);
  assign->patch_type = patch_type < HT_PATCH_TYPE_COUNT ? patch_type : 0u;
  assign->count = slot_count;
  force_vowel =
      (assign->patch_type == HT_PATCH_VOWEL_CHANT || assign->patch_type == HT_PATCH_CASCADE_CHOIR)
          ? 1u
          : 0u;
  for (i = 0; i < slot_count; i += 1) {
    uint8_t track = (uint8_t)(i % HT_TRACK_COUNT);
    assign->engines[i] =
        pick_voice_engine(&state, assign->timbre_profile, assign->patch_type, track, wander,
                          force_vowel);
  }
  if (!force_vowel) {
    ensure_spread(assign->engines, slot_count, &state, 4u);
    /* amazon_canopy: guarantee at least one bird or dolphin. */
    if (assign->timbre_profile == HT_TIMBRE_AMAZON_CANOPY) {
      uint8_t has_nature = 0;
      for (i = 0; i < slot_count; i += 1) {
        if (assign->engines[i] == HT_ENGINE_BIRD || assign->engines[i] == HT_ENGINE_DOLPHIN ||
            assign->engines[i] == HT_ENGINE_BUBBLE || assign->engines[i] == HT_ENGINE_FOREST) {
          has_nature = 1;
          break;
        }
      }
      if (!has_nature && slot_count > 1u) {
        assign->engines[1] = HT_ENGINE_BIRD;
      }
    }
  }
}

uint8_t ht_engine_assign_pick(const HtEngineAssign *assign, uint32_t salt) {
  if (!assign || assign->count == 0u) {
    return HT_ENGINE_SUBTRACTIVE;
  }
  return assign->engines[salt % assign->count];
}
