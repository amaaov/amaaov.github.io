#include "ht_court.h"

#include "ht_hand_style.h"
#include "ht_siteswap.h"

#define HT_COURT_TRAIL 18
#define HT_COURT_PROP_MAX 8

typedef struct {
  uint8_t count;
  uint8_t x[HT_COURT_PROP_MAX];
  uint8_t y[HT_COURT_PROP_MAX];
  uint8_t held[HT_COURT_PROP_MAX];
  uint8_t hand_x[2];
  uint8_t hand_y[2];
} HtCourtSnap;

static HtCourtSnap court_trails[HT_COURT_TRAIL];
static uint8_t court_trail_count;
static uint8_t court_trail_write;
static float court_trail_last_beat = -999.0f;

/* Palm + fingers + thumb; same silhouette as js/pixel_court.js HAND_LEFT. */
static const int8_t HAND_LEFT[][2] = {
    {0, -6},  {2, -6},  {4, -7},  {6, -6},  {-1, -4}, {1, -4},  {3, -4},  {5, -4},
    {7, -4},  {-2, -2}, {0, -2},  {2, -2},  {4, -2},  {6, -2},  {8, -2},  {-3, 0},
    {-1, 0},  {1, 0},   {3, 0},   {5, 0},   {7, 0},   {-3, 2},  {-1, 2},  {1, 2},
    {3, 2},   {5, 2},   {-2, 4},  {0, 4},   {2, 4},   {4, 4},   {-5, -1}, {-6, 0},
    {-5, 1},
};
#define HAND_LEFT_N (sizeof(HAND_LEFT) / sizeof(HAND_LEFT[0]))

static float ht_fmaxf(float a, float b) { return a > b ? a : b; }

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

/* JS mapPoint: 18 + norm * 204 inside the 240 court. */
static int map_x(float norm) {
  int x = 18 + (int)(norm * 204.0f);
  if (x < 2) {
    return 2;
  }
  if (x > HT_COURT_WIDTH - 3) {
    return HT_COURT_WIDTH - 3;
  }
  return x;
}

static int map_y(float norm) {
  int y = 18 + (int)(norm * 204.0f);
  if (y < 2) {
    return 2;
  }
  if (y > HT_COURT_HEIGHT - 3) {
    return HT_COURT_HEIGHT - 3;
  }
  return y;
}

static void plot_px(uint16_t *row, int row_y, int x, int y, uint16_t color) {
  if (row_y != y || x < 0 || x >= HT_COURT_WIDTH) {
    return;
  }
  row[x] = color;
}

static void plot_disk(uint16_t *row, int row_y, int cx, int cy, int radius, uint16_t color) {
  int dy = row_y - cy;
  int x;
  int r2;
  if (dy < -radius || dy > radius) {
    return;
  }
  r2 = radius * radius;
  for (x = -radius; x <= radius; x += 1) {
    if (x * x + dy * dy <= r2) {
      plot_px(row, row_y, cx + x, row_y, color);
    }
  }
}

static void plot_hand(uint16_t *row, int row_y, int cx, int cy, int hand_index) {
  int i;
  int mirror = hand_index == 1 ? -1 : 1;
  uint16_t hand = rgb565(198, 186, 168);
  uint16_t shade = rgb565(140, 128, 112);
  uint16_t light = rgb565(230, 220, 204);
  for (i = 0; i < (int)HAND_LEFT_N; i += 1) {
    int dx = (int)HAND_LEFT[i][0] * mirror;
    int dy = (int)HAND_LEFT[i][1];
    uint16_t color = dy > 1 || dx < -3 ? shade : (dy < -4 ? light : hand);
    plot_px(row, row_y, cx + dx, cy + dy, color);
    plot_px(row, row_y, cx + dx, cy + dy + 1, color);
  }
}

static void plot_ball(uint16_t *row, int row_y, int cx, int cy, uint8_t held) {
  uint16_t shade = held ? rgb565(150, 50, 24) : rgb565(28, 100, 124);
  uint16_t mid = held ? rgb565(220, 96, 48) : rgb565(64, 168, 196);
  uint16_t light = held ? rgb565(255, 180, 120) : rgb565(160, 220, 236);
  plot_disk(row, row_y, cx, cy, 5, shade);
  plot_disk(row, row_y, cx, cy, 4, mid);
  plot_disk(row, row_y, cx - 1, cy - 2, 2, light);
  plot_px(row, row_y, cx - 2, cy - 3, light);
}

static void sample_hands(const HtCourtFrame *frame, float *left_x, float *left_y, float *right_x,
                         float *right_y) {
  HtHandStyle style;
  *left_x = 0.32f;
  *left_y = 0.82f;
  *right_x = 0.68f;
  *right_y = 0.82f;
  if (frame->hand_style && ht_hand_style_parse(frame->hand_style, &style)) {
    HtHandPose left = ht_hand_style_sample(&style, 0, frame->time_beat, 0.5f);
    HtHandPose right = ht_hand_style_sample(&style, 1, frame->time_beat, 0.5f);
    if (left.valid) {
      *left_x = 0.32f + left.x;
      *left_y = 0.82f + left.y;
    }
    if (right.valid) {
      *right_x = 0.68f + right.x;
      *right_y = 0.82f + right.y;
    }
  }
}

static void append_prop(HtCourtSnap *snap, float px, float py, uint8_t held) {
  if (snap->count >= HT_COURT_PROP_MAX) {
    return;
  }
  snap->x[snap->count] = (uint8_t)map_x(px);
  snap->y[snap->count] = (uint8_t)map_y(py);
  snap->held[snap->count] = held;
  snap->count = (uint8_t)(snap->count + 1u);
}

static void capture_snap(const HtCourtFrame *frame, HtCourtSnap *snap) {
  float left_x;
  float left_y;
  float right_x;
  float right_y;
  HtSiteswapSchedule schedule;
  snap->count = 0;
  sample_hands(frame, &left_x, &left_y, &right_x, &right_y);
  snap->hand_x[0] = (uint8_t)map_x(left_x);
  snap->hand_y[0] = (uint8_t)map_y(left_y);
  snap->hand_x[1] = (uint8_t)map_x(right_x);
  snap->hand_y[1] = (uint8_t)map_y(right_y);

  if (frame->episode_wait) {
    return;
  }
  if (frame->siteswap &&
      ht_siteswap_schedule(frame->siteswap, frame->hold_twos, (int16_t)(frame->time_beat + 16),
                           &schedule) == HT_SS_OK) {
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
      float from_y = 0.78f;
      float to_y = 0.78f;
      float px;
      float py;
      uint8_t held;
      if (ev->height == 0) {
        continue;
      }
      if (frame->time_beat < throw_time - 0.02f || frame->time_beat > next_throw + 0.08f) {
        continue;
      }
      if (!ev->hold && frame->time_beat < catch_time) {
        float progress = (frame->time_beat - throw_time) / ht_fmaxf(flight, 1e-3f);
        float lift = 4.0f * progress * (1.0f - progress);
        if (progress < 0.0f) {
          progress = 0.0f;
        }
        if (progress > 1.0f) {
          progress = 1.0f;
        }
        px = from_x + (to_x - from_x) * progress;
        py = from_y + (to_y - from_y) * progress - 0.42f * lift * ht_court_gate_amount(frame);
        held = 0;
      } else {
        float progress =
            ev->hold ? 0.5f
                     : (frame->time_beat - catch_time) / ht_fmaxf(next_throw - catch_time, 1e-3f);
        if (progress < 0.0f) {
          progress = 0.0f;
        }
        if (progress > 1.0f) {
          progress = 1.0f;
        }
        px = to_x + (progress - 0.5f) * 0.04f;
        py = to_y - 0.02f * progress;
        held = 1;
      }
      append_prop(snap, px, py, held);
    }
  } else {
    /* Cascade fallback when siteswap parse fails — three balls, JS-like arcs. */
    int ball_index;
    float beat = frame->time_beat;
    for (ball_index = 0; ball_index < 3; ball_index += 1) {
      float cycle = 3.0f;
      float phase = beat + (float)ball_index * (cycle / 3.0f);
      float throw_beat = (float)((int)(phase / cycle)) * cycle + (float)ball_index;
      float local = phase - throw_beat;
      float from_x = (ball_index & 1) ? 0.68f : 0.32f;
      float to_x = (ball_index & 1) ? 0.32f : 0.68f;
      float progress = local / cycle;
      float lift = 4.0f * progress * (1.0f - progress);
      float px = from_x + (to_x - from_x) * progress;
      float py = 0.78f - 0.40f * lift;
      append_prop(snap, px, py, 0);
    }
  }
}

void ht_court_clear_trails(void) {
  court_trail_count = 0;
  court_trail_write = 0;
  court_trail_last_beat = -999.0f;
}

void ht_court_push_trail(const HtCourtFrame *frame) {
  HtCourtSnap snap;
  if (!frame) {
    return;
  }
  /* Denser smear on native stage; device keeps 0.04 beat spacing. */
#ifdef HT_STAGE_NATIVE
  if (frame->time_beat - court_trail_last_beat < 0.02f && court_trail_count > 0u) {
    return;
  }
#else
  if (frame->time_beat - court_trail_last_beat < 0.04f && court_trail_count > 0u) {
    return;
  }
#endif
  court_trail_last_beat = frame->time_beat;
  capture_snap(frame, &snap);
  court_trails[court_trail_write] = snap;
  court_trail_write = (uint8_t)((court_trail_write + 1u) % HT_COURT_TRAIL);
  if (court_trail_count < HT_COURT_TRAIL) {
    court_trail_count = (uint8_t)(court_trail_count + 1u);
  }
}

void ht_court_draw_frame(uint16_t *rgb565_row, int row_y, const HtCourtFrame *frame) {
  uint16_t fill;
  uint8_t shade;
  int x;
  uint8_t t;
  static HtCourtSnap live;
  static uint8_t live_valid;
  if (!rgb565_row || row_y < 0 || row_y >= HT_COURT_HEIGHT) {
    return;
  }
  shade = 28;
  if (frame && frame->cosmology) {
    shade = (uint8_t)(14 + (int)(frame->storm * 18.0f) + (int)((1.0f - frame->moon) * 12.0f));
  }
  fill = rgb565(shade, (uint8_t)(shade > 2 ? shade - 2 : shade), (uint8_t)(shade > 4 ? shade - 4 : shade));
  for (x = 0; x < HT_COURT_WIDTH; x += 1) {
    rgb565_row[x] = fill;
  }
  if (!frame) {
    live_valid = 0;
    return;
  }

  if (row_y == 0) {
    capture_snap(frame, &live);
    live_valid = 1;
  }

  /* Faint court frame like JS ink border. */
  if (row_y == 14 || row_y == 225) {
    for (x = 14; x < 226; x += 1) {
      rgb565_row[x] = rgb565(210, 200, 180);
    }
  }
  if (row_y >= 14 && row_y < 226) {
    rgb565_row[14] = rgb565(210, 200, 180);
    rgb565_row[225] = rgb565(210, 200, 180);
  }

  for (t = 0; t < court_trail_count; t += 1) {
    uint8_t index =
        (uint8_t)((court_trail_write + HT_COURT_TRAIL - court_trail_count + t) % HT_COURT_TRAIL);
    const HtCourtSnap *snap = &court_trails[index];
    uint8_t age = (uint8_t)(court_trail_count - 1u - t);
    uint8_t dim = (uint8_t)(24u + (uint8_t)((t * 50u) / (court_trail_count ? court_trail_count : 1u)));
    uint16_t trail_air = rgb565((uint8_t)(dim / 2), dim, (uint8_t)(dim + 20));
    uint16_t trail_held = rgb565((uint8_t)(dim + 40), (uint8_t)(dim / 2), (uint8_t)(dim / 3));
    uint8_t p;
    if (age > 14u) {
      continue;
    }
    for (p = 0; p < snap->count; p += 1) {
      plot_px(rgb565_row, row_y, (int)snap->x[p], (int)snap->y[p],
              snap->held[p] ? trail_held : trail_air);
      if (age < 6u) {
        plot_px(rgb565_row, row_y, (int)snap->x[p] + 1, (int)snap->y[p],
                snap->held[p] ? trail_held : trail_air);
      }
    }
  }

  if (frame->episode_wait || !live_valid) {
    return;
  }

  plot_hand(rgb565_row, row_y, (int)live.hand_x[0], (int)live.hand_y[0], 0);
  plot_hand(rgb565_row, row_y, (int)live.hand_x[1], (int)live.hand_y[1], 1);
  {
    uint8_t p;
    for (p = 0; p < live.count; p += 1) {
      plot_ball(rgb565_row, row_y, (int)live.x[p], (int)live.y[p], live.held[p]);
    }
  }
}
