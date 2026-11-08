#include <stdio.h>

#include "ht_gen.h"

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
  HtGenRng rng = {.value = ht_gen_stream(42)};
  uint32_t a = ht_gen_next(&rng);
  uint32_t b = ht_gen_next(&rng);
  HtGenEuclid euclid;
  HtGenMarkov markov;
  HtGenMorph morph;
  HtGenAtlas atlas;
  HtGenOut outs[3];
  int hits = 0;
  int gates = 0;
  int drums = 0;
  uint8_t step;

  expect_true("stream nonzero", ht_gen_stream(1) != 0);
  expect_true("rng advances", a != b);
  expect_true("rnd bounded", ht_gen_rnd(&rng, 7) < 7);

  for (step = 0; step < 8; step += 1) {
    hits += ht_euclid_hit(step, 8, 3, 0);
  }
  expect_eq_u8("euclid 8/3", (uint8_t)hits, 3);
  expect_eq_u8("euclid empty", (uint8_t)ht_euclid_hit(0, 8, 0, 0), 0);

  ht_gen_euclid_init(&euclid, 8, 3, 0, 60, 11);
  for (step = 0; step < 8; step += 1) {
    HtGenOut note = ht_gen_euclid_step(&euclid);
    gates += note.gate ? 1 : 0;
    if (note.gate) {
      expect_true("euclid midi", note.midi >= 36 && note.midi <= 96);
    }
  }
  expect_eq_u8("euclid gates", (uint8_t)gates, 3);

  ht_gen_markov_init(&markov, 40, 80, 2, 99);
  gates = 0;
  for (step = 0; step < 32; step += 1) {
    HtGenOut note = ht_gen_markov_step(&markov);
    gates += note.gate ? 1 : 0;
  }
  expect_true("markov sometimes gates", gates >= 1);

  ht_gen_morph_init(&morph, 64, 1234);
  gates = 0;
  for (step = 0; step < 16; step += 1) {
    HtGenOut note = ht_gen_morph_step(&morph);
    gates += note.gate ? 1 : 0;
  }
  expect_true("morph steps", gates >= 0);

  ht_gen_atlas_init(&atlas, 40, 90, 80, 20, 55);
  for (step = 0; step < 16; step += 1) {
    int count = ht_gen_atlas_step(&atlas, outs);
    expect_true("atlas count", count >= 0 && count <= 3);
    drums += count;
  }
  expect_true("atlas emits drums", drums >= 1);

  if (failures) {
    fprintf(stderr, "%d failures\n", failures);
    return 1;
  }
  puts("ht_gen_test ok");
  return 0;
}
