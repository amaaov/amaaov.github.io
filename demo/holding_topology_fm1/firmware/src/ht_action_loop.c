#include "ht_action_loop.h"

static float clampf(float value, float lo, float hi) {
  if (value < lo) {
    return lo;
  }
  if (value > hi) {
    return hi;
  }
  return value;
}

static void reset_buffer(HtActionLooper *loop) {
  loop->event_count = 0;
  loop->play_cursor = 0;
}

void ht_action_loop_init(HtActionLooper *loop, uint32_t seed) {
  if (!loop) {
    return;
  }
  loop->host = (uint8_t)((seed ? seed : 1u) % HT_ACTION_LOOP_HOST_COUNT);
  loop->mode = HT_ACTION_IDLE;
  loop->replaying = 0;
  loop->last_host_value = 0.5f;
  loop->record_start_beat = 0.0f;
  loop->loop_start_beat = 0.0f;
  loop->loop_length_beats = (float)(HT_ACTION_LOOP_BARS * HT_ACTION_LOOP_BEATS_PER_BAR);
  reset_buffer(loop);
}

void ht_action_loop_rebind(HtActionLooper *loop, uint32_t seed) {
  ht_action_loop_init(loop, seed ^ 0xa71cu);
}

static void shuffle_order(HtActionLooper *loop, uint32_t entropy) {
  uint8_t i;
  uint32_t state = entropy ? entropy : 1u;
  for (i = 0; i < loop->event_count; i += 1) {
    loop->order[i] = i;
  }
  for (i = loop->event_count; i > 1u; i -= 1) {
    uint8_t j;
    uint8_t tmp;
    state = state * 1664525u + 1013904223u;
    j = (uint8_t)(state % i);
    tmp = loop->order[i - 1u];
    loop->order[i - 1u] = loop->order[j];
    loop->order[j] = tmp;
  }
}

static void begin_loop(HtActionLooper *loop, float beat, uint32_t entropy) {
  if (loop->event_count == 0u) {
    loop->mode = HT_ACTION_IDLE;
    return;
  }
  loop->mode = HT_ACTION_LOOPING;
  loop->loop_start_beat = beat;
  loop->play_cursor = 0;
  shuffle_order(loop, entropy);
}

HtActionLoopMode ht_action_loop_on_host(HtActionLooper *loop, float value, float beat,
                                        uint32_t entropy) {
  float level = clampf(value, 0.0f, 1.0f);
  if (!loop) {
    return HT_ACTION_IDLE;
  }
  if (level >= 0.68f && loop->last_host_value < 0.68f) {
    loop->mode = HT_ACTION_RECORDING;
    reset_buffer(loop);
    loop->record_start_beat = beat;
  } else if (loop->mode == HT_ACTION_RECORDING && level < 0.32f && loop->last_host_value >= 0.32f) {
    begin_loop(loop, beat, entropy);
  }
  loop->last_host_value = level;
  return (HtActionLoopMode)loop->mode;
}

int ht_action_loop_capture(HtActionLooper *loop, uint8_t kind, uint8_t id, float value,
                           float beat) {
  float at;
  HtActionEvent *event;
  if (!loop || loop->replaying || loop->mode != HT_ACTION_RECORDING) {
    return 0;
  }
  if (kind == HT_ACTION_KNOB && id == loop->host) {
    return 0;
  }
  at = beat - loop->record_start_beat;
  if (at < 0.0f || at > loop->loop_length_beats + 0.05f) {
    return 0;
  }
  if (loop->event_count >= HT_ACTION_LOOP_MAX_EVENTS) {
    return 0;
  }
  event = &loop->events[loop->event_count++];
  event->kind = kind;
  event->id = id;
  event->value = value;
  event->at_beat = at;
  return 1;
}

uint8_t ht_action_loop_tick(HtActionLooper *loop, float beat, HtActionEvent *out, uint8_t cap) {
  uint8_t written = 0;
  float local;
  if (!loop || !out || cap == 0u || loop->mode != HT_ACTION_LOOPING || loop->event_count == 0u) {
    return 0;
  }
  local = beat - loop->loop_start_beat;
  while (local >= loop->loop_length_beats) {
    local -= loop->loop_length_beats;
    loop->loop_start_beat += loop->loop_length_beats;
    loop->play_cursor = 0;
  }
  while (loop->play_cursor < loop->event_count && written < cap) {
    uint8_t index = loop->order[loop->play_cursor];
    const HtActionEvent *event = &loop->events[index];
    if (event->at_beat > local + 0.0001f) {
      break;
    }
    out[written++] = *event;
    loop->play_cursor = (uint8_t)(loop->play_cursor + 1u);
  }
  return written;
}
