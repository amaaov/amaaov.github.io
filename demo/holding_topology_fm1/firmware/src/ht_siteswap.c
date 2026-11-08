#include "ht_siteswap.h"

#include <ctype.h>
#include <math.h>
#include <string.h>

static int is_space_dot(char c) {
  return c == '.' || c == ' ' || c == '\t' || c == '\n' || c == '\r';
}

static const char *skip_space(const char *p) {
  while (*p && is_space_dot(*p)) {
    p += 1;
  }
  return p;
}

static int solo_lab_reject(const char *source) {
  for (const char *p = source; *p; p += 1) {
    if (*p == '<' || *p == '>' || *p == '|') {
      return 1;
    }
  }
  for (const char *p = source; *p; p += 1) {
    if ((isdigit((unsigned char)p[0]) || p[0] == 'x' || p[0] == 'X') &&
        (p[1] == 'B' || p[1] == 'F' || p[1] == 'H')) {
      return 1;
    }
  }
  return 0;
}

static int parse_height(char c, uint8_t *out) {
  if (c >= '0' && c <= '9') {
    *out = (uint8_t)(c - '0');
    return 0;
  }
  if (c >= 'a' && c <= 'z') {
    *out = (uint8_t)(10 + (c - 'a'));
    return 0;
  }
  return -1;
}

static const char *parse_throw(const char *p, int keep_crossing, HtSiteswapThrow *out) {
  uint8_t height;
  p = skip_space(p);
  if (parse_height(*p, &height) != 0) {
    return NULL;
  }
  p += 1;
  out->height = height;
  out->crossing = (uint8_t)(height % 2);
  if (*p == 'x' || *p == 'X') {
    out->crossing = (uint8_t)(1 - out->crossing);
    p += 1;
  } else if (!keep_crossing && out->crossing) {
    /* async numeric form keeps crossing implicit via height parity */
  }
  if (*p == 'B' || *p == 'F' || *p == 'H') {
    return NULL;
  }
  return p;
}

static const char *parse_hand_throws(const char *p, int keep_crossing, HtSiteswapThrow *buf,
                                     uint8_t *count) {
  *count = 0;
  p = skip_space(p);
  if (*p == '[') {
    p += 1;
    while (*p && *p != ']') {
      p = skip_space(p);
      if (*p == ']') {
        break;
      }
      if (*count >= HT_SITESWAP_MAX_THROWS_PER_HAND) {
        return NULL;
      }
      p = parse_throw(p, keep_crossing, &buf[*count]);
      if (!p) {
        return NULL;
      }
      *count += 1;
    }
    if (*p != ']' || *count == 0) {
      return NULL;
    }
    return p + 1;
  }
  if (*count >= HT_SITESWAP_MAX_THROWS_PER_HAND) {
    return NULL;
  }
  p = parse_throw(p, keep_crossing, &buf[*count]);
  if (!p) {
    return NULL;
  }
  *count = 1;
  return p;
}

static const char *parse_sync_pair(const char *p, HtSiteswapFrame *frame) {
  HtSiteswapThrow left[HT_SITESWAP_MAX_THROWS_PER_HAND];
  HtSiteswapThrow right[HT_SITESWAP_MAX_THROWS_PER_HAND];
  uint8_t left_count = 0;
  uint8_t right_count = 0;
  p = skip_space(p);
  if (*p != '(') {
    return NULL;
  }
  p = parse_hand_throws(p + 1, 1, left, &left_count);
  if (!p) {
    return NULL;
  }
  p = skip_space(p);
  if (*p != ',') {
    return NULL;
  }
  p = parse_hand_throws(p + 1, 1, right, &right_count);
  if (!p) {
    return NULL;
  }
  p = skip_space(p);
  if (*p != ')') {
    return NULL;
  }
  frame->kind = 1;
  frame->forced_hand = 255;
  frame->left_count = left_count;
  frame->right_count = right_count;
  memcpy(frame->left, left, sizeof(HtSiteswapThrow) * left_count);
  memcpy(frame->right, right, sizeof(HtSiteswapThrow) * right_count);
  return p + 1;
}

static void mirror_frame(const HtSiteswapFrame *in, HtSiteswapFrame *out) {
  *out = *in;
  if (in->kind == 1) {
    out->left_count = in->right_count;
    out->right_count = in->left_count;
    memcpy(out->left, in->right, sizeof(HtSiteswapThrow) * in->right_count);
    memcpy(out->right, in->left, sizeof(HtSiteswapThrow) * in->left_count);
  }
  if (in->forced_hand == 0 || in->forced_hand == 1) {
    out->forced_hand = (uint8_t)(1 - in->forced_hand);
  }
}

HtSiteswapError ht_siteswap_parse(const char *source, HtSiteswapPattern *out) {
  char body[HT_SITESWAP_MAX_STRING];
  const char *p;
  int mirrored = 0;
  uint8_t start_hand = 255;
  size_t len;
  if (!source || !out) {
    return HT_SS_ERR_EMPTY;
  }
  memset(out, 0, sizeof(*out));
  out->start_hand = 255;
  if (solo_lab_reject(source)) {
    return HT_SS_ERR_UNSUPPORTED;
  }
  len = strlen(source);
  if (len == 0 || len >= HT_SITESWAP_MAX_STRING) {
    return len == 0 ? HT_SS_ERR_EMPTY : HT_SS_ERR_OVERFLOW;
  }
  memcpy(body, source, len + 1);
  /* trim */
  p = skip_space(body);
  memmove(body, p, strlen(p) + 1);
  len = strlen(body);
  while (len > 0 && is_space_dot(body[len - 1])) {
    body[--len] = 0;
  }
  if (len == 0) {
    return HT_SS_ERR_EMPTY;
  }
  if (body[len - 1] == '*') {
    mirrored = 1;
    body[--len] = 0;
    while (len > 0 && is_space_dot(body[len - 1])) {
      body[--len] = 0;
    }
  }
  p = body;
  if (*p == 'R') {
    start_hand = 1;
    p += 1;
  } else if (*p == 'L') {
    start_hand = 0;
    p += 1;
  }
  p = skip_space(p);
  if (!*p) {
    return HT_SS_ERR_EMPTY;
  }
  while (*p) {
    HtSiteswapFrame frame;
    memset(&frame, 0, sizeof(frame));
    frame.forced_hand = 255;
    p = skip_space(p);
    if (!*p) {
      break;
    }
    if (out->frame_count >= HT_SITESWAP_MAX_FRAMES) {
      return HT_SS_ERR_OVERFLOW;
    }
    if (*p == '(') {
      p = parse_sync_pair(p, &frame);
      if (!p) {
        return HT_SS_ERR_PARSE;
      }
      frame.duration = 2;
      if (*p == '!') {
        frame.duration = 1;
        p += 1;
      }
      out->frames[out->frame_count++] = frame;
      continue;
    }
    if (*p == 'R') {
      frame.forced_hand = 1;
      p += 1;
    } else if (*p == 'L') {
      frame.forced_hand = 0;
      p += 1;
    }
    {
      HtSiteswapThrow throws[HT_SITESWAP_MAX_THROWS_PER_HAND];
      uint8_t count = 0;
      p = parse_hand_throws(p, 0, throws, &count);
      if (!p) {
        return HT_SS_ERR_PARSE;
      }
      frame.kind = 0;
      frame.duration = 1;
      frame.left_count = count;
      memcpy(frame.left, throws, sizeof(HtSiteswapThrow) * count);
      out->frames[out->frame_count++] = frame;
    }
  }
  if (out->frame_count == 0) {
    return HT_SS_ERR_EMPTY;
  }
  if (mirrored) {
    uint8_t base = out->frame_count;
    uint8_t i;
    if ((uint16_t)base * 2u > HT_SITESWAP_MAX_FRAMES) {
      return HT_SS_ERR_OVERFLOW;
    }
    for (i = 0; i < base; i += 1) {
      mirror_frame(&out->frames[i], &out->frames[base + i]);
    }
    out->frame_count = (uint8_t)(base * 2);
  }
  {
    int has_async = 0;
    int has_sync = 0;
    int short_sync = 0;
    int forced = 0;
    uint8_t i;
    for (i = 0; i < out->frame_count; i += 1) {
      if (out->frames[i].kind == 0) {
        has_async = 1;
      } else {
        has_sync = 1;
        if (out->frames[i].duration == 1) {
          short_sync = 1;
        }
      }
      if (out->frames[i].forced_hand != 255) {
        forced = 1;
      }
    }
    if ((has_async && has_sync) || short_sync || forced) {
      out->timing = HT_SS_HYBRID;
    } else if (has_sync) {
      out->timing = HT_SS_SYNC;
    } else {
      out->timing = HT_SS_ASYNC;
    }
  }
  out->start_hand = start_hand;
  return HT_SS_OK;
}

uint8_t ht_siteswap_period(const HtSiteswapPattern *pattern) {
  uint8_t i;
  uint16_t sum = 0;
  if (!pattern) {
    return 0;
  }
  for (i = 0; i < pattern->frame_count; i += 1) {
    sum = (uint16_t)(sum + pattern->frames[i].duration);
  }
  return sum > 255 ? 255 : (uint8_t)sum;
}

static uint16_t sum_heights(const HtSiteswapThrow *throws, uint8_t count) {
  uint16_t sum = 0;
  uint8_t i;
  for (i = 0; i < count; i += 1) {
    sum = (uint16_t)(sum + throws[i].height);
  }
  return sum;
}

float ht_siteswap_ball_count(const HtSiteswapPattern *pattern) {
  uint8_t i;
  uint16_t sum = 0;
  uint16_t duration = 0;
  if (!pattern || pattern->frame_count == 0) {
    return 0;
  }
  for (i = 0; i < pattern->frame_count; i += 1) {
    const HtSiteswapFrame *frame = &pattern->frames[i];
    duration = (uint16_t)(duration + frame->duration);
    if (frame->kind == 1) {
      sum = (uint16_t)(sum + sum_heights(frame->left, frame->left_count) +
                       sum_heights(frame->right, frame->right_count));
    } else {
      sum = (uint16_t)(sum + sum_heights(frame->left, frame->left_count));
    }
  }
  if (duration == 0) {
    return 0;
  }
  return (float)sum / (float)duration;
}

static const HtSiteswapFrame *frame_at_beat(const HtSiteswapPattern *pattern, int beat) {
  uint8_t period = ht_siteswap_period(pattern);
  uint8_t i;
  int local;
  int offset = 0;
  if (period == 0) {
    return NULL;
  }
  local = beat % period;
  if (local < 0) {
    local += period;
  }
  for (i = 0; i < pattern->frame_count; i += 1) {
    if (local == offset) {
      return &pattern->frames[i];
    }
    if (local < offset + pattern->frames[i].duration) {
      return NULL;
    }
    offset += pattern->frames[i].duration;
  }
  return NULL;
}

typedef struct {
  uint8_t slots[HT_SITESWAP_MAX_DEPTH][HT_SITESWAP_MAX_BALLS];
  uint8_t counts[HT_SITESWAP_MAX_DEPTH];
} HandLanding;

static void landing_push(HandLanding *hand, uint8_t height, uint8_t ball) {
  uint8_t idx;
  if (height == 0 || height > HT_SITESWAP_MAX_DEPTH) {
    return;
  }
  idx = (uint8_t)(height - 1);
  if (hand->counts[idx] < HT_SITESWAP_MAX_BALLS) {
    hand->slots[idx][hand->counts[idx]++] = ball;
  }
}

static int landing_take(uint8_t *available, uint8_t *available_count, uint8_t *ball) {
  if (*available_count == 0) {
    return 0;
  }
  *ball = available[0];
  memmove(available, available + 1, (size_t)(*available_count - 1));
  *available_count -= 1;
  return 1;
}

static void advance_hands(HandLanding landing[2], uint8_t available[2][HT_SITESWAP_MAX_BALLS],
                          uint8_t available_count[2]) {
  uint8_t hand;
  uint8_t d;
  for (hand = 0; hand < 2; hand += 1) {
    available_count[hand] = landing[hand].counts[0];
    memcpy(available[hand], landing[hand].slots[0], available_count[hand]);
    for (d = 0; d + 1 < HT_SITESWAP_MAX_DEPTH; d += 1) {
      landing[hand].counts[d] = landing[hand].counts[d + 1];
      memcpy(landing[hand].slots[d], landing[hand].slots[d + 1], landing[hand].counts[d]);
    }
    landing[hand].counts[HT_SITESWAP_MAX_DEPTH - 1] = 0;
  }
}

static HtSiteswapError toss_hand(const HtSiteswapThrow *throws, uint8_t count, HandLanding landing[2],
                                 uint8_t available[2][HT_SITESWAP_MAX_BALLS],
                                 uint8_t available_count[2], uint8_t *intro, uint8_t *intro_count,
                                 uint8_t throw_hand, int16_t beat, uint8_t hold_twos, int record,
                                 HtSiteswapEvent *events, uint16_t *event_count) {
  uint8_t i;
  for (i = 0; i < count; i += 1) {
    uint8_t height = throws[i].height;
    uint8_t crossing = throws[i].crossing;
    uint8_t ball;
    uint8_t catch_hand;
    uint8_t hold;
    if (height == 0) {
      if (available_count[throw_hand] > 0) {
        return HT_SS_ERR_COLLISION;
      }
      continue;
    }
    if (!landing_take(available[throw_hand], &available_count[throw_hand], &ball)) {
      if (*intro_count > 0) {
        ball = intro[0];
        memmove(intro, intro + 1, (size_t)(*intro_count - 1));
        *intro_count -= 1;
      } else {
        return HT_SS_ERR_NO_PROP;
      }
    }
    catch_hand = crossing ? (uint8_t)(1 - throw_hand) : throw_hand;
    hold = (uint8_t)(hold_twos && height == 2 && !crossing);
    if (record) {
      if (*event_count >= HT_SITESWAP_MAX_EVENTS) {
        return HT_SS_ERR_OVERFLOW;
      }
      events[*event_count].beat = beat;
      events[*event_count].height = height;
      events[*event_count].ball = ball;
      events[*event_count].from_hand = throw_hand;
      events[*event_count].to_hand = catch_hand;
      events[*event_count].hold = hold;
      *event_count += 1;
    }
    landing_push(&landing[catch_hand], height, ball);
  }
  return HT_SS_OK;
}

static HtSiteswapError apply_beat(const HtSiteswapPattern *pattern, HandLanding landing[2],
                                  uint8_t available[2][HT_SITESWAP_MAX_BALLS],
                                  uint8_t available_count[2], uint8_t *intro, uint8_t *intro_count,
                                  uint8_t throw_hand, int16_t beat, uint8_t hold_twos, int record,
                                  HtSiteswapEvent *events, uint16_t *event_count) {
  const HtSiteswapFrame *frame = frame_at_beat(pattern, beat);
  HtSiteswapError err;
  uint8_t hand;
  if (!frame) {
    if (available_count[0] || available_count[1]) {
      return HT_SS_ERR_COLLISION;
    }
    return HT_SS_OK;
  }
  if (frame->kind == 1) {
    err = toss_hand(frame->left, frame->left_count, landing, available, available_count, intro,
                    intro_count, 0, beat, hold_twos, record, events, event_count);
    if (err != HT_SS_OK) {
      return err;
    }
    err = toss_hand(frame->right, frame->right_count, landing, available, available_count, intro,
                    intro_count, 1, beat, hold_twos, record, events, event_count);
    if (err != HT_SS_OK) {
      return err;
    }
  } else {
    hand = (frame->forced_hand == 0 || frame->forced_hand == 1) ? frame->forced_hand : throw_hand;
    err = toss_hand(frame->left, frame->left_count, landing, available, available_count, intro,
                    intro_count, hand, beat, hold_twos, record, events, event_count);
    if (err != HT_SS_OK) {
      return err;
    }
  }
  if (available_count[0] || available_count[1]) {
    return HT_SS_ERR_COLLISION;
  }
  return HT_SS_OK;
}

static uint8_t pattern_highest(const HtSiteswapPattern *pattern) {
  uint8_t i;
  uint8_t j;
  uint8_t highest = 0;
  for (i = 0; i < pattern->frame_count; i += 1) {
    const HtSiteswapFrame *frame = &pattern->frames[i];
    for (j = 0; j < frame->left_count; j += 1) {
      if (frame->left[j].height > highest) {
        highest = frame->left[j].height;
      }
    }
    for (j = 0; j < frame->right_count; j += 1) {
      if (frame->right[j].height > highest) {
        highest = frame->right[j].height;
      }
    }
  }
  return highest;
}

HtSiteswapError ht_siteswap_schedule(const char *source, uint8_t hold_twos, int16_t until_beat,
                                     HtSiteswapSchedule *out) {
  HtSiteswapPattern pattern;
  HtSiteswapError err;
  HandLanding landing[2];
  uint8_t available[2][HT_SITESWAP_MAX_BALLS];
  uint8_t available_count[2];
  uint8_t intro[HT_SITESWAP_MAX_BALLS];
  uint8_t intro_count;
  HtSiteswapEvent cycle[HT_SITESWAP_MAX_EVENTS];
  uint16_t cycle_count = 0;
  float balls_f;
  uint8_t ball_count;
  uint8_t period;
  uint8_t highest;
  uint8_t throw_hand = 1;
  int init_complete = 0;
  int16_t beat = 0;
  uint8_t cycle_length = 0;
  int step;
  uint16_t i;
  int copy;
  int swap_hands;
  if (!out) {
    return HT_SS_ERR_EMPTY;
  }
  memset(out, 0, sizeof(*out));
  err = ht_siteswap_parse(source, &pattern);
  if (err != HT_SS_OK) {
    return err;
  }
  balls_f = ht_siteswap_ball_count(&pattern);
  ball_count = (uint8_t)(balls_f + 0.5f);
  if (ball_count < 1 || fabsf(balls_f - (float)ball_count) > 0.001f) {
    return HT_SS_ERR_INVALID;
  }
  period = ht_siteswap_period(&pattern);
  highest = pattern_highest(&pattern);
  if (highest > HT_SITESWAP_MAX_DEPTH) {
    return HT_SS_ERR_OVERFLOW;
  }
  memset(landing, 0, sizeof(landing));
  intro_count = ball_count;
  for (i = 0; i < ball_count; i += 1) {
    intro[i] = (uint8_t)i;
  }
  for (step = 0; step < 2000; step += 1) {
    advance_hands(landing, available, available_count);
    err = apply_beat(&pattern, landing, available, available_count, intro, &intro_count, throw_hand,
                     beat, hold_twos, init_complete, cycle, &cycle_count);
    if (err != HT_SS_OK) {
      return err;
    }
    if (init_complete) {
      if (beat > 0 && (beat % period) == 0) {
        while (cycle_count > 0 && cycle[cycle_count - 1].beat == beat) {
          cycle_count -= 1;
        }
        cycle_length = (uint8_t)beat;
        break;
      }
    } else if (intro_count == 0 && ((beat + 1) % period) == 0) {
      init_complete = 1;
      beat = -1;
      cycle_count = 0;
    }
    beat = (int16_t)(beat + 1);
    throw_hand = (uint8_t)(1 - throw_hand);
  }
  if (cycle_length == 0) {
    return HT_SS_ERR_INVALID;
  }
  swap_hands = pattern.start_hand == 1;
  out->ball_count = ball_count;
  out->highest = highest;
  out->period = period;
  out->cycle_length = cycle_length;
  out->timing = pattern.timing;
  out->start_hand = pattern.start_hand == 255 ? 0 : pattern.start_hand;
  for (i = 0; i < cycle_count; i += 1) {
    for (copy = -4; copy <= (until_beat / cycle_length) + 4; copy += 1) {
      int16_t absolute = (int16_t)(cycle[i].beat + copy * cycle_length);
      HtSiteswapEvent ev;
      if (absolute < -highest || absolute > until_beat) {
        continue;
      }
      if (out->event_count >= HT_SITESWAP_MAX_EVENTS) {
        return HT_SS_ERR_OVERFLOW;
      }
      ev = cycle[i];
      ev.beat = absolute;
      if (swap_hands) {
        ev.from_hand = (uint8_t)(1 - ev.from_hand);
        ev.to_hand = (uint8_t)(1 - ev.to_hand);
      }
      out->events[out->event_count++] = ev;
    }
  }
  return HT_SS_OK;
}

int ht_siteswap_valid(const char *source) {
  HtSiteswapSchedule schedule;
  HtSiteswapPattern pattern;
  float balls;
  if (ht_siteswap_parse(source, &pattern) != HT_SS_OK) {
    return 0;
  }
  balls = ht_siteswap_ball_count(&pattern);
  if (fabsf(balls - (float)(uint8_t)(balls + 0.5f)) > 0.001f || balls < 0.999f) {
    return 0;
  }
  return ht_siteswap_schedule(source, 1, (int16_t)(ht_siteswap_period(&pattern) * 4), &schedule) ==
         HT_SS_OK;
}

static uint32_t gen_rand(uint32_t *state) {
  *state += 0x6d2b79f5u;
  uint32_t value = *state;
  value = (value ^ (value >> 15)) * (value | 1u);
  value ^= value + (value ^ (value >> 7)) * (value | 61u);
  return (value ^ (value >> 14));
}

static char height_char(uint8_t height) {
  if (height < 10u) {
    return (char)('0' + height);
  }
  return (char)('a' + (height - 10u));
}

static int append_char(char *out, uint16_t cap, uint16_t *len, char ch) {
  if (*len + 1u >= cap) {
    return 0;
  }
  out[(*len)++] = ch;
  out[*len] = 0;
  return 1;
}

static void write_trivial(const HtSiteswapGenParams *params, char *out, uint16_t cap) {
  uint16_t len = 0;
  out[0] = 0;
  if (params->timing == HT_SS_SYNC || params->family == HT_SS_FAMILY_FOUNTAIN ||
      params->family == HT_SS_FAMILY_BOX || params->family == HT_SS_FAMILY_COLUMNS) {
    uint8_t high = (uint8_t)(params->object_count + (params->object_count & 1u));
    uint8_t low = (uint8_t)(params->object_count * 2u - high);
    append_char(out, cap, &len, '(');
    append_char(out, cap, &len, height_char(high));
    append_char(out, cap, &len, ',');
    append_char(out, cap, &len, height_char(low));
    append_char(out, cap, &len, ')');
    return;
  }
  append_char(out, cap, &len, height_char(params->object_count));
}

static int emit_async(char *out, uint16_t cap, const uint8_t *heights, uint8_t period) {
  uint16_t len = 0;
  uint8_t i;
  out[0] = 0;
  for (i = 0; i < period; i += 1) {
    if (!append_char(out, cap, &len, height_char(heights[i]))) {
      return 0;
    }
  }
  return 1;
}

static int emit_sync_pairs(char *out, uint16_t cap, const uint8_t *left, const uint8_t *right,
                           const uint8_t *left_x, const uint8_t *right_x, uint8_t pairs) {
  uint16_t len = 0;
  uint8_t i;
  out[0] = 0;
  for (i = 0; i < pairs; i += 1) {
    if (!append_char(out, cap, &len, '(') || !append_char(out, cap, &len, height_char(left[i]))) {
      return 0;
    }
    if (left_x[i] && !append_char(out, cap, &len, 'x')) {
      return 0;
    }
    if (!append_char(out, cap, &len, ',') || !append_char(out, cap, &len, height_char(right[i]))) {
      return 0;
    }
    if (right_x[i] && !append_char(out, cap, &len, 'x')) {
      return 0;
    }
    if (!append_char(out, cap, &len, ')')) {
      return 0;
    }
  }
  return 1;
}

static uint8_t rand_height(uint32_t *state, uint8_t min_throw, uint8_t max_throw, int allow_zero) {
  uint8_t span;
  uint8_t value;
  if (allow_zero && (gen_rand(state) & 7u) == 0u) {
    return 0;
  }
  if (max_throw < min_throw) {
    return min_throw;
  }
  span = (uint8_t)(max_throw - min_throw + 1u);
  value = (uint8_t)(min_throw + (gen_rand(state) % span));
  return value;
}

static uint8_t even_height(int value) {
  int rounded = value < 0 ? 0 : value;
  if (rounded & 1) {
    rounded += 1;
  }
  if (rounded > 35) {
    rounded = 34;
  }
  return (uint8_t)rounded;
}

static int copy_if_valid(const char *source, uint8_t objects, char *out, uint16_t cap) {
  uint16_t i = 0;
  if (!source || !out || cap < 2u) {
    return 0;
  }
  while (source[i] && i + 1u < cap) {
    out[i] = source[i];
    i += 1;
  }
  out[i] = 0;
  if (!ht_siteswap_valid(out)) {
    return 0;
  }
  {
    HtSiteswapPattern pattern;
    if (ht_siteswap_parse(out, &pattern) != HT_SS_OK) {
      return 0;
    }
    if ((uint8_t)(ht_siteswap_ball_count(&pattern) + 0.5f) != objects) {
      return 0;
    }
  }
  return 1;
}

HtSiteswapError ht_siteswap_construct_family(uint8_t family, uint8_t object_count, uint32_t seed,
                                             char *out, uint16_t cap) {
  uint32_t state = seed ? seed : 1u;
  uint8_t n = object_count < 1u ? 1u : object_count;
  char candidate[HT_SITESWAP_MAX_STRING];
  uint8_t tries;
  if (!out || cap < 4u) {
    return HT_SS_ERR_OVERFLOW;
  }
  if (n > HT_SITESWAP_MAX_BALLS) {
    n = HT_SITESWAP_MAX_BALLS;
  }
  for (tries = 0; tries < 24u; tries += 1) {
    candidate[0] = 0;
    if (family == HT_SS_FAMILY_SHOWER) {
      uint8_t delta = (uint8_t)(1u + (gen_rand(&state) % 4u));
      int high = (int)n + (int)delta;
      int low = (int)n - (int)delta;
      if (high % 2 == 0) {
        high += 1;
        low = (int)(2u * n) - high;
      }
      if (low >= 0 && high <= 35) {
        uint16_t len = 0;
        append_char(candidate, sizeof candidate, &len, height_char((uint8_t)high));
        append_char(candidate, sizeof candidate, &len, height_char((uint8_t)low));
      }
    } else if (family == HT_SS_FAMILY_BOX) {
      uint8_t max_spread = n / 2u;
      uint8_t delta = (uint8_t)(1u + (gen_rand(&state) % (max_spread < 1u ? 1u : max_spread + 1u)));
      uint8_t high = even_height((int)n + (int)delta);
      uint8_t low = even_height((int)(2u * n) - (int)high);
      if (low >= 2u) {
        uint16_t len = 0;
        uint8_t shape = (uint8_t)(gen_rand(&state) & 3u);
        if (shape == 0u) {
          append_char(candidate, sizeof candidate, &len, '(');
          append_char(candidate, sizeof candidate, &len, height_char(high));
          append_char(candidate, sizeof candidate, &len, 'x');
          append_char(candidate, sizeof candidate, &len, ',');
          append_char(candidate, sizeof candidate, &len, height_char(low));
          append_char(candidate, sizeof candidate, &len, 'x');
          append_char(candidate, sizeof candidate, &len, ')');
        } else {
          append_char(candidate, sizeof candidate, &len, '(');
          append_char(candidate, sizeof candidate, &len, height_char(high));
          append_char(candidate, sizeof candidate, &len, 'x');
          append_char(candidate, sizeof candidate, &len, ',');
          append_char(candidate, sizeof candidate, &len, height_char(low));
          append_char(candidate, sizeof candidate, &len, ')');
          append_char(candidate, sizeof candidate, &len, '(');
          append_char(candidate, sizeof candidate, &len, height_char(high));
          append_char(candidate, sizeof candidate, &len, ',');
          append_char(candidate, sizeof candidate, &len, height_char(low));
          append_char(candidate, sizeof candidate, &len, 'x');
          append_char(candidate, sizeof candidate, &len, ')');
        }
      }
    } else if (family == HT_SS_FAMILY_COLUMNS) {
      uint8_t column = even_height((int)(2u + (gen_rand(&state) % (n + 3u))));
      int held = (int)(4u * n) - 2 * (int)column;
      if (held >= 0 && held <= 35 && (held % 2) == 0) {
        uint16_t len = 0;
        uint8_t hold_left = (uint8_t)(gen_rand(&state) & 1u);
        append_char(candidate, sizeof candidate, &len, '(');
        append_char(candidate, sizeof candidate, &len, height_char(column));
        append_char(candidate, sizeof candidate, &len, ',');
        append_char(candidate, sizeof candidate, &len, height_char(column));
        append_char(candidate, sizeof candidate, &len, ')');
        append_char(candidate, sizeof candidate, &len, '(');
        if (hold_left) {
          append_char(candidate, sizeof candidate, &len, '0');
          append_char(candidate, sizeof candidate, &len, ',');
          append_char(candidate, sizeof candidate, &len, height_char((uint8_t)held));
        } else {
          append_char(candidate, sizeof candidate, &len, height_char((uint8_t)held));
          append_char(candidate, sizeof candidate, &len, ',');
          append_char(candidate, sizeof candidate, &len, '0');
        }
        append_char(candidate, sizeof candidate, &len, ')');
      }
    } else if (family == HT_SS_FAMILY_FOUNTAIN) {
      uint8_t high = even_height((int)n + (int)(n & 1u));
      uint8_t low = even_height((int)(2u * n) - (int)high);
      uint16_t len = 0;
      append_char(candidate, sizeof candidate, &len, '(');
      append_char(candidate, sizeof candidate, &len, height_char(high));
      append_char(candidate, sizeof candidate, &len, ',');
      append_char(candidate, sizeof candidate, &len, height_char((n % 2u) == 0u ? high : low));
      append_char(candidate, sizeof candidate, &len, ')');
    } else if (family == HT_SS_FAMILY_MULTIPLEX) {
      /* Period-2 multiplex+singleton: high+low+rest = 2*n. */
      uint8_t high = (uint8_t)(2u + (gen_rand(&state) % (n + 3u)));
      uint8_t low = (uint8_t)(gen_rand(&state) % (high < 1u ? 1u : high));
      int rest = (int)(2u * n) - (int)high - (int)low;
      uint16_t len = 0;
      if (rest >= 0 && rest <= 35) {
        if ((gen_rand(&state) & 1u) == 0u) {
          append_char(candidate, sizeof candidate, &len, '[');
          append_char(candidate, sizeof candidate, &len, height_char(high));
          append_char(candidate, sizeof candidate, &len, height_char(low));
          append_char(candidate, sizeof candidate, &len, ']');
          append_char(candidate, sizeof candidate, &len, height_char((uint8_t)rest));
        } else {
          append_char(candidate, sizeof candidate, &len, height_char((uint8_t)rest));
          append_char(candidate, sizeof candidate, &len, '[');
          append_char(candidate, sizeof candidate, &len, height_char(high));
          append_char(candidate, sizeof candidate, &len, height_char(low));
          append_char(candidate, sizeof candidate, &len, ']');
        }
      } else {
        /* Period-1 multiplex packet: high+low = n. */
        high = (uint8_t)(1u + (gen_rand(&state) % n));
        low = (uint8_t)(n - high);
        append_char(candidate, sizeof candidate, &len, '[');
        append_char(candidate, sizeof candidate, &len, height_char(high));
        append_char(candidate, sizeof candidate, &len, height_char(low));
        append_char(candidate, sizeof candidate, &len, ']');
      }
    } else {
      return HT_SS_ERR_UNSUPPORTED;
    }
    if (candidate[0] && copy_if_valid(candidate, n, out, cap)) {
      return HT_SS_OK;
    }
  }
  return HT_SS_ERR_INVALID;
}

HtSiteswapError ht_siteswap_generate(const HtSiteswapGenParams *params, char *out, uint16_t cap) {
  uint32_t state;
  uint16_t budget;
  uint8_t period;
  uint8_t max_throw;
  uint8_t min_throw;
  uint8_t objects;
  uint8_t family;
  uint8_t timing;
  uint16_t attempt;
  if (!params || !out || cap < 4u) {
    return HT_SS_ERR_OVERFLOW;
  }
  objects = params->object_count < 1u ? 1u : params->object_count;
  if (objects > HT_SITESWAP_MAX_BALLS) {
    objects = HT_SITESWAP_MAX_BALLS;
  }
  family = params->family;
  if (family == HT_SS_FAMILY_SHOWER || family == HT_SS_FAMILY_BOX || family == HT_SS_FAMILY_COLUMNS ||
      family == HT_SS_FAMILY_FOUNTAIN || family == HT_SS_FAMILY_MULTIPLEX) {
    if (ht_siteswap_construct_family(family, objects, params->seed, out, cap) == HT_SS_OK) {
      return HT_SS_OK;
    }
    {
      static const uint8_t siblings[] = {HT_SS_FAMILY_SHOWER, HT_SS_FAMILY_BOX, HT_SS_FAMILY_FOUNTAIN,
                                         HT_SS_FAMILY_COLUMNS, HT_SS_FAMILY_MULTIPLEX};
      uint8_t si;
      uint32_t sibling_seed = params->seed ^ 0x9e3779b9u;
      for (si = 0; si < 5u; si += 1) {
        if (siblings[si] == family) {
          continue;
        }
        if (ht_siteswap_construct_family(siblings[si], objects, sibling_seed + si, out, cap) ==
            HT_SS_OK) {
          return HT_SS_OK;
        }
      }
    }
  }
  timing = params->timing;
  period = params->period < 1u ? objects : params->period;
  if (family == HT_SS_FAMILY_SHOWER) {
    timing = HT_SS_ASYNC;
    period = 2u;
  } else if (family == HT_SS_FAMILY_BOX || family == HT_SS_FAMILY_COLUMNS ||
             family == HT_SS_FAMILY_FOUNTAIN) {
    timing = HT_SS_SYNC;
    if (period < 2u || (period & 1u)) {
      period = family == HT_SS_FAMILY_FOUNTAIN ? 2u : 4u;
    }
  } else if (family == HT_SS_FAMILY_MULTIPLEX) {
    timing = HT_SS_ASYNC;
    if (period < 2u) {
      period = 3u;
    }
  }
  if (timing == HT_SS_SYNC && (period & 1u)) {
    period = (uint8_t)(period + 1u);
  }
  if (period > 16u) {
    period = 16u;
  }
  max_throw = params->max_throw == 0u ? (uint8_t)(objects + 4u) : params->max_throw;
  if (max_throw > 35u) {
    max_throw = 35u;
  }
  min_throw = params->min_throw;
  if (min_throw > max_throw) {
    min_throw = 0u;
  }
  if (family == HT_SS_FAMILY_SHOWER && max_throw < (uint8_t)(objects + 2u)) {
    max_throw = (uint8_t)(objects + 4u);
  }
  budget = params->search_budget == 0u ? 400u : params->search_budget;
  state = params->seed ? params->seed : 1u;

  for (attempt = 0; attempt < budget; attempt += 1) {
    uint16_t target = (uint16_t)objects * (uint16_t)period;
    uint16_t sum = 0;
    uint8_t i;
    if (timing == HT_SS_SYNC) {
      uint8_t pairs = (uint8_t)(period / 2u);
      uint8_t left[8];
      uint8_t right[8];
      uint8_t left_x[8];
      uint8_t right_x[8];
      uint8_t rest = params->rest_slots;
      if (pairs > 8u) {
        pairs = 8u;
      }
      for (i = 0; i < pairs; i += 1) {
        int force_zero = rest > 0 && i == pairs - 1u;
        left_x[i] = 0;
        right_x[i] = 0;
        if (family == HT_SS_FAMILY_BOX) {
          left_x[i] = (uint8_t)((i & 1u) == 0u ? 0u : 1u);
          right_x[i] = (uint8_t)((i & 1u) == 0u ? 1u : 0u);
        }
        if (force_zero) {
          if ((gen_rand(&state) & 1u) == 0u) {
            left[i] = 0;
            right[i] = rand_height(&state, min_throw ? min_throw : 2u, max_throw, 0);
          } else {
            left[i] = rand_height(&state, min_throw ? min_throw : 2u, max_throw, 0);
            right[i] = 0;
          }
          rest = 0;
        } else if (family == HT_SS_FAMILY_COLUMNS && i == pairs - 1u) {
          left[i] = (gen_rand(&state) & 1u) ? 0u : rand_height(&state, 2u, max_throw, 0);
          right[i] = left[i] == 0u ? rand_height(&state, 2u, max_throw, 0) : 0u;
        } else {
          left[i] = rand_height(&state, min_throw, max_throw, family != HT_SS_FAMILY_FOUNTAIN);
          right[i] = rand_height(&state, min_throw, max_throw, family != HT_SS_FAMILY_FOUNTAIN);
          /* Sync packets use even heights; box keeps even with explicit x marks. */
          if (timing == HT_SS_SYNC) {
            left[i] = (uint8_t)(left[i] & ~1u);
            right[i] = (uint8_t)(right[i] & ~1u);
            if (left[i] == 0u && min_throw > 0u) {
              left[i] = (uint8_t)((min_throw + 1u) & ~1u);
            }
            if (right[i] == 0u && min_throw > 0u) {
              right[i] = (uint8_t)((min_throw + 1u) & ~1u);
            }
          }
        }
        sum = (uint16_t)(sum + left[i] + right[i]);
      }
      if (sum != target) {
        int16_t delta = (int16_t)target - (int16_t)sum;
        int16_t adjusted = (int16_t)left[0] + delta;
        if (adjusted < 0) {
          adjusted = 0;
        }
        if (adjusted > max_throw) {
          adjusted = max_throw;
        }
        if (family != HT_SS_FAMILY_BOX && (adjusted & 1) && adjusted > 0) {
          adjusted = (int16_t)(adjusted & ~1);
        }
        left[0] = (uint8_t)adjusted;
      }
      if (!emit_sync_pairs(out, cap, left, right, left_x, right_x, pairs)) {
        return HT_SS_ERR_OVERFLOW;
      }
    } else {
      uint8_t heights[16];
      uint8_t rest = params->rest_slots;
      for (i = 0; i < period; i += 1) {
        if (rest > 0 && i >= period - rest) {
          heights[i] = 0;
        } else {
          heights[i] = rand_height(&state, min_throw, max_throw, 1);
        }
        sum = (uint16_t)(sum + heights[i]);
      }
      if (sum != target) {
        int16_t delta = (int16_t)target - (int16_t)sum;
        int16_t adjusted = (int16_t)heights[0] + delta;
        if (adjusted < 0) {
          adjusted = 0;
        }
        if (adjusted > max_throw) {
          adjusted = max_throw;
        }
        heights[0] = (uint8_t)adjusted;
      }
      if (!emit_async(out, cap, heights, period)) {
        return HT_SS_ERR_OVERFLOW;
      }
    }
    if (ht_siteswap_valid(out)) {
      return HT_SS_OK;
    }
  }
  write_trivial(params, out, cap);
  return ht_siteswap_valid(out) ? HT_SS_OK : HT_SS_ERR_INVALID;
}
