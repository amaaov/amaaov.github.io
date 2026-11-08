#ifndef HT_CONTROLS_H
#define HT_CONTROLS_H

#include <stdint.h>
#include "ht_patch.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Panel state — mirrors js/control_map.js DEFAULT_CONTROLS. */
typedef struct HtControls {
  float master;
  float select;
  float presets;
  float algorithm;
  float knob1;
  float knob2;
  float knob3;
  float knob4;
  float env;
  float lfo;
  float fx;
  float edit;
  float glo;
  uint8_t voice_mute[HT_VOICE_COUNT];
  uint8_t seed_locked;
} HtControls;

/* Soft bias for PLAY — knobs suggest, wildness wanders (js/rnd_patch.js). */
typedef struct HtPatchBias {
  float wildness;
  uint8_t object_count;        /* resolved soft pick */
  uint8_t object_count_prefer; /* KNOB3 suggestion only */
  float throw_bias;
  float bpm;
  float dwell_ratio;
  float total_feedback;
  float lfo_depth;
  float delay_time;
  float scatter;
  float drive;
  uint8_t lfo_destination;
  uint8_t lfo_shape;
  uint8_t patch_type; /* HtPatchType */
  uint8_t scale_index;
} HtPatchBias;

#define HT_BPM_MIN 40.0f
#define HT_BPM_MAX 220.0f

void ht_controls_init(HtControls *controls);
/* Mix host entropy (RTC / ADC / button noise) into a fresh 32-bit seed. */
uint32_t ht_unique_seed(uint32_t entropy);
HtPatchBias ht_bias_from_controls(const HtControls *controls);
/* Prefer is a light pull; seed+wildness roam 3…7 (js softPick). */
uint8_t ht_soft_object_count(uint8_t prefer, uint32_t seed, float wildness, uint8_t exclude);
float ht_bpm_from_tempo_knob(float value);
float ht_tempo_knob_from_bpm(float bpm);
/* Prefer is a light pull; seed+wildness roam HT_BPM_MIN…HT_BPM_MAX (js softAround). */
float ht_soft_bpm(float prefer, uint32_t seed, float wildness);
uint8_t ht_object_count_from_siteswap_knob(float value);
float ht_dwell_from_env_knob(float value);
float ht_feedback_from_knob(float value);
float ht_lfo_depth_from_knob(float value);
float ht_delay_from_fx_knob(float value);
float ht_drive_from_edit_knob(float value);

#ifdef __cplusplus
}
#endif

#endif
