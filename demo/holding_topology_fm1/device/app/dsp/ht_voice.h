/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1
 *
 * Device voice bank: all HT engines + 4-track bus
 * (tracks → sidechain → court → stereo scatter → tape → reverb → EQ → analog). */
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
#include "ht_reverb.h"
#include "ht_sidechain.h"
#include "ht_tape.h"
#include "ht_waveguide.h"

#ifdef HT_STAGE_NATIVE
#define HT_VOICE_SLOTS 12
#define HT_SCATTER_SAMPLES 49152 /* ~0.5 s at 96 kHz — device keeps 2048 */
#else
#define HT_VOICE_SLOTS 6
#define HT_SCATTER_SAMPLES 2048
#endif

typedef struct HtVoiceBus {
  float feedback;
  float scatter;
  float drive;
  float delay_time;
  float lfo_depth;
  uint8_t lfo_destination; /* 0 pitch 1 cutoff 2 width 3 level 4 pan */
  float wildness;
  float compress;
  float court_gate;
  float dry;
  float wet;
  float reverb;
  float env_amount;
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
  uint8_t slot_track[HT_VOICE_SLOTS];
  HtTrackMix tracks[HT_TRACK_COUNT];
  HtVoiceBus bus;
  HtTape tape;
  HtAnalogBus analog;
  HtSidechain sidechain;
  HtCourtChain court;
  HtGrainDelay grain;
  HtEqBus eq;
  HtReverb reverb;
#ifdef HT_STAGE_NATIVE
  /* True stereo FX path (js/feedback_mix keeps L/R independent through grain/tape/EQ/analog). */
  HtTape tape_r;
  HtAnalogBus analog_r;
  HtGrainDelay grain_r;
  HtEqBus eq_r;
#endif
  float scatter_delay_l[HT_SCATTER_SAMPLES];
  float scatter_delay_r[HT_SCATTER_SAMPLES];
  uint32_t scatter_write;
  float pan[HT_VOICE_SLOTS];
  float pending_pan;
  uint8_t pending_pan_valid;
  uint8_t pending_track;
  uint8_t pending_track_valid;
  float duck_depth;
  float gain_now;
  float lfo_phase;
  float lfo_pan_phase;
  uint32_t seed;
  HtEnvelope envelope;
  HtDrumEnvelopes drum_envelopes;
#ifdef HT_STAGE_NATIVE
  /* Obvious stereo ping-pong so the stage is never mono mid-side mush. */
  float ping_l[48000];
  float ping_r[48000];
  uint32_t ping_write;
  uint32_t ping_delay;
#endif
} HtVoiceBank;

void ht_voice_init(HtVoiceBank *bank);
void ht_voice_panic(HtVoiceBank *bank);
void ht_voice_set_seed(HtVoiceBank *bank, uint32_t seed);
void ht_voice_set_drum_envelopes(HtVoiceBank *bank, const HtDrumEnvelopes *envelopes);
void ht_voice_set_bus(HtVoiceBank *bank, const HtVoiceBus *bus);
void ht_voice_set_tracks(HtVoiceBank *bank, const HtTrackMix tracks[HT_TRACK_COUNT]);
uint8_t ht_voice_pick_engine(uint32_t seed, float midi, uint8_t drum_part);
void ht_voice_note_on(HtVoiceBank *bank, float midi, uint8_t velocity, uint8_t engine);
/* Next note_on uses this stereo pan (-1..1) once, then clears. */
void ht_voice_set_pending_pan(HtVoiceBank *bank, float pan);
/* Next note_on uses this mix track (0..3) once, then clears. */
void ht_voice_set_pending_track(HtVoiceBank *bank, uint8_t track);
void ht_voice_note_off(HtVoiceBank *bank, float midi);
/* Release held voices older than max_age_sec so generative patterns read as rhythm. */
void ht_voice_release_aged(HtVoiceBank *bank, float max_age_sec);
void ht_voice_render(HtVoiceBank *bank, int32_t *lr, uint32_t frames, uint32_t master_q12);
#ifdef HT_STAGE_NATIVE
/* Float path for the macOS stage — avoids int32 staircasing that reads as chip-tune. */
void ht_voice_render_f32(HtVoiceBank *bank, float *lr, uint32_t frames, float master01);
#endif

#endif
