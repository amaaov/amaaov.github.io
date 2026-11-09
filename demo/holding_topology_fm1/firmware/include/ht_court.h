#ifndef HT_COURT_H
#define HT_COURT_H

#include <stdint.h>
#include "ht_mix.h"

#ifdef __cplusplus
extern "C" {
#endif

#define HT_COURT_WIDTH 240
#define HT_COURT_HEIGHT 240

/* 240x240 RGB565 strip API for the FM-1 LCD.
 * Browser: demo/.../js/pixel_court.js (ImageData pixels).
 * Device: same scene — hands, props, short trails, optional cosmology pixels.
 */
typedef struct HtCourtFrame {
  float time_beat;
  const char *siteswap;
  const char *hand_style;
  float dwell_ratio;
  uint8_t hold_twos;
  uint8_t cosmology;
  float sun;
  float moon;
  float storm;
  float chaos;
  float feedback;
  /* Prop / rest state for mix silence (js/instrument silenceMode). */
  uint8_t airborne_count;
  uint8_t hand_hold_count;
  uint8_t episode_wait;
  uint8_t episode_gap; /* 1 → gap during wait; 0 → tail */
} HtCourtFrame;

/* True only on episode rests — empty court during play stays open (JS parity). */
int ht_court_is_silent(const HtCourtFrame *frame);

/* open / tail / gap from wait flags. */
HtSilenceMode ht_court_silence_mode(const HtCourtFrame *frame);

/* Gain target for feedback_mix courtGate. */
float ht_court_gate_amount(const HtCourtFrame *frame);

void ht_court_clear_trails(void);
void ht_court_push_trail(const HtCourtFrame *frame);
void ht_court_draw_frame(uint16_t *rgb565_row, int row_y, const HtCourtFrame *frame);

#ifdef __cplusplus
}
#endif

#endif
