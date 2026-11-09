#ifndef HT_SITESWAP_H
#define HT_SITESWAP_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Solo Lab core mirror of pages/.../siteswap.js — fixed buffers for FM-1 SRAM. */

#define HT_SITESWAP_MAX_STRING 96
#define HT_SITESWAP_MAX_FRAMES 48
#define HT_SITESWAP_MAX_THROWS_PER_HAND 4
#define HT_SITESWAP_MAX_EVENTS 256
#define HT_SITESWAP_MAX_BALLS 12
#define HT_SITESWAP_MAX_DEPTH 24

typedef enum HtSiteswapError {
  HT_SS_OK = 0,
  HT_SS_ERR_EMPTY = 1,
  HT_SS_ERR_UNSUPPORTED = 2,
  HT_SS_ERR_PARSE = 3,
  HT_SS_ERR_INVALID = 4,
  HT_SS_ERR_OVERFLOW = 5,
  HT_SS_ERR_NO_PROP = 6,
  HT_SS_ERR_COLLISION = 7
} HtSiteswapError;

typedef enum HtSiteswapTiming {
  HT_SS_ASYNC = 0,
  HT_SS_SYNC = 1,
  HT_SS_HYBRID = 2
} HtSiteswapTiming;

typedef struct HtSiteswapThrow {
  uint8_t height;
  uint8_t crossing; /* 1 = crosses */
  uint8_t add_after; /* siteswap + after this throw → park held object */
  uint8_t remove_after; /* siteswap - after this throw → drop/dump */
} HtSiteswapThrow;

typedef struct HtSiteswapFrame {
  uint8_t kind; /* 0 async, 1 sync */
  uint8_t duration;
  uint8_t forced_hand; /* 0/1 or 255 = none */
  uint8_t left_count;
  uint8_t right_count;
  uint8_t add_before;
  uint8_t remove_before;
  uint8_t add_after;
  uint8_t remove_after;
  HtSiteswapThrow left[HT_SITESWAP_MAX_THROWS_PER_HAND];
  HtSiteswapThrow right[HT_SITESWAP_MAX_THROWS_PER_HAND];
} HtSiteswapFrame;

typedef struct HtSiteswapPattern {
  HtSiteswapTiming timing;
  uint8_t start_hand; /* 0 left, 1 right, 255 default */
  uint8_t frame_count;
  HtSiteswapFrame frames[HT_SITESWAP_MAX_FRAMES];
} HtSiteswapPattern;

typedef struct HtSiteswapEvent {
  int16_t beat;
  uint8_t height;
  uint8_t ball;
  uint8_t from_hand;
  uint8_t to_hand;
  uint8_t hold;
  uint8_t parked; /* 1 → hold from siteswap + (third hand add) */
  uint8_t drop; /* 1 → abandoned flight (− mark / failed catch) */
  uint8_t dump; /* 1 → held object removed after hold (− on a 2) */
  uint8_t failed_catch;
} HtSiteswapEvent;

typedef struct HtSiteswapSchedule {
  uint8_t ball_count;
  uint8_t highest;
  uint8_t period;
  uint8_t cycle_length;
  HtSiteswapTiming timing;
  uint8_t start_hand;
  uint8_t cyclic; /* 1 → repeating siteswap; 0 → linear episode (marks / breaks) */
  int16_t break_beat; /* -1 when unbroken */
  uint16_t event_count;
  HtSiteswapEvent events[HT_SITESWAP_MAX_EVENTS];
} HtSiteswapSchedule;

typedef enum HtSiteswapFamily {
  HT_SS_FAMILY_NONE = 0,
  HT_SS_FAMILY_SHOWER = 1,
  HT_SS_FAMILY_BOX = 2,
  HT_SS_FAMILY_COLUMNS = 3,
  HT_SS_FAMILY_FOUNTAIN = 4,
  HT_SS_FAMILY_MULTIPLEX = 5
} HtSiteswapFamily;

typedef struct HtSiteswapGenParams {
  uint8_t object_count;
  uint8_t period;       /* beats; sync uses even periods */
  uint8_t max_throw;    /* 0..35 */
  uint8_t min_throw;    /* 0 stays allowed for holds */
  uint8_t timing;       /* HtSiteswapTiming; hybrid treated as async here */
  uint8_t family;       /* HtSiteswapFamily — shapes mask, not a pattern shelf */
  uint8_t rest_slots;   /* force this many trailing wildcards to 0 */
  uint16_t search_budget;
  uint32_t seed;
} HtSiteswapGenParams;

HtSiteswapError ht_siteswap_parse(const char *source, HtSiteswapPattern *out);
uint8_t ht_siteswap_period(const HtSiteswapPattern *pattern);
float ht_siteswap_ball_count(const HtSiteswapPattern *pattern);
int ht_siteswap_has_domain(const HtSiteswapPattern *pattern);
int ht_siteswap_valid(const char *source);
HtSiteswapError ht_siteswap_schedule(const char *source, uint8_t hold_twos, int16_t until_beat,
                                     HtSiteswapSchedule *out);
/* Cyclic when valid; else linear episode with +/− parks, drops, and breaks (JS schedulePlayable). */
HtSiteswapError ht_siteswap_schedule_playable(const char *source, uint8_t hold_twos,
                                              int16_t until_beat, HtSiteswapSchedule *out);
/* Parametric family construction (heights from object_count + seed) — no pattern shelf. */
HtSiteswapError ht_siteswap_construct_family(uint8_t family, uint8_t object_count, uint32_t seed,
                                             char *out, uint16_t cap);
/* Construct first for named families; tight random search backup; trivial fallback. */
HtSiteswapError ht_siteswap_generate(const HtSiteswapGenParams *params, char *out, uint16_t cap);

#ifdef __cplusplus
}
#endif

#endif
