/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 amaaov / Holding Topology FM-1
 *
 * FM-1 app contract for Holding Topology. Built on fm1-base (MPL-2.0 platform).
 * Portable generators and panel maps live under ht/ (symlinked from ../firmware). */
#pragma once
#include <stdint.h>
#include "plat.h"

#define APP_NAME "HT-1"
#define APP_SPLASH_RGB RGB(36, 120, 96)
#define APP_BLOCK 256u
#define APP_TOUCH
/* Strip height for court blit (full 240 needs too much .pool with the voice bank). */
#define APP_CANVAS_PX (240u * 120u)
/* MASTER pot squared is near-silent until the knob moves; keep a floor so the
 * generative path is audible at boot (emu pots often sit at 0 until dragged). */
#define APP_GAIN(m) (((m) * (m) >> 12) < 600u ? 1400u : ((m) * (m) >> 12))

enum { OBJ_SETTINGS, OBJ_PANEL, OBJ_BLE, OBJ_NOBJ };
#define APP_STORE_MAP {0xFC000u, 0xDC000u, 0xDE000u}

void app_init(void);
void app_render(int32_t *lr, uint32_t n, uint32_t master_q12);
void app_panic(void);
void app_ui_init(void);
void app_frame(void);
void app_input_only(void);
void app_say(const char *a, const char *b);

#ifdef PLAT_HOST
#define APP_HOST_EXPECT
int app_expect(const char *what, int *got);
#endif
