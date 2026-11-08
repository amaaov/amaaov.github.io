#include "ht_keys.h"

/* Mulberry32 — same step as pages/.../siteswap_generator.js seededRandom. */
typedef struct HtKeyRng {
  uint32_t state;
} HtKeyRng;

static float ht_key_random(HtKeyRng *rng) {
  uint32_t state = rng->state + 0x6d2b79f5u;
  rng->state = state;
  uint32_t value = state;
  value = (value ^ (value >> 15)) * (value | 1u);
  value ^= value + (value ^ (value >> 7)) * (value | 61u);
  return (float)((value ^ (value >> 14)) >> 0) / 4294967296.0f;
}

static uint8_t ht_key_pick_kind(HtKeyRng *rng, uint8_t midi) {
  float roll = ht_key_random(rng);
  uint8_t kind;
  if (roll < 0.28f) {
    kind = HT_KEY_PLAY;
  } else if (roll < 0.52f) {
    kind = HT_KEY_MODULATE;
  } else if (roll < 0.78f) {
    kind = HT_KEY_COMBO;
  } else if (roll < 0.92f) {
    kind = HT_KEY_BURST;
  } else {
    kind = HT_KEY_MUTE;
  }
  if (midi < 12 && kind == HT_KEY_MODULATE && ht_key_random(rng) < 0.55f) {
    kind = ht_key_random(rng) < 0.35f ? HT_KEY_MUTE : HT_KEY_PLAY;
  }
  return kind;
}

static void ht_key_pick_voices(HtKeyRng *rng, uint8_t kind, uint8_t midi, HtKeyRole *role) {
  role->voice_count = 0;
  if (kind == HT_KEY_MODULATE) {
    return;
  }
  if (kind == HT_KEY_MUTE) {
    role->voices[0] = (uint8_t)(midi % HT_VOICE_COUNT);
    role->voice_count = 1;
    return;
  }
  if (kind == HT_KEY_PLAY) {
    if (ht_key_random(rng) < 0.7f) {
      role->voices[0] = (uint8_t)(ht_key_random(rng) * (float)HT_VOICE_COUNT);
      role->voice_count = 1;
      return;
    }
    uint8_t a = (uint8_t)(ht_key_random(rng) * (float)HT_VOICE_COUNT);
    uint8_t b =
        (uint8_t)((a + 1u + (uint8_t)(ht_key_random(rng) * (float)(HT_VOICE_COUNT - 1))) %
                  HT_VOICE_COUNT);
    role->voices[0] = a;
    if (a == b) {
      role->voice_count = 1;
      return;
    }
    role->voices[1] = b;
    role->voice_count = 2;
    return;
  }
  if (kind == HT_KEY_COMBO) {
    role->voices[0] = (uint8_t)(ht_key_random(rng) * (float)HT_VOICE_COUNT);
    role->voice_count = 1;
    return;
  }
  /* burst */
  uint8_t count = (uint8_t)(2 + (int)(ht_key_random(rng) * 3.0f));
  uint8_t start = (uint8_t)(ht_key_random(rng) * (float)HT_VOICE_COUNT);
  for (uint8_t index = 0; index < count && role->voice_count < HT_KEY_MAX_VOICES; index += 1) {
    uint8_t step = (uint8_t)(1 + (int)(ht_key_random(rng) * 2.0f));
    uint8_t voice = (uint8_t)((start + index * step) % HT_VOICE_COUNT);
    uint8_t seen = 0;
    for (uint8_t prior = 0; prior < role->voice_count; prior += 1) {
      if (role->voices[prior] == voice) {
        seen = 1;
        break;
      }
    }
    if (!seen) {
      role->voices[role->voice_count++] = voice;
    }
  }
}

static void ht_key_pick_params(HtKeyRng *rng, uint8_t kind, HtKeyRole *role) {
  role->param_count = 0;
  if (kind == HT_KEY_PLAY || kind == HT_KEY_MUTE) {
    return;
  }
  uint8_t count;
  if (kind == HT_KEY_BURST) {
    count = (uint8_t)(2 + (int)(ht_key_random(rng) * 3.0f));
  } else if (kind == HT_KEY_COMBO) {
    count = (uint8_t)(1 + (ht_key_random(rng) < 0.45f ? 1 : 0));
  } else {
    count = (uint8_t)(1 + (ht_key_random(rng) < 0.4f ? 1 : 0));
  }
  if (count > HT_KEY_MAX_PARAMS) {
    count = HT_KEY_MAX_PARAMS;
  }
  uint8_t pool[HT_KEY_PARAM_ID_COUNT];
  for (uint8_t index = 0; index < HT_KEY_PARAM_ID_COUNT; index += 1) {
    pool[index] = index;
  }
  uint8_t pool_len = HT_KEY_PARAM_ID_COUNT;
  for (uint8_t index = 0; index < count && pool_len > 0; index += 1) {
    uint8_t pick = (uint8_t)(ht_key_random(rng) * (float)pool_len);
    uint8_t id = pool[pick];
    pool[pick] = pool[pool_len - 1];
    pool_len -= 1;
    float magnitude = 0.04f + ht_key_random(rng) * 0.18f;
    float delta = ht_key_random(rng) < 0.5f ? magnitude : -magnitude;
    uint8_t pulse = (kind == HT_KEY_BURST && ht_key_random(rng) < 0.35f) ? 1 : 0;
    role->params[role->param_count].id = id;
    role->params[role->param_count].delta = delta;
    role->params[role->param_count].pulse = pulse;
    role->param_count += 1;
  }
}

void ht_key_map_build(uint32_t seed, HtKeyRole out[HT_KEY_MIDI_COUNT]) {
  HtKeyRng rng;
  rng.state = seed ^ 0x4b455931u;
  for (uint8_t midi = 0; midi < HT_KEY_MIDI_COUNT; midi += 1) {
    HtKeyRole *role = &out[midi];
    role->midi = midi;
    role->kind = ht_key_pick_kind(&rng, midi);
    ht_key_pick_voices(&rng, role->kind, midi, role);
    ht_key_pick_params(&rng, role->kind, role);
    role->height = (uint8_t)(2 + (int)(ht_key_random(&rng) * 7.0f));
    role->velocity = (uint8_t)(70 + (int)(ht_key_random(&rng) * 50.0f));
  }
}
