import { MORSE_TABLE } from "../morse/alphabet.js";
import { onlyLetters } from "./alphabet.js";
import { morseToText } from "../morse/decode.js";

const DEFAULT_MAP = {
  ".": ["0", "1", "2", "3"],
  "-": ["4", "5", "6"],
  "x": ["7", "8", "9"],
};

function toMorseStream(text) {
  return onlyLetters(text)
    .split("")
    .map((character) => `${MORSE_TABLE[character]}x`)
    .join("")
    .replace(/x$/u, "");
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function polluxEncrypt(text, digitMap = DEFAULT_MAP) {
  const stream = toMorseStream(text);
  return [...stream]
    .map((symbol) => pick(digitMap[symbol] || digitMap.x))
    .join("");
}

export function polluxDecrypt(digits, digitMap = DEFAULT_MAP) {
  const reverse = {};
  for (const [symbol, list] of Object.entries(digitMap)) {
    for (const digit of list) reverse[digit] = symbol;
  }
  const stream = [...String(digits).replace(/\D/gu, "")]
    .map((digit) => reverse[digit] ?? "")
    .join("");
  const morse = stream
    .split("x")
    .filter(Boolean)
    .join(" ")
    .replace(/x/gu, "");
  return morseToText(morse);
}
