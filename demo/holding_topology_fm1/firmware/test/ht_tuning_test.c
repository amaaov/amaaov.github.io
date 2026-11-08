#include <math.h>
#include <stdio.h>

#include "ht_patch.h"
#include "ht_tuning.h"

static int failures = 0;

static void expect_true(const char *name, int condition) {
  if (!condition) {
    fprintf(stderr, "FAIL %s\n", name);
    failures += 1;
  }
}

static void expect_near(const char *name, float got, float want, float eps) {
  if (fabsf(got - want) > eps) {
    fprintf(stderr, "FAIL %s got=%f want=%f\n", name, got, want);
    failures += 1;
  }
}

int main(void) {
  expect_true("scale count", HT_SCALE_COUNT == 15);
  expect_near("12tet fifth", ht_degree_to_midi(60, 7, 0, 0), 67.0f, 0.001f);
  expect_near("edo19 step", ht_edo_step_midi_offset(1, 19), 12.0f / 19.0f, 1e-5f);
  expect_true("edo19 micro", ht_scale_is_micro(11));
  expect_true("major not micro", !ht_scale_is_micro(0));
  expect_near("just third", ht_ratio_midi_offset(1.25f), 12.0f * log2f(1.25f), 1e-4f);
  expect_near("justMajor note", ht_scale_note(14, 60.0f, 2, 0),
              60.0f + 12.0f * log2f(1.25f), 1e-3f);
  expect_near("A4", ht_note_hz(69.0f), 440.0f, 0.01f);
  expect_near("quarter sharp A", ht_note_hz(69.5f), 440.0f * exp2f(0.5f / 12.0f), 0.05f);

  if (failures) {
    fprintf(stderr, "%d failures\n", failures);
    return 1;
  }
  puts("ht_tuning_test ok");
  return 0;
}
