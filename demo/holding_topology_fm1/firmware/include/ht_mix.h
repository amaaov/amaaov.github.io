#ifndef HT_MIX_H
#define HT_MIX_H

#include <stdint.h>
#include "ht_patch.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Four-track generative mix — js/mix_composition.js + js/mix_motion.js */

typedef enum HtSilenceMode {
  HT_SILENCE_OPEN = 0,
  HT_SILENCE_TAIL = 1,
  HT_SILENCE_GAP = 2
} HtSilenceMode;

typedef struct HtWeather {
  float storm;
  float chaos;
  float moon;
  float feedback;
} HtWeather;

typedef struct HtTrackMix {
  uint8_t index;
  uint8_t role;
  uint8_t active;
  float level;
  float pan;
  float reverb_send;
  float chain_send;
} HtTrackMix;

typedef struct HtMixGlobals {
  float reverb;
  float feedback;
  float filter_hz;
  float wet;
  float dry;
  float court_gate;
  uint8_t mode; /* HtSilenceMode */
} HtMixGlobals;

typedef struct HtComposition {
  uint8_t active_tracks;
  HtTrackMix tracks[HT_TRACK_COUNT];
  float base_reverb;
  float base_feedback;
  float base_filter_hz;
  float base_return;
} HtComposition;

HtSilenceMode ht_normalize_silence_mode(int silent_flag, HtSilenceMode mode);

void ht_composition_init_default(HtComposition *comp, uint32_t seed, float wildness);
void ht_live_mix_snapshot(const HtComposition *comp, float elapsed_seconds, uint32_t seed,
                          const HtWeather *weather, HtSilenceMode mode,
                          HtTrackMix out[HT_TRACK_COUNT]);
HtMixGlobals ht_live_mix_globals(const HtComposition *comp, const HtWeather *weather,
                                 HtSilenceMode mode);

#ifdef __cplusplus
}
#endif

#endif
