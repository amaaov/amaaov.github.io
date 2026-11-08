#ifndef HT_FX_H
#define HT_FX_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Mirrors js/ht_fx.js — portable HT court FX maps for DSP wiring. */

#define HT_TAPE_LOOP_MAXIMUM_SECONDS 30.0f
#define HT_LFO_DEST_COUNT 5
#define HT_LFO_SHAPE_COUNT 4

typedef struct HtEnvelope {
  float attack;
  float decay;
  float sustain;
  float release;
  float filter_env;
} HtEnvelope;

typedef struct HtTapePlan {
  float tape_speed;
  float tape_loop_seconds;
  float tape_wet;
  uint8_t tape_recording;
  uint8_t tape_held;
} HtTapePlan;

typedef struct HtScatterPlan {
  float time;
  float gain;
  float feedback;
  float duck;
} HtScatterPlan;

HtEnvelope ht_envelope_from_env_knob(float value);

typedef struct HtDrumEnvelopes {
  HtEnvelope kick;
  HtEnvelope snare;
  HtEnvelope hat;
} HtDrumEnvelopes;

typedef struct HtGrainPlan {
  float delay_seconds;
  float spray;
  float grain_seconds;
  float density;
  float feedback;
  float mix;
  uint8_t max_grains;
} HtGrainPlan;

uint32_t ht_hash_pattern_seed(const char *source);
HtDrumEnvelopes ht_drum_envelopes_from_seed(uint32_t seed, const char *pattern_source);
HtGrainPlan ht_grain_plan(float amount, float delay_seconds);
uint8_t ht_lfo_destination_from_knob(float value);
uint8_t ht_lfo_shape_from_knob(float value);
float ht_scatter_from_fx_knob(float value);
float ht_eq_shelf_gain(float unit);
float ht_tape_speed_rate(float unit);
float ht_tape_loop_seconds(float seconds);
HtTapePlan ht_tape_plan(float tape_seconds, float tape_dry, float speed, uint8_t recording,
                        uint8_t held, uint8_t silent);
HtScatterPlan ht_scatter_plan(float amount, float time_seconds);
float ht_envelope_level(float age, const HtEnvelope *envelope, uint8_t released);

/* Analog-character amount maps — mirrors js/analog_character.js (DSP wiring later). */
typedef struct HtAnalog {
  float drive;
  float warmth;
  float wow;
  float flutter;
  float hiss;
  float drift;
  float mix;
} HtAnalog;

HtAnalog ht_analog_defaults(void);
float ht_warmth_cutoff_hz(float warmth, float sample_rate);
float ht_wow_depth_seconds(float wow);
float ht_flutter_depth_seconds(float flutter);
float ht_hiss_gain(float hiss);
float ht_drift_cents(float drift);

/* Physical-model feedback ceilings — mirrors js/pipe_synth.js + string_synth.js. */
float ht_pipe_feedback_cap(uint8_t engine, float sharp);
float ht_string_feedback_cap(uint8_t engine, float sharp);
float ht_physical_output_gain(uint8_t engine);

#ifdef __cplusplus
}
#endif

#endif
