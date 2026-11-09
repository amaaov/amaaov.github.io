/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1
 *
 * Master-bus analog character: sat → warmth → wow/flutter → hiss. */
#ifndef HT_ANALOG_BUS_H
#define HT_ANALOG_BUS_H

#include <stdint.h>

#include "ht_dsp_common.h"
#include "ht_fx.h"

#ifdef HT_STAGE_NATIVE
#define HT_ANALOG_WOW_DELAY 2048 /* ~21 ms at 96 kHz — device keeps 128 */
#else
#define HT_ANALOG_WOW_DELAY 128
#endif

typedef struct HtAnalogBus {
  HtAnalog amount;
  float warmth_z;
  float wow_phase;
  float flutter_phase;
  float wow_delay[HT_ANALOG_WOW_DELAY];
  uint16_t wow_write;
  uint32_t noise;
  float mix;
} HtAnalogBus;

void ht_analog_bus_init(HtAnalogBus *bus);
void ht_analog_bus_set(HtAnalogBus *bus, const HtAnalog *amount);
float ht_analog_bus_process(HtAnalogBus *bus, float input);

#endif
