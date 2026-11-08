/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1 */
#ifndef HT_EQ_BUS_H
#define HT_EQ_BUS_H

#include "ht_dsp_common.h"
#include "ht_fx.h"

typedef struct HtEqBus {
  float low_gain_db;
  float mid_gain_db;
  float high_gain_db;
  float low_z;
  float mid_z;
  float high_z;
} HtEqBus;

void ht_eq_bus_init(HtEqBus *eq);
void ht_eq_bus_set(HtEqBus *eq, float lows_unit, float mids_unit, float highs_unit);
float ht_eq_bus_process(HtEqBus *eq, float input);

#endif
