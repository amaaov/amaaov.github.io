/* SPDX-License-Identifier: MIT
 * Patch-time voice engine assignment — mirrors js/rnd_patch.js pickVoiceEngine. */
#ifndef HT_ENGINE_ASSIGN_H
#define HT_ENGINE_ASSIGN_H

#include <stdint.h>

#include "ht_patch.h"

#ifdef __cplusplus
extern "C" {
#endif

#ifndef HT_ENGINE_ASSIGN_SLOTS
#define HT_ENGINE_ASSIGN_SLOTS 6
#endif

typedef struct HtEngineAssign {
  uint8_t engines[HT_ENGINE_ASSIGN_SLOTS];
  uint8_t count;
  uint8_t timbre_profile; /* HtTimbreProfile */
  uint8_t patch_type;     /* HtPatchType */
} HtEngineAssign;

/* Deterministic PRNG step (xorshift-ish). */
uint32_t ht_engine_assign_next(uint32_t *state);

/* Soft timbre from seed (same catalog as TIMBRE_PROFILES). */
uint8_t ht_timbre_from_seed(uint32_t seed);

/* Fill assign->engines[0..count) like pickVoiceEngine + ensureEngineSpread. */
void ht_engine_assign_voices(HtEngineAssign *assign, uint32_t seed, uint8_t patch_type,
                             float wildness, uint8_t slot_count);

/* Round-robin / hash pick among assigned melodic engines. */
uint8_t ht_engine_assign_pick(const HtEngineAssign *assign, uint32_t salt);

#ifdef __cplusplus
}
#endif

#endif
