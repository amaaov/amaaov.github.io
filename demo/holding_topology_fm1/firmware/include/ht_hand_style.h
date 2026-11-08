#ifndef HT_HAND_STYLE_H
#define HT_HAND_STYLE_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define HT_HAND_STYLE_MAX_BEATS 12
#define HT_HAND_STYLE_MAX_POINTS 6
#define HT_HAND_STYLE_MAX_STRING 160

typedef struct HtHandPoint {
  float x;
  float y;
  float z;
  uint8_t hold;
  char role; /* 't', 'c', or 0 */
} HtHandPoint;

typedef struct HtHandStyle {
  uint8_t beat_count;
  uint8_t point_counts[HT_HAND_STYLE_MAX_BEATS];
  HtHandPoint points[HT_HAND_STYLE_MAX_BEATS][HT_HAND_STYLE_MAX_POINTS];
} HtHandStyle;

typedef struct HtHandPose {
  float x;
  float y;
  uint8_t at_throw;
  uint8_t at_catch;
  uint8_t valid;
} HtHandPose;

int ht_hand_style_parse(const char *source, HtHandStyle *out);
HtHandPose ht_hand_style_sample(const HtHandStyle *style, uint8_t hand, float time_beat,
                                float progress);

#ifdef __cplusplus
}
#endif

#endif
