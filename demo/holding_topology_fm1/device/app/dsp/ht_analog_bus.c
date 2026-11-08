/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1 */
#include "ht_analog_bus.h"

void ht_analog_bus_init(HtAnalogBus *bus) {
  uint16_t index;
  bus->amount = ht_analog_defaults();
  bus->warmth_z = 0.0f;
  bus->wow_phase = 0.0f;
  bus->flutter_phase = 0.0f;
  bus->wow_write = 0;
  bus->noise = 0xA11CE5u;
  bus->mix = bus->amount.mix;
  for (index = 0; index < HT_ANALOG_WOW_DELAY; index += 1) {
    bus->wow_delay[index] = 0.0f;
  }
}

void ht_analog_bus_set(HtAnalogBus *bus, const HtAnalog *amount) {
  if (!amount) {
    return;
  }
  bus->amount = *amount;
  bus->mix = ht_clampf(amount->mix, 0.0f, 1.0f);
}

float ht_analog_bus_process(HtAnalogBus *bus, float input) {
  float driven = ht_softsat(input, bus->amount.drive);
  float warmth_coeff =
      ht_warmth_cutoff_hz(bus->amount.warmth, HT_DSP_SAMPLE_RATE) / (HT_DSP_SAMPLE_RATE * 0.5f);
  float warm;
  float wow;
  float flutter;
  float delayed;
  float hiss;
  float wet;
  uint16_t read;
  float depth_samples;

  warmth_coeff = ht_clampf(warmth_coeff, 0.02f, 0.95f);
  warm = ht_onepole(driven, &bus->warmth_z, warmth_coeff);

  bus->wow_phase += (0.12f + bus->amount.wow * 0.28f) / HT_DSP_SAMPLE_RATE;
  if (bus->wow_phase >= 1.0f) {
    bus->wow_phase -= 1.0f;
  }
  bus->flutter_phase += (5.5f + bus->amount.flutter * 7.0f) / HT_DSP_SAMPLE_RATE;
  if (bus->flutter_phase >= 1.0f) {
    bus->flutter_phase -= 1.0f;
  }
  wow = ht_sinf(bus->wow_phase * 6.2831853f);
  flutter = ht_sinf(bus->flutter_phase * 6.2831853f);
  depth_samples =
      (ht_wow_depth_seconds(bus->amount.wow) + ht_flutter_depth_seconds(bus->amount.flutter)) *
      HT_DSP_SAMPLE_RATE;
  depth_samples = ht_clampf(depth_samples * (0.55f + 0.45f * wow) + flutter * 0.35f, 1.0f,
                            (float)(HT_ANALOG_WOW_DELAY - 2));

  bus->wow_delay[bus->wow_write] = warm;
  read = (uint16_t)((bus->wow_write + HT_ANALOG_WOW_DELAY - (uint16_t)depth_samples) %
                    HT_ANALOG_WOW_DELAY);
  delayed = bus->wow_delay[read];
  bus->wow_write = (uint16_t)((bus->wow_write + 1u) % HT_ANALOG_WOW_DELAY);

  hiss = ht_noise_f(&bus->noise) * ht_hiss_gain(bus->amount.hiss);
  wet = delayed + hiss;
  return input * (1.0f - bus->mix) + wet * bus->mix;
}
