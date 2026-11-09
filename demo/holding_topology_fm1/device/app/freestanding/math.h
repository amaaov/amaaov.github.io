/* Device freestanding math: map libm names onto fm1-base fastmath (no libm link). */
#pragma once
#include "fastmath.h"

#define fabsf fm_fabsf
#define floorf fm_floorf
#define fmaxf fm_maxf
#define fminf fm_minf
#define sinf fm_sinf
#define cosf fm_cosf
#define expf fm_expf
#define exp2f fm_exp2f
#define log2f fm_log2f
#define logf fm_logf
#define powf fm_powf
#define sqrtf fm_sqrtf
#define tanf fm_tanf
