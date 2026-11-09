#include <math.h>
#include <stdio.h>
#include <string.h>

#include "ht_siteswap.h"

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
  HtSiteswapPattern pattern;
  HtSiteswapSchedule schedule;

  expect_true("parse 3", ht_siteswap_parse("3", &pattern) == HT_SS_OK);
  expect_eq_u8("period 3", ht_siteswap_period(&pattern), 1);
  expect_true("balls 3", fabsf(ht_siteswap_ball_count(&pattern) - 3.0f) < 0.01f);
  expect_true("valid 3", ht_siteswap_valid("3"));
  expect_true("valid 531", ht_siteswap_valid("531"));
  expect_true("valid 531*", ht_siteswap_valid("531*"));
  expect_true("valid sync star", ht_siteswap_valid("(4x,2x)(2,4x)*"));
  expect_true("domain mark not cyclic-valid", !ht_siteswap_valid("555+"));
  expect_true("sync add mark not cyclic-valid", !ht_siteswap_valid("(4,2)+"));
  expect_true("reject bounce", !ht_siteswap_valid("3B"));
  expect_true("reject pass", !ht_siteswap_valid("<3|3>"));
  expect_true("reject 76", !ht_siteswap_valid("76"));

  expect_true("schedule 3", ht_siteswap_schedule("3", 1, 12, &schedule) == HT_SS_OK);
  expect_eq_u8("sched balls", schedule.ball_count, 3);
  expect_true("sched events", schedule.event_count > 0);
  expect_true("cyclic 3", schedule.cyclic);
  expect_true("cascade cycle spans balls+hands", schedule.cycle_length >= 6);
  {
    uint8_t seen[HT_SITESWAP_MAX_BALLS];
    uint8_t distinct = 0;
    uint16_t i;
    memset(seen, 0, sizeof(seen));
    for (i = 0; i < schedule.event_count; i += 1) {
      uint8_t ball = schedule.events[i].ball;
      if (ball < HT_SITESWAP_MAX_BALLS && !seen[ball]) {
        seen[ball] = 1;
        distinct = (uint8_t)(distinct + 1u);
      }
    }
    expect_eq_u8("cascade distinct balls", distinct, 3);
  }
  expect_true("schedule shower 51", ht_siteswap_schedule("51", 1, 12, &schedule) == HT_SS_OK);
  expect_eq_u8("shower balls", schedule.ball_count, 3);
  {
    uint8_t seen[HT_SITESWAP_MAX_BALLS];
    uint8_t distinct = 0;
    uint16_t i;
    memset(seen, 0, sizeof(seen));
    for (i = 0; i < schedule.event_count; i += 1) {
      uint8_t ball = schedule.events[i].ball;
      if (ball < HT_SITESWAP_MAX_BALLS && !seen[ball]) {
        seen[ball] = 1;
        distinct = (uint8_t)(distinct + 1u);
      }
    }
    expect_eq_u8("shower distinct balls", distinct, 3);
  }

  expect_true("playable third-hand",
              ht_siteswap_schedule_playable("555+", 1, 16, &schedule) == HT_SS_OK);
  {
    int found = 0;
    uint16_t i;
    for (i = 0; i < schedule.event_count; i += 1) {
      if (schedule.events[i].parked) {
        found = 1;
        break;
      }
    }
    expect_true("third-hand parks", found);
  }
  expect_true("playable dump", ht_siteswap_schedule_playable("2-", 1, 8, &schedule) == HT_SS_OK);
  {
    int found = 0;
    uint16_t i;
    for (i = 0; i < schedule.event_count; i += 1) {
      if (schedule.events[i].dump) {
        found = 1;
        break;
      }
    }
    expect_true("dump mark", found);
  }

  expect_true("parse R3", ht_siteswap_parse("R3", &pattern) == HT_SS_OK);
  expect_eq_u8("R start", pattern.start_hand, 1);
  expect_true("sched R3", ht_siteswap_schedule("R3", 1, 4, &schedule) == HT_SS_OK);
  {
    int found = 0;
    uint16_t i;
    for (i = 0; i < schedule.event_count; i += 1) {
      if (schedule.events[i].beat == 0 && schedule.events[i].height == 3) {
        expect_eq_u8("R3 hand", schedule.events[i].from_hand, 1);
        found = 1;
        break;
      }
    }
    expect_true("R3 beat0", found);
  }

  expect_true("multiplex", ht_siteswap_valid("[22]2"));
  expect_true("hybrid bang", ht_siteswap_valid("(0,5)!(5,0)!(0,5)!(1,0)!"));

  {
    HtSiteswapGenParams gen;
    char buffer[HT_SITESWAP_MAX_STRING];
    uint8_t distinct = 0;
    char first[HT_SITESWAP_MAX_STRING];
    first[0] = 0;
    gen.object_count = 3;
    gen.period = 2;
    gen.max_throw = 9;
    gen.min_throw = 0;
    gen.timing = HT_SS_ASYNC;
    gen.family = HT_SS_FAMILY_SHOWER;
    gen.rest_slots = 0;
    gen.search_budget = 800;
    gen.seed = 0x51e51eu;
    expect_true("generate shower", ht_siteswap_generate(&gen, buffer, sizeof buffer) == HT_SS_OK);
    expect_true("generated valid", ht_siteswap_valid(buffer));
    strncpy(first, buffer, sizeof first);
    gen.family = HT_SS_FAMILY_BOX;
    gen.timing = HT_SS_SYNC;
    gen.period = 4;
    gen.seed = 0x80c5u;
    expect_true("generate box", ht_siteswap_generate(&gen, buffer, sizeof buffer) == HT_SS_OK);
    expect_true("box valid", ht_siteswap_valid(buffer));
    expect_true("box crosses", strchr(buffer, 'x') != NULL);
    if (strcmp(first, buffer) != 0) {
      distinct = 1;
    }
    gen.family = HT_SS_FAMILY_NONE;
    gen.timing = HT_SS_ASYNC;
    gen.period = 5;
    gen.seed = 99u;
    expect_true("generate async", ht_siteswap_generate(&gen, buffer, sizeof buffer) == HT_SS_OK);
    expect_true("async valid", ht_siteswap_valid(buffer));
    if (strcmp(first, buffer) != 0) {
      distinct = 1;
    }
    expect_true("generated variety", distinct);
    gen.family = HT_SS_FAMILY_MULTIPLEX;
    gen.object_count = 3;
    gen.seed = 0x3333u;
    expect_true("generate multiplex",
                ht_siteswap_generate(&gen, buffer, sizeof buffer) == HT_SS_OK);
    expect_true("multiplex has bracket", strchr(buffer, '[') != NULL);
    {
      uint8_t n;
      for (n = 3; n <= 7; n += 1) {
        expect_true("construct columns",
                    ht_siteswap_construct_family(HT_SS_FAMILY_COLUMNS, n, 0x1000u + n, buffer,
                                                 sizeof buffer) == HT_SS_OK);
        expect_true("columns valid", ht_siteswap_valid(buffer));
      }
    }
  }

  if (failures) {
    fprintf(stderr, "%d failures\n", failures);
    return 1;
  }
  puts("ht_siteswap_test ok");
  return 0;
}
