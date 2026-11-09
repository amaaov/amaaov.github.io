/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1
 *
 * Device voice bank: all HT engines + bus (sidechain → court → scatter → tape → EQ → analog). */
#ifndef HT_VOICE_H
#define HT_VOICE_H

#include <stdint.h>

#include "ht_analog_bus.h"
#include "ht_court_chain.h"
#include "ht_engines.h"
#include "ht_eq_bus.h"
#include "ht_fx.h"
#include "ht_grain_delay.h"
#include "ht_mix.h"
#include "ht_sidechain.h"
#include "ht_tape.h"
#include "ht_waveguide.h"

#define HT_VOICE_SLOTS 6
#define HT_SCATTER_SAMPLES 2048

typedef struct HtVoiceBus {
  float feedback;
  float scatter;
  float drive;
  float delay_time;
  float lfo_depth;
  float wildness;
  float compress;
  float court_gate;
  float dry;
  float wet;
  float filter_hz;
  float eq_lows;
  float eq_mids;
  float eq_highs;
  float sidechain_depth;
  HtAnalog analog;
  float tape_seconds;
  float tape_dry;
  float tape_speed;
  uint8_t tape_recording;
  uint8_t tape_held;
  uint8_t silence_mode;
} HtVoiceBus;

typedef struct HtVoiceBank {
  HtOscSlot osc[HT_VOICE_SLOTS];
  HtWaveguide wg[HT_VOICE_SLOTS];
  uint8_t use_wg[HT_VOICE_SLOTS];
  uint8_t wg_drum[HT_VOICE_SLOTS];
  HtVoiceBus bus;
  HtTape tape;
  HtAnalogBus analog;
  HtSidechain sidechain;
  HtCourtChain court;
  HtGrainDelay grain;
  HtEqBus eq;
  float scatter_delay[HT_SCATTER_SAMPLES];
  uint32_t scatter_write;
  float duck_depth;
  float gain_now;
  float lfo_phase;
  uint32_t seed;
  HtEnvelope envelope;
  HtDrumEnvelopes drum_envelopes;
} HtVoiceBank;

void ht_voice_init(HtVoiceBank *bank);
void ht_voice_panic(HtVoiceBank *bank);
void ht_voice_set_seed(HtVoiceBank *bank, uint32_t seed);
void ht_voice_set_drum_envelopes(HtVoiceBank *bank, const HtDrumEnvelopes *envelopes);
void ht_voice_set_bus(HtVoiceBank *bank, const HtVoiceBus *bus);
uint8_t ht_voice_pick_engine(uint32_t seed, float midi, uint8_t drum_part);
void ht_voice_note_on(HtVoiceBank *bank, float midi, uint8_t velocity, uint8_t engine);
void ht_voice_note_off(HtVoiceBank *bank, float midi);
/* Release held voices older than max_age_sec so generative patterns read as rhythm. */
void ht_voice_release_aged(HtVoiceBank *bank, float max_age_sec);
void ht_voice_render(HtVoiceBank *bank, int32_t *lr, uint32_t frames, uint32_t master_q12);

#endif
