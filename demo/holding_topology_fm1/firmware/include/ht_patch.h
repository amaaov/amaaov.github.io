#ifndef HT_PATCH_H
#define HT_PATCH_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Keep in lockstep with js/control_map.js VOICE_COUNT and js/rnd_patch.js lists. */
#define HT_VOICE_COUNT 12
#define HT_TRACK_COUNT 4
#define HT_SCALE_COUNT 15
#define HT_PATCH_TYPE_COUNT 12
#define HT_ENGINE_COUNT 23
#define HT_TIMBRE_COUNT 10

typedef enum HtPatchType {
  HT_PATCH_LOOPING = 0,
  HT_PATCH_DRONE = 1,
  HT_PATCH_JINGLE = 2,
  HT_PATCH_CALL_RESPONSE = 3,
  HT_PATCH_CASCADE_CHOIR = 4,
  HT_PATCH_VOWEL_CHANT = 5,
  HT_PATCH_STUTTER = 6,
  HT_PATCH_ORBIT = 7,
  HT_PATCH_EUCLID_GROOVE = 8,
  HT_PATCH_TURING_LINE = 9,
  HT_PATCH_MARKOV_WALK = 10,
  HT_PATCH_ATLAS_DRUMS = 11
} HtPatchType;

typedef enum HtEngine {
  HT_ENGINE_SUBTRACTIVE = 0,
  HT_ENGINE_FM = 1,
  HT_ENGINE_ACID = 2,
  HT_ENGINE_NOISE = 3,
  HT_ENGINE_KARPLUS = 4,
  HT_ENGINE_SUPERSAW = 5,
  HT_ENGINE_ADDITIVE = 6,
  HT_ENGINE_ORGAN = 7,
  HT_ENGINE_VOWEL = 8,
  HT_ENGINE_RING_MOD = 9,
  HT_ENGINE_AM = 10,
  HT_ENGINE_PHASE_DISTORTION = 11,
  HT_ENGINE_WAVESHAPE = 12,
  HT_ENGINE_WAVETABLE = 13,
  HT_ENGINE_GRANULAR = 14,
  HT_ENGINE_PWM = 15,
  HT_ENGINE_PIPE = 16,
  HT_ENGINE_GUITAR = 17,
  HT_ENGINE_VIOLIN = 18,
  HT_ENGINE_PIANO = 19,
  HT_ENGINE_SAXOPHONE = 20,
  HT_ENGINE_DIDGERIDOO = 21,
  HT_ENGINE_VARGAN = 22
} HtEngine;

typedef enum HtTimbreProfile {
  HT_TIMBRE_LYRA_ORGAN = 0,
  HT_TIMBRE_ACID_ROOM = 1,
  HT_TIMBRE_GLASS_PAD = 2,
  HT_TIMBRE_NOISE_RITUAL = 3,
  HT_TIMBRE_CHOIR_CAVE = 4,
  HT_TIMBRE_PULSE_GRID = 5,
  HT_TIMBRE_KARPLUS_HALL = 6,
  HT_TIMBRE_FM_STORM = 7,
  HT_TIMBRE_STRING_COURT = 8,
  HT_TIMBRE_WIND_COURT = 9
} HtTimbreProfile;

typedef enum HtTrackRole {
  HT_TRACK_BASS = 0,
  HT_TRACK_PAD = 1,
  HT_TRACK_LEAD = 2,
  HT_TRACK_PERC = 3
} HtTrackRole;

typedef enum HtGenKind {
  HT_GEN_TURING = 0,
  HT_GEN_EUCLID = 1,
  HT_GEN_MARKOV = 2,
  HT_GEN_MORPH = 3,
  HT_GEN_ATLAS = 4
} HtGenKind;

uint8_t ht_patch_type_from_algorithm(float value);
uint8_t ht_scale_index_from_presets(float value);
int ht_patch_is_generative(uint8_t patch_type);
int ht_engine_is_wind(uint8_t engine);
int ht_engine_is_string(uint8_t engine);
int ht_engine_is_physical(uint8_t engine);

#ifdef __cplusplus
}
#endif

#endif
