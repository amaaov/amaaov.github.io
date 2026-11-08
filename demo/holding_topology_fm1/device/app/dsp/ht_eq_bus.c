/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1 */
#include "ht_eq_bus.h"

void ht_eq_bus_init(HtEqBus *eq) {
  eq->low_gain_db = 0.0f;
  eq->mid_gain_db = 0.0f;
  eq->high_gain_db = 0.0f;
  eq->low_z = 0.0f;
  eq->mid_z = 0.0f;
  eq->high_z = 0.0f;
}

void ht_eq_bus_set(HtEqBus *eq, float lows_unit, float mids_unit, float highs_unit) {
  eq->low_gain_db = ht_eq_shelf_gain(lows_unit);
  eq->mid_gain_db = ht_eq_shelf_gain(mids_unit);
  eq->high_gain_db = ht_eq_shelf_gain(highs_unit);
}

static float db_to_lin(float db) {
  return ht_exp2f(db / 6.0f);
}

float ht_eq_bus_process(HtEqBus *eq, float input) {
  float low = ht_onepole(input, &eq->low_z, 0.08f);
  float high = input - ht_onepole(input, &eq->high_z, 0.35f);
  float mid = input - low * 0.5f - high * 0.35f;
  (void)eq->mid_z;
  return low * db_to_lin(eq->low_gain_db) + mid * db_to_lin(eq->mid_gain_db) +
         high * db_to_lin(eq->high_gain_db);
}
