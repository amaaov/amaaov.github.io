/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1 */
#include "ht_sidechain.h"

void ht_sidechain_init(HtSidechain *sc) {
  sc->env = 0.0f;
  sc->attack = 0.008f;
  sc->release = 0.22f;
  sc->depth = 0.55f;
  sc->floor = 0.18f;
}

void ht_sidechain_set(HtSidechain *sc, float depth, float attack_sec, float release_sec) {
  sc->depth = ht_clampf(depth, 0.0f, 1.0f);
  sc->attack = ht_clampf(attack_sec, 0.001f, 0.2f);
  sc->release = ht_clampf(release_sec, 0.02f, 1.5f);
}

float ht_sidechain_process(HtSidechain *sc, float key_abs) {
  float coeff;
  float duck;
  float key = ht_fabsf(key_abs);
  if (key > sc->env) {
    coeff = ht_clampf(1.0f / (sc->attack * HT_DSP_SAMPLE_RATE + 1.0f), 0.0005f, 1.0f);
  } else {
    coeff = ht_clampf(1.0f / (sc->release * HT_DSP_SAMPLE_RATE + 1.0f), 0.0002f, 1.0f);
  }
  sc->env += coeff * (key - sc->env);
  duck = ht_clampf(sc->env * 4.5f, 0.0f, 1.0f) * sc->depth;
  return sc->floor + (1.0f - sc->floor) * (1.0f - duck);
}
