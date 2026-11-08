#include "ht_court.h"

#include "ht_hand_style.h"
#include "ht_siteswap.h"

#include <math.h>

int ht_court_is_silent(const HtCourtFrame *frame) {
  if (!frame) {
    return 1;
  }
  return frame->episode_wait ? 1 : 0;
}

HtSilenceMode ht_court_silence_mode(const HtCourtFrame *frame) {
  if (!frame || !frame->episode_wait) {
    return HT_SILENCE_OPEN;
  }
  return frame->episode_gap ? HT_SILENCE_GAP : HT_SILENCE_TAIL;
}

float ht_court_gate_amount(const HtCourtFrame *frame) {
  HtSilenceMode mode = ht_court_silence_mode(frame);
  if (mode == HT_SILENCE_GAP) {
    return 0.02f;
  }
  if (mode == HT_SILENCE_TAIL) {
    return 0.85f;
  }
  return 1.0f;
}

static uint16_t rgb565(uint8_t r, uint8_t g, uint8_t b) {
  return (uint16_t)(((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3));
}

static void plot_dot(uint16_t *row, int row_y, int bx, int by, int size, uint16_t color) {
  int x;
  if (row_y < by || row_y >= by + size) {
    return;
  }
  for (x = bx; x < bx + size && x < HT_COURT_WIDTH; x += 1) {
    if (x >= 0) {
      row[x] = color;
    }
  }
}

void ht_court_draw_frame(uint16_t *rgb565_row, int row_y, const HtCourtFrame *frame) {
  uint16_t fill;
  uint8_t shade;
  int x;
  HtSiteswapSchedule schedule;
  HtHandStyle style;
  int have_style = 0;
  if (!rgb565_row || row_y < 0 || row_y >= HT_COURT_HEIGHT) {
    return;
  }
  shade = 16;
  if (frame && frame->cosmology) {
    shade = (uint8_t)(16 + (int)(frame->storm * 20.0f) + (int)(frame->moon * 10.0f));
  }
  fill = rgb565(shade, (uint8_t)(shade + 8), (uint8_t)(shade + 4));
  for (x = 0; x < HT_COURT_WIDTH; x += 1) {
    rgb565_row[x] = fill;
  }
  if (row_y >= 198 && row_y <= 202) {
    uint16_t floor = rgb565(48, 64, 56);
    for (x = 20; x < 220; x += 1) {
      rgb565_row[x] = floor;
    }
  }
  if (!frame || frame->episode_wait) {
    return;
  }

  /* Hands */
  {
    float left_x = 0.32f;
    float left_y = 0.82f;
    float right_x = 0.68f;
    float right_y = 0.82f;
    if (frame->hand_style && ht_hand_style_parse(frame->hand_style, &style)) {
      HtHandPose left = ht_hand_style_sample(&style, 0, frame->time_beat, 0.5f);
      HtHandPose right = ht_hand_style_sample(&style, 1, frame->time_beat, 0.5f);
      have_style = 1;
      if (left.valid) {
        left_x = 0.32f + left.x;
        left_y = 0.82f + left.y;
      }
      if (right.valid) {
        right_x = 0.68f + right.x;
        right_y = 0.82f + right.y;
      }
    }
    plot_dot(rgb565_row, row_y, (int)(left_x * HT_COURT_WIDTH) - 4,
             (int)(left_y * HT_COURT_HEIGHT) - 4, 8, rgb565(180, 200, 220));
    plot_dot(rgb565_row, row_y, (int)(right_x * HT_COURT_WIDTH) - 4,
             (int)(right_y * HT_COURT_HEIGHT) - 4, 8, rgb565(180, 200, 220));
    (void)have_style;
  }

  if (frame->siteswap &&
      ht_siteswap_schedule(frame->siteswap, frame->hold_twos, (int16_t)(frame->time_beat + 8),
                           &schedule) == HT_SS_OK) {
    uint16_t ball = rgb565(242, 160, 64);
    uint16_t i;
    float dwell = frame->dwell_ratio > 0.05f ? frame->dwell_ratio : 0.5f;
    for (i = 0; i < schedule.event_count; i += 1) {
      const HtSiteswapEvent *ev = &schedule.events[i];
      float throw_time = (float)ev->beat;
      float flight = ev->hold ? 0.0f : (float)ev->height * (1.0f - dwell);
      float catch_time = throw_time + (ev->hold ? 0.0f : flight);
      float next_throw = throw_time + (float)ev->height;
      float from_x = ev->from_hand ? 0.68f : 0.32f;
      float to_x = ev->to_hand ? 0.68f : 0.32f;
      float px;
      float py;
      if (ev->height == 0) {
        continue;
      }
      if (frame->time_beat < throw_time || frame->time_beat > next_throw + 0.05f) {
        continue;
      }
      if (!ev->hold && frame->time_beat < catch_time) {
        float progress = (frame->time_beat - throw_time) / fmaxf(flight, 1e-3f);
        float lift = 4.0f * progress * (1.0f - progress);
        px = from_x + (to_x - from_x) * progress;
        py = 0.82f - 0.45f * lift * ht_court_gate_amount(frame);
      } else {
        float progress =
            ev->hold ? 0.5f
                     : (frame->time_beat - catch_time) / fmaxf(next_throw - catch_time, 1e-3f);
        px = to_x + (progress - 0.5f) * 0.02f;
        py = 0.78f;
      }
      plot_dot(rgb565_row, row_y, (int)(px * HT_COURT_WIDTH) - 4, (int)(py * HT_COURT_HEIGHT) - 4, 8,
               ball);
    }
  } else {
    /* Fallback dots when pattern cannot schedule. */
    float beat = frame->time_beat;
    uint16_t ball = rgb565(242, 160, 64);
    int ball_index;
    for (ball_index = 0; ball_index < 3; ball_index += 1) {
      float phase = beat * (1.1f + ball_index * 0.17f) + ball_index * 2.1f;
      int bx = 40 + ball_index * 70 + (int)(12.0f * (phase - (float)(int)phase));
      int by = 160 - (int)(ht_court_gate_amount(frame) * 70.0f *
                           (0.5f + 0.5f * ((phase - (float)(int)phase) < 0.5f ? 1.0f : -1.0f)));
      plot_dot(rgb565_row, row_y, bx, by, 8, ball);
    }
  }
}
