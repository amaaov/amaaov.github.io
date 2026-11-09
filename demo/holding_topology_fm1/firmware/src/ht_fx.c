#include "ht_fx.h"
#include "ht_patch.h"

#include <math.h>

static float clampf(float value, float min, float max) {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

HtEnvelope ht_envelope_from_env_knob(float value) {
  float amount = clampf(value, 0.0f, 1.0f);
  HtEnvelope envelope;
  envelope.attack = 0.008f + amount * 0.42f;
  envelope.decay = 0.06f + (1.0f - amount) * 0.35f;
  envelope.sustain = 0.28f + amount * 0.55f;
  envelope.release = 0.12f + amount * 0.85f;
  envelope.filter_env = 0.12f + amount * 0.7f;
  return envelope;
}

uint32_t ht_hash_pattern_seed(const char *source) {
  uint32_t hash = 2166136261u;
  const char *cursor = source ? source : "";
  while (*cursor) {
    hash ^= (uint8_t)(*cursor);
    hash *= 16777619u;
    cursor += 1;
  }
  return hash;
}

static float unit_rand(uint32_t *state) {
  uint32_t value;
  *state += 0x6d2b79f5u;
  value = *state;
  value = (value ^ (value >> 15)) * (value | 1u);
  value ^= value + (value ^ (value >> 7)) * (value | 61u);
  return (float)((value ^ (value >> 14)) & 0xffffffu) / 16777216.0f;
}

static HtEnvelope drum_part_envelope(uint32_t seed, uint32_t salt, uint8_t part) {
  uint32_t state = seed ^ salt;
  HtEnvelope envelope;
  float r0 = unit_rand(&state);
  float r1 = unit_rand(&state);
  float r2 = unit_rand(&state);
  float r3 = unit_rand(&state);
  if (part == 0) { /* kick */
    envelope.attack = clampf(0.003f + r0 * 0.02f, 0.002f, 0.035f);
    envelope.decay = clampf(0.05f + r1 * 0.2f, 0.04f, 0.32f);
    envelope.sustain = clampf(0.04f + r2 * 0.22f, 0.02f, 0.35f);
    envelope.release = clampf(0.12f + r3 * 0.35f, 0.08f, 0.55f);
  } else if (part == 1) { /* snare */
    envelope.attack = clampf(0.001f + r0 * 0.012f, 0.001f, 0.02f);
    envelope.decay = clampf(0.025f + r1 * 0.12f, 0.02f, 0.18f);
    envelope.sustain = clampf(0.02f + r2 * 0.14f, 0.01f, 0.22f);
    envelope.release = clampf(0.05f + r3 * 0.18f, 0.04f, 0.28f);
  } else {
    envelope.attack = clampf(0.0008f + r0 * 0.006f, 0.0005f, 0.012f);
    envelope.decay = clampf(0.008f + r1 * 0.05f, 0.006f, 0.08f);
    envelope.sustain = clampf(0.008f + r2 * 0.05f, 0.004f, 0.08f);
    envelope.release = clampf(0.015f + r3 * 0.07f, 0.01f, 0.12f);
  }
  envelope.filter_env = 0.2f + r0 * 0.5f;
  return envelope;
}

HtDrumEnvelopes ht_drum_envelopes_from_seed(uint32_t seed, const char *pattern_source) {
  uint32_t mix = (seed ? seed : 1u) ^ ht_hash_pattern_seed(pattern_source);
  HtDrumEnvelopes envelopes;
  envelopes.kick = drum_part_envelope(mix, 0x6b69636bu, 0);
  envelopes.snare = drum_part_envelope(mix, 0x736e6172u, 1);
  envelopes.hat = drum_part_envelope(mix, 0x68617431u, 2);
  return envelopes;
}

HtGrainPlan ht_grain_plan(float amount, float delay_seconds) {
  float unit = clampf(amount, 0.0f, 1.0f);
  float delay = clampf(delay_seconds > 0.0f ? delay_seconds : 0.28f, 0.02f, 1.85f);
  HtGrainPlan plan;
  plan.delay_seconds = delay;
  plan.spray = unit * 0.55f;
  plan.grain_seconds = 0.035f + unit * 0.14f;
  plan.density = 3.0f + unit * 36.0f;
  plan.feedback = unit * 0.42f;
  plan.mix = unit <= 0.02f ? 0.0f : 0.2f + unit * 0.75f;
  plan.max_grains = (uint8_t)(4u + (uint8_t)(unit * 12.0f));
  if (plan.max_grains > 16u) {
    plan.max_grains = 16u;
  }
  return plan;
}

uint8_t ht_lfo_destination_from_knob(float value) {
  float clamped = clampf(value, 0.0f, 0.999f);
  uint8_t index = (uint8_t)(clamped * (float)HT_LFO_DEST_COUNT);
  if (index >= HT_LFO_DEST_COUNT) {
    index = HT_LFO_DEST_COUNT - 1;
  }
  return index;
}

uint8_t ht_lfo_shape_from_knob(float value) {
  float clamped = clampf(value, 0.0f, 0.999f);
  uint8_t index = (uint8_t)(clamped * (float)HT_LFO_SHAPE_COUNT);
  if (index >= HT_LFO_SHAPE_COUNT) {
    index = HT_LFO_SHAPE_COUNT - 1;
  }
  return index;
}

float ht_scatter_from_fx_knob(float value) {
  return clampf(value, 0.0f, 1.0f) * 0.85f;
}

float ht_eq_shelf_gain(float unit) {
  return (clampf(unit, 0.0f, 1.0f) - 0.5f) * 18.0f;
}

float ht_tape_speed_rate(float unit) {
  float clamped = clampf(unit, -2.0f, 2.0f);
  if (fabsf(clamped) <= 0.08f) {
    return 0.0f;
  }
  return clamped;
}

float ht_tape_loop_seconds(float seconds) {
  if (!(seconds > 0.0f)) {
    return 0.0f;
  }
  return clampf(seconds, 0.0f, HT_TAPE_LOOP_MAXIMUM_SECONDS);
}

HtTapePlan ht_tape_plan(float tape_seconds, float tape_dry, float speed, uint8_t recording,
                        uint8_t held, uint8_t silent) {
  HtTapePlan plan;
  float seconds = ht_tape_loop_seconds(tape_seconds);
  plan.tape_speed = ht_tape_speed_rate(speed);
  plan.tape_loop_seconds = seconds;
  plan.tape_recording = (seconds > 0.0f && !held && !silent && recording) ? 1 : 0;
  plan.tape_held = held ? 1 : 0;
  if (seconds > 0.0f && (!silent || held)) {
    plan.tape_wet = clampf(tape_dry, 0.0f, 1.0f);
  } else {
    plan.tape_wet = 0.0f;
  }
  return plan;
}

HtScatterPlan ht_scatter_plan(float amount, float time_seconds) {
  HtScatterPlan plan;
  if (!(amount > 0.0f)) {
    plan.time = 0.05f;
    plan.gain = 0.0f;
    plan.feedback = 0.0f;
    plan.duck = 0.0f;
    return plan;
  }
  float base = 0.2f - amount * 0.16f;
  float slot = floorf(time_seconds * 3.2f);
  float hash = sinf(slot * 12.9898f) * 43758.5453f;
  hash = hash - floorf(hash);
  float half = hash > 0.62f ? 0.5f : 1.0f;
  plan.time = clampf(base * half, 0.018f, 0.22f);
  plan.gain = 0.72f + amount * 0.26f;
  plan.feedback = 0.86f + amount * 0.12f;
  plan.duck = 0.4f + amount * 0.45f;
  return plan;
}

float ht_envelope_level(float age, const HtEnvelope *envelope, uint8_t released) {
  float safe_age = age < 0.0f ? 0.0f : age;
  if (released) {
    if (envelope->release <= 0.0f) {
      return 0.0f;
    }
    float level = envelope->sustain * (1.0f - safe_age / envelope->release);
    return level < 0.0f ? 0.0f : level;
  }
  if (envelope->attack > 0.0f && safe_age < envelope->attack) {
    return safe_age / envelope->attack;
  }
  float after_attack = safe_age - (envelope->attack < 0.0f ? 0.0f : envelope->attack);
  if (envelope->decay > 0.0f && after_attack < envelope->decay) {
    return 1.0f - (1.0f - envelope->sustain) * (after_attack / envelope->decay);
  }
  return envelope->sustain;
}

float ht_warmth_cutoff_hz(float warmth, float sample_rate) {
  float unit = clampf(warmth, 0.0f, 1.0f);
  float nyquist = sample_rate * 0.45f;
  float hz = 9200.0f - unit * 6200.0f;
  return clampf(hz, 1800.0f, nyquist);
}

float ht_wow_depth_seconds(float wow) {
  return 0.00015f + clampf(wow, 0.0f, 1.0f) * 0.0024f;
}

float ht_flutter_depth_seconds(float flutter) {
  return 0.00004f + clampf(flutter, 0.0f, 1.0f) * 0.00055f;
}

float ht_hiss_gain(float hiss) {
  return clampf(hiss, 0.0f, 1.0f) * 0.028f;
}

float ht_drift_cents(float drift) {
  return 1.5f + clampf(drift, 0.0f, 1.0f) * 7.0f;
}

HtAnalog ht_analog_defaults(void) {
  HtAnalog analog;
  analog.drive = 0.38f;
  analog.warmth = 0.42f;
  analog.wow = 0.32f;
  analog.flutter = 0.22f;
  analog.hiss = 0.1f;
  analog.drift = 0.45f;
  analog.mix = 0.45f;
  return analog;
}

float ht_pipe_feedback_cap(uint8_t engine, float sharp) {
  float amount = clampf(sharp, 0.0f, 1.0f);
  if (engine == HT_ENGINE_DIDGERIDOO) {
    return fminf(0.62f, 0.52f + amount * 0.08f);
  }
  if (engine == HT_ENGINE_SAXOPHONE) {
    return fminf(0.58f, 0.48f + amount * 0.08f);
  }
  if (engine == HT_ENGINE_VARGAN) {
    return fminf(0.5f, 0.38f + amount * 0.1f);
  }
  /* pipe / default wind */
  return fminf(0.55f, 0.42f + amount * 0.1f);
}

float ht_string_feedback_cap(uint8_t engine, float sharp) {
  float amount = clampf(sharp, 0.0f, 1.0f);
  if (engine == HT_ENGINE_VIOLIN) {
    return fminf(0.88f, 0.82f + amount * 0.05f);
  }
  if (engine == HT_ENGINE_PIANO) {
    return fminf(0.86f, 0.8f + amount * 0.04f);
  }
  /* guitar / karplus */
  return fminf(0.87f, 0.8f + amount * 0.05f);
}

float ht_physical_output_gain(uint8_t engine) {
#ifdef HT_STAGE_NATIVE
  if (engine == HT_ENGINE_VARGAN) {
    return 0.95f;
  }
  if (engine == HT_ENGINE_SAXOPHONE || engine == HT_ENGINE_PIPE) {
    return 0.78f;
  }
  if (ht_engine_is_wind(engine)) {
    return 0.72f;
  }
  if (ht_engine_is_string(engine)) {
    return 0.8f;
  }
  return 1.0f;
#else
  if (engine == HT_ENGINE_VARGAN) {
    return 0.72f;
  }
  if (engine == HT_ENGINE_SAXOPHONE || engine == HT_ENGINE_PIPE) {
    return 0.55f;
  }
  if (ht_engine_is_wind(engine)) {
    return 0.48f;
  }
  if (ht_engine_is_string(engine)) {
    return 0.55f;
  }
  return 1.0f;
#endif
}
