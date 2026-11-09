#include "ht_court.h"

#include "ht_hand_style.h"
#include "ht_siteswap.h"

#include <math.h>
#include <string.h>

#define HT_COURT_TRAIL 18
#define HT_COURT_PROP_MAX 8
#define HT_COURT_HAND_MAX 3
#define HT_COURT_PEAK_LIFT 0.56f
#define HT_COURT_MULTIPLEX 0.038f
#define HT_COURT_EMPTY_RECOVER 1.15f
#define HT_COURT_REST_LX 0.32f
#define HT_COURT_REST_RX 0.68f
#define HT_COURT_REST_Y 0.82f
#define HT_COURT_THIRD_X 0.50f
#define HT_COURT_THIRD_Y 0.52f
#define HT_COURT_PI 3.14159265f

typedef struct {
  float x;
  float y;
} HtCourtVec;

typedef struct {
  uint8_t count;
  uint8_t hand_count;
  uint8_t x[HT_COURT_PROP_MAX];
  uint8_t y[HT_COURT_PROP_MAX];
  uint8_t held[HT_COURT_PROP_MAX];
  uint8_t abandoned[HT_COURT_PROP_MAX];
  uint8_t hand_x[HT_COURT_HAND_MAX];
  uint8_t hand_y[HT_COURT_HAND_MAX];
} HtCourtSnap;

static HtCourtSnap court_trails[HT_COURT_TRAIL];
static uint8_t court_trail_count;
static uint8_t court_trail_write;
static float court_trail_last_beat = -999.0f;
static HtCourtSnap court_last_live;
static uint8_t court_last_live_valid;

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
static float ht_fminf(float a, float b) { return a < b ? a : b; }
static float ht_clampf(float v, float lo, float hi) {
  if (v < lo) {
    return lo;
  }
  if (v > hi) {
    return hi;
  }
  return v;
}

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

static void plot_ball(uint16_t *row, int row_y, int cx, int cy, uint8_t held, uint8_t abandoned) {
  uint16_t shade;
  uint16_t mid;
  uint16_t light;
  if (abandoned) {
    shade = rgb565(70, 66, 60);
    mid = rgb565(96, 90, 84);
    light = rgb565(140, 132, 120);
  } else if (held) {
    shade = rgb565(150, 50, 24);
    mid = rgb565(220, 96, 48);
    light = rgb565(255, 180, 120);
  } else {
    shade = rgb565(28, 100, 124);
    mid = rgb565(64, 168, 196);
    light = rgb565(160, 220, 236);
  }
  plot_disk(row, row_y, cx, cy, 5, shade);
  plot_disk(row, row_y, cx, cy, 4, mid);
  plot_disk(row, row_y, cx - 1, cy - 2, 2, light);
  plot_px(row, row_y, cx - 2, cy - 3, light);
}

static float throw_flight(uint8_t height, float dwell_ratio, uint8_t hold_twos) {
  float shannon;
  float ceiling;
  if (height == 0) {
    return 0.0f;
  }
  if (height == 2 && hold_twos) {
    return 0.0f;
  }
  shannon = (float)height - 2.0f * dwell_ratio;
  if (shannon >= 0.5f) {
    return shannon;
  }
  ceiling = ht_fmaxf((float)height - 0.15f, 0.2f);
  return ht_fminf(0.5f, ceiling);
}

static float gravity_for_flight(float flight) {
  float duration = ht_fmaxf(flight, 0.25f);
  return (HT_COURT_PEAK_LIFT * 8.0f) / (duration * duration);
}

static float ease_in_out(float progress) {
  float clamped = ht_clampf(progress, 0.0f, 1.0f);
  return clamped * clamped * (3.0f - 2.0f * clamped);
}

static float ease_out_cubic(float progress) {
  float t = 1.0f - ht_clampf(progress, 0.0f, 1.0f);
  return 1.0f - t * t * t;
}

static float ease_in_cubic(float progress) {
  float t = ht_clampf(progress, 0.0f, 1.0f);
  return t * t * t;
}

/* Parabolic flight with soft leave/arrive so catch and release match the hands. */
static HtCourtVec ballistic(HtCourtVec from, HtCourtVec to, float progress, float gravity, float flight,
                            float wind_x, float wind_y) {
  float u = ht_clampf(progress, 0.0f, 1.0f);
  float lift = 0.5f * gravity * flight * flight * (u - u * u);
  float gust = 4.0f * u * (1.0f - u);
  HtCourtVec point;
  float leave;
  float arrive;
  float handoff;
  point.x = from.x + (to.x - from.x) * u + wind_x * gust;
  point.y = from.y + (to.y - from.y) * u - lift + wind_y * gust;
  /* First ~12%: ease out of throw hand; last ~12%: ease into catch hand. */
  leave = u < 0.12f ? (1.0f - ease_out_cubic(u / 0.12f)) : 0.0f;
  arrive = u > 0.88f ? ease_in_cubic((u - 0.88f) / 0.12f) : 0.0f;
  handoff = leave + arrive;
  if (handoff > 1e-4f) {
    HtCourtVec anchor = leave >= arrive ? from : to;
    float blend = ht_fminf(handoff, 1.0f) * 0.55f;
    point.x = point.x + (anchor.x - point.x) * blend;
    point.y = point.y + (anchor.y - point.y) * blend;
  }
  return point;
}

static HtCourtVec mix_poses(HtCourtVec from, HtCourtVec to, float blend) {
  HtCourtVec out;
  out.x = from.x + (to.x - from.x) * blend;
  out.y = from.y + (to.y - from.y) * blend;
  return out;
}

static HtCourtVec dwell_point(HtCourtVec from, HtCourtVec to, float progress) {
  float u = ht_clampf(progress, 0.0f, 1.0f);
  /* Soft catch absorb, then carry into the throw release. */
  float eased = ease_in_cubic(ease_in_out(u));
  float dx = to.x - from.x;
  float dy = to.y - from.y;
  float travel = sqrtf(dx * dx + dy * dy);
  float scoop = ht_fminf(0.028f, travel * 0.4f) * sinf(HT_COURT_PI * u);
  HtCourtVec out;
  out.x = from.x + dx * eased;
  out.y = from.y + dy * eased + scoop;
  return out;
}

static HtCourtVec rest_hand(uint8_t hand) {
  HtCourtVec rest;
  rest.x = hand ? HT_COURT_REST_RX : HT_COURT_REST_LX;
  rest.y = HT_COURT_REST_Y;
  return rest;
}

static HtCourtVec catch_pose(uint8_t hand, const HtCourtVec *style) {
  HtCourtVec rest = rest_hand(hand);
  HtCourtVec base;
  float outward = hand == 0 ? -0.045f : 0.045f;
  if (style) {
    base.x = rest.x + style->x;
    base.y = rest.y + style->y;
    return base;
  }
  base.x = rest.x + outward;
  base.y = rest.y - 0.045f;
  return base;
}

static HtCourtVec throw_pose(uint8_t hand, const HtCourtVec *style) {
  HtCourtVec rest = rest_hand(hand);
  HtCourtVec base;
  float inward = hand == 0 ? 0.05f : -0.05f;
  if (style) {
    base.x = rest.x + style->x;
    base.y = rest.y + style->y;
    return base;
  }
  base.x = rest.x + inward;
  base.y = rest.y + 0.02f;
  return base;
}

static HtCourtVec third_hand_pose(float time_beat) {
  HtCourtVec out;
  out.x = HT_COURT_THIRD_X + 0.01f * sinf(HT_COURT_PI * time_beat * 0.35f);
  out.y = HT_COURT_THIRD_Y + 0.012f * sinf(HT_COURT_PI * time_beat * 0.5f);
  return out;
}

static HtCourtVec hold_idle_pose(uint8_t hand, float time_beat) {
  HtCourtVec rest;
  float side;
  float sway;
  HtCourtVec out;
  if (hand >= 2u) {
    return third_hand_pose(time_beat);
  }
  rest = catch_pose(hand, NULL);
  side = hand == 0 ? -1.0f : 1.0f;
  sway = 0.008f * sinf(HT_COURT_PI * time_beat);
  out.x = rest.x + side * sway;
  out.y = rest.y + 0.005f * sinf(HT_COURT_PI * time_beat + 0.5f);
  return out;
}

static int is_leaving_toss(const HtSiteswapEvent *ev) {
  return !ev->hold && ev->height > 0 && !ev->parked;
}

static HtCourtVec hold_carry_pose(uint8_t hand, float time_beat, const HtSiteswapEvent *events,
                                  uint16_t event_count) {
  HtCourtVec idle = hold_idle_pose(hand, time_beat);
  HtCourtVec throw_at = throw_pose(hand, NULL);
  float blend_window = 0.55f;
  float last_release = -1.0e9f;
  float next_release = 1.0e9f;
  float since;
  float until;
  float blend = 0.0f;
  uint16_t i;
  for (i = 0; i < event_count; i += 1) {
    const HtSiteswapEvent *ev = &events[i];
    if (ev->from_hand != hand || !is_leaving_toss(ev)) {
      continue;
    }
    if ((float)ev->beat <= time_beat && (float)ev->beat >= last_release) {
      last_release = (float)ev->beat;
    }
    if ((float)ev->beat > time_beat && (float)ev->beat < next_release) {
      next_release = (float)ev->beat;
    }
  }
  since = time_beat - last_release;
  until = next_release - time_beat;
  if (since >= 0.0f && since < blend_window) {
    blend = 1.0f - since / blend_window;
  }
  if (until >= 0.0f && until < blend_window) {
    blend = ht_fmaxf(blend, 1.0f - until / blend_window);
  }
  return mix_poses(idle, throw_at, ease_in_out(blend));
}

static HtCourtVec empty_hand_pose(uint8_t hand, float time_beat, const HtSiteswapEvent *events,
                                  uint16_t event_count, float dwell_ratio, uint8_t hold_twos) {
  float last_throw = -1.0e9f;
  float next_catch = 1.0e9f;
  uint16_t i;
  float vacant_end;
  float recover_for;
  float progress;
  for (i = 0; i < event_count; i += 1) {
    const HtSiteswapEvent *ev = &events[i];
    float catch_time;
    if (ev->height == 0) {
      continue;
    }
    if (is_leaving_toss(ev) && ev->from_hand == hand && (float)ev->beat <= time_beat &&
        (float)ev->beat >= last_throw) {
      last_throw = (float)ev->beat;
    }
    catch_time = ev->hold ? (float)ev->beat : (float)ev->beat + throw_flight(ev->height, dwell_ratio, hold_twos);
    if (ev->to_hand == hand && catch_time > time_beat && catch_time < next_catch) {
      next_catch = catch_time;
    }
  }
  if (last_throw < -1.0e8f) {
    return rest_hand(hand);
  }
  vacant_end = next_catch < 1.0e8f ? next_catch : last_throw + HT_COURT_EMPTY_RECOVER;
  recover_for = ht_fminf(ht_fmaxf(vacant_end - last_throw, 1e-6f), HT_COURT_EMPTY_RECOVER);
  progress = ht_clampf((time_beat - last_throw) / recover_for, 0.0f, 1.0f);
  /* Hand arrives at the catch early and waits for the prop. */
  return dwell_point(throw_pose(hand, NULL), catch_pose(hand, NULL), ease_out_cubic(progress));
}

static const HtSiteswapEvent *next_event_for_ball(const HtSiteswapEvent *events, uint16_t event_count,
                                                  const HtSiteswapEvent *ev) {
  int16_t landing = (int16_t)(ev->beat + (int16_t)ev->height);
  uint16_t i;
  for (i = 0; i < event_count; i += 1) {
    if (events[i].ball == ev->ball && events[i].beat == landing) {
      return &events[i];
    }
  }
  return NULL;
}

static void style_offsets(const HtCourtFrame *frame, HtCourtVec *left, HtCourtVec *right,
                          uint8_t *have_left, uint8_t *have_right) {
  HtHandStyle style;
  *have_left = 0;
  *have_right = 0;
  left->x = left->y = 0.0f;
  right->x = right->y = 0.0f;
  if (frame->hand_style && ht_hand_style_parse(frame->hand_style, &style)) {
    HtHandPose l = ht_hand_style_sample(&style, 0, frame->time_beat, 0.5f);
    HtHandPose r = ht_hand_style_sample(&style, 1, frame->time_beat, 0.5f);
    if (l.valid) {
      left->x = l.x;
      left->y = l.y;
      *have_left = 1;
    }
    if (r.valid) {
      right->x = r.x;
      right->y = r.y;
      *have_right = 1;
    }
  }
}

static int pattern_has_third_hand(const HtCourtFrame *frame) {
  const char *p;
  if (frame->third_hand) {
    return 1;
  }
  if (!frame->siteswap) {
    return 0;
  }
  for (p = frame->siteswap; *p; p += 1) {
    if (*p == '+') {
      return 1;
    }
  }
  return 0;
}

static void append_prop(HtCourtSnap *snap, float px, float py, uint8_t held, uint8_t abandoned) {
  if (snap->count >= HT_COURT_PROP_MAX) {
    return;
  }
  snap->x[snap->count] = (uint8_t)map_x(px);
  snap->y[snap->count] = (uint8_t)map_y(py);
  snap->held[snap->count] = held;
  snap->abandoned[snap->count] = abandoned;
  snap->count = (uint8_t)(snap->count + 1u);
}

static void store_hand(HtCourtSnap *snap, uint8_t index, HtCourtVec pose) {
  if (index >= HT_COURT_HAND_MAX) {
    return;
  }
  snap->hand_x[index] = (uint8_t)map_x(pose.x);
  snap->hand_y[index] = (uint8_t)map_y(pose.y);
}

static void capture_abandoned(HtCourtSnap *snap) {
  uint8_t i;
  snap->count = 0;
  snap->hand_count = court_last_live_valid ? court_last_live.hand_count : 2;
  if (court_last_live_valid) {
    for (i = 0; i < snap->hand_count && i < HT_COURT_HAND_MAX; i += 1) {
      snap->hand_x[i] = court_last_live.hand_x[i];
      snap->hand_y[i] = court_last_live.hand_y[i];
    }
    for (i = 0; i < court_last_live.count && snap->count < HT_COURT_PROP_MAX; i += 1) {
      snap->x[snap->count] = court_last_live.x[i];
      snap->y[snap->count] = court_last_live.y[i];
      snap->held[snap->count] = 0;
      snap->abandoned[snap->count] = 1;
      snap->count = (uint8_t)(snap->count + 1u);
    }
  } else {
    store_hand(snap, 0, rest_hand(0));
    store_hand(snap, 1, rest_hand(1));
  }
}

static void capture_snap(const HtCourtFrame *frame, HtCourtSnap *snap) {
  HtSiteswapSchedule schedule;
  HtCourtVec style_l;
  HtCourtVec style_r;
  uint8_t have_l;
  uint8_t have_r;
  HtCourtVec hand_now[2];
  uint8_t occupied[2];
  float dwell;
  float max_flight;
  float gravity;
  float wind_x;
  float wind_y;
  uint8_t third;
  uint16_t i;
  typedef struct {
    float x;
    float y;
    uint8_t held;
    uint8_t hand;
    uint8_t abandoned;
    uint8_t visible;
  } PropState;
  PropState props[HT_SITESWAP_MAX_BALLS];
  uint8_t ball_count;
  uint8_t held_slots[2];

  memset(snap, 0, sizeof(*snap));
  if (frame->episode_wait) {
    capture_abandoned(snap);
    return;
  }

  style_offsets(frame, &style_l, &style_r, &have_l, &have_r);
  dwell = frame->dwell_ratio > 0.05f ? frame->dwell_ratio : 0.5f;
  wind_x = frame->storm * 0.04f * (frame->chaos - 0.5f);
  wind_y = frame->storm * 0.02f;
  third = pattern_has_third_hand(frame) ? 1u : 0u;
  hand_now[0] = rest_hand(0);
  hand_now[1] = rest_hand(1);
  occupied[0] = occupied[1] = 0;
  held_slots[0] = held_slots[1] = 0;

  if (!frame->siteswap ||
      ht_siteswap_schedule_playable(frame->siteswap, frame->hold_twos,
                                    (int16_t)(frame->time_beat + 16), &schedule) != HT_SS_OK) {
    /* Unreadable source → empty court (JS emptyCourtPicture), not a fake cascade. */
    store_hand(snap, 0, rest_hand(0));
    store_hand(snap, 1, rest_hand(1));
    snap->hand_count = 2;
    court_last_live = *snap;
    court_last_live_valid = 1;
    return;
  }

  ball_count = schedule.ball_count;
  if (ball_count > HT_SITESWAP_MAX_BALLS) {
    ball_count = HT_SITESWAP_MAX_BALLS;
  }
  memset(props, 0, sizeof(props));
  max_flight = 0.3f;
  for (i = 0; i < schedule.event_count; i += 1) {
    float flight = throw_flight(schedule.events[i].height, dwell, frame->hold_twos);
    if (flight > max_flight) {
      max_flight = flight;
    }
  }
  gravity = gravity_for_flight(max_flight) / ht_fmaxf(0.35f, 1.0f - frame->storm * 0.25f);

  for (i = 0; i < schedule.event_count; i += 1) {
    const HtSiteswapEvent *ev = &schedule.events[i];
    float flight;
    float throw_time;
    float catch_time;
    float next_throw;
    float dump_at;
    float floor_y;
    const HtCourtVec *from_style;
    const HtCourtVec *to_style;
    HtCourtVec from;
    HtCourtVec to;
    uint8_t ball;
    if (ev->ball >= HT_SITESWAP_MAX_BALLS) {
      continue;
    }
    if (ev->height == 0 && !ev->dump) {
      continue;
    }
    ball = ev->ball;
    flight = throw_flight(ev->height, dwell, frame->hold_twos);
    throw_time = (float)ev->beat;
    catch_time = ev->hold ? throw_time : throw_time + flight;
    next_throw = throw_time + (float)(ev->height > 0 ? ev->height : 1);
    dump_at = ev->height > 0 ? throw_time + (float)ev->height : throw_time;
    if (ev->dump && frame->time_beat >= dump_at) {
      props[ball].visible = 0;
      continue;
    }
    from_style = ev->from_hand ? (have_r ? &style_r : NULL) : (have_l ? &style_l : NULL);
    to_style = ev->to_hand ? (have_r ? &style_r : NULL) : (have_l ? &style_l : NULL);
    from = throw_pose(ev->from_hand, from_style);
    to = catch_pose(ev->to_hand, to_style);
    floor_y = ht_fmaxf(HT_COURT_REST_Y, HT_COURT_REST_Y) + 0.12f;
    if (ev->drop) {
      HtCourtVec floor;
      float fall;
      if (frame->time_beat < throw_time) {
        continue;
      }
      floor.x = (from.x + to.x) * 0.5f;
      floor.y = floor_y;
      fall = ht_fmaxf(flight, 0.35f);
      if (frame->time_beat < throw_time + fall) {
        float progress = (frame->time_beat - throw_time) / fall;
        HtCourtVec point = ballistic(from, floor, progress, gravity, fall, wind_x, wind_y);
        props[ball].x = point.x;
        props[ball].y = point.y;
      } else {
        props[ball].x = floor.x;
        props[ball].y = floor.y;
      }
      props[ball].held = 0;
      props[ball].hand = ev->from_hand;
      props[ball].abandoned = 1;
      props[ball].visible = 1;
      continue;
    }
    if (frame->time_beat < throw_time || frame->time_beat >= next_throw) {
      continue;
    }
    if (!ev->hold && frame->time_beat < catch_time) {
      float progress = (frame->time_beat - throw_time) / ht_fmaxf(flight, 1e-6f);
      float remain = ht_clampf((catch_time - frame->time_beat) / ht_fmaxf(flight, 1e-6f), 0.0f, 1.0f);
      float gate_dip = (1.0f - ht_court_gate_amount(frame)) * 0.08f * remain;
      HtCourtVec point = ballistic(from, to, progress, gravity, flight, wind_x, wind_y);
      /* Gate dip fades to zero at catch so the handoff stays continuous. */
      point.y -= gate_dip;
      props[ball].x = point.x;
      props[ball].y = point.y;
      props[ball].held = 0;
      props[ball].hand = ev->from_hand;
      props[ball].abandoned = 0;
      props[ball].visible = 1;
      /* Receiving hand tracks the incoming prop near the catch. */
      if (remain < 0.35f && !occupied[ev->to_hand] && ev->to_hand < 2) {
        float meet = 1.0f - remain / 0.35f;
        HtCourtVec waiting = catch_pose(ev->to_hand, to_style);
        hand_now[ev->to_hand].x = waiting.x + (point.x - waiting.x) * meet * 0.35f;
        hand_now[ev->to_hand].y = waiting.y + (point.y - waiting.y) * meet * 0.35f;
        occupied[ev->to_hand] = 1;
      }
    } else if (ev->hold || ev->parked) {
      uint8_t park_hand = (ev->parked && third) ? 2u : ev->to_hand;
      HtCourtVec point =
          ev->parked ? hold_idle_pose(park_hand, frame->time_beat)
                     : hold_carry_pose(ev->to_hand, frame->time_beat, schedule.events, schedule.event_count);
      props[ball].x = point.x;
      props[ball].y = point.y;
      props[ball].held = 1;
      props[ball].hand = park_hand;
      props[ball].abandoned = 0;
      props[ball].visible = 1;
      if (park_hand < 2u) {
        hand_now[park_hand] = point;
        occupied[park_hand] = 1;
      }
    } else {
      float dwell_span = ht_fmaxf(next_throw - catch_time, 1e-6f);
      float progress = (frame->time_beat - catch_time) / dwell_span;
      const HtSiteswapEvent *following = next_event_for_ball(schedule.events, schedule.event_count, ev);
      HtCourtVec carry_to = following && following->hold
                                ? hold_idle_pose(ev->to_hand, next_throw)
                                : throw_pose(ev->to_hand, to_style);
      HtCourtVec point = dwell_point(to, carry_to, ht_fminf(progress, 1.0f));
      props[ball].x = point.x;
      props[ball].y = point.y;
      props[ball].held = 1;
      props[ball].hand = ev->to_hand;
      props[ball].abandoned = 0;
      props[ball].visible = 1;
      hand_now[ev->to_hand] = point;
      occupied[ev->to_hand] = 1;
    }
  }

  for (i = 0; i < 2; i += 1) {
    if (!occupied[i]) {
      hand_now[i] = empty_hand_pose((uint8_t)i, frame->time_beat, schedule.events, schedule.event_count, dwell,
                                    frame->hold_twos);
    }
  }

  /* Multiplex spread for co-held props in one hand (toss.js spreadHeldInHand). */
  for (i = 0; i < ball_count; i += 1) {
    if (props[i].visible && props[i].held && props[i].hand < 2) {
      held_slots[props[i].hand] = (uint8_t)(held_slots[props[i].hand] + 1u);
    }
  }
  {
    uint8_t seen[2] = {0, 0};
    for (i = 0; i < ball_count; i += 1) {
      uint8_t hand;
      uint8_t group;
      uint8_t slot;
      if (!props[i].visible || !props[i].held || props[i].hand > 1) {
        continue;
      }
      hand = props[i].hand;
      group = held_slots[hand];
      if (group < 2) {
        continue;
      }
      slot = seen[hand];
      seen[hand] = (uint8_t)(seen[hand] + 1u);
      props[i].x += ((float)slot - (float)(group - 1u) * 0.5f) * HT_COURT_MULTIPLEX;
    }
  }

  for (i = 0; i < ball_count; i += 1) {
    if (props[i].visible) {
      append_prop(snap, props[i].x, props[i].y, props[i].held, props[i].abandoned);
    }
  }

  store_hand(snap, 0, hand_now[0]);
  store_hand(snap, 1, hand_now[1]);
  snap->hand_count = 2;
  if (third) {
    /* Third hand holds parked (+) props; silhouette tracks the park pose. */
    store_hand(snap, 2, third_hand_pose(frame->time_beat));
    snap->hand_count = 3;
  }

  court_last_live = *snap;
  court_last_live_valid = 1;
}

void ht_court_clear_trails(void) {
  court_trail_count = 0;
  court_trail_write = 0;
  court_trail_last_beat = -999.0f;
  court_last_live_valid = 0;
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
    uint16_t trail_abandoned = rgb565((uint8_t)(dim / 3), (uint8_t)(dim / 3), (uint8_t)(dim / 2));
    uint8_t p;
    if (age > 14u) {
      continue;
    }
    for (p = 0; p < snap->count; p += 1) {
      uint16_t color =
          snap->abandoned[p] ? trail_abandoned : (snap->held[p] ? trail_held : trail_air);
      plot_px(rgb565_row, row_y, (int)snap->x[p], (int)snap->y[p], color);
      if (age < 6u) {
        plot_px(rgb565_row, row_y, (int)snap->x[p] + 1, (int)snap->y[p], color);
      }
    }
  }

  if (!live_valid) {
    return;
  }

  /* Hands stay visible on rests (JS echoOnly still paints hands). */
  {
    uint8_t h;
    for (h = 0; h < live.hand_count && h < HT_COURT_HAND_MAX; h += 1) {
      plot_hand(rgb565_row, row_y, (int)live.hand_x[h], (int)live.hand_y[h], h == 2 ? 0 : (int)h);
    }
  }
  {
    uint8_t p;
    for (p = 0; p < live.count; p += 1) {
      plot_ball(rgb565_row, row_y, (int)live.x[p], (int)live.y[p], live.held[p], live.abandoned[p]);
    }
  }
}
