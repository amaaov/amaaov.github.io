import { LETTER_GAP, MORSE_TABLE, WORD_GAP } from "./alphabet.js";
import { normalizeMorse, textToMorse } from "./encode.js";

/**
 * Maps each character in the encoded Morse string to a source text span.
 * Gap characters (letter/word spacing) map to null.
 */
export function buildTextMorseMap(text) {
  const source = String(text);
  let morse = "";
  const letterAtMorse = [];

  const words = [];
  const wordPattern = /\S+/gu;
  let match = wordPattern.exec(source);
  while (match) {
    words.push({ value: match[0], index: match.index });
    match = wordPattern.exec(source);
  }

  words.forEach((word, wordIndex) => {
    if (wordIndex > 0) {
      for (const character of WORD_GAP) {
        morse += character;
        letterAtMorse.push(null);
      }
    }
    let lettersInWord = 0;
    for (let index = 0; index < word.value.length; index += 1) {
      const code = MORSE_TABLE[word.value[index].toUpperCase()];
      if (!code) continue;
      if (lettersInWord > 0) {
        for (const character of LETTER_GAP) {
          morse += character;
          letterAtMorse.push(null);
        }
      }
      const textFrom = word.index + index;
      const textTo = textFrom + 1;
      for (const character of code) {
        morse += character;
        letterAtMorse.push({ textFrom, textTo });
      }
      lettersInWord += 1;
    }
  });

  return { morse, letterAtMorse };
}

/** True when `text` encodes to the same Morse stream as `code`. */
export function textMatchesMorse(text, code) {
  return textToMorse(text) === normalizeMorse(code);
}
