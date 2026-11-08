#include "ht_controls.h"
#include "ht_fx.h"

static float clampf(float value, float min, float max) {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

uint32_t ht_unique_seed(uint32_t entropy) {
  static uint32_t counter = 0x57414c4bu;
  counter += 0x9e3779b9u;
  uint32_t z = (entropy ^ counter ^ 0xa5c35a17u) * 0x85ebca6bu + 0x27d4eb2du;
  z = (z ^ (z >> 15)) * 0xc2b2ae35u;
  z ^= z >> 13;
  return z ? z : 0xa511e9b3u;
}

void ht_controls_init(HtControls *controls) {
  controls->master = 0.72f;
  controls->select = 0.5f;
  controls->presets = 0.35f;
  controls->algorithm = 0.4f;
  controls->knob1 = 0.48f;
  controls->knob2 = 0.42f;
  controls->knob3 = 0.45f;
  controls->knob4 = 0.55f;
  controls->env = 0.5f;
  controls->lfo = 0.4f;
  controls->fx = 0.45f;
  controls->edit = 0.4f;
  controls->glo = 0.55f;
  controls->seed_locked = 0;
  for (int index = 0; index < HT_VOICE_COUNT; index += 1) {
    controls->voice_mute[index] = 0;
  }
}

float ht_bpm_from_tempo_knob(float value) {
  return HT_BPM_MIN + clampf(value, 0.0f, 1.0f) * (HT_BPM_MAX - HT_BPM_MIN);
}

float ht_tempo_knob_from_bpm(float bpm) {
  return clampf((bpm - HT_BPM_MIN) / (HT_BPM_MAX - HT_BPM_MIN), 0.0f, 1.0f);
}

float ht_soft_bpm(float prefer, uint32_t seed, float wildness) {
  float center = clampf(prefer, HT_BPM_MIN, HT_BPM_MAX);
  float wander = wildness <= 0.0f ? 0.0f : (wildness > 1.0f ? 1.0f : wildness);
  uint32_t state = seed ? seed : 1u;
  float unit;
  if (wander <= 0.0f) {
    return center;
  }
  state ^= 0xb10bu;
  state = (state ^ (state >> 13)) * 0xc2b2ae35u;
  unit = (float)((state >> 8) & 0xffu) / 255.0f;
  /* Most PLAY rolls pick freely in 40…220; prefer is only a light pull. */
  if (unit < 0.28f * wander) {
    return center;
  }
  state ^= 0x27d4eb2du;
  state = (state ^ (state >> 15)) * 0x85ebca6bu;
  unit = (float)(state & 0xffffu) / 65535.0f;
  return HT_BPM_MIN + unit * (HT_BPM_MAX - HT_BPM_MIN);
}

uint8_t ht_object_count_from_siteswap_knob(float value) {
  float clamped = clampf(value, 0.0f, 1.0f);
  uint8_t count = (uint8_t)(3 + (int)(clamped * 4.999f));
  if (count > 7) {
    count = 7;
  }
  return count;
}

uint8_t ht_soft_object_count(uint8_t prefer, uint32_t seed, float wildness, uint8_t exclude) {
  static const uint8_t choices[] = {3, 4, 5, 6, 7};
  uint8_t pool[5];
  uint8_t pool_n = 0;
  uint8_t i;
  float wander = wildness <= 0.0f ? 0.0f : (wildness > 1.0f ? 1.0f : wildness);
  uint32_t state = seed ? seed : 1u;
  for (i = 0; i < 5u; i += 1) {
    if (choices[i] != exclude) {
      pool[pool_n++] = choices[i];
    }
  }
  if (pool_n == 0u) {
    pool[0] = 3;
    pool_n = 1;
  }
  if (prefer >= 3u && prefer <= 7u && prefer != exclude) {
    if (wander <= 0.0f) {
      return prefer;
    }
    state ^= 0x85ebca6bu;
    state = (state ^ (state >> 13)) * 0xc2b2ae35u;
    if (((state >> 8) & 0xffu) < (uint32_t)(0.28f * 255.0f * (wander < 1.0f ? wander : 1.0f) + 0.5f)) {
      return prefer;
    }
  }
  state ^= 0x27d4eb2du;
  state = (state ^ (state >> 15)) * 0x85ebca6bu;
  return pool[state % pool_n];
}

float ht_dwell_from_env_knob(float value) {
  return 0.28f + clampf(value, 0.0f, 1.0f) * 0.4f;
}

float ht_feedback_from_knob(float value) {
  return 0.05f + clampf(value, 0.0f, 1.0f) * 0.9f;
}

float ht_lfo_depth_from_knob(float value) {
  return 0.05f + clampf(value, 0.0f, 1.0f) * 0.95f;
}

float ht_delay_from_fx_knob(float value) {
  return 0.08f + clampf(value, 0.0f, 1.0f) * 0.7f;
}

float ht_drive_from_edit_knob(float value) {
  return 0.05f + clampf(value, 0.0f, 1.0f) * 0.9f;
}

uint8_t ht_patch_type_from_algorithm(float value) {
  float clamped = clampf(value, 0.0f, 0.999f);
  uint8_t index = (uint8_t)(clamped * (float)HT_PATCH_TYPE_COUNT);
  if (index >= HT_PATCH_TYPE_COUNT) {
    index = HT_PATCH_TYPE_COUNT - 1;
  }
  return index;
}

uint8_t ht_scale_index_from_presets(float value) {
  float clamped = clampf(value, 0.0f, 0.999f);
  uint8_t index = (uint8_t)(clamped * (float)HT_SCALE_COUNT);
  if (index >= HT_SCALE_COUNT) {
    index = HT_SCALE_COUNT - 1;
  }
  return index;
}

int ht_patch_is_generative(uint8_t patch_type) {
  return patch_type == HT_PATCH_EUCLID_GROOVE || patch_type == HT_PATCH_TURING_LINE ||
         patch_type == HT_PATCH_MARKOV_WALK || patch_type == HT_PATCH_ATLAS_DRUMS;
}

int ht_engine_is_wind(uint8_t engine) {
  return engine == HT_ENGINE_PIPE || engine == HT_ENGINE_SAXOPHONE ||
         engine == HT_ENGINE_DIDGERIDOO || engine == HT_ENGINE_VARGAN;
}

int ht_engine_is_string(uint8_t engine) {
  return engine == HT_ENGINE_KARPLUS || engine == HT_ENGINE_GUITAR ||
         engine == HT_ENGINE_VIOLIN || engine == HT_ENGINE_PIANO;
}

int ht_engine_is_physical(uint8_t engine) {
  return ht_engine_is_wind(engine) || ht_engine_is_string(engine);
}

HtPatchBias ht_bias_from_controls(const HtControls *controls) {
  HtPatchBias bias;
  bias.wildness = clampf(controls->glo, 0.0f, 1.0f);
  if (bias.wildness < 0.55f) {
    bias.wildness = 0.55f;
  }
  bias.object_count_prefer = ht_object_count_from_siteswap_knob(controls->knob3);
  bias.object_count = bias.object_count_prefer;
  bias.throw_bias = clampf(controls->knob3, 0.0f, 1.0f);
  bias.bpm = ht_bpm_from_tempo_knob(controls->knob4);
  bias.dwell_ratio = ht_dwell_from_env_knob(controls->env);
  bias.total_feedback = ht_feedback_from_knob(controls->knob1);
  bias.lfo_depth = ht_lfo_depth_from_knob(controls->knob2);
  bias.delay_time = ht_delay_from_fx_knob(controls->fx);
  bias.scatter = ht_scatter_from_fx_knob(controls->fx);
  bias.drive = ht_drive_from_edit_knob(controls->edit);
  bias.lfo_destination = ht_lfo_destination_from_knob(controls->lfo);
  bias.lfo_shape = ht_lfo_shape_from_knob(controls->lfo);
  bias.patch_type = ht_patch_type_from_algorithm(controls->algorithm);
  bias.scale_index = ht_scale_index_from_presets(controls->presets);
  return bias;
}
