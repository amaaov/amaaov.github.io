#include <math.h>
#include <stdio.h>

#include "ht_fx.h"
#include "ht_patch.h"

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
  HtGrainPlan grain = ht_grain_plan(0.0f, 0.28f);
  HtGrainPlan grain_wet = ht_grain_plan(0.8f, 0.4f);
  HtDrumEnvelopes drums = ht_drum_envelopes_from_seed(0xabcdu, "51");
  HtDrumEnvelopes drums_same = ht_drum_envelopes_from_seed(0xabcdu, "51");
  HtTapePlan silent = ht_tape_plan(2.0f, 0.7f, 1.0f, 1, 0, 1);
  HtTapePlan held = ht_tape_plan(2.0f, 0.7f, 0.0f, 0, 1, 0);
  HtScatterPlan closed = ht_scatter_plan(0.0f, 1.0f);
  HtEnvelope env = ht_envelope_from_env_knob(0.2f);

  expect_near("dry grain mix", grain.mix, 0.0f, 0.001f);
  expect_true("wet grain mix", grain_wet.mix > 0.5f);
  expect_true("wet grain density", grain_wet.density > grain.density);
  expect_true("grain delay clamped", grain_wet.delay_seconds >= 0.02f &&
                                         grain_wet.delay_seconds <= 1.85f);

  expect_true("pattern hash stable", ht_hash_pattern_seed("51") == ht_hash_pattern_seed("51"));
  expect_true("pattern hash differs", ht_hash_pattern_seed("3") != ht_hash_pattern_seed("51"));
  expect_near("drum seed stable kick", drums.kick.decay, drums_same.kick.decay, 1e-6f);
  expect_true("kick slower than hat", drums.kick.decay > drums.hat.decay);

  expect_true("silent tape not recording", !silent.tape_recording);
  expect_near("silent tape wet", silent.tape_wet, 0.0f, 0.001f);
  expect_true("held tape flagged", held.tape_held);
  expect_true("held keeps wet", held.tape_wet > 0.0f);

  expect_near("closed scatter gain", closed.gain, 0.0f, 0.001f);
  expect_true("release to zero", ht_envelope_level(10.0f, &env, 1) == 0.0f);
  expect_true("attack ramp", ht_envelope_level(env.attack * 0.5f, &env, 0) < 1.0f);
  expect_true("lfo shape span", ht_lfo_shape_from_knob(0.0f) == 0 &&
                                    ht_lfo_shape_from_knob(0.99f) == HT_LFO_SHAPE_COUNT - 1);
  expect_true("flutter grows", ht_flutter_depth_seconds(1.0f) > ht_flutter_depth_seconds(0.1f));
  expect_true("drift grows", ht_drift_cents(1.0f) > ht_drift_cents(0.0f));
  expect_true("pipe gain", ht_physical_output_gain(HT_ENGINE_PIPE) > 0.0f);
  expect_true("piano string cap", ht_string_feedback_cap(HT_ENGINE_PIANO, 0.9f) <= 0.98f);
  expect_true("tape speed near zero rests", fabsf(ht_tape_speed_rate(0.0f)) < 0.001f);
  expect_true("tape loop capped", ht_tape_loop_seconds(100.0f) <= HT_TAPE_LOOP_MAXIMUM_SECONDS);

  if (failures) {
    fprintf(stderr, "%d failures\n", failures);
    return 1;
  }
  puts("ht_fx_test ok");
  return 0;
}
