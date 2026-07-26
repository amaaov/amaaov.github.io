import { MORSE_TABLE } from "../morse/alphabet.js";
import { onlyLetters, uniqueKeyAlphabet } from "./alphabet.js";
import { morseToText } from "../morse/decode.js";

const TRIPLES = (() => {
  const symbols = [".", "-", "x"];
  const out = [];
  for (const a of symbols) {
    for (const b of symbols) {
      for (const c of symbols) out.push(a + b + c);
    }
  }
  return out;
})();

function keyedMap(keyword) {
  const alphabet = uniqueKeyAlphabet(keyword || "ROUNDTABLE").slice(0, 27);
  const forward = {};
  const reverse = {};
  TRIPLES.forEach((triple, index) => {
    const letter = alphabet[index] || "?";
    forward[triple] = letter;
    reverse[letter] = triple;
  });
  return { forward, reverse };
}

function toStream(text) {
  return onlyLetters(text)
    .split("")
    .map((character) => `${MORSE_TABLE[character]}x`)
    .join("")
    .replace(/x$/u, "");
}

export function fractionatedEncrypt(text, keyword = "ROUNDTABLE") {
  const { forward } = keyedMap(keyword);
  let stream = toStream(text);
  while (stream.length % 3 !== 0) stream += "x";
  let out = "";
  for (let index = 0; index < stream.length; index += 3) {
    out += forward[stream.slice(index, index + 3)];
  }
  return out;
}

export function fractionatedDecrypt(text, keyword = "ROUNDTABLE") {
  const { reverse } = keyedMap(keyword);
  const stream = onlyLetters(text)
    .split("")
    .map((character) => reverse[character] || "")
    .join("");
  const morse = stream
    .replace(/x+/gu, (match) => (match.length >= 2 ? " / " : " "))
    .replace(/ {2,}/gu, " ")
    .trim();
  return morseToText(morse);
}
