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
  wg->amp = 0.0f;
  wg->peak = 0.0f;
  wg->feedback = 0.0f;
  wg->feedback_live = 0.0f;
  wg->out_gain = 0.45f;
  wg->breath = 0.0f;
  wg->breath_peak = 0.0f;
  wg->buzz_phase = 0.0f;
  wg->formant_z = 0.0f;
  wg->formant2_z = 0.0f;
  wg->lp2_z = 0.0f;
  wg->age = 0.0f;
  wg->release_age = 0.0f;
  wg->attack = 0.02f;
  wg->decay = 0.1f;
  wg->sustain = 0.6f;
  wg->release = 0.25f;
  wg->engine = HT_ENGINE_PIPE;
  wg->midi = 0;
  wg->active = 0;
  wg->released = 0;
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

/* ADSR shapes close to lyra_synth.js physical / string_synth.js pluck. */
static void physical_adsr(uint8_t engine, float vel, HtWaveguide *wg) {
  if (engine == HT_ENGINE_VIOLIN) {
    wg->attack = 0.04f;
    wg->decay = 0.35f;
    wg->sustain = 0.78f;
    wg->release = 0.28f;
    wg->peak = 0.42f + vel * 0.35f;
  } else if (engine == HT_ENGINE_PIANO) {
    wg->attack = 0.004f;
    wg->decay = 0.045f;
    wg->sustain = 0.32f;
    wg->release = 0.48f;
    wg->peak = 0.4f + vel * 0.4f;
  } else if (engine == HT_ENGINE_GUITAR || engine == HT_ENGINE_KARPLUS) {
    wg->attack = 0.008f;
    wg->decay = 0.07f;
    wg->sustain = 0.38f;
    wg->release = 0.36f;
    wg->peak = 0.35f + vel * 0.4f;
  } else if (engine == HT_ENGINE_SAXOPHONE || engine == HT_ENGINE_DIDGERIDOO) {
    wg->attack = 0.03f;
    wg->decay = 0.14f;
    wg->sustain = 0.72f;
    wg->release = 0.3f;
    wg->peak = 0.48f + vel * 0.35f;
  } else if (engine == HT_ENGINE_VARGAN) {
    wg->attack = 0.002f;
    wg->decay = 0.08f;
    wg->sustain = 0.2f;
    wg->release = 0.22f;
    wg->peak = 0.5f + vel * 0.4f;
  } else {
    wg->attack = 0.025f;
    wg->decay = 0.12f;
    wg->sustain = 0.68f;
    wg->release = 0.28f;
    wg->peak = 0.45f + vel * 0.4f;
  }
}

static float amp_from_adsr(const HtWaveguide *wg) {
  HtEnvelope shape;
  shape.attack = wg->attack;
  shape.decay = wg->decay;
  shape.sustain = wg->sustain;
  shape.release = wg->release;
  shape.filter_env = 0.0f;
  if (wg->released) {
    return ht_envelope_level(wg->release_age, &shape, 1) * wg->peak;
  }
  return ht_envelope_level(wg->age, &shape, 0) * wg->peak;
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
  wg->released = 0;
  wg->age = 0.0f;
  wg->release_age = 0.0f;
  wg->length = delay_len_for_midi(midi);
  wg->out_gain = ht_physical_output_gain(engine);
  wg->noise ^= (uint32_t)(midi * 0x9E3779B9u);
  physical_adsr(engine, vel, wg);
  wg->amp = 0.0f;

  if (ht_engine_is_string(engine)) {
    wg->feedback = ht_string_feedback_cap(engine, sharp);
    wg->feedback_live = wg->feedback;
    wg->bowed = (engine == HT_ENGINE_VIOLIN) ? 1 : 0;
    wg->breath = 0.0f;
    wg->breath_peak = wg->bowed ? (0.03f + vel * 0.05f) : 0.0f;
    for (index = 0; index < wg->length; index += 1) {
      wg->delay[index] = ht_noise_f(&wg->noise) * vel;
    }
  } else {
    wg->feedback = ht_pipe_feedback_cap(engine, sharp);
    wg->feedback_live = wg->feedback;
    wg->bowed = (engine == HT_ENGINE_DIDGERIDOO || engine == HT_ENGINE_SAXOPHONE) ? 1 : 0;
    wg->breath_peak = (engine == HT_ENGINE_VARGAN) ? 0.0f : 0.35f * vel;
    wg->breath = 0.0f;
    for (index = 0; index < wg->length; index += 1) {
      wg->delay[index] = 0.0f;
    }
  }
}

void ht_wg_note_off(HtWaveguide *wg) {
  wg->active = 0;
  wg->bowed = 0;
  wg->released = 1;
  wg->release_age = 0.0f;
  wg->breath_peak = 0.0f;
}

float ht_wg_process(HtWaveguide *wg) {
  uint16_t read;
  float tap;
  float exc = 0.0f;
  float damp;
  float out;
  float target_amp;
  if (wg->length < 16u) {
    return 0.0f;
  }
  wg->age += 1.0f / HT_DSP_SAMPLE_RATE;
  if (wg->released) {
    wg->release_age += 1.0f / HT_DSP_SAMPLE_RATE;
  }
  target_amp = amp_from_adsr(wg);
  wg->amp += (target_amp - wg->amp) * 0.08f;
  if (wg->released) {
    float fade = wg->release > 0.001f ? (1.0f - wg->release_age / wg->release) : 0.0f;
    if (fade < 0.0f) {
      fade = 0.0f;
    }
    wg->feedback_live = wg->feedback * fade;
    wg->breath *= 0.995f;
  } else {
    wg->feedback_live = wg->feedback;
    /* Breath / bow rises with attack (string_synth.pluck / pipe setActive). */
    {
      float breath_target = wg->breath_peak;
      if (wg->engine == HT_ENGINE_VIOLIN && wg->bowed) {
        breath_target = wg->breath_peak;
      } else if (!wg->bowed && ht_engine_is_string(wg->engine)) {
        /* Pluck: short excitation burst, then silence into the loop. */
        if (wg->age < wg->attack + wg->decay) {
          breath_target = wg->breath_peak;
        } else {
          breath_target = 0.0f;
        }
      }
      wg->breath += (breath_target - wg->breath) * 0.05f;
    }
  }
  if (wg->amp < 0.00008f && wg->released && wg->feedback_live < 0.001f) {
    return 0.0f;
  }

  read = (uint16_t)((wg->write + wg->length - 1u) % wg->length);
  tap = wg->delay[read];
  /* Piano/guitar: stretched second tap (~0.2%) like string_synth.js delayB. */
  if (wg->engine == HT_ENGINE_PIANO || wg->engine == HT_ENGINE_GUITAR) {
    uint16_t stretch = (uint16_t)(wg->length / 500u);
    uint16_t read2;
    if (stretch < 1u) {
      stretch = 1u;
    }
    if (stretch > 12u) {
      stretch = 12u;
    }
    if (wg->engine == HT_ENGINE_GUITAR) {
      stretch = (uint16_t)(stretch > 1u ? stretch - 1u : 1u);
    }
    read2 = (uint16_t)((wg->write + wg->length - 1u - stretch) % wg->length);
    tap = tap * 0.58f + wg->delay[read2] * 0.42f;
  }

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
        buzz += ht_sinf(wg->buzz_phase * 12.56637f) * 0.08f;
      } else if (wg->engine == HT_ENGINE_SAXOPHONE) {
        buzz = ht_sinf(wg->buzz_phase * 6.2831853f);
        buzz = ht_softsat(buzz + breath_noise * 0.35f, 0.55f);
      } else if (wg->engine == HT_ENGINE_VARGAN) {
        float pulse = wg->buzz_phase < 0.08f ? 1.0f : 0.0f;
        exc = (pulse * 1.15f + breath_noise * 0.18f) * wg->amp;
      } else if (wg->engine == HT_ENGINE_PIPE) {
        buzz = ht_sinf(wg->buzz_phase * 6.2831853f) * 0.22f + breath_noise * wg->breath;
      } else {
        buzz = breath_noise * wg->breath;
      }
      if (wg->engine != HT_ENGINE_VARGAN) {
        exc = (buzz + breath_noise * wg->breath) * (wg->amp > 0.001f ? 1.0f : 0.0f);
      }
    }
    damp = wg->engine == HT_ENGINE_VARGAN ? 0.22f : 0.35f;
  } else {
    if (wg->bowed && !wg->released) {
      exc = ht_noise_f(&wg->noise) * 0.18f * wg->amp;
    } else if (wg->breath > 0.001f && ht_engine_is_string(wg->engine) && !wg->bowed) {
      /* Residual pluck noise into the delay while attack/decay runs. */
      exc = ht_noise_f(&wg->noise) * wg->breath * 0.35f;
    }
    damp = (wg->engine == HT_ENGINE_PIANO) ? 0.28f : 0.22f;
  }

  out = ht_onepole(tap + exc, &wg->lp_z, damp);
  out = ht_softsat(out, 0.25f);
  if (wg->engine == HT_ENGINE_SAXOPHONE || wg->engine == HT_ENGINE_DIDGERIDOO ||
      wg->engine == HT_ENGINE_VARGAN || wg->engine == HT_ENGINE_PIPE) {
    float body = out - wg->formant_z;
    float bite = out - wg->formant2_z;
    wg->formant_z = out * 0.72f + wg->formant_z * 0.28f;
    wg->formant2_z = out * 0.45f + wg->formant2_z * 0.55f;
    if (wg->engine == HT_ENGINE_VARGAN) {
      out = out * 0.4f + body * 0.75f + bite * 0.35f;
    } else if (wg->engine == HT_ENGINE_SAXOPHONE) {
      out = out * 0.55f + body * 0.55f + bite * 0.4f;
    } else if (wg->engine == HT_ENGINE_DIDGERIDOO) {
      out = out * 0.5f + body * 0.65f + bite * 0.25f;
    } else {
      out = out * 0.7f + body * 0.35f;
    }
    out = ht_onepole(out, &wg->lp2_z, 0.4f);
  }

  wg->delay[wg->write] = out * wg->feedback_live;
  wg->write = (uint16_t)((wg->write + 1u) % wg->length);
  return out * wg->amp * wg->out_gain;
}
