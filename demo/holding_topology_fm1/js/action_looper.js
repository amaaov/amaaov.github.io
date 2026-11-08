/**
 * Ephemeral user-action looper. Host knob is chosen per seed; nothing persists.
 * Record until bars elapse (or host drops), then loop immediately. Re-arm overrides.
 */

export const ACTION_LOOP_HOSTS = ["KNOB1", "KNOB2", "KNOB3", "KNOB4"];
export const ACTION_LOOP_BEATS_PER_BAR = 4;
export const ACTION_LOOP_BARS = 2;

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

export function createActionLooper({
  seed = 1,
  bars = ACTION_LOOP_BARS,
  beatsPerBar = ACTION_LOOP_BEATS_PER_BAR,
} = {}) {
  const loopLengthBeats = Math.max(1, bars * beatsPerBar);
  let host = ACTION_LOOP_HOSTS[(seed >>> 0) % ACTION_LOOP_HOSTS.length];
  let mode = "idle";
  let events = [];
  let recordStartBeat = 0;
  let loopStartBeat = 0;
  let lastHostValue = 0.5;
  let playCursor = 0;
  let loopOrder = [];
  let replaying = false;

  function resetBuffer() {
    events = [];
    playCursor = 0;
    loopOrder = [];
  }

  function startRecord(beat) {
    mode = "recording";
    resetBuffer();
    recordStartBeat = beat;
  }

  function shuffleOrder(random) {
    loopOrder = events.map((_, index) => index);
    for (let index = loopOrder.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [loopOrder[index], loopOrder[other]] = [loopOrder[other], loopOrder[index]];
    }
    if (loopOrder.length > 1 && random() < 0.55) {
      const rotate = Math.floor(random() * loopOrder.length);
      loopOrder = [...loopOrder.slice(rotate), ...loopOrder.slice(0, rotate)];
    }
  }

  function beginLoop(beat, random = Math.random) {
    if (events.length === 0) {
      mode = "idle";
      return;
    }
    mode = "looping";
    loopStartBeat = beat;
    playCursor = 0;
    shuffleOrder(random);
  }

  return {
    host: () => host,
    mode: () => mode,
    eventCount: () => events.length,
    loopLengthBeats: () => loopLengthBeats,
    isReplaying: () => replaying,
    rebind(nextSeed = 1) {
      host = ACTION_LOOP_HOSTS[(nextSeed >>> 0) % ACTION_LOOP_HOSTS.length];
      mode = "idle";
      lastHostValue = 0.5;
      resetBuffer();
    },
    /**
     * Host knob crosses up → record (override). Bars done or host drops → loop.
     */
    onHostKnob(value, beat, random = Math.random) {
      const level = clamp01(value);
      if (level >= 0.68 && lastHostValue < 0.68) {
        startRecord(beat);
      } else if (mode === "recording" && level < 0.32 && lastHostValue >= 0.32) {
        beginLoop(beat, random);
      }
      lastHostValue = level;
      return mode;
    },
    capture(action, beat) {
      if (replaying || mode !== "recording") {
        return false;
      }
      if (action?.kind === "knob" && action.name === host) {
        return false;
      }
      const at = Math.max(0, beat - recordStartBeat);
      if (at > loopLengthBeats + 0.05) {
        return false;
      }
      events.push({
        at,
        kind: action.kind,
        name: action.name,
        value: action.value,
        down: action.down,
        midi: action.midi,
      });
      return true;
    },
    /**
     * Advance looper. Returns actions to dispatch this beat slice.
     */
    tick(beat, previousBeat, random = Math.random) {
      if (mode === "recording" && beat - recordStartBeat >= loopLengthBeats) {
        beginLoop(beat, random);
      }
      if (mode !== "looping" || events.length === 0) {
        return [];
      }
      const length = loopLengthBeats;
      const localNow = ((beat - loopStartBeat) % length + length) % length;
      const localPrev =
        previousBeat <= loopStartBeat
          ? -0.0001
          : ((previousBeat - loopStartBeat) % length + length) % length;
      const wrapped = localNow < localPrev;
      if (wrapped) {
        shuffleOrder(random);
        playCursor = 0;
      }
      const due = [];
      for (let step = 0; step < loopOrder.length; step += 1) {
        const index = loopOrder[step];
        const event = events[index];
        if (!event) {
          continue;
        }
        const at = event.at % length;
        const crossed = wrapped
          ? at <= localNow || at > localPrev
          : at > localPrev && at <= localNow;
        if (crossed) {
          due.push(event);
        }
      }
      return due;
    },
    withReplay(fn) {
      replaying = true;
      try {
        return fn();
      } finally {
        replaying = false;
      }
    },
  };
}
