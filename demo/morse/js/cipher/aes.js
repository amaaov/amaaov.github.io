import { textToMorse } from "../morse/encode.js";
import { morseToText } from "../morse/decode.js";
import { normalizeMorse } from "../morse/encode.js";

async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex) {
  const clean = hex.replace(/[^0-9a-f]/giu, "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export async function aesEncrypt(text, password) {
  if (!password) throw new Error("Password required for AES-GCM");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(text),
  );
  const payload = `${toHex(salt)}${toHex(iv)}${toHex(cipher)}`;
  return { hex: payload, morse: textToMorse(payload) };
}

export async function aesDecrypt(hexOrMorse, password) {
  if (!password) throw new Error("Password required for AES-GCM");
  let hex = String(hexOrMorse).replace(/\s+/gu, "");
  if (/[.\-/]/u.test(hex)) {
    hex = morseToText(normalizeMorse(hexOrMorse)).replace(/\s+/gu, "");
  }
  const bytes = fromHex(hex);
  if (bytes.length < 28) throw new Error("Ciphertext too short");
  const salt = bytes.slice(0, 16);
  const iv = bytes.slice(16, 28);
  const data = bytes.slice(28);
  const key = await deriveKey(password, salt);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(plain);
}
