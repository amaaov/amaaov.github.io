/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1 */
#include "ht_voice.h"

#include "ht_dsp_common.h"
#include "ht_patch.h"

static void default_tracks(HtTrackMix tracks[HT_TRACK_COUNT]) {
  uint8_t index;
  for (index = 0; index < HT_TRACK_COUNT; index += 1) {
    tracks[index].index = index;
    tracks[index].role = index;
    tracks[index].active = 1;
    tracks[index].level = index == 3u ? 0.9f : 0.75f;
    tracks[index].pan = index == 0u ? -0.15f : index == 2u ? 0.2f : index == 3u ? 0.05f : -0.05f;
    tracks[index].reverb_send = index == 3u ? 0.12f : 0.28f;
    tracks[index].chain_send = index == 3u ? 0.1f : 0.22f;
  }
}

static uint8_t default_track_for_slot(uint32_t slot, uint8_t drum) {
  uint8_t per;
  uint8_t track;
  if (drum) {
    return 3u;
  }
  per = (uint8_t)((HT_VOICE_SLOTS + HT_TRACK_COUNT - 1u) / HT_TRACK_COUNT);
  if (per < 1u) {
    per = 1u;
  }
  track = (uint8_t)(slot / per);
  if (track >= HT_TRACK_COUNT) {
    track = HT_TRACK_COUNT - 1u;
  }
  return track;
}

void ht_voice_init(HtVoiceBank *bank) {
  uint32_t index;
  for (index = 0; index < HT_VOICE_SLOTS; index += 1) {
    ht_osc_slot_clear(&bank->osc[index]);
    bank->osc[index].noise = 0x1234u + index * 97u;
    ht_wg_clear(&bank->wg[index]);
    bank->use_wg[index] = 0;
    bank->wg_drum[index] = 0;
    bank->slot_track[index] = default_track_for_slot(index, 0);
    bank->pan[index] = 0.0f;
  }
  for (index = 0; index < HT_SCATTER_SAMPLES; index += 1) {
    bank->scatter_delay_l[index] = 0.0f;
    bank->scatter_delay_r[index] = 0.0f;
  }
  bank->scatter_write = 0;
  bank->pending_pan = 0.0f;
  bank->pending_pan_valid = 0;
  bank->pending_track = 0;
  bank->pending_track_valid = 0;
  default_tracks(bank->tracks);
#ifdef HT_STAGE_NATIVE
  {
    uint32_t p;
    for (p = 0; p < 48000u; p += 1) {
      bank->ping_l[p] = 0.0f;
      bank->ping_r[p] = 0.0f;
    }
    bank->ping_write = 0;
    bank->ping_delay = (uint32_t)(0.22f * HT_DSP_SAMPLE_RATE);
    if (bank->ping_delay < 64u) {
      bank->ping_delay = 64u;
    }
    if (bank->ping_delay > 47900u) {
      bank->ping_delay = 47900u;
    }
  }
#endif
  bank->duck_depth = 0.55f;
  bank->gain_now = 0.0f;
  bank->lfo_phase = 0.0f;
  bank->lfo_pan_phase = 0.17f;
  bank->seed = 1;
  bank->envelope = ht_envelope_from_env_knob(0.5f);
  bank->bus.feedback = 0.45f;
  bank->bus.scatter = 0.2f;
  bank->bus.drive = 0.35f;
  bank->bus.delay_time = 0.22f;
  bank->bus.lfo_depth = 0.3f;
  bank->bus.lfo_destination = 0;
  bank->bus.wildness = 0.55f;
  bank->bus.compress = 0.45f;
  bank->bus.court_gate = 1.0f;
  bank->bus.dry = 0.85f;
  bank->bus.wet = 0.28f;
  bank->bus.reverb = 0.28f;
  bank->bus.env_amount = 0.5f;
  bank->bus.filter_hz = 3800.0f;
  bank->bus.eq_lows = 0.55f;
  bank->bus.eq_mids = 0.6f;
  bank->bus.eq_highs = 0.5f;
  bank->bus.sidechain_depth = 0.55f;
  bank->bus.analog = ht_analog_defaults();
  bank->bus.tape_seconds = 0.18f;
  bank->bus.tape_dry = 0.55f;
  bank->bus.tape_speed = 1.0f;
  bank->bus.tape_recording = 0;
  bank->bus.tape_held = 0;
  bank->bus.silence_mode = HT_SILENCE_OPEN;
  bank->drum_envelopes = ht_drum_envelopes_from_seed(1u, "3");
  ht_tape_init(&bank->tape);
  ht_analog_bus_init(&bank->analog);
  ht_sidechain_init(&bank->sidechain);
  ht_court_chain_init(&bank->court);
  ht_grain_delay_init(&bank->grain, (uint32_t)HT_DSP_SAMPLE_RATE);
  ht_eq_bus_init(&bank->eq);
  ht_reverb_init(&bank->reverb);
#ifdef HT_STAGE_NATIVE
  ht_tape_init(&bank->tape_r);
  ht_analog_bus_init(&bank->analog_r);
  ht_grain_delay_init(&bank->grain_r, (uint32_t)HT_DSP_SAMPLE_RATE);
  ht_eq_bus_init(&bank->eq_r);
#endif
}

void ht_voice_panic(HtVoiceBank *bank) {
  uint32_t index;
  if (!bank) {
    return;
  }
  for (index = 0; index < HT_VOICE_SLOTS; index += 1) {
    bank->osc[index].target = 0.0f;
    bank->osc[index].active = 0;
    bank->osc[index].released = 1;
    ht_wg_note_off(&bank->wg[index]);
    bank->use_wg[index] = 0;
    ht_wg_clear(&bank->wg[index]);
  }
  /* Hard scene cut: wipe delay/reverb/tape so the next seed is not wet wash from the last. */
  for (index = 0; index < HT_SCATTER_SAMPLES; index += 1) {
    bank->scatter_delay_l[index] = 0.0f;
    bank->scatter_delay_r[index] = 0.0f;
  }
  bank->scatter_write = 0;
  bank->gain_now = 0.0f;
  ht_tape_init(&bank->tape);
  ht_court_chain_init(&bank->court);
  ht_grain_delay_init(&bank->grain, (uint32_t)HT_DSP_SAMPLE_RATE);
  ht_reverb_init(&bank->reverb);
  ht_analog_bus_init(&bank->analog);
  ht_sidechain_init(&bank->sidechain);
  ht_eq_bus_init(&bank->eq);
#ifdef HT_STAGE_NATIVE
  {
    uint32_t p;
    for (p = 0; p < 48000u; p += 1) {
      bank->ping_l[p] = 0.0f;
      bank->ping_r[p] = 0.0f;
    }
    bank->ping_write = 0;
  }
  ht_tape_init(&bank->tape_r);
  ht_analog_bus_init(&bank->analog_r);
  ht_grain_delay_init(&bank->grain_r, (uint32_t)HT_DSP_SAMPLE_RATE);
  ht_eq_bus_init(&bank->eq_r);
#endif
}

void ht_voice_set_seed(HtVoiceBank *bank, uint32_t seed) {
  bank->seed = seed ? seed : 1u;
}

void ht_voice_set_drum_envelopes(HtVoiceBank *bank, const HtDrumEnvelopes *envelopes) {
  if (!bank || !envelopes) {
    return;
  }
  bank->drum_envelopes = *envelopes;
}

void ht_voice_set_tracks(HtVoiceBank *bank, const HtTrackMix tracks[HT_TRACK_COUNT]) {
  uint8_t index;
  if (!bank || !tracks) {
    return;
  }
  for (index = 0; index < HT_TRACK_COUNT; index += 1) {
    bank->tracks[index] = tracks[index];
  }
}

static const HtEnvelope *envelope_for_slot(const HtVoiceBank *bank, const HtOscSlot *slot) {
  uint8_t midi;
  if (!slot->drum) {
    return &bank->envelope;
  }
  midi = (uint8_t)(slot->midi + 0.5f);
  if (midi == 36) {
    return &bank->drum_envelopes.kick;
  }
  if (midi == 38) {
    return &bank->drum_envelopes.snare;
  }
  return &bank->drum_envelopes.hat;
}

void ht_voice_set_bus(HtVoiceBank *bank, const HtVoiceBus *bus) {
  HtTapePlan plan;
  HtScatterPlan scatter;
  HtGrainPlan grain;
  float env_knob;
  if (!bus) {
    return;
  }
  bank->bus = *bus;
  env_knob = bus->env_amount > 0.01f ? bus->env_amount
                                     : ht_clampf(1.0f - bus->wildness * 0.35f, 0.0f, 1.0f);
  bank->envelope = ht_envelope_from_env_knob(env_knob);
  bank->bus.analog.drive = ht_clampf(bus->drive, 0.0f, 1.0f);
  ht_analog_bus_set(&bank->analog, &bank->bus.analog);
  plan = ht_tape_plan(bus->tape_seconds, bus->tape_dry, bus->tape_speed, bus->tape_recording,
                      bus->tape_held, bus->silence_mode == HT_SILENCE_GAP);
  ht_tape_configure(&bank->tape, &plan);
  scatter = ht_scatter_plan(bus->scatter, 0.0f);
  bank->duck_depth = scatter.duck;
  ht_sidechain_set(&bank->sidechain, bus->sidechain_depth * (0.35f + scatter.duck), 0.006f, 0.2f);
  ht_court_chain_configure(&bank->court, bus->delay_time, bus->feedback, bus->dry, bus->wet,
                           bus->filter_hz, bus->drive);
  grain = ht_grain_plan(bus->scatter, bus->delay_time);
  ht_grain_delay_configure(&bank->grain, &grain);
  ht_eq_bus_set(&bank->eq, bus->eq_lows, bus->eq_mids, bus->eq_highs);
  ht_reverb_configure(&bank->reverb, 0.45f + bus->reverb * 0.5f, bus->reverb,
                      0.3f + bus->scatter * 0.35f);
#ifdef HT_STAGE_NATIVE
  ht_analog_bus_set(&bank->analog_r, &bank->bus.analog);
  ht_tape_configure(&bank->tape_r, &plan);
  ht_grain_delay_configure(&bank->grain_r, &grain);
  ht_eq_bus_set(&bank->eq_r, bus->eq_lows, bus->eq_mids, bus->eq_highs);
#endif
}

uint8_t ht_voice_pick_engine(uint32_t seed, float midi, uint8_t drum_part) {
  if (drum_part) {
    return HT_ENGINE_NOISE;
  }
  return (uint8_t)((seed ^ ((uint32_t)(midi * 97.0f) * 0x85ebca6bu) ^ 0xC001D00Du) % HT_ENGINE_COUNT);
}

static uint32_t alloc_slot(HtVoiceBank *bank) {
  uint32_t index;
  uint32_t best = 0;
  float best_score = -1.0f;
  for (index = 0; index < HT_VOICE_SLOTS; index += 1) {
    if (!bank->osc[index].active && !bank->use_wg[index]) {
      return index;
    }
  }
  /* All busy — steal the quietest / oldest so new engines stay audible. */
  for (index = 0; index < HT_VOICE_SLOTS; index += 1) {
    float score = bank->osc[index].age;
    if (bank->use_wg[index]) {
      score += 2.0f + (1.0f - bank->wg[index].amp) * 8.0f;
    } else {
      score += (1.0f - bank->osc[index].level) * 10.0f;
      if (bank->osc[index].released || bank->osc[index].target <= 0.0f) {
        score += 20.0f;
      }
    }
    if (score > best_score) {
      best_score = score;
      best = index;
    }
  }
  return best;
}

void ht_voice_set_pending_pan(HtVoiceBank *bank, float pan) {
  if (!bank) {
    return;
  }
  bank->pending_pan = ht_clampf(pan, -1.0f, 1.0f);
  bank->pending_pan_valid = 1;
}

void ht_voice_set_pending_track(HtVoiceBank *bank, uint8_t track) {
  if (!bank) {
    return;
  }
  bank->pending_track = track < HT_TRACK_COUNT ? track : (HT_TRACK_COUNT - 1u);
  bank->pending_track_valid = 1;
}

void ht_voice_note_on(HtVoiceBank *bank, float midi, uint8_t velocity, uint8_t engine) {
  uint32_t slot = alloc_slot(bank);
  float vel = (float)velocity / 127.0f;
  uint8_t drum = (uint8_t)ht_engine_is_drum_midi(engine, midi);
  float pan;
  uint8_t track;
  if (vel < 0.05f) {
    vel = 0.05f;
  }
  if (engine >= HT_ENGINE_COUNT) {
    engine = HT_ENGINE_SUBTRACTIVE;
  }
  if (bank->pending_pan_valid) {
    pan = bank->pending_pan;
    bank->pending_pan_valid = 0;
  } else {
    pan = (((float)((int)(midi + 0.5f) % 12) - 5.5f) / 7.0f);
    if (drum) {
      pan *= 0.35f;
    }
  }
  bank->pan[slot] = ht_clampf(pan, -1.0f, 1.0f);
  if (bank->pending_track_valid) {
    track = bank->pending_track;
    bank->pending_track_valid = 0;
  } else {
    track = default_track_for_slot(slot, drum);
  }
  if (drum) {
    track = 3u;
  }
  bank->slot_track[slot] = track;

  if (ht_engine_is_physical(engine)) {
    ht_wg_note_on(&bank->wg[slot], engine, midi, velocity, bank->bus.feedback);
    bank->use_wg[slot] = 1;
    bank->wg_drum[slot] = drum;
    bank->osc[slot].active = 0;
    bank->osc[slot].released = 0;
    bank->osc[slot].midi = midi;
    bank->osc[slot].drum = drum;
    bank->osc[slot].engine = engine;
    bank->osc[slot].age = 0.0f;
    return;
  }
  bank->use_wg[slot] = 0;
  bank->wg_drum[slot] = 0;
  ht_wg_note_off(&bank->wg[slot]);
  ht_osc_slot_clear(&bank->osc[slot]);
  bank->osc[slot].noise ^= (uint32_t)(midi * 97.0f) * 0x9E3779B9u + bank->seed;
  bank->osc[slot].engine = engine;
  bank->osc[slot].midi = midi;
  bank->osc[slot].active = 1;
  bank->osc[slot].released = 0;
  bank->osc[slot].drum = drum;
  if (engine == HT_ENGINE_BIRD) {
    bank->osc[slot].vowel_index =
        (uint8_t)(((uint8_t)(midi + 0.5f) + (bank->seed & 7u)) % 4u);
  } else if (engine == HT_ENGINE_DOLPHIN) {
    bank->osc[slot].vowel_index =
        (uint8_t)(((uint8_t)(midi + 0.5f) + bank->seed) % 4u);
  } else if (engine == HT_ENGINE_BUBBLE || engine == HT_ENGINE_FOREST ||
             engine == HT_ENGINE_DUB_BASS || engine == HT_ENGINE_FIRE) {
    bank->osc[slot].vowel_index =
        (uint8_t)(((uint8_t)(midi + 0.5f) + bank->seed) & 1u);
  } else {
    bank->osc[slot].vowel_index =
        (uint8_t)(((uint8_t)(midi + 0.5f) + (bank->seed & 7u)) % 5u);
  }
  bank->osc[slot].age = 0.0f;
#ifdef HT_STAGE_NATIVE
  /* Headroom for 12-voice polyphony — loud enough, not clip-flat. */
  bank->osc[slot].target = (drum ? 0.48f : 0.52f) * vel;
#else
  bank->osc[slot].target = (drum ? 0.32f : 0.42f) * vel;
#endif
}

void ht_voice_note_off(HtVoiceBank *bank, float midi) {
  uint32_t index;
  for (index = 0; index < HT_VOICE_SLOTS; index += 1) {
    if (bank->use_wg[index] && ht_fabsf(bank->wg[index].midi - midi) < 0.06f) {
      ht_wg_note_off(&bank->wg[index]);
    }
    if (bank->osc[index].active && ht_fabsf(bank->osc[index].midi - midi) < 0.06f) {
      bank->osc[index].released = 1;
      bank->osc[index].active = 0;
      bank->osc[index].target = 0.0f;
    }
  }
}

void ht_voice_release_aged(HtVoiceBank *bank, float max_age_sec) {
  uint32_t index;
  float limit = max_age_sec > 0.02f ? max_age_sec : 0.02f;
  float drum_limit = limit * 0.35f;
  if (drum_limit < 0.04f) {
    drum_limit = 0.04f;
  }
  if (!bank) {
    return;
  }
  for (index = 0; index < HT_VOICE_SLOTS; index += 1) {
    HtOscSlot *slot = &bank->osc[index];
    float age_limit = slot->drum ? drum_limit : limit;
    if (slot->active && slot->age >= age_limit) {
      slot->released = 1;
      slot->active = 0;
      slot->target = 0.0f;
    }
    /* Free dead slots so alloc can reuse them (sustain would otherwise pin forever). */
    if (!slot->active && slot->level < 0.0002f && !bank->use_wg[index]) {
      slot->target = 0.0f;
      slot->level = 0.0f;
    }
    if (bank->use_wg[index] && bank->wg[index].active && !bank->wg[index].released) {
      float wg_limit = bank->wg_drum[index] ? drum_limit : (bank->wg[index].bowed ? limit * 1.6f : limit);
      if (slot->age >= wg_limit) {
        ht_wg_note_off(&bank->wg[index]);
      }
    }
  }
}

static void scatter_process_stereo(HtVoiceBank *bank, float in_l, float in_r, float *out_l,
                                   float *out_r) {
  float amount = ht_clampf(bank->bus.scatter, 0.0f, 1.0f);
  float delay_samples =
      ht_clampf(bank->bus.delay_time * 0.45f, 0.018f, 0.22f) * HT_DSP_SAMPLE_RATE;
  uint32_t length = HT_SCATTER_SAMPLES;
  uint32_t delay_l;
  uint32_t delay_r;
  uint32_t index_l;
  uint32_t index_r;
  float delayed_l;
  float delayed_r;
  float fb_l;
  float fb_r;
  float duck = 1.0f - bank->duck_depth * 0.35f * amount;
  if (amount < 0.01f) {
    *out_l = in_l;
    *out_r = in_r;
    return;
  }
  if (delay_samples > (float)(length - 8u)) {
    delay_samples = (float)(length - 8u);
  }
  delay_l = (uint32_t)delay_samples;
  delay_r = (uint32_t)(delay_samples * 1.17f);
  if (delay_r > length - 2u) {
    delay_r = length - 2u;
  }
  index_l = (bank->scatter_write + length - delay_l) % length;
  index_r = (bank->scatter_write + length - delay_r) % length;
  delayed_l = bank->scatter_delay_l[index_l];
  delayed_r = bank->scatter_delay_r[index_r];
  fb_l = delayed_l * (0.15f + amount * 0.45f);
  fb_r = delayed_r * (0.15f + amount * 0.45f);
  /* Cross-feed keeps stereo scatter from collapsing. */
  bank->scatter_delay_l[bank->scatter_write % length] = in_l + fb_l * 0.28f + fb_r * 0.12f;
  bank->scatter_delay_r[bank->scatter_write % length] = in_r + fb_r * 0.28f + fb_l * 0.12f;
  bank->scatter_write = (bank->scatter_write + 1u) % length;
  *out_l = in_l * duck + delayed_l * amount * 0.55f;
  *out_r = in_r * duck + delayed_r * amount * 0.55f;
}

static float soft_compress(float input, float amount, float key_env) {
  float thr = 0.35f - amount * 0.22f;
  float gr = 1.0f;
  float abs_in = ht_fabsf(input);
  float sense = ht_clampf(abs_in + key_env * 0.8f, 0.0f, 2.0f);
  if (sense > thr) {
    gr = thr / (thr + (sense - thr) * (1.5f + amount * 3.0f));
  }
  return input * (0.55f + 0.45f * gr);
}

static void ht_voice_render_linear(HtVoiceBank *bank, float *lr, uint32_t frames, float gain) {
  uint32_t frame;
  uint32_t index;
  for (frame = 0; frame < frames; frame += 1) {
    float track_l[HT_TRACK_COUNT];
    float track_r[HT_TRACK_COUNT];
    float music_l = 0.0f;
    float music_r = 0.0f;
    float perc_l = 0.0f;
    float perc_r = 0.0f;
    float rev_send_l = 0.0f;
    float rev_send_r = 0.0f;
    float chain_l = 0.0f;
    float chain_r = 0.0f;
    float dry_l;
    float dry_r;
    float court_l;
    float court_r;
    float scatter_l;
    float scatter_r;
    float grain_l;
    float grain_r;
    float fx_l;
    float fx_r;
    float rev_l = 0.0f;
    float rev_r = 0.0f;
    float out_l;
    float out_r;
    float lfo;
    float lfo_pan;
    float lfo_level = 1.0f;
    float lfo_cutoff = 0.0f;
    float sc_gain;
    uint8_t t;
    uint8_t lfo_dest = bank->bus.lfo_destination;
    for (t = 0; t < HT_TRACK_COUNT; t += 1) {
      track_l[t] = 0.0f;
      track_r[t] = 0.0f;
    }
    bank->gain_now += (gain - bank->gain_now) * 0.004f;
    /* Dual LFO like js/lyra_synth (0.35 Hz sine + 0.55 Hz triangle feel). */
    bank->lfo_phase += (0.35f + bank->bus.lfo_depth * 0.9f) / HT_DSP_SAMPLE_RATE;
    if (bank->lfo_phase >= 1.0f) {
      bank->lfo_phase -= 1.0f;
    }
    bank->lfo_pan_phase += (0.55f + bank->bus.lfo_depth * 0.7f) / HT_DSP_SAMPLE_RATE;
    if (bank->lfo_pan_phase >= 1.0f) {
      bank->lfo_pan_phase -= 1.0f;
    }
    {
      float tri = bank->lfo_pan_phase < 0.5f ? bank->lfo_pan_phase * 4.0f - 1.0f
                                            : 3.0f - bank->lfo_pan_phase * 4.0f;
      lfo = (ht_sinf(bank->lfo_phase * 6.2831853f) * 0.62f + tri * 0.38f) * bank->bus.lfo_depth;
    }
    lfo_pan = ht_sinf(bank->lfo_pan_phase * 6.2831853f) * bank->bus.lfo_depth * 0.45f;
    /* Destinations: 0 pitch, 1 cutoff, 2 width, 3 level, 4 pan (js/ht_fx.js). */
    if (lfo_dest == 1u) {
      lfo_cutoff = lfo;
      lfo = 0.0f;
    } else if (lfo_dest == 2u) {
      lfo_pan = lfo * 0.85f;
      lfo *= 0.25f;
    } else if (lfo_dest == 3u) {
      lfo_level = ht_clampf(1.0f + lfo * 0.55f, 0.35f, 1.45f);
      lfo = 0.0f;
    } else if (lfo_dest == 4u) {
      lfo_pan = lfo;
      lfo = 0.0f;
    }

    for (index = 0; index < HT_VOICE_SLOTS; index += 1) {
      float sample = 0.0f;
      float pan;
      float l_gain;
      float r_gain;
      uint8_t drum = 0;
      uint8_t track;
      bank->osc[index].age += 1.0f / HT_DSP_SAMPLE_RATE;
      if (bank->use_wg[index]) {
        sample = ht_wg_process(&bank->wg[index]) * lfo_level;
        drum = bank->wg_drum[index];
        if (bank->wg[index].released && bank->wg[index].amp < 0.0001f &&
            bank->wg[index].feedback_live < 0.001f) {
          bank->use_wg[index] = 0;
        }
      } else {
        HtOscSlot *slot = &bank->osc[index];
        float env;
        float pair = 0.0f;
        const HtEnvelope *shape = envelope_for_slot(bank, slot);
        env = ht_envelope_level(slot->age, shape, slot->released);
        slot->level += (slot->target * env - slot->level) * 0.01f;
        if (slot->level < 0.00008f && slot->target <= 0.0f) {
          continue;
        }
        if ((index & 1u) && bank->osc[index - 1u].active) {
          pair = ht_sinf(bank->osc[index - 1u].phase * 6.2831853f) * 0.12f *
                 (0.35f + shape->filter_env);
        }
        {
          /* Stronger filterEnv path — js/lyra_synth opens cutoff from envelope + LFO. */
          float fe = shape->filter_env * (0.55f + bank->bus.env_amount * 1.15f) + lfo_cutoff * 1.35f;
          sample = ht_engine_sample(slot, lfo + pair, fe) * slot->level * lfo_level;
        }
        drum = slot->drum;
      }
      track = bank->slot_track[index];
      if (drum) {
        track = 3u;
      }
      if (track >= HT_TRACK_COUNT) {
        track = HT_TRACK_COUNT - 1u;
      }
      pan = ht_clampf(bank->pan[index] + lfo_pan * (drum ? 0.25f : 1.0f), -1.0f, 1.0f);
      l_gain = ht_clampf(0.7071f * (1.0f - pan), 0.0f, 1.25f);
      r_gain = ht_clampf(0.7071f * (1.0f + pan), 0.0f, 1.25f);
      track_l[track] += sample * l_gain;
      track_r[track] += sample * r_gain;
    }

    for (t = 0; t < HT_TRACK_COUNT; t += 1) {
      const HtTrackMix *row = &bank->tracks[t];
      float level = row->active ? row->level : 0.0f;
      float tilt = ht_clampf(row->pan, -1.0f, 1.0f) * 0.4f;
      float bus_l = track_l[t] * level * (1.0f - tilt);
      float bus_r = track_r[t] * level * (1.0f + tilt);
      float send = row->active ? row->reverb_send * 0.8f : 0.0f;
      float chain = row->active ? row->chain_send : 0.0f;
      rev_send_l += bus_l * send;
      rev_send_r += bus_r * send;
      chain_l += bus_l * chain;
      chain_r += bus_r * chain;
      if (t == 3u) {
        perc_l += bus_l;
        perc_r += bus_r;
      } else {
        music_l += bus_l;
        music_r += bus_r;
      }
    }

    sc_gain = ht_sidechain_process(&bank->sidechain, 0.5f * (perc_l + perc_r));
    dry_l = music_l * sc_gain + perc_l;
    dry_r = music_r * sc_gain + perc_r;
    /* chain_send feeds the court delay (js/feedback_mix track.chainSend). */
    ht_court_chain_process_stereo(&bank->court, dry_l * 0.55f + chain_l, dry_r * 0.55f + chain_r,
                                  &court_l, &court_r);
    scatter_process_stereo(bank, court_l, court_r, &scatter_l, &scatter_r);
#ifdef HT_STAGE_NATIVE
    grain_l = ht_grain_delay_process(&bank->grain, scatter_l);
    grain_r = ht_grain_delay_process(&bank->grain_r, scatter_r);
#else
    {
      float grain_m =
          ht_grain_delay_process(&bank->grain, 0.5f * (scatter_l + scatter_r));
      grain_l = grain_m;
      grain_r = grain_m;
    }
#endif
#ifdef HT_STAGE_NATIVE
    /* Match js/feedback_mix: dry court + scatter + granular delay return. */
    fx_l = court_l * 0.7f + scatter_l * 0.28f + grain_l * 0.42f;
    fx_r = court_r * 0.7f + scatter_r * 0.28f + grain_r * 0.42f;
#else
    fx_l = court_l * 0.62f + scatter_l * 0.28f + grain_l * 0.55f;
    fx_r = court_r * 0.62f + scatter_r * 0.28f + grain_r * 0.55f;
#endif
#ifdef HT_STAGE_NATIVE
    fx_l = ht_tape_process(&bank->tape, fx_l);
    fx_r = ht_tape_process(&bank->tape_r, fx_r);
#else
    {
      float side;
      float taped;
      taped = ht_tape_process(&bank->tape, 0.5f * (fx_l + fx_r));
      side = 0.5f * (fx_l - fx_r);
      fx_l = taped + side;
      fx_r = taped - side;
    }
#endif
    /* Track reverb sends + a light post send (js/feedback_mix track.reverbOut). */
#ifdef HT_STAGE_NATIVE
    ht_reverb_process(&bank->reverb, rev_send_l + fx_l * 0.16f, rev_send_r + fx_r * 0.16f, &rev_l,
                      &rev_r);
#else
    ht_reverb_process(&bank->reverb, rev_send_l + fx_l * 0.22f, rev_send_r + fx_r * 0.22f, &rev_l,
                      &rev_r);
#endif
    fx_l += rev_l;
    fx_r += rev_r;
#ifdef HT_STAGE_NATIVE
    fx_l = ht_eq_bus_process(&bank->eq, fx_l);
    fx_r = ht_eq_bus_process(&bank->eq_r, fx_r);
    fx_l = soft_compress(fx_l, bank->bus.compress, bank->sidechain.env);
    fx_r = soft_compress(fx_r, bank->bus.compress, bank->sidechain.env);
    fx_l = ht_analog_bus_process(&bank->analog, fx_l);
    fx_r = ht_analog_bus_process(&bank->analog_r, fx_r);
#else
    {
      float side = 0.5f * (fx_l - fx_r);
      float mid = 0.5f * (fx_l + fx_r);
      mid = ht_eq_bus_process(&bank->eq, mid);
      mid = soft_compress(mid, bank->bus.compress, bank->sidechain.env);
      mid = ht_analog_bus_process(&bank->analog, mid);
      fx_l = mid + side;
      fx_r = mid - side;
    }
#endif
#ifdef HT_STAGE_NATIVE
    /* Stereo ping ≈ JS delayA/delayB with cross feedback (~0.2). */
    if (bank->ping_delay >= 64u) {
      uint32_t delay = bank->ping_delay;
      uint32_t read_l = (bank->ping_write + 48000u - delay) % 48000u;
      uint32_t read_r =
          (bank->ping_write + 48000u - (uint32_t)(delay * 1.17f)) % 48000u;
      float tap_l = bank->ping_l[read_l];
      float tap_r = bank->ping_r[read_r];
      float fb = ht_clampf(bank->bus.feedback, 0.1f, 0.55f);
      bank->ping_l[bank->ping_write] = fx_l * 0.55f + tap_r * fb * 0.85f;
      bank->ping_r[bank->ping_write] = fx_r * 0.55f + tap_l * fb * 0.75f;
      bank->ping_write = (bank->ping_write + 1u) % 48000u;
      out_l = (fx_l * 0.78f + tap_l * 0.42f) * bank->gain_now;
      out_r = (fx_r * 0.78f + tap_r * 0.42f) * bank->gain_now;
    } else {
      out_l = fx_l * bank->gain_now;
      out_r = fx_r * bank->gain_now;
    }
#else
    out_l = fx_l * bank->gain_now;
    out_r = fx_r * bank->gain_now;
#endif
#ifdef HT_STAGE_NATIVE
    /* Soft ceiling only — stacked softsat was flattening every engine into one tone. */
    if (out_l > 1.0f) {
      out_l = 1.0f + ht_tanhf(out_l - 1.0f) * 0.2f;
    } else if (out_l < -1.0f) {
      out_l = -1.0f + ht_tanhf(out_l + 1.0f) * 0.2f;
    }
    if (out_r > 1.0f) {
      out_r = 1.0f + ht_tanhf(out_r - 1.0f) * 0.2f;
    } else if (out_r < -1.0f) {
      out_r = -1.0f + ht_tanhf(out_r + 1.0f) * 0.2f;
    }
#else
    out_l = ht_softsat(out_l, 0.55f);
    out_r = ht_softsat(out_r, 0.55f);
    if (out_l > 1.25f) {
      out_l = 1.25f;
    }
    if (out_l < -1.25f) {
      out_l = -1.25f;
    }
    if (out_r > 1.25f) {
      out_r = 1.25f;
    }
    if (out_r < -1.25f) {
      out_r = -1.25f;
    }
#endif
    lr[2 * frame] = out_l;
    lr[2 * frame + 1] = out_r;
  }
}

void ht_voice_render(HtVoiceBank *bank, int32_t *lr, uint32_t frames, uint32_t master_q12) {
  float scratch[512];
  uint32_t done = 0;
  float gain = (float)master_q12 / 4096.0f * bank->bus.court_gate;
  if (!bank || !lr || frames == 0u) {
    return;
  }
  while (done < frames) {
    uint32_t chunk = frames - done;
    uint32_t i;
    if (chunk > 256u) {
      chunk = 256u;
    }
    ht_voice_render_linear(bank, scratch, chunk, gain);
    for (i = 0; i < chunk * 2u; i += 1) {
      float sample = scratch[i] * 9200000.0f;
      if (sample > 8000000.0f) {
        sample = 8000000.0f;
      }
      if (sample < -8000000.0f) {
        sample = -8000000.0f;
      }
      lr[done * 2u + i] = (int32_t)sample;
    }
    done += chunk;
  }
}

#ifdef HT_STAGE_NATIVE
void ht_voice_render_f32(HtVoiceBank *bank, float *lr, uint32_t frames, float master01) {
  float gain;
  if (!bank || !lr || frames == 0u) {
    return;
  }
  gain = ht_clampf(master01, 0.0f, 1.0f) * bank->bus.court_gate;
  ht_voice_render_linear(bank, lr, frames, gain);
}
#endif
