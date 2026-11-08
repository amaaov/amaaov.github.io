#include <math.h>
#include <stdio.h>

#include "ht_mod_matrix.h"

static int failures = 0;

static void expect_true(const char *name, int condition) {
  if (!condition) {
    fprintf(stderr, "FAIL %s\n", name);
    failures += 1;
  }
}

int main(void) {
  HtModFactors factors;
  HtModVector sustain;
  HtModVector edge;

  expect_true("kappa", ht_occupancy_sign(3, 0, 3) == HT_OCC_KRATOS);
  expect_true("alpha", ht_occupancy_sign(0, 3, 3) == HT_OCC_AKRATEIA);
  expect_true("mix", ht_occupancy_sign(1, 2, 3) == HT_OCC_MIXED);

  factors.state = HT_OCC_MIXED;
  factors.object_count = 4;
  factors.object_index = 1;
  factors.hand = 1;
  factors.dwell_phase = 0.5f;
  factors.transition = HT_MOD_SUSTAIN;
  sustain = ht_mod_matrix_combine(&factors);
  factors.transition = HT_MOD_THROW;
  edge = ht_mod_matrix_combine(&factors);
  expect_true("audible", sustain.audible && edge.audible);
  expect_true("transition burst", edge.burst_gain > sustain.burst_gain);

  if (failures) {
    fprintf(stderr, "%d failures\n", failures);
    return 1;
  }
  puts("ht_mod_matrix_test ok");
  return 0;
}
