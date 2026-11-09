/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1 */
#include "ht_voice.h"

#include "ht_dsp_common.h"
#include "ht_patch.h"

void ht_voice_init(HtVoiceBank *bank) {
  uint32_t index;
  for (index = 0; index < HT_VOICE_SLOTS; index += 1) {
    ht_osc_slot_clear(&bank->osc[index]);
    bank->osc[index].noise = 0x1234u + index * 97u;
    ht_wg_clear(&bank->wg[index]);
    bank->use_wg[index] = 0;
    bank->wg_drum[index] = 0;
  }
  for (index = 0; index < HT_SCATTER_SAMPLES; index += 1) {
    bank->scatter_delay[index] = 0.0f;
  }
  bank->scatter_write = 0;
  bank->duck_depth = 0.55f;
  bank->gain_now = 0.0f;
  bank->lfo_phase = 0.0f;
  bank->seed = 1;
  bank->envelope = ht_envelope_from_env_knob(0.5f);
  bank->bus.feedback = 0.45f;
  bank->bus.scatter = 0.2f;
  bank->bus.drive = 0.35f;
  bank->bus.delay_time = 0.22f;
  bank->bus.lfo_depth = 0.3f;
  bank->bus.wildness = 0.55f;
  bank->bus.compress = 0.45f;
  bank->bus.court_gate = 1.0f;
  bank->bus.dry = 0.85f;
  bank->bus.wet = 0.28f;
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
}

void ht_voice_panic(HtVoiceBank *bank) {
  uint32_t index;
  for (index = 0; index < HT_VOICE_SLOTS; index += 1) {
    bank->osc[index].target = 0.0f;
    bank->osc[index].active = 0;
    bank->osc[index].released = 1;
    ht_wg_note_off(&bank->wg[index]);
    bank->use_wg[index] = 0;
  }
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
  if (!bus) {
    return;
  }
  bank->bus = *bus;
  bank->envelope = ht_envelope_from_env_knob(ht_clampf(1.0f - bus->wildness * 0.35f, 0.0f, 1.0f));
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
}

uint8_t ht_voice_pick_engine(uint32_t seed, float midi, uint8_t drum_part) {
  if (drum_part) {
    return HT_ENGINE_NOISE;
  }
  return (uint8_t)((seed ^ ((uint32_t)(midi * 97.0f) * 0x85ebca6bu) ^ 0xC001D00Du) % HT_ENGINE_COUNT);
}

static uint32_t alloc_slot(HtVoiceBank *bank) {
  uint32_t index;
  for (index = 0; index < HT_VOICE_SLOTS; index += 1) {
    if (!bank->osc[index].active && !bank->use_wg[index]) {
      return index;
    }
  }
  return 0;
}

void ht_voice_note_on(HtVoiceBank *bank, float midi, uint8_t velocity, uint8_t engine) {
  uint32_t slot = alloc_slot(bank);
  float vel = (float)velocity / 127.0f;
  uint8_t drum = (uint8_t)ht_engine_is_drum_midi(engine, midi);
  if (vel < 0.05f) {
    vel = 0.05f;
  }
  if (engine >= HT_ENGINE_COUNT) {
    engine = HT_ENGINE_SUBTRACTIVE;
  }
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
  bank->osc[slot].target = (drum ? 0.4f : 0.28f) * vel;
}

void ht_voice_note_off(HtVoiceBank *bank, float midi) {
  uint32_t index;
  for (index = 0; index < HT_VOICE_SLOTS; index += 1) {
    if (bank->use_wg[index] && ht_fabsf(bank->wg[index].midi - midi) < 0.06f) {
      ht_wg_note_off(&bank->wg[index]);
      bank->use_wg[index] = 0;
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
  if (!bank) {
    return;
  }
  for (index = 0; index < HT_VOICE_SLOTS; index += 1) {
    HtOscSlot *slot = &bank->osc[index];
    if (slot->active && !slot->drum && slot->age >= limit) {
      slot->released = 1;
      slot->active = 0;
      slot->target = 0.0f;
    }
    if (bank->use_wg[index] && !bank->wg_drum[index] && !bank->wg[index].bowed &&
        bank->wg[index].active && slot->age >= limit) {
      ht_wg_note_off(&bank->wg[index]);
      bank->use_wg[index] = 0;
    }
  }
}

static float scatter_process(HtVoiceBank *bank, float input) {
  float amount = ht_clampf(bank->bus.scatter, 0.0f, 1.0f);
  float delay_samples =
      ht_clampf(bank->bus.delay_time * 0.45f, 0.018f, 0.22f) * HT_DSP_SAMPLE_RATE;
  uint32_t length = HT_SCATTER_SAMPLES;
  uint32_t index;
  float delayed;
  float fb;
  float ducked_dry;
  if (amount < 0.01f) {
    return input;
  }
  if (delay_samples > (float)(length - 2u)) {
    delay_samples = (float)(length - 2u);
  }
  ducked_dry = input * (1.0f - bank->duck_depth * 0.35f * amount);
  bank->scatter_delay[bank->scatter_write % length] = input;
  index = (bank->scatter_write + length - (uint32_t)delay_samples) % length;
  delayed = bank->scatter_delay[index];
  fb = delayed * (0.15f + amount * 0.45f);
  bank->scatter_delay[bank->scatter_write % length] = input + fb * 0.35f;
  bank->scatter_write = (bank->scatter_write + 1u) % length;
  return ducked_dry + delayed * amount * 0.55f;
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

void ht_voice_render(HtVoiceBank *bank, int32_t *lr, uint32_t frames, uint32_t master_q12) {
  uint32_t frame;
  uint32_t index;
  /* Slightly hotter than template's 8.3e6 so generative engines stay clear at mid MASTER. */
  float gain = (float)master_q12 / 4096.0f * 9200000.0f * bank->bus.court_gate;
  for (frame = 0; frame < frames; frame += 1) {
    float music = 0.0f;
    float drums = 0.0f;
    float out;
    float lfo;
    float sc_gain;
    bank->gain_now += (gain - bank->gain_now) * 0.004f;
    bank->lfo_phase += (0.4f + bank->bus.lfo_depth * 2.5f) / HT_DSP_SAMPLE_RATE;
    if (bank->lfo_phase >= 1.0f) {
      bank->lfo_phase -= 1.0f;
    }
    lfo = ht_sinf(bank->lfo_phase * 6.2831853f) * bank->bus.lfo_depth;

    for (index = 0; index < HT_VOICE_SLOTS; index += 1) {
      float sample = 0.0f;
      uint8_t drum = 0;
      bank->osc[index].age += 1.0f / HT_DSP_SAMPLE_RATE;
      if (bank->use_wg[index]) {
        sample = ht_wg_process(&bank->wg[index]);
        drum = bank->wg_drum[index];
      } else {
        HtOscSlot *slot = &bank->osc[index];
        float env;
        env = ht_envelope_level(slot->age, envelope_for_slot(bank, slot), slot->released);
        slot->level += (slot->target * env - slot->level) * 0.01f;
        if (slot->level < 0.00008f && slot->target <= 0.0f) {
          continue;
        }
        sample = ht_engine_sample(slot, lfo) * slot->level;
        drum = slot->drum;
      }
      if (drum) {
        drums += sample;
      } else {
        music += sample;
      }
    }

    sc_gain = ht_sidechain_process(&bank->sidechain, drums);
    out = music * sc_gain + drums;
    out = ht_court_chain_process(&bank->court, out);
    out = scatter_process(bank, out);
    out += ht_grain_delay_process(&bank->grain, out);
    out = ht_tape_process(&bank->tape, out);
    out = ht_eq_bus_process(&bank->eq, out);
    out = soft_compress(out, bank->bus.compress, bank->sidechain.env);
    out = ht_analog_bus_process(&bank->analog, out);
    out *= bank->gain_now;
    if (out > 8000000.0f) {
      out = 8000000.0f;
    }
    if (out < -8000000.0f) {
      out = -8000000.0f;
    }
    lr[2 * frame] = (int32_t)out;
    lr[2 * frame + 1] = (int32_t)out;
  }
}
