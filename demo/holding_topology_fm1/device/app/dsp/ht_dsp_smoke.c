/* SPDX-License-Identifier: MIT
 * Host smoke for device DSP (no fm1-base). Build: make -C device/app/dsp test */
#define HT_DSP_HOST 1

#include <math.h>
#include <stdio.h>
#include <stdint.h>

#include "ht_patch.h"
#include "ht_voice.h"

static int failures;

static void expect_true(const char *name, int ok) {
  if (!ok) {
    fprintf(stderr, "FAIL %s\n", name);
    failures += 1;
  }
}

int main(void) {
  HtVoiceBank bank;
  int32_t block[512];
  uint32_t index;
  uint8_t engine;
  double energy = 0.0;
  HtVoiceBus bus;
  uint8_t seen[HT_ENGINE_COUNT];

  ht_voice_init(&bank);
  ht_voice_set_seed(&bank, 0xaced42u);
  bus = bank.bus;
  bus.feedback = 0.5f;
  bus.scatter = 0.4f;
  bus.drive = 0.55f;
  bus.tape_seconds = 0.18f;
  bus.tape_dry = 0.7f;
  bus.tape_recording = 1;
  bus.sidechain_depth = 0.8f;
  bus.compress = 0.6f;
  bus.court_gate = 1.0f;
  bus.dry = 0.8f;
  bus.wet = 0.35f;
  bus.reverb = 0.4f;
  bus.env_amount = 0.55f;
  bus.filter_hz = 3200.0f;
  bus.eq_lows = 0.55f;
  bus.eq_mids = 0.6f;
  bus.eq_highs = 0.5f;
  bus.silence_mode = 0;
  ht_voice_set_bus(&bank, &bus);

  expect_true("engine count", HT_ENGINE_COUNT == 29);
  for (index = 0; index < HT_ENGINE_COUNT; index += 1) {
    seen[index] = 0;
  }
  /* Midi 0 keeps the pitch term at 0 so seed ^ constant maps 1:1 onto engines. */
  for (engine = 0; engine < HT_ENGINE_COUNT; engine += 1) {
    uint32_t seed = (uint32_t)engine ^ 0xC001D00Du;
    uint8_t picked = ht_voice_pick_engine(seed, 0.0f, 0);
    expect_true("pick hits engine", picked == engine);
    seen[picked] = 1;
  }
  for (engine = 0; engine < HT_ENGINE_COUNT; engine += 1) {
    expect_true("pick covers engine", seen[engine]);
  }
  expect_true("drum noise", ht_voice_pick_engine(1, 36, 1) == HT_ENGINE_NOISE);

  for (engine = 0; engine < HT_ENGINE_COUNT; engine += 1) {
    ht_voice_panic(&bank);
    ht_voice_note_on(&bank, (uint8_t)(48 + (engine % 24)), 100, engine);
    ht_voice_render(&bank, block, 128, 2800);
  }

  ht_voice_panic(&bank);
  ht_voice_note_on(&bank, 60, 100, HT_ENGINE_PIPE);
  ht_voice_note_on(&bank, 64, 90, HT_ENGINE_VOWEL);
  ht_voice_note_on(&bank, 55, 85, HT_ENGINE_GRANULAR);
  ht_voice_note_on(&bank, 50, 80, HT_ENGINE_WAVETABLE);
  ht_voice_note_on(&bank, 36, 110, HT_ENGINE_NOISE);
  ht_voice_note_on(&bank, 62, 100, HT_ENGINE_BIRD);
  ht_voice_note_on(&bank, 40, 110, HT_ENGINE_DUB_BASS);
  ht_voice_note_on(&bank, 58, 95, HT_ENGINE_BUBBLE);
  ht_voice_note_on(&bank, 45, 100, HT_ENGINE_FIRE);
  for (index = 0; index < 40; index += 1) {
    ht_voice_render(&bank, block, 256, 2800);
  }
  for (index = 0; index < 512; index += 1) {
    energy += (double)block[index] * (double)block[index];
  }
  expect_true("audio energy", energy > 1.0);

  {
    double left = 0.0;
    double right = 0.0;
    ht_voice_panic(&bank);
    ht_voice_set_pending_pan(&bank, -0.9f);
    ht_voice_note_on(&bank, 60, 110, HT_ENGINE_ORGAN);
    ht_voice_set_pending_pan(&bank, 0.9f);
    ht_voice_note_on(&bank, 67, 110, HT_ENGINE_ORGAN);
    for (index = 0; index < 30; index += 1) {
      ht_voice_render(&bank, block, 256, 3000);
    }
    for (index = 0; index < 256; index += 1) {
      left += (double)block[index * 2] * (double)block[index * 2];
      right += (double)block[index * 2 + 1] * (double)block[index * 2 + 1];
    }
    expect_true("stereo left energy", left > 1.0);
    expect_true("stereo right energy", right > 1.0);
    expect_true("stereo channels differ", fabs(left - right) / (left + right + 1.0) > 0.02);
  }

  {
    HtDrumEnvelopes drums = ht_drum_envelopes_from_seed(0x51e51eu, "[40]2");
    HtGrainPlan grain = ht_grain_plan(0.7f, 0.3f);
    double grain_energy = 0.0;
    double kick_energy = 0.0;
    double hat_energy = 0.0;
    ht_voice_set_drum_envelopes(&bank, &drums);
    expect_true("drum kick attack", drums.kick.attack > 0.0f);
    bus.scatter = 0.75f;
    bus.delay_time = 0.3f;
    ht_voice_set_bus(&bank, &bus);
    expect_true("grain plan wet", grain.mix > 0.4f);
    ht_voice_panic(&bank);
    ht_voice_note_on(&bank, 48, 110, HT_ENGINE_NOISE);
    for (index = 0; index < 20; index += 1) {
      ht_voice_render(&bank, block, 256, 2800);
    }
    for (index = 0; index < 512; index += 1) {
      grain_energy += (double)block[index] * (double)block[index];
    }
    expect_true("grain bus energy", grain_energy > 1.0);

    ht_voice_panic(&bank);
    ht_voice_note_on(&bank, 36, 120, HT_ENGINE_NOISE);
    for (index = 0; index < 12; index += 1) {
      ht_voice_render(&bank, block, 256, 2800);
    }
    for (index = 0; index < 512; index += 1) {
      kick_energy += (double)block[index] * (double)block[index];
    }
    ht_voice_panic(&bank);
    ht_voice_note_on(&bank, 42, 120, HT_ENGINE_NOISE);
    for (index = 0; index < 12; index += 1) {
      ht_voice_render(&bank, block, 256, 2800);
    }
    for (index = 0; index < 512; index += 1) {
      hat_energy += (double)block[index] * (double)block[index];
    }
    expect_true("kit kick energy", kick_energy > 1.0);
    expect_true("kit hat energy", hat_energy > 0.2);
    expect_true("kit kick and hat differ",
                fabs(kick_energy - hat_energy) / (kick_energy + hat_energy + 1.0) > 0.05);
  }

  {
    HtTrackMix tracks[HT_TRACK_COUNT];
    double bass_e = 0.0;
    double lead_e = 0.0;
    uint8_t t;
    for (t = 0; t < HT_TRACK_COUNT; t += 1) {
      tracks[t].index = t;
      tracks[t].role = t;
      tracks[t].active = 1;
      tracks[t].level = t == 0u ? 1.0f : t == 2u ? 1.0f : 0.05f;
      tracks[t].pan = t == 0u ? -0.8f : 0.8f;
      tracks[t].reverb_send = 0.4f;
      tracks[t].chain_send = 0.2f;
    }
    ht_voice_set_tracks(&bank, tracks);
    ht_voice_panic(&bank);
    ht_voice_set_pending_track(&bank, 0);
    ht_voice_set_pending_pan(&bank, -0.9f);
    ht_voice_note_on(&bank, 40, 110, HT_ENGINE_SUPERSAW);
    for (index = 0; index < 20; index += 1) {
      ht_voice_render(&bank, block, 256, 3000);
    }
    for (index = 0; index < 256; index += 1) {
      bass_e += (double)block[index * 2] * (double)block[index * 2];
    }
    ht_voice_panic(&bank);
    ht_voice_set_pending_track(&bank, 2);
    ht_voice_set_pending_pan(&bank, 0.9f);
    ht_voice_note_on(&bank, 72, 110, HT_ENGINE_SUPERSAW);
    for (index = 0; index < 20; index += 1) {
      ht_voice_render(&bank, block, 256, 3000);
    }
    for (index = 0; index < 256; index += 1) {
      lead_e += (double)block[index * 2 + 1] * (double)block[index * 2 + 1];
    }
    expect_true("track bass energy", bass_e > 1.0);
    expect_true("track lead energy", lead_e > 1.0);
  }

  {
    double wg_e = 0.0;
    ht_voice_panic(&bank);
    ht_voice_note_on(&bank, 60, 110, HT_ENGINE_PIANO);
    for (index = 0; index < 30; index += 1) {
      ht_voice_render(&bank, block, 256, 3000);
    }
    for (index = 0; index < 512; index += 1) {
      wg_e += (double)block[index] * (double)block[index];
    }
    expect_true("waveguide piano energy", wg_e > 1.0);
  }

  if (failures) {
    fprintf(stderr, "%d failure(s)\n", failures);
    return 1;
  }
  puts("ht_dsp_smoke ok");
  return 0;
}
