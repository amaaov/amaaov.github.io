#include "ht_hand_style.h"

#include <ctype.h>
#include <stdlib.h>
#include <string.h>

static const char *skip_ws(const char *p) {
  while (*p && isspace((unsigned char)*p)) {
    p += 1;
  }
  return p;
}

static const char *parse_number(const char *p, float *out) {
  char *end = NULL;
  float value;
  p = skip_ws(p);
  value = strtof(p, &end);
  if (end == p) {
    return NULL;
  }
  *out = value;
  return end;
}

static const char *parse_coord(const char *p, HtHandPoint *out) {
  float a;
  float b;
  float c;
  memset(out, 0, sizeof(*out));
  p = skip_ws(p);
  if (*p == '-') {
    out->hold = 1;
    return p + 1;
  }
  if (*p != '(') {
    return NULL;
  }
  p = parse_number(p + 1, &a);
  if (!p) {
    return NULL;
  }
  p = skip_ws(p);
  out->x = a;
  if (*p == ',') {
    p = parse_number(p + 1, &b);
    if (!p) {
      return NULL;
    }
    p = skip_ws(p);
    if (*p == ',') {
      p = parse_number(p + 1, &c);
      if (!p) {
        return NULL;
      }
      out->y = b;
      out->z = c;
      p = skip_ws(p);
    } else {
      out->z = b;
    }
  }
  if (*p != ')') {
    return NULL;
  }
  return p + 1;
}

int ht_hand_style_parse(const char *source, HtHandStyle *out) {
  const char *p;
  uint8_t beat = 0;
  uint8_t count = 0;
  if (!source || !out) {
    return 0;
  }
  memset(out, 0, sizeof(*out));
  if (strchr(source, '<') || strchr(source, '|')) {
    return 0;
  }
  p = source;
  while (*p) {
    HtHandPoint point;
    p = skip_ws(p);
    if (!*p) {
      break;
    }
    if (*p == '.') {
      if (count > 0) {
        out->point_counts[beat] = count;
        beat = (uint8_t)(beat + 1);
        count = 0;
        if (beat >= HT_HAND_STYLE_MAX_BEATS) {
          return 0;
        }
      }
      p += 1;
      continue;
    }
    memset(&point, 0, sizeof(point));
    if (*p == 't' || *p == 'c') {
      point.role = *p;
      p += 1;
    }
    p = parse_coord(p, &point);
    if (!p) {
      return 0;
    }
    if (count >= HT_HAND_STYLE_MAX_POINTS) {
      return 0;
    }
    out->points[beat][count++] = point;
  }
  if (count > 0) {
    out->point_counts[beat] = count;
    beat = (uint8_t)(beat + 1);
  }
  out->beat_count = beat;
  return beat > 0;
}

static HtHandPoint *pick_point(HtHandPoint *points, uint8_t count, char role, int from_end) {
  uint8_t i;
  if (count == 0) {
    return NULL;
  }
  if (from_end) {
    for (i = count; i > 0; i -= 1) {
      if (role && points[i - 1].role == role) {
        return &points[i - 1];
      }
    }
    return &points[count - 1];
  }
  for (i = 0; i < count; i += 1) {
    if (role && points[i].role == role) {
      return &points[i];
    }
  }
  return &points[0];
}

static void style_xy(const HtHandPoint *point, uint8_t hand, float *x, float *y) {
  float mirror = hand == 0 ? -1.0f : 1.0f;
  *x = (mirror * point->x) / 250.0f;
  *y = -point->z / 250.0f;
}

HtHandPose ht_hand_style_sample(const HtHandStyle *style, uint8_t hand, float time_beat,
                                float progress) {
  HtHandPose pose;
  uint8_t beat_index;
  HtHandPoint *points;
  uint8_t count;
  HtHandPoint *throw_pt;
  HtHandPoint *catch_pt;
  float tx;
  float ty;
  float cx;
  float cy;
  float blend;
  memset(&pose, 0, sizeof(pose));
  if (!style || style->beat_count == 0) {
    return pose;
  }
  beat_index = (uint8_t)(((int)time_beat % style->beat_count + style->beat_count) % style->beat_count);
  points = (HtHandPoint *)style->points[beat_index];
  count = style->point_counts[beat_index];
  throw_pt = pick_point(points, count, 't', 0);
  catch_pt = pick_point(points, count, 'c', 1);
  if (!throw_pt || throw_pt->hold) {
    throw_pt = catch_pt;
  }
  if (!catch_pt || catch_pt->hold) {
    catch_pt = throw_pt;
  }
  if (!throw_pt || !catch_pt || throw_pt->hold) {
    return pose;
  }
  style_xy(throw_pt, hand, &tx, &ty);
  style_xy(catch_pt, hand, &cx, &cy);
  blend = progress < 0 ? 0 : (progress > 1 ? 1 : progress);
  pose.x = tx + (cx - tx) * blend;
  pose.y = ty + (cy - ty) * blend;
  pose.at_throw = blend < 0.08f;
  pose.at_catch = blend > 0.92f;
  pose.valid = 1;
  return pose;
}
