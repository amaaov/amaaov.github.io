/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1 */
#include "ht_engines.h"

/* Compact wavetable: 0 = sine-ish, 1 = saw-ish (linear morph). */
static float wavetable_at(float phase, float morph) {
  float x = phase;
  float sine = ht_sinf(x * 6.2831853f);
  float saw = 2.0f * x - 1.0f;
  float tri = 4.0f * ht_fabsf(x - 0.5f) - 1.0f;
  float m = ht_clampf(morph, 0.0f, 1.0f);
  if (m < 0.5f) {
    return sine * (1.0f - m * 2.0f) + tri * (m * 2.0f);
  }
  return tri * (2.0f - m * 2.0f) + saw * ((m - 0.5f) * 2.0f);
}

static void vowel_freqs(uint8_t index, float out[3]) {
  static const float table[5][3] = {
      {730.0f, 1090.0f, 2440.0f}, /* a */
      {530.0f, 1840.0f, 2480.0f}, /* e */
      {270.0f, 2290.0f, 3010.0f}, /* i */
      {570.0f, 840.0f, 2410.0f},  /* o */
      {300.0f, 870.0f, 2240.0f},  /* u */
  };
  uint8_t row = index % 5u;
  out[0] = table[row][0];
  out[1] = table[row][1];
  out[2] = table[row][2];
}

static float resonator(float input, float *z, float hz, float q_proxy) {
  float coeff = ht_clampf(hz / (HT_DSP_SAMPLE_RATE * (0.5f + q_proxy)), 0.01f, 0.95f);
  float band = input - *z;
  *z += coeff * band;
  return band * (0.35f + q_proxy * 0.2f) + *z * 0.15f;
}

static float wrap01(float phase) {
  while (phase >= 1.0f) {
    phase -= 1.0f;
  }
  while (phase < 0.0f) {
    phase += 1.0f;
  }
  return phase;
}

/* Minnaert-style bubble pops + pinkish flow bed; mode1 = waterfall rush. */
static float sample_bubble(HtOscSlot *slot, float hz, float lfo) {
  float n = ht_noise_f(&slot->noise);
  float flow;
  float rate;
  float bubble = 0.0f;
  int waterfall = (slot->vowel_index & 1u) != 0;
  rate = waterfall ? (0.0018f + hz * 0.0000025f) : (0.00035f + hz * 0.0000008f);
  rate *= 1.0f + lfo * 0.35f;
  flow = ht_onepole(n, &slot->formant_z[2], waterfall ? 0.12f : 0.045f);
  if (((float)(ht_noise_u32(&slot->noise) & 0xffffu) / 65535.0f) < rate) {
    slot->formant_z[0] = 1.0f;
    slot->formant_z[1] =
        (waterfall ? 280.0f : 520.0f) +
        ((float)(ht_noise_u32(&slot->noise) & 0xffffu) / 65535.0f) *
            (waterfall ? 2400.0f : 1600.0f);
    slot->grain_phase = 0.0f;
  }
  if (slot->formant_z[0] > 0.0005f) {
    float f = slot->formant_z[1];
    slot->grain_phase = wrap01(slot->grain_phase + f / HT_DSP_SAMPLE_RATE);
    bubble = ht_sinf(slot->grain_phase * 6.2831853f) * slot->formant_z[0];
    /* Pitch falls slightly as the cavity stabilises. */
    slot->formant_z[1] *= 0.99972f;
    slot->formant_z[0] *= waterfall ? 0.9988f : 0.9975f;
  }
  return flow * (waterfall ? 0.55f : 0.22f) + bubble * (waterfall ? 0.55f : 0.85f);
}

/* Bird / bark / owl motifs via FM + sweeps. mode: chirp,trill,bark,owl. */
static float sample_bird(HtOscSlot *slot, float hz, float lfo) {
  uint8_t mode = (uint8_t)(slot->vowel_index % 4u);
  float t = slot->age;
  float cycle = wrap01(t * (mode == 3u ? 0.55f : 2.4f + (float)((int)slot->midi % 5) * 0.15f));
  float base = hz * (mode == 3u ? 0.45f : 1.35f + (float)((int)slot->midi % 7) * 0.08f);
  float f = base;
  float depth = 0.8f + lfo * 0.4f;
  float env = 1.0f;
  float mod;
  float carrier;
  if (mode == 0u) {
    /* Chirp: quadratic upsweep. */
    f = base * (0.7f + 2.2f * cycle * cycle);
    env = cycle < 0.72f ? 1.0f : 1.0f - (cycle - 0.72f) / 0.28f;
  } else if (mode == 1u) {
    /* Trill: two-pitch alternation. */
    f = base * (cycle < 0.5f ? 1.0f : 1.22f);
    env = 0.75f + 0.25f * ht_sinf(cycle * 25.13274f);
  } else if (mode == 2u) {
    /* Bark / harsh call: short AM noise + FM. */
    f = base * (0.55f + 0.9f * (1.0f - cycle));
    env = cycle < 0.18f ? cycle / 0.18f : (cycle < 0.55f ? 1.0f : 1.0f - (cycle - 0.55f) / 0.45f);
    depth = 2.4f;
  } else {
    /* Owl whoop: slow down-glide. */
    f = base * (1.35f - 0.55f * cycle);
    env = cycle < 0.12f ? cycle / 0.12f : (cycle < 0.75f ? 1.0f : 1.0f - (cycle - 0.75f) / 0.25f);
    depth = 0.35f;
  }
  slot->phase2 = wrap01(slot->phase2 + (f * 2.15f) / HT_DSP_SAMPLE_RATE);
  slot->phase = wrap01(slot->phase + f / HT_DSP_SAMPLE_RATE);
  mod = ht_sinf(slot->phase2 * 6.2831853f) * depth;
  carrier = ht_sinf((slot->phase + mod * 0.07f) * 6.2831853f);
  if (mode == 2u) {
    carrier = carrier * (0.55f + 0.45f * ht_fabsf(ht_noise_f(&slot->noise))) +
              ht_noise_f(&slot->noise) * 0.22f * env;
  }
  return carrier * ht_clampf(env, 0.0f, 1.0f);
}

/* Forest canopy bed vs gust wind — filtered noise + sparse rustle. */
static float sample_forest(HtOscSlot *slot, float hz, float lfo) {
  int gust = (slot->vowel_index & 1u) != 0;
  float n = ht_noise_f(&slot->noise);
  float brown = ht_onepole(n, &slot->formant_z[0], gust ? 0.08f : 0.03f);
  float cut = (gust ? 900.0f : 420.0f) + hz * 0.35f +
              (0.5f + 0.5f * ht_sinf(slot->age * (gust ? 1.1f : 0.28f) + lfo)) *
                  (gust ? 2800.0f : 1400.0f);
  float air = resonator(brown, &slot->formant_z[1], cut, gust ? 0.55f : 0.35f);
  float rustle = 0.0f;
  if (((float)(ht_noise_u32(&slot->noise) & 0xffffu) / 65535.0f) < (gust ? 0.0009f : 0.00025f)) {
    slot->formant_z[2] = 0.9f;
  }
  if (slot->formant_z[2] > 0.001f) {
    rustle = ht_noise_f(&slot->noise) * slot->formant_z[2];
    slot->formant_z[2] *= 0.992f;
  }
  return air * (gust ? 0.7f : 0.45f) + rustle * 0.35f + brown * 0.12f;
}

/* Dolphin whistle: harmonic FM contour (up / down / convex / sine). */
static float sample_dolphin(HtOscSlot *slot, float hz, float lfo) {
  uint8_t contour = (uint8_t)(slot->vowel_index % 4u);
  float cycle = wrap01(slot->age * (1.1f + (float)((int)slot->midi % 5) * 0.12f));
  float shape;
  float f;
  float fund;
  float h2;
  float h3;
  float env;
  if (contour == 0u) {
    shape = cycle;
  } else if (contour == 1u) {
    shape = 1.0f - cycle;
  } else if (contour == 2u) {
    shape = 1.0f - 4.0f * (cycle - 0.5f) * (cycle - 0.5f);
  } else {
    shape = 0.5f + 0.5f * ht_sinf(cycle * 6.2831853f);
  }
  f = hz * (3.2f + 5.5f * shape) * (1.0f + lfo * 0.03f);
  env = cycle < 0.08f ? cycle / 0.08f : (cycle < 0.82f ? 1.0f : 1.0f - (cycle - 0.82f) / 0.18f);
  slot->phase = wrap01(slot->phase + f / HT_DSP_SAMPLE_RATE);
  slot->phase2 = wrap01(slot->phase2 + (f * 2.0f) / HT_DSP_SAMPLE_RATE);
  slot->phase3 = wrap01(slot->phase3 + (f * 3.0f) / HT_DSP_SAMPLE_RATE);
  fund = ht_sinf(slot->phase * 6.2831853f);
  h2 = ht_sinf(slot->phase2 * 6.2831853f) * 0.42f;
  h3 = ht_sinf(slot->phase3 * 6.2831853f) * 0.16f;
  return (fund + h2 + h3) * ht_clampf(env, 0.0f, 1.0f);
}

/*
 * Campfire vs forest fire — Farnell-style crackle + hiss + low lapping.
 * mode0 = camp (sparse pops, soft rumble); mode1 = forest blaze (dense roar).
 */
static float sample_fire(HtOscSlot *slot, float hz, float lfo) {
  int blaze = (slot->vowel_index & 1u) != 0;
  float n = ht_noise_f(&slot->noise);
  float rumble = ht_onepole(n, &slot->formant_z[0], blaze ? 0.06f : 0.025f);
  float hiss_mod = ht_noise_f(&slot->noise);
  /* Squared-squared dynamics for rare loud hiss bursts. */
  hiss_mod = hiss_mod * hiss_mod;
  hiss_mod = hiss_mod * hiss_mod;
  float hiss = resonator(n, &slot->formant_z[1], blaze ? 2200.0f : 1400.0f, 0.45f) * hiss_mod;
  float crackle = 0.0f;
  float rate = blaze ? (0.0022f + hz * 0.0000015f) : (0.00045f + hz * 0.0000006f);
  rate *= 1.0f + lfo * 0.25f;
  if (((float)(ht_noise_u32(&slot->noise) & 0xffffu) / 65535.0f) < rate) {
    slot->formant_z[2] = 1.0f;
    slot->grain_phase =
        120.0f + ((float)(ht_noise_u32(&slot->noise) & 0xffffu) / 65535.0f) *
                     (blaze ? 1400.0f : 900.0f);
  }
  if (slot->formant_z[2] > 0.001f) {
    float pop = n * slot->formant_z[2];
    crackle = pop + resonator(pop, &slot->grain_buf[0], slot->grain_phase, 1.4f) * 0.55f;
    slot->formant_z[2] *= blaze ? 0.985f : 0.96f;
  }
  float lap = ht_softsat(rumble * (blaze ? 2.8f : 1.6f), blaze ? 0.55f : 0.35f);
  if (blaze) {
    return crackle * 0.22f + hiss * 0.35f + lap * 0.55f;
  }
  return crackle * 0.45f + hiss * 0.2f + lap * 0.35f;
}

/* Funk slap vs reggae dub bass — dual osc + age-driven filter brightness. */
static float sample_dub_bass(HtOscSlot *slot, float hz, float lfo) {
  int dub = (slot->vowel_index & 1u) != 0;
  float saw = 2.0f * slot->phase - 1.0f;
  float square = slot->phase2 < 0.5f ? 0.7f : -0.7f;
  float sub = ht_sinf(slot->phase * 6.2831853f);
  float mix;
  float bright;
  float t = slot->age;
  float fenv;
  if (dub) {
    /* Slow / reverse-ish filter open for dread bass. */
    fenv = ht_clampf(t * 2.2f, 0.0f, 1.0f);
    mix = sub * 0.62f + saw * 0.28f + square * 0.1f;
    bright = 0.04f + fenv * 0.14f + lfo * 0.02f;
  } else {
    /* Funk slap: snappy filter burst then body. */
    fenv = t < 0.06f ? 1.0f : ht_clampf(1.0f - (t - 0.06f) * 3.5f, 0.18f, 1.0f);
    mix = saw * 0.45f + square * 0.35f + sub * 0.2f;
    bright = 0.08f + fenv * 0.45f + lfo * 0.03f;
  }
  (void)hz;
  return mix * (0.85f + bright * 0.2f);
}

void ht_osc_slot_clear(HtOscSlot *slot) {
  uint16_t index;
  slot->phase = 0.0f;
  slot->phase2 = 0.13f;
  slot->phase3 = 0.27f;
  slot->level = 0.0f;
  slot->target = 0.0f;
  slot->cutoff_z = 0.0f;
  slot->formant_z[0] = 0.0f;
  slot->formant_z[1] = 0.0f;
  slot->formant_z[2] = 0.0f;
  for (index = 0; index < HT_GRAIN_BUF; index += 1) {
    slot->grain_buf[index] = 0.0f;
  }
  slot->grain_write = 0;
  slot->grain_phase = 0.0f;
  slot->age = 0.0f;
  slot->engine = HT_ENGINE_SUBTRACTIVE;
  slot->midi = 0;
  slot->active = 0;
  slot->released = 0;
  slot->drum = 0;
  slot->vowel_index = 0;
  slot->noise = 0xA5A5A5A5u;
}

int ht_engine_is_drum_midi(uint8_t engine, float midi) {
  uint8_t rounded = (uint8_t)(midi + 0.5f);
  return engine == HT_ENGINE_NOISE || rounded == 36 || rounded == 38 || rounded == 42;
}

float ht_engine_sample(HtOscSlot *slot, float lfo, float filter_env) {
  float hz = ht_note_hz_f(slot->midi) * (1.0f + lfo * 0.02f);
  float inc = hz / HT_DSP_SAMPLE_RATE;
  float wave = 0.0f;
  float bright = 0.22f;
  float mod;
  float carrier;
  float morph;
  float freqs[3];
  uint16_t g;
  float grain;
  uint8_t midi_round = (uint8_t)(slot->midi + 0.5f);
  int kit_drum = slot->drum && (midi_round == 36 || midi_round == 38 || midi_round == 42);
  int nature = slot->engine == HT_ENGINE_BUBBLE || slot->engine == HT_ENGINE_BIRD ||
               slot->engine == HT_ENGINE_FOREST || slot->engine == HT_ENGINE_DOLPHIN ||
               slot->engine == HT_ENGINE_DUB_BASS || slot->engine == HT_ENGINE_FIRE;

  if (!nature && !kit_drum) {
    slot->phase += inc;
    if (slot->phase >= 1.0f) {
      slot->phase -= 1.0f;
    }
    slot->phase2 += inc * (slot->engine == HT_ENGINE_SUPERSAW ? 1.003f : 2.01f);
    if (slot->phase2 >= 1.0f) {
      slot->phase2 -= 1.0f;
    }
    slot->phase3 += inc * 3.02f;
    if (slot->phase3 >= 1.0f) {
      slot->phase3 -= 1.0f;
    }
  } else if (slot->engine == HT_ENGINE_DUB_BASS) {
    slot->phase += inc;
    if (slot->phase >= 1.0f) {
      slot->phase -= 1.0f;
    }
    slot->phase2 += inc * 1.002f;
    if (slot->phase2 >= 1.0f) {
      slot->phase2 -= 1.0f;
    }
  }

  switch (slot->engine) {
    case HT_ENGINE_SUBTRACTIVE:
      wave = 2.0f * slot->phase - 1.0f;
      bright = 0.42f;
      break;

    case HT_ENGINE_FM:
      mod = ht_sinf(slot->phase2 * 6.2831853f) * (2.8f + filter_env * 1.6f);
      wave = ht_sinf((slot->phase + mod * 0.18f) * 6.2831853f);
      bright = 0.55f;
      break;

    case HT_ENGINE_ACID:
      wave = slot->phase < 0.5f ? 1.0f - 4.0f * ht_fabsf(slot->phase - 0.25f)
                                : -1.0f + 4.0f * ht_fabsf(slot->phase - 0.75f);
      bright = 0.78f;
      break;

    case HT_ENGINE_NOISE:
      /* Analog kit voices (js/drum_kit.js) when MIDI maps to kick/snare/hat. */
      if (midi_round == 36) {
        float body = 1.0f / (1.0f + slot->age * 18.0f);
        float chirp_hz = 42.0f + 103.0f * body;
        slot->phase += chirp_hz / HT_DSP_SAMPLE_RATE;
        if (slot->phase >= 1.0f) {
          slot->phase -= 1.0f;
        }
        wave = ht_sinf(slot->phase * 6.2831853f) * 0.95f + ht_noise_f(&slot->noise) * 0.04f;
        bright = 0.12f;
      } else if (midi_round == 38) {
        float n = ht_noise_f(&slot->noise);
        float tone_hz = 190.0f - 70.0f * ht_clampf(slot->age * 9.0f, 0.0f, 1.0f);
        float hp;
        slot->phase += tone_hz / HT_DSP_SAMPLE_RATE;
        if (slot->phase >= 1.0f) {
          slot->phase -= 1.0f;
        }
        slot->formant_z[0] = slot->formant_z[0] * 0.82f + n * 0.18f;
        hp = n - slot->formant_z[0];
        wave = hp * 0.72f + ht_sinf(slot->phase * 6.2831853f) * 0.42f;
        bright = 0.58f;
      } else if (midi_round == 42) {
        float n = ht_noise_f(&slot->noise);
        slot->formant_z[1] = slot->formant_z[1] * 0.55f + n * 0.45f;
        wave = (n - slot->formant_z[1]) * 1.15f;
        bright = 0.88f;
      } else {
        wave = ht_noise_f(&slot->noise);
        bright = 0.4f;
      }
      break;

    case HT_ENGINE_SUPERSAW: {
      float phase4 = slot->phase + 0.17f;
      if (phase4 >= 1.0f) {
        phase4 -= 1.0f;
      }
      wave = (2.0f * slot->phase - 1.0f) * 0.4f + (2.0f * slot->phase2 - 1.0f) * 0.32f +
             (2.0f * slot->phase3 - 1.0f) * 0.18f + (2.0f * phase4 - 1.0f) * 0.1f;
      bright = 0.48f;
      break;
    }

    case HT_ENGINE_ADDITIVE:
      wave = ht_sinf(slot->phase * 6.2831853f) * 0.5f +
             ht_sinf(slot->phase * 12.56637f) * 0.28f +
             ht_sinf(slot->phase * 18.84956f) * 0.14f +
             ht_sinf(slot->phase * 25.13274f) * 0.08f;
      break;

    case HT_ENGINE_ORGAN:
      wave = ht_sinf(slot->phase * 6.2831853f) * 0.55f +
             ht_sinf(slot->phase * 12.56637f) * 0.3f +
             ht_sinf(slot->phase * 18.84956f) * 0.15f;
      break;

    case HT_ENGINE_VOWEL:
      /* Parallel formants closer to vowel_formants.js (Q~5–8 feel via higher q_proxy). */
      carrier = 2.0f * slot->phase - 1.0f;
      vowel_freqs(slot->vowel_index, freqs);
      wave = resonator(carrier, &slot->formant_z[0], freqs[0], 1.55f) * 1.45f +
             resonator(carrier, &slot->formant_z[1], freqs[1], 1.85f) * 1.05f +
             resonator(carrier, &slot->formant_z[2], freqs[2], 2.15f) * 0.7f +
             carrier * 0.22f;
      bright = 0.72f;
      break;

    case HT_ENGINE_RING_MOD:
      carrier = ht_sinf(slot->phase * 6.2831853f);
      mod = ht_sinf(slot->phase2 * 6.2831853f);
      wave = carrier * mod;
      break;

    case HT_ENGINE_AM:
      carrier = ht_sinf(slot->phase * 6.2831853f);
      mod = 0.5f + 0.5f * ht_sinf(slot->phase2 * 6.2831853f);
      wave = carrier * mod;
      break;

    case HT_ENGINE_PHASE_DISTORTION: {
      float d = ht_clampf(0.35f + lfo * 0.2f, 0.05f, 0.95f);
      float pd = slot->phase < d ? (slot->phase / d) * 0.5f
                                 : 0.5f + (slot->phase - d) / (1.0f - d + 1e-6f) * 0.5f;
      wave = ht_sinf(pd * 6.2831853f);
      break;
    }

    case HT_ENGINE_WAVESHAPE:
      wave = ht_softsat(ht_sinf(slot->phase * 6.2831853f) * (1.4f + lfo), 0.55f);
      break;

    case HT_ENGINE_WAVETABLE:
      morph = 0.25f + 0.55f * (0.5f + 0.5f * ht_sinf(slot->phase2 * 6.2831853f));
      wave = wavetable_at(slot->phase, morph);
      break;

    case HT_ENGINE_GRANULAR:
      slot->grain_phase +=
          (18.0f + (float)((int)slot->midi % 12) * 2.5f) / HT_DSP_SAMPLE_RATE;
      if (slot->grain_phase >= 1.0f) {
        slot->grain_phase -= 1.0f;
        for (g = 0; g < 32u; g += 1) {
          float env = 1.0f - (float)g / 32.0f;
          slot->grain_buf[(slot->grain_write + g) % HT_GRAIN_BUF] +=
              ht_noise_f(&slot->noise) * env * 0.55f;
        }
      }
      grain = slot->grain_buf[slot->grain_write % HT_GRAIN_BUF];
      slot->grain_buf[slot->grain_write % HT_GRAIN_BUF] *= 0.92f;
      slot->grain_write = (uint16_t)((slot->grain_write + 1u) % HT_GRAIN_BUF);
      wave = grain + ht_sinf(slot->phase * 6.2831853f) * 0.15f;
      bright = 0.35f;
      break;

    case HT_ENGINE_PWM: {
      float width = 0.25f + 0.35f * (0.5f + 0.5f * ht_sinf(slot->phase2 * 6.2831853f));
      wave = slot->phase < width ? 0.7f : -0.7f;
      break;
    }

    case HT_ENGINE_BUBBLE:
      wave = sample_bubble(slot, hz, lfo);
      bright = (slot->vowel_index & 1u) ? 0.28f : 0.42f;
      break;

    case HT_ENGINE_BIRD:
      wave = sample_bird(slot, hz, lfo) * 1.35f;
      bright = 0.62f;
      break;

    case HT_ENGINE_FOREST:
      wave = sample_forest(slot, hz, lfo);
      bright = (slot->vowel_index & 1u) ? 0.32f : 0.18f;
      break;

    case HT_ENGINE_DOLPHIN:
      wave = sample_dolphin(slot, hz, lfo);
      bright = 0.48f;
      break;

    case HT_ENGINE_DUB_BASS:
      wave = sample_dub_bass(slot, hz, lfo);
      bright = (slot->vowel_index & 1u) ? 0.08f : 0.22f;
      break;

    case HT_ENGINE_FIRE:
      wave = sample_fire(slot, hz, lfo);
      bright = (slot->vowel_index & 1u) ? 0.38f : 0.28f;
      break;

    default:
      /* Physical engines are rendered by waveguides; keep a quiet fallback. */
      wave = ht_sinf(slot->phase * 6.2831853f) * 0.2f;
      break;
  }

  bright = ht_clampf(bright * (1.0f + filter_env * 1.6f) + filter_env * 0.12f, 0.05f, 0.95f);
#ifdef HT_STAGE_NATIVE
  /* Keep more harmonics for analogue body; softsat instead of a dull brickwall LP. */
  bright = ht_clampf(bright * 1.35f + 0.12f, 0.18f, 0.98f);
  wave = ht_softsat(wave * (1.05f + filter_env * 0.35f), 0.28f + bright * 0.35f);
  return ht_onepole(wave, &slot->cutoff_z, bright);
#else
  return ht_onepole(wave, &slot->cutoff_z, bright);
#endif
}
