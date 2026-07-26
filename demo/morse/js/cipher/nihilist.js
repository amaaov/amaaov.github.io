import { onlyLetters } from "./alphabet.js";
import { buildPolybius5, lettersToCodes } from "./polybius5.js";

/**
 * Classic Nihilist: keyed Polybius coords + repeating additive keyword coords.
 * Ciphertext is space-separated sums (often 2–3 digits).
 */
export function nihilistEncrypt(
  text,
  squareKey = "ZEBRAS",
  additiveKey = "RUSSIA",
) {
  const { forward } = buildPolybius5(squareKey);
  const plainCodes = lettersToCodes(text, forward);
  const keyCodes = lettersToCodes(additiveKey, forward);
  if (!keyCodes.length) throw new Error("Additive key required");
  return plainCodes
    .map((code, index) => code + keyCodes[index % keyCodes.length])
    .join(" ");
}

export function nihilistDecrypt(
  text,
  squareKey = "ZEBRAS",
  additiveKey = "RUSSIA",
) {
  const { reverse } = buildPolybius5(squareKey);
  const { forward } = buildPolybius5(squareKey);
  const keyCodes = lettersToCodes(additiveKey, forward);
  if (!keyCodes.length) throw new Error("Additive key required");
  const numbers = String(text)
    .match(/\d+/gu)
    ?.map(Number);
  if (!numbers?.length) throw new Error("Nihilist ciphertext must contain numbers");
  return numbers
    .map((value, index) => {
      const plain = value - keyCodes[index % keyCodes.length];
      return reverse[plain] || "?";
    })
    .join("");
}

export { onlyLetters };
