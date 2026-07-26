import { normalizeMorse } from "../morse/encode.js";

export function unitMsForWpm(wpm) {
  return 1200 / Math.max(5, Number(wpm) || 18);
}

/**
 * Straight-key MIDI score: note on for each dit/dah, note off at element end.
 * Timing matches the CW voice scheduler (inter-element gap of one unit).
 */
export function buildMidiEvents(
  morse,
  { wpm = 18, note = 69, channel = 0, velocity = 96 } = {},
) {
  const unit = unitMsForWpm(wpm);
  const channelNibble = Math.max(0, Math.min(15, Number(channel) || 0));
  const noteNumber = Math.max(0, Math.min(127, Number(note) || 69));
  const vel = Math.max(1, Math.min(127, Number(velocity) || 96));
  const tokens = [...normalizeMorse(morse)].filter((character) =>
    ".-/ ".includes(character),
  );
  let atMs = 0;
  const events = [];

  for (const token of tokens) {
    if (token === "." || token === "-") {
      const duration = unit * (token === "-" ? 3 : 1);
      events.push({
        atMs,
        status: 0x90 | channelNibble,
        note: noteNumber,
        velocity: vel,
        label: "ON",
        token,
      });
      events.push({
        atMs: atMs + duration,
        status: 0x80 | channelNibble,
        note: noteNumber,
        velocity: 0,
        label: "OFF",
        token,
      });
      atMs += duration + unit;
    } else if (token === " ") {
      atMs += unit * 2;
    } else if (token === "/") {
      atMs += unit * 4;
    }
  }

  return events;
}

export function formatMidiText(events, { wpm = 18, note = 69, channel = 0 } = {}) {
  const channelDisplay = Math.max(0, Math.min(15, Number(channel) || 0)) + 1;
  const header = `ch${channelDisplay} note${Number(note) || 69} · ${Number(wpm) || 18} WPM`;
  if (!events.length) return `${header}\n(empty)`;
  const lines = events.map((event) => {
    const hex = [event.status, event.note, event.velocity]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join(" ");
    return `${String(Math.round(event.atMs)).padStart(5, " ")}ms  ${event.label.padEnd(3)}  ${hex}`;
  });
  return [header, ...lines].join("\n");
}
