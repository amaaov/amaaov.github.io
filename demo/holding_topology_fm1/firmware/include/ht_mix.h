#ifndef HT_MIX_H
#define HT_MIX_H

#include <stdint.h>
#include "ht_patch.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Four-track generative mix — js/mix_composition.js + js/mix_motion.js */

#define HT_MIX_MAX_SECTIONS 6

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

typedef struct HtMixSection {
  float beats;
  float levels[HT_TRACK_COUNT];
  uint8_t mutes[HT_TRACK_COUNT];
  float pan_offsets[HT_TRACK_COUNT];
  float reverb_sends[HT_TRACK_COUNT];
  float chain_sends[HT_TRACK_COUNT];
  float feedback;
  float reverb;
  float density;
} HtMixSection;

typedef struct HtComposition {
  uint8_t active_tracks;
  HtTrackMix tracks[HT_TRACK_COUNT];
  float base_reverb;
  float base_feedback;
  float base_filter_hz;
  float base_return;
  uint8_t section_count;
  HtMixSection sections[HT_MIX_MAX_SECTIONS];
} HtComposition;

HtSilenceMode ht_normalize_silence_mode(int silent_flag, HtSilenceMode mode);

void ht_composition_init_default(HtComposition *comp, uint32_t seed, float wildness);
/* patch_type shapes section plan (js/mix_composition.js sectionNamesForPatch). */
void ht_composition_init(HtComposition *comp, uint32_t seed, float wildness, uint8_t patch_type);

/* Locate arrangement section at beat; returns 1 when a section is written. */
int ht_composition_section_at_beat(const HtComposition *comp, float beat, HtMixSection *out,
                                   uint8_t *index_out);

void ht_live_mix_snapshot(const HtComposition *comp, float elapsed_seconds, uint32_t seed,
                          const HtWeather *weather, HtSilenceMode mode,
                          HtTrackMix out[HT_TRACK_COUNT]);
/* Same as snapshot, then apply section level/mute/send multipliers at beat. */
void ht_live_mix_snapshot_beat(const HtComposition *comp, float beat, float elapsed_seconds,
                               uint32_t seed, const HtWeather *weather, HtSilenceMode mode,
                               HtTrackMix out[HT_TRACK_COUNT], HtMixSection *section_out);
HtMixGlobals ht_live_mix_globals(const HtComposition *comp, const HtWeather *weather,
                                 HtSilenceMode mode);
/* Globals with section reverb/feedback overrides when section is non-NULL. */
HtMixGlobals ht_live_mix_globals_section(const HtComposition *comp, const HtWeather *weather,
                                         HtSilenceMode mode, const HtMixSection *section);

#ifdef __cplusplus
}
#endif

#endif
