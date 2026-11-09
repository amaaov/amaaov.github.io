/* SPDX-License-Identifier: MIT
 * Native macOS stage runtime: generative court + voice bank (no WebView / JS). */
#ifndef HT_STAGE_ENGINE_H
#define HT_STAGE_ENGINE_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct HtStageEngine HtStageEngine;

/* sample_rate: 96000 or 192000 preferred. master 0..1. */
HtStageEngine *ht_stage_create(double sample_rate);
void ht_stage_destroy(HtStageEngine *stage);

void ht_stage_set_master(HtStageEngine *stage, float master01);
void ht_stage_new_patch(HtStageEngine *stage);
void ht_stage_chaos(HtStageEngine *stage);

/* Advance generative clock by wall milliseconds (display backup). */
void ht_stage_tick_ms(HtStageEngine *stage, double wall_ms);

/* Interleaved stereo float32 frames in [-1, 1]. Advances clock by frames. */
void ht_stage_render(HtStageEngine *stage, float *interleaved, uint32_t frames);

/* 240x240 RGBA8888 court (row-major). */
void ht_stage_court_rgba(HtStageEngine *stage, uint8_t *rgba);

double ht_stage_sample_rate(const HtStageEngine *stage);
float ht_stage_bpm(const HtStageEngine *stage);
float ht_stage_pattern_beat(const HtStageEngine *stage);
uint32_t ht_stage_seed(const HtStageEngine *stage);
/* NUL-terminated siteswap; empty if unavailable. */
const char *ht_stage_siteswap(const HtStageEngine *stage);

#ifdef __cplusplus
}
#endif

#endif
