import { MORSE_TABLE } from "../morse/alphabet.js";
import { onlyLetters } from "./alphabet.js";
import { morseToText } from "../morse/decode.js";

const PAIRS = ["..", ".-", ".x", "-.", "--", "-x", "x.", "x-", "xx"];

export function morbitKeyFromKeyword(keyword = "MORSECODE") {
  const letters = onlyLetters(keyword).padEnd(9, "ABCDEFGHI").slice(0, 9);
  const ranked = [...letters]
    .map((character, index) => ({ character, index }))
    .sort((left, right) =>
      left.character === right.character
        ? left.index - right.index
        : left.character.localeCompare(right.character),
    );
  const digits = Array(9);
  ranked.forEach((entry, rank) => {
    digits[entry.index] = String(rank + 1);
  });
  return digits.join("");
}

function pairMap(keyDigits) {
  const digits = String(keyDigits).replace(/\D/gu, "");
  if (digits.length !== 9 || new Set(digits).size !== 9) {
    throw new Error("Morbit key must be a permutation of digits 1-9");
  }
  const forward = {};
  const reverse = {};
  PAIRS.forEach((pair, index) => {
    forward[pair] = digits[index];
    reverse[digits[index]] = pair;
  });
  return { forward, reverse };
}

function toStream(text) {
  return onlyLetters(text)
    .split("")
    .map((character) => `${MORSE_TABLE[character]}x`)
    .join("")
    .replace(/x$/u, "x");
}

export function morbitEncrypt(text, key = "123456789") {
  const { forward } = pairMap(key);
  let stream = toStream(text);
  if (stream.length % 2 === 1) stream += "x";
  let out = "";
  for (let index = 0; index < stream.length; index += 2) {
    out += forward[stream.slice(index, index + 2)];
  }
  return out;
}

export function morbitDecrypt(digits, key = "123456789") {
  const { reverse } = pairMap(key);
  const stream = [...String(digits).replace(/\D/gu, "")]
    .map((digit) => reverse[digit] || "")
    .join("");
  const morse = stream
    .replace(/xx/gu, " / ")
    .replace(/x/gu, " ")
    .replace(/ {2,}/gu, " ")
    .trim();
  return morseToText(morse);
}
