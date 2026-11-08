#include <stdio.h>
#include <string.h>

#include "ht_action_loop.h"
#include "ht_fx.h"
#include "ht_siteswap.h"

static int failures = 0;

static void expect_true(const char *name, int condition) {
  if (!condition) {
    fprintf(stderr, "FAIL %s\n", name);
    failures += 1;
  }
}

int main(void) {
  HtActionLooper loop;
  HtActionEvent due[8];
  HtDrumEnvelopes drums_a;
  HtDrumEnvelopes drums_b;
  char buffer[HT_SITESWAP_MAX_STRING];
  HtSiteswapGenParams gen;

  ht_action_loop_init(&loop, 0x51e51eu);
  expect_true("host in range", loop.host < HT_ACTION_LOOP_HOST_COUNT);
  expect_true("rise records",
              ht_action_loop_on_host(&loop, 0.8f, 0.0f, 1u) == HT_ACTION_RECORDING);
  {
    uint8_t other = (uint8_t)((loop.host + 1u) % HT_ACTION_LOOP_HOST_COUNT);
    expect_true("capture knob", ht_action_loop_capture(&loop, HT_ACTION_KNOB, other, 0.4f, 1.0f));
  }
  expect_true("drop loops", ht_action_loop_on_host(&loop, 0.2f, 4.0f, 2u) == HT_ACTION_LOOPING);
  expect_true("tick yields", ht_action_loop_tick(&loop, 5.0f, due, 8) >= 1);

  drums_a = ht_drum_envelopes_from_seed(0x1111u, "3");
  drums_b = ht_drum_envelopes_from_seed(0x1111u, "51");
  expect_true("drum adsrs diverge by pattern",
              drums_a.kick.decay != drums_b.kick.decay ||
                  drums_a.snare.release != drums_b.snare.release);

  gen.object_count = 5;
  gen.period = 2;
  gen.max_throw = 12;
  gen.min_throw = 0;
  gen.timing = HT_SS_ASYNC;
  gen.family = HT_SS_FAMILY_SHOWER;
  gen.rest_slots = 0;
  gen.search_budget = 200;
  gen.seed = 0xabcd1234u;
  expect_true("construct shower 5", ht_siteswap_generate(&gen, buffer, sizeof buffer) == HT_SS_OK);
  expect_true("shower valid", ht_siteswap_valid(buffer));
  gen.family = HT_SS_FAMILY_MULTIPLEX;
  gen.seed = 0x3333u;
  expect_true("construct multiplex", ht_siteswap_generate(&gen, buffer, sizeof buffer) == HT_SS_OK);
  expect_true("multiplex bracket", strchr(buffer, '[') != NULL);

  if (failures) {
    fprintf(stderr, "%d failures\n", failures);
    return 1;
  }
  puts("ht_action_loop_test ok");
  return 0;
}
