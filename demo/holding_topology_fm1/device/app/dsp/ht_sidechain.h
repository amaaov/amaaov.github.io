/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1
 *
 * Envelope-follower sidechain: key (drums) ducks the music bus. */
#ifndef HT_SIDECHAIN_H
#define HT_SIDECHAIN_H

#include <stdint.h>

#include "ht_dsp_common.h"

typedef struct HtSidechain {
  float env;
  float attack;
  float release;
  float depth; /* 0..1 how hard the key ducks */
  float floor; /* minimum music gain when fully ducked */
} HtSidechain;

void ht_sidechain_init(HtSidechain *sc);
void ht_sidechain_set(HtSidechain *sc, float depth, float attack_sec, float release_sec);
/* key: absolute drum/key sample; returns music gain 0..1 */
float ht_sidechain_process(HtSidechain *sc, float key_abs);

#endif
