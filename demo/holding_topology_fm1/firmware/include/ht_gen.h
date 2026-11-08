#ifndef HT_GEN_H
#define HT_GEN_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Holding Topology court generators — mirrors js/court_gen.js. */

typedef struct HtGenRng {
  uint32_t value;
} HtGenRng;

typedef struct HtGenOut {
  uint8_t gate;
  uint8_t midi;
  uint8_t velocity;
  uint8_t part; /* 0 synth, 1 kick, 2 snare, 3 hat */
} HtGenOut;

typedef struct HtGenTuring {
  uint8_t len;
  uint8_t prob;
  uint8_t oct_span;
  uint16_t reg;
  HtGenRng rng;
} HtGenTuring;

typedef struct HtGenEuclid {
  uint8_t steps;
  uint8_t pulses;
  uint8_t rot;
  uint16_t pitch_seed;
  uint8_t step_idx;
  HtGenRng rng;
} HtGenEuclid;

typedef struct HtGenMarkov {
  uint8_t tension;
  uint8_t density;
  uint8_t oct_span;
  uint8_t state;
  HtGenRng rng;
} HtGenMarkov;

typedef struct HtGenMorph {
  uint8_t morph_pos;
  uint16_t snap_a;
  uint16_t snap_b;
  uint8_t step_idx;
  HtGenRng rng;
} HtGenMorph;

typedef struct HtGenAtlas {
  uint8_t x;
  uint8_t y;
  uint8_t dens;
  uint8_t chaos;
  uint8_t kick_pulses;
  uint8_t snare_pulses;
  uint8_t hat_pulses;
  uint8_t kick_rot;
  uint8_t snare_rot;
  uint8_t hat_rot;
  uint8_t step_idx;
  HtGenRng rng;
} HtGenAtlas;

uint32_t ht_gen_stream(uint32_t seed);
uint32_t ht_gen_next(HtGenRng *rng);
uint32_t ht_gen_rnd(HtGenRng *rng, uint32_t n);
int ht_euclid_hit(uint8_t step, uint8_t steps, uint8_t pulses, uint8_t rot);

void ht_gen_turing_init(HtGenTuring *gen, uint8_t len, uint8_t prob, uint8_t oct_span, uint32_t seed);
HtGenOut ht_gen_turing_step(HtGenTuring *gen);

void ht_gen_euclid_init(HtGenEuclid *gen, uint8_t steps, uint8_t pulses, uint8_t rot,
                        uint16_t pitch_seed, uint32_t seed);
HtGenOut ht_gen_euclid_step(HtGenEuclid *gen);

void ht_gen_markov_init(HtGenMarkov *gen, uint8_t tension, uint8_t density, uint8_t oct_span,
                        uint32_t seed);
HtGenOut ht_gen_markov_step(HtGenMarkov *gen);

void ht_gen_morph_init(HtGenMorph *gen, uint8_t morph_pos, uint32_t seed);
HtGenOut ht_gen_morph_step(HtGenMorph *gen);

void ht_gen_atlas_init(HtGenAtlas *gen, uint8_t x, uint8_t y, uint8_t dens, uint8_t chaos,
                       uint32_t seed);
int ht_gen_atlas_step(HtGenAtlas *gen, HtGenOut outs[3]);

#ifdef __cplusplus
}
#endif

#endif
