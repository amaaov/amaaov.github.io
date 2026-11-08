#include "ht_gen.h"

#include <math.h>

static const uint8_t DEGREE_STEPS[8] = {0, 2, 3, 5, 7, 8, 10, 12};

static uint8_t bit_count(uint32_t value) {
  uint8_t count = 0;
  while (value) {
    count = (uint8_t)(count + (value & 1u));
    value >>= 1;
  }
  return count;
}

uint32_t ht_gen_stream(uint32_t seed) {
  uint32_t z = (seed ^ 0x9e3779b9u) * 0x85ebca6bu + 0x27d4eb2du;
  z = (z ^ (z >> 15)) * 0xc2b2ae35u;
  z ^= z >> 13;
  return z ? z : 0xa511e9b3u;
}

uint32_t ht_gen_next(HtGenRng *rng) {
  uint32_t x = rng->value ? rng->value : ht_gen_stream(0);
  x ^= x << 7;
  x ^= x >> 9;
  x ^= x << 8;
  x *= 0x2545f491u;
  rng->value = x ? x : 1u;
  return rng->value;
}

uint32_t ht_gen_rnd(HtGenRng *rng, uint32_t n) {
  if (!n) {
    return 0;
  }
  return ht_gen_next(rng) % n;
}

int ht_euclid_hit(uint8_t step, uint8_t steps, uint8_t pulses, uint8_t rot) {
  if (!pulses || !steps) {
    return 0;
  }
  if (pulses >= steps) {
    return 1;
  }
  uint8_t index = (uint8_t)((step + rot) % steps);
  return (((uint32_t)(index + 1u) * pulses) / steps) > (((uint32_t)index * pulses) / steps);
}

void ht_gen_turing_init(HtGenTuring *gen, uint8_t len, uint8_t prob, uint8_t oct_span,
                        uint32_t seed) {
  gen->len = len < 2 ? 2 : (len > 16 ? 16 : len);
  gen->prob = prob;
  gen->oct_span = oct_span ? oct_span : 1;
  gen->rng.value = ht_gen_stream(seed ^ 0xc011u);
  gen->reg = (uint16_t)(ht_gen_next(&gen->rng) & 0xffffu);
  if (!gen->reg) {
    gen->reg = 0x1357u;
  }
}

HtGenOut ht_gen_turing_step(HtGenTuring *gen) {
  HtGenOut out;
  uint8_t top = (uint8_t)((gen->reg >> (gen->len - 1)) & 1u);
  uint8_t inject = top;
  if (gen->prob > 0 && ht_gen_rnd(&gen->rng, 100) < gen->prob) {
    inject = (uint8_t)(top ^ 1u);
  }
  gen->reg = (uint16_t)(((gen->reg << 1) | inject) & 0xffffu);
  uint16_t mask = gen->len >= 16 ? 0xffffu : (uint16_t)((1u << gen->len) - 1u);
  uint16_t window = (uint16_t)(gen->reg & mask);
  uint8_t pop = bit_count(window & 0xffu);
  uint8_t nibble = (uint8_t)((window >> 4) & 0xfu);
  uint8_t degree = DEGREE_STEPS[(pop + nibble) % 8u];
  uint8_t oct = (uint8_t)(((window >> 8) + pop) % gen->oct_span);
  out.gate = (window & 0x5u) != 0;
  out.midi = (uint8_t)(40 + oct * 12 + degree);
  out.velocity = (uint8_t)(85 + (pop % 5u) * 6u);
  out.part = 0;
  return out;
}

void ht_gen_euclid_init(HtGenEuclid *gen, uint8_t steps, uint8_t pulses, uint8_t rot,
                        uint16_t pitch_seed, uint32_t seed) {
  gen->steps = steps ? steps : 16;
  gen->pulses = pulses > gen->steps ? gen->steps : pulses;
  gen->rot = rot;
  gen->pitch_seed = pitch_seed;
  gen->step_idx = 0;
  gen->rng.value = ht_gen_stream(seed ^ 0xe001u);
}

HtGenOut ht_gen_euclid_step(HtGenEuclid *gen) {
  HtGenOut out;
  uint8_t current = gen->step_idx;
  gen->step_idx = (uint8_t)((gen->step_idx + 1) % gen->steps);
  out.part = 0;
  if (!ht_euclid_hit(current, gen->steps, gen->pulses, gen->rot)) {
    out.gate = 0;
    out.midi = 60;
    out.velocity = 0;
    return out;
  }
  uint8_t degree;
  if (!gen->pitch_seed) {
    degree = (uint8_t)((current * 5u) % 12u);
  } else {
    uint32_t mixed = (uint32_t)((current + 3u) * 0x9e3779b1u) ^
                     (uint32_t)(gen->pitch_seed * 0x85ebca77u);
    degree = (uint8_t)(mixed % 12u);
  }
  out.gate = 1;
  out.midi = (uint8_t)(50 + degree);
  out.velocity = (uint8_t)(100 + (current % 3u) * 5u);
  return out;
}

void ht_gen_markov_init(HtGenMarkov *gen, uint8_t tension, uint8_t density, uint8_t oct_span,
                        uint32_t seed) {
  gen->tension = tension;
  gen->density = density;
  gen->oct_span = oct_span ? oct_span : 1;
  gen->rng.value = ht_gen_stream(seed ^ 0x3a71u);
  gen->state = (uint8_t)ht_gen_rnd(&gen->rng, 8);
}

HtGenOut ht_gen_markov_step(HtGenMarkov *gen) {
  HtGenOut out;
  float leap = gen->tension / 100.0f;
  float weights[8];
  float sum = 0.0f;
  for (uint8_t degree = 0; degree < 8; degree += 1) {
    int dist = degree > gen->state ? (int)(degree - gen->state) : (int)(gen->state - degree);
    float weight = expf(-(float)dist * (1.4f - leap * 0.9f)) * (1.0f + leap * (float)dist * 0.35f);
    if (degree == 0 || degree == 4) {
      weight *= 1.15f;
    }
    weights[degree] = weight;
    sum += weight;
  }
  float roll = (ht_gen_rnd(&gen->rng, 1000) / 1000.0f) * sum;
  uint8_t next = 7;
  for (uint8_t degree = 0; degree < 8; degree += 1) {
    roll -= weights[degree];
    if (roll <= 0.0f) {
      next = degree;
      break;
    }
  }
  gen->state = next;
  out.part = 0;
  if (ht_gen_rnd(&gen->rng, 100) >= (gen->density ? gen->density : 100)) {
    out.gate = 0;
    out.midi = 60;
    out.velocity = 0;
    return out;
  }
  out.gate = 1;
  out.midi = (uint8_t)(38 + DEGREE_STEPS[next] + 12 * ht_gen_rnd(&gen->rng, gen->oct_span));
  out.velocity = (uint8_t)(88 + ht_gen_rnd(&gen->rng, 28));
  return out;
}

static uint16_t grow_rhythm_mask(HtGenRng *rng) {
  uint16_t mask = 0;
  int density = 3 + (int)ht_gen_rnd(rng, 6);
  for (uint8_t bit = 0; bit < 16 && density > 0; bit += 1) {
    if ((int)ht_gen_rnd(rng, 16u - bit) < density) {
      mask = (uint16_t)(mask | (1u << bit));
      density -= 1;
    }
  }
  return mask ? mask : 0x1111u;
}

void ht_gen_morph_init(HtGenMorph *gen, uint8_t morph_pos, uint32_t seed) {
  gen->morph_pos = morph_pos;
  gen->step_idx = 0;
  gen->rng.value = ht_gen_stream(seed ^ 0xb1e5u);
  gen->snap_a = grow_rhythm_mask(&gen->rng);
  gen->snap_b = grow_rhythm_mask(&gen->rng);
}

HtGenOut ht_gen_morph_step(HtGenMorph *gen) {
  HtGenOut out;
  gen->step_idx = (uint8_t)((gen->step_idx + 1) & 0x0fu);
  uint8_t prefer_b = ht_gen_rnd(&gen->rng, 128) < gen->morph_pos;
  uint16_t mask = prefer_b ? gen->snap_b : gen->snap_a;
  out.part = 0;
  if (!((mask >> gen->step_idx) & 1u)) {
    out.gate = 0;
    out.midi = 60;
    out.velocity = 0;
    return out;
  }
  uint8_t mul = prefer_b ? 3 : 2;
  uint8_t add = prefer_b ? 1 : 0;
  uint8_t degree = DEGREE_STEPS[(gen->step_idx * mul + add) % 8u];
  out.gate = 1;
  out.midi = (uint8_t)(48 + degree);
  out.velocity = (uint8_t)(92 + (gen->step_idx % 4u == 0 ? 20 : 8));
  return out;
}

void ht_gen_atlas_init(HtGenAtlas *gen, uint8_t x, uint8_t y, uint8_t dens, uint8_t chaos,
                       uint32_t seed) {
  gen->x = x;
  gen->y = y;
  gen->dens = dens;
  gen->chaos = chaos;
  gen->kick_pulses = (uint8_t)(1 + ((255 - x) * 5) / 255);
  gen->snare_pulses = (uint8_t)(1 + (y * 4) / 255);
  gen->hat_pulses = (uint8_t)(3 + ((x > y ? x - y : y - x) * 9) / 255);
  gen->kick_rot = (uint8_t)((x * 7) / 255);
  gen->snare_rot = (uint8_t)(2 + (y * 6) / 255);
  gen->hat_rot = (uint8_t)(((x ^ y) / 16) % 16);
  gen->step_idx = 0;
  gen->rng.value = ht_gen_stream(seed ^ ((uint32_t)y << 9) ^ ((uint32_t)x << 1) ^ 0x50f7u);
}

int ht_gen_atlas_step(HtGenAtlas *gen, HtGenOut outs[3]) {
  uint8_t current = gen->step_idx;
  gen->step_idx = (uint8_t)((gen->step_idx + 1) % 16u);
  int count = 0;
  struct {
    uint8_t pulses;
    uint8_t rot;
    uint8_t midi;
    uint8_t part;
  } layers[3] = {
      {gen->kick_pulses, gen->kick_rot, 36, 1},
      {gen->snare_pulses, gen->snare_rot, 38, 2},
      {gen->hat_pulses, gen->hat_rot, 42, 3},
  };
  for (int layer = 0; layer < 3; layer += 1) {
    int pattern = ht_euclid_hit(current, 16, layers[layer].pulses, layers[layer].rot);
    int noise = ht_gen_rnd(&gen->rng, 100) < gen->chaos;
    if (!(pattern || noise)) {
      continue;
    }
    if (ht_gen_rnd(&gen->rng, 100) > gen->dens) {
      continue;
    }
    outs[count].gate = 1;
    outs[count].midi = layers[layer].midi;
    outs[count].velocity = (uint8_t)(65 + ht_gen_rnd(&gen->rng, 55));
    outs[count].part = layers[layer].part;
    count += 1;
  }
  return count;
}
