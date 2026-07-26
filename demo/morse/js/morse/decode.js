import { REVERSE_MORSE } from "./alphabet.js";
import { normalizeMorse } from "./encode.js";

export function morseToText(code) {
  const normalized = normalizeMorse(code);
  if (!normalized) return "";

  return normalized
    .split(/\s*\/\s*/u)
    .map((word) =>
      word
        .trim()
        .split(/\s+/u)
        .map((symbol) => REVERSE_MORSE[symbol] ?? "�")
        .join(""),
    )
    .join(" ");
}

/**
 * Decode a stream of timed marks into Morse then text.
 * marks: [{ kind: "on"|"off", ms: number }]
 */
export function marksToMorse(marks, unitMs = 80) {
  if (!marks.length) return "";

  const dit = Math.max(40, unitMs);
  const dahThreshold = dit * 2.2;
  const letterGap = dit * 2.5;
  const wordGap = dit * 6;

  let morse = "";
  let letter = "";

  for (const mark of marks) {
    if (mark.kind === "on") {
      letter += mark.ms >= dahThreshold ? "-" : ".";
      continue;
    }

    if (mark.ms >= wordGap) {
      if (letter) morse += `${letter} `;
      letter = "";
      morse += "/ ";
    } else if (mark.ms >= letterGap) {
      if (letter) morse += `${letter} `;
      letter = "";
    }
  }

  if (letter) morse += `${letter} `;
  return morse.trim().replace(/ \/ $/u, "").replace(/ {2,}/gu, " ");
}
