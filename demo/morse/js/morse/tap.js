import { marksToMorse } from "./decode.js";
import { morseToText } from "./decode.js";

export function createTapDecoder({ onUpdate, unitMs = 80 } = {}) {
  const marks = [];
  let pressStartedAt = 0;
  let releaseStartedAt = 0;
  let pressing = false;
  let unit = unitMs;

  function emit() {
    const morse = marksToMorse(marks, unit);
    onUpdate?.({
      marks: [...marks],
      morse,
      text: morseToText(morse),
    });
  }

  return {
    press() {
      if (pressing) return;
      const now = performance.now();
      if (releaseStartedAt > 0) {
        marks.push({ kind: "off", ms: now - releaseStartedAt });
      }
      pressStartedAt = now;
      pressing = true;
    },
    release() {
      if (!pressing) return;
      const now = performance.now();
      marks.push({ kind: "on", ms: now - pressStartedAt });
      releaseStartedAt = now;
      pressing = false;
      emit();
    },
    clear() {
      marks.length = 0;
      pressStartedAt = 0;
      releaseStartedAt = 0;
      pressing = false;
      emit();
    },
    setUnitMs(next) {
      unit = Math.max(40, Number(next) || unit);
    },
    getMarks() {
      return [...marks];
    },
  };
}
