#ifndef HT_TUNING_H
#define HT_TUNING_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Mirrors js/ht_tuning.js — fractional MIDI / EDO / just intonation. */

#define HT_TUNING_A4_HZ 440.0f
#define HT_JUST_MAJOR_COUNT 7

float ht_note_hz(float midi);
float ht_edo_step_midi_offset(float step, uint8_t edo);
float ht_ratio_midi_offset(float ratio);
float ht_degree_to_midi(float root_midi, float degree_step, uint8_t scale_index, int8_t octave);
uint8_t ht_scale_division(uint8_t scale_index);
int ht_scale_is_micro(uint8_t scale_index);
uint8_t ht_scale_degree_count(uint8_t scale_index);
float ht_scale_degree_step(uint8_t scale_index, uint8_t degree_index);
float ht_scale_note(uint8_t scale_index, float root_midi, uint8_t degree_index, int8_t octave);

#ifdef __cplusplus
}
#endif

#endif
