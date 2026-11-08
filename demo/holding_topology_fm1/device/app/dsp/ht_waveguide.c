/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1 */
#include "ht_waveguide.h"

#include "ht_fx.h"
#include "ht_patch.h"

void ht_wg_clear(HtWaveguide *wg) {
  uint16_t index;
  for (index = 0; index < HT_WG_DELAY_MAX; index += 1) {
    wg->delay[index] = 0.0f;
  }
  wg->length = 64;
  wg->write = 0;
  wg->lp_z = 0.0f;
  wg->level = 0.0f;
  wg->target = 0.0f;
  wg->feedback = 0.0f;
  wg->out_gain = 0.45f;
  wg->breath = 0.0f;
  wg->buzz_phase = 0.0f;
  wg->formant_z = 0.0f;
  wg->engine = HT_ENGINE_PIPE;
  wg->midi = 0;
  wg->active = 0;
  wg->bowed = 0;
  wg->noise = 0xC0FFEE11u;
}

static uint16_t delay_len_for_midi(float midi) {
  float clamped = midi < 24.0f ? 24.0f : midi;
  float hz = ht_note_hz_f(clamped);
  uint32_t samples = (uint32_t)(HT_DSP_SAMPLE_RATE / hz + 0.5f);
  if (samples < 16u) {
    samples = 16u;
  }
  if (samples > HT_WG_DELAY_MAX - 1u) {
    samples = HT_WG_DELAY_MAX - 1u;
  }
  return (uint16_t)samples;
}

void ht_wg_note_on(HtWaveguide *wg, uint8_t engine, float midi, uint8_t velocity, float sharp) {
  uint16_t index;
  float vel = (float)velocity / 127.0f;
  if (vel < 0.05f) {
    vel = 0.05f;
  }
  ht_wg_clear(wg);
  wg->engine = engine;
  wg->midi = midi;
  wg->active = 1;
  wg->length = delay_len_for_midi(midi);
  wg->out_gain = ht_physical_output_gain(engine);
  wg->noise ^= (uint32_t)(midi * 0x9E3779B9u);

  if (ht_engine_is_string(engine)) {
    wg->feedback = ht_string_feedback_cap(engine, sharp);
    wg->bowed = (engine == HT_ENGINE_VIOLIN) ? 1 : 0;
    wg->target = 0.55f * vel;
    for (index = 0; index < wg->length; index += 1) {
      wg->delay[index] = ht_noise_f(&wg->noise) * vel;
    }
  } else {
    wg->feedback = ht_pipe_feedback_cap(engine, sharp);
    wg->bowed = (engine == HT_ENGINE_DIDGERIDOO || engine == HT_ENGINE_SAXOPHONE) ? 1 : 0;
    wg->breath = (engine == HT_ENGINE_VARGAN) ? 0.0f : 0.35f * vel;
    wg->target = 0.5f * vel;
    for (index = 0; index < wg->length; index += 1) {
      wg->delay[index] = 0.0f;
    }
  }
}

void ht_wg_note_off(HtWaveguide *wg) {
  wg->active = 0;
  wg->bowed = 0;
  wg->breath = 0.0f;
  wg->target = 0.0f;
  wg->feedback = 0.0f;
}

float ht_wg_process(HtWaveguide *wg) {
  uint16_t read;
  float tap;
  float exc = 0.0f;
  float damp;
  float out;
  if (wg->length < 16u) {
    return 0.0f;
  }
  wg->level += (wg->target - wg->level) * 0.004f;
  if (wg->level < 0.00008f && wg->target <= 0.0f && !wg->active) {
    return 0.0f;
  }

  read = (uint16_t)((wg->write + wg->length - 1u) % wg->length);
  tap = wg->delay[read];

  if (ht_engine_is_wind(wg->engine)) {
    float buzz = 0.0f;
    if (wg->bowed || wg->breath > 0.001f) {
      float breath_noise = ht_noise_f(&wg->noise);
      wg->buzz_phase += ht_note_hz_f(wg->midi) / HT_DSP_SAMPLE_RATE;
      if (wg->buzz_phase >= 1.0f) {
        wg->buzz_phase -= 1.0f;
      }
      if (wg->engine == HT_ENGINE_DIDGERIDOO) {
        buzz = (wg->buzz_phase < 0.5f ? 1.0f : -1.0f) * 0.25f;
      } else if (wg->engine == HT_ENGINE_SAXOPHONE) {
        buzz = ht_sinf(wg->buzz_phase * 6.2831853f);
        buzz = ht_softsat(buzz + breath_noise * 0.35f, 0.55f);
      } else if (wg->engine == HT_ENGINE_VARGAN) {
        exc = breath_noise * (wg->active ? 0.55f * wg->level : 0.0f);
      } else {
        buzz = breath_noise * wg->breath;
      }
      if (wg->engine != HT_ENGINE_VARGAN) {
        exc = (buzz + breath_noise * wg->breath) * (wg->active ? 1.0f : 0.0f);
      }
    }
    damp = 0.35f;
  } else {
    if (wg->bowed && wg->active) {
      exc = ht_noise_f(&wg->noise) * 0.18f * wg->level;
    }
    damp = (wg->engine == HT_ENGINE_PIANO) ? 0.28f : 0.22f;
  }

  out = ht_onepole(tap + exc, &wg->lp_z, damp);
  out = ht_softsat(out, 0.25f);
  if (wg->engine == HT_ENGINE_SAXOPHONE || wg->engine == HT_ENGINE_DIDGERIDOO) {
    float formant = out - wg->formant_z;
    wg->formant_z = out;
    out = out * 0.7f + formant * 0.45f;
  }

  wg->delay[wg->write] = out * (wg->active ? wg->feedback : 0.0f);
  wg->write = (uint16_t)((wg->write + 1u) % wg->length);
  return out * wg->level * wg->out_gain;
}
