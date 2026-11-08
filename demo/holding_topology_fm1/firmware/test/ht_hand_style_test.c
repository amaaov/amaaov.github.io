#include <math.h>
#include <stdio.h>
#include <string.h>

#include "ht_hand_style.h"

static int failures = 0;

static void expect_true(const char *name, int condition) {
  if (!condition) {
    fprintf(stderr, "FAIL %s\n", name);
    failures += 1;
  }
}

static void expect_eq_u8(const char *name, uint8_t got, uint8_t want) {
  if (got != want) {
    fprintf(stderr, "FAIL %s got=%u want=%u\n", name, got, want);
    failures += 1;
  }
}

int main(void) {
  HtHandStyle style;
  HtHandPose pose;

  expect_true("reject pass marks", !ht_hand_style_parse("<3|3>", &style));
  expect_true("parse cascade path", ht_hand_style_parse("(10)(32.5).", &style));
  expect_true("beats present", style.beat_count >= 1);
  expect_true("points present", style.point_counts[0] >= 1);

  expect_true("parse hold rest", ht_hand_style_parse("(-30)(2.5).(30)(-2.5).", &style));
  pose = ht_hand_style_sample(&style, 0, 0.0f, 0.0f);
  expect_true("sample valid", pose.valid);
  expect_true("sample finite", isfinite(pose.x) && isfinite(pose.y));

  expect_true("parse throw catch roles", ht_hand_style_parse("t(0)(25).c(-20)(10).", &style));
  pose = ht_hand_style_sample(&style, 1, 0.0f, 0.0f);
  expect_true("right hand sample", pose.valid);

  pose = ht_hand_style_sample(NULL, 0, 0.0f, 0.0f);
  expect_eq_u8("null style invalid", pose.valid, 0);

  if (failures) {
    fprintf(stderr, "%d failures\n", failures);
    return 1;
  }
  puts("ht_hand_style_test ok");
  return 0;
}
