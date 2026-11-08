#ifndef HT_ACTION_LOOP_H
#define HT_ACTION_LOOP_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Ephemeral action looper — mirrors js/action_looper.js. Nothing persists. */

#define HT_ACTION_LOOP_HOST_COUNT 4
#define HT_ACTION_LOOP_MAX_EVENTS 48
#define HT_ACTION_LOOP_BARS 2
#define HT_ACTION_LOOP_BEATS_PER_BAR 4

typedef enum HtActionLoopMode {
  HT_ACTION_IDLE = 0,
  HT_ACTION_RECORDING = 1,
  HT_ACTION_LOOPING = 2
} HtActionLoopMode;

typedef enum HtActionKind {
  HT_ACTION_KNOB = 0,
  HT_ACTION_BUTTON = 1,
  HT_ACTION_KEY = 2
} HtActionKind;

typedef struct HtActionEvent {
  uint8_t kind;
  uint8_t id; /* knob index 0..3, button id, or key index */
  float value;
  float at_beat;
} HtActionEvent;

typedef struct HtActionLooper {
  uint8_t host; /* 0..3 → KNOB1..KNOB4 */
  uint8_t mode;
  uint8_t event_count;
  uint8_t play_cursor;
  uint8_t replaying;
  float last_host_value;
  float record_start_beat;
  float loop_start_beat;
  float loop_length_beats;
  HtActionEvent events[HT_ACTION_LOOP_MAX_EVENTS];
  uint8_t order[HT_ACTION_LOOP_MAX_EVENTS];
} HtActionLooper;

void ht_action_loop_init(HtActionLooper *loop, uint32_t seed);
void ht_action_loop_rebind(HtActionLooper *loop, uint32_t seed);
HtActionLoopMode ht_action_loop_on_host(HtActionLooper *loop, float value, float beat,
                                        uint32_t entropy);
int ht_action_loop_capture(HtActionLooper *loop, uint8_t kind, uint8_t id, float value,
                           float beat);
/* Returns count of due events written into out[]; advances loop cursor. */
uint8_t ht_action_loop_tick(HtActionLooper *loop, float beat, HtActionEvent *out, uint8_t cap);

#ifdef __cplusplus
}
#endif

#endif
