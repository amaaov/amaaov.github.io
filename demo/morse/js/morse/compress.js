/**
 * Reversible Morse digraph compression for open-channel stacks.
 * Packs dit / dah / separator pairs into A–I (fixed map, not a secret).
 * Intended as a stage before and/or after a cipher, not as encryption itself.
 */

import { MORSE_TABLE } from "./alphabet.js";
import { morseToText } from "./decode.js";

const PAIRS = ["..", ".-", ".x", "-.", "--", "-x", "x.", "x-", "xx"];
const DIGITS = "ABCDEFGHI";

const FORWARD = Object.fromEntries(
  PAIRS.map((pair, index) => [pair, DIGITS[index]]),
);
const REVERSE = Object.fromEntries(
  PAIRS.map((pair, index) => [DIGITS[index], pair]),
);

function tokenStream(text) {
  const words = String(text ?? "")
    .toUpperCase()
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
  return words
    .map((word) =>
      [...word]
        .filter((character) => MORSE_TABLE[character])
        .map((character) => `${MORSE_TABLE[character]}x`)
        .join("")
        .replace(/x$/u, ""),
    )
    .filter(Boolean)
    .join("xx");
}

function packStream(stream) {
  let packed = stream;
  if (packed.length % 2 === 1) packed += "x";
  let out = "";
  for (let index = 0; index < packed.length; index += 2) {
    const pair = packed.slice(index, index + 2);
    out += FORWARD[pair] || "";
  }
  return out;
}

function unpackLetters(packed) {
  return [...String(packed ?? "").toUpperCase().replace(/[^A-I]/gu, "")]
    .map((letter) => REVERSE[letter] || "")
    .join("");
}

function streamToMorse(stream) {
  return stream
    .replace(/xx+/gu, " / ")
    .replace(/x/gu, " ")
    .replace(/ {2,}/gu, " ")
    .trim();
}

/** Compress alphanumerics via Morse digraph packing → A–I letters. */
export function compressMorseText(text) {
  const stream = tokenStream(text);
  if (!stream) return "";
  return packStream(stream);
}

/** Inverse of compressMorseText. Accepts A–I (ignores other characters). */
export function decompressMorseText(packed) {
  const stream = unpackLetters(packed);
  if (!stream) return "";
  return morseToText(streamToMorse(stream));
}

export const MORSE_COMPRESS_ALPHABET = DIGITS;
