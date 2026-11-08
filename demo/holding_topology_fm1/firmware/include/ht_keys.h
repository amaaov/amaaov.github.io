#ifndef HT_KEYS_H
#define HT_KEYS_H

#include <stdint.h>
#include "ht_patch.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Seeded keyboard roles — mirrors js/key_roles.js (midi 0…26). */

#define HT_KEY_MIDI_COUNT 27
#define HT_KEY_MAX_VOICES 4
#define HT_KEY_MAX_PARAMS 4
#define HT_KEY_PARAM_ID_COUNT 12

typedef enum HtKeyKind {
  HT_KEY_PLAY = 0,
  HT_KEY_MODULATE = 1,
  HT_KEY_COMBO = 2,
  HT_KEY_BURST = 3,
  HT_KEY_MUTE = 4
} HtKeyKind;

typedef enum HtKeyParamId {
  HT_KEY_PARAM_FEEDBACK = 0,
  HT_KEY_PARAM_DELAY = 1,
  HT_KEY_PARAM_DRIVE = 2,
  HT_KEY_PARAM_SCATTER = 3,
  HT_KEY_PARAM_REVERB = 4,
  HT_KEY_PARAM_LFO_DEPTH = 5,
  HT_KEY_PARAM_TEMPO = 6,
  HT_KEY_PARAM_MASTER = 7,
  HT_KEY_PARAM_COMPRESS = 8,
  HT_KEY_PARAM_EQ_HIGH = 9,
  HT_KEY_PARAM_ENV = 10,
  HT_KEY_PARAM_WILD = 11
} HtKeyParamId;

typedef struct HtKeyParam {
  uint8_t id;    /* HtKeyParamId */
  uint8_t pulse; /* 1 = temporary pulse */
  float delta;
} HtKeyParam;

typedef struct HtKeyRole {
  uint8_t midi;
  uint8_t kind; /* HtKeyKind */
  uint8_t voice_count;
  uint8_t voices[HT_KEY_MAX_VOICES];
  uint8_t param_count;
  HtKeyParam params[HT_KEY_MAX_PARAMS];
  uint8_t height;
  uint8_t velocity;
} HtKeyRole;

/* Build the full 27-key map for a patch seed (same RNG family as JS). */
void ht_key_map_build(uint32_t seed, HtKeyRole out[HT_KEY_MIDI_COUNT]);

#ifdef __cplusplus
}
#endif

#endif
