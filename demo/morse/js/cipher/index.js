import { atbashDecrypt, atbashEncrypt } from "./atbash.js";
import { caesarDecrypt, caesarEncrypt } from "./caesar.js";
import { affineDecrypt, affineEncrypt } from "./affine.js";
import { substitutionDecrypt, substitutionEncrypt } from "./substitution.js";
import { vigenereDecrypt, vigenereEncrypt } from "./vigenere.js";
import { beaufortDecrypt, beaufortEncrypt } from "./beaufort.js";
import { autokeyDecrypt, autokeyEncrypt } from "./autokey.js";
import { playfairDecrypt, playfairEncrypt } from "./playfair.js";
import { railFenceDecrypt, railFenceEncrypt } from "./railfence.js";
import { columnarDecrypt, columnarEncrypt } from "./columnar.js";
import { baconDecrypt, baconEncrypt } from "./bacon.js";
import { polluxDecrypt, polluxEncrypt } from "./pollux.js";
import { morbitDecrypt, morbitEncrypt, morbitKeyFromKeyword } from "./morbit.js";
import { fractionatedDecrypt, fractionatedEncrypt } from "./fractionated.js";
import { otpDecrypt, otpEncrypt, generatePad } from "./otp.js";
import { adfgvxDecrypt, adfgvxEncrypt } from "./adfgvx.js";
import { nihilistDecrypt, nihilistEncrypt } from "./nihilist.js";
import { bifidDecrypt, bifidEncrypt } from "./bifid.js";
import { aesDecrypt, aesEncrypt } from "./aes.js";

/** Catalog of open-channel methods. keys describe UI fields. */
export const CIPHERS = [
  { id: "none", name: "Plain", keys: [], sync: true },
  { id: "atbash", name: "Atbash", keys: [], sync: true },
  { id: "caesar", name: "Caesar / ROT", keys: ["shift"], sync: true },
  { id: "affine", name: "Affine", keys: ["a", "b"], sync: true },
  { id: "substitution", name: "Keyed substitution", keys: ["keyword"], sync: true },
  { id: "vigenere", name: "Vigenère", keys: ["keyword"], sync: true },
  { id: "beaufort", name: "Beaufort", keys: ["keyword"], sync: true },
  { id: "autokey", name: "Autokey", keys: ["keyword"], sync: true },
  { id: "playfair", name: "Playfair", keys: ["keyword"], sync: true },
  { id: "railfence", name: "Rail fence", keys: ["rails"], sync: true },
  { id: "columnar", name: "Columnar transposition", keys: ["keyword"], sync: true },
  { id: "bacon", name: "Baconian", keys: [], sync: true },
  { id: "pollux", name: "Pollux (Morse)", keys: [], sync: true },
  { id: "morbit", name: "Morbit (Morse)", keys: ["morbitKey"], sync: true },
  { id: "fractionated", name: "Fractionated Morse", keys: ["keyword"], sync: true },
  { id: "otp", name: "One-time pad", keys: ["pad"], sync: true },
  { id: "adfgvx", name: "ADFGVX", keys: ["squareKey", "columnKey"], sync: true },
  { id: "nihilist", name: "Nihilist", keys: ["squareKey", "additiveKey"], sync: true },
  { id: "bifid", name: "Bifid", keys: ["keyword", "period"], sync: true },
  { id: "aes", name: "AES-GCM (modern)", keys: ["password"], sync: false },
];

export async function applyCipher(id, mode, text, options = {}) {
  const encrypt = mode === "encrypt";
  switch (id) {
    case "none":
      return text;
    case "atbash":
      return encrypt ? atbashEncrypt(text) : atbashDecrypt(text);
    case "caesar":
      return encrypt
        ? caesarEncrypt(text, options.shift)
        : caesarDecrypt(text, options.shift);
    case "affine":
      return encrypt
        ? affineEncrypt(text, options.a, options.b)
        : affineDecrypt(text, options.a, options.b);
    case "substitution":
      return encrypt
        ? substitutionEncrypt(text, options.keyword)
        : substitutionDecrypt(text, options.keyword);
    case "vigenere":
      return encrypt
        ? vigenereEncrypt(text, options.keyword)
        : vigenereDecrypt(text, options.keyword);
    case "beaufort":
      return encrypt
        ? beaufortEncrypt(text, options.keyword)
        : beaufortDecrypt(text, options.keyword);
    case "autokey":
      return encrypt
        ? autokeyEncrypt(text, options.keyword)
        : autokeyDecrypt(text, options.keyword);
    case "playfair":
      return encrypt
        ? playfairEncrypt(text, options.keyword)
        : playfairDecrypt(text, options.keyword);
    case "railfence":
      return encrypt
        ? railFenceEncrypt(text, options.rails)
        : railFenceDecrypt(text, options.rails);
    case "columnar":
      return encrypt
        ? columnarEncrypt(text, options.keyword)
        : columnarDecrypt(text, options.keyword);
    case "bacon":
      return encrypt ? baconEncrypt(text) : baconDecrypt(text);
    case "pollux":
      return encrypt ? polluxEncrypt(text) : polluxDecrypt(text);
    case "morbit": {
      const key = options.morbitKey || morbitKeyFromKeyword(options.keyword || "MORSECODE");
      return encrypt ? morbitEncrypt(text, key) : morbitDecrypt(text, key);
    }
    case "fractionated":
      return encrypt
        ? fractionatedEncrypt(text, options.keyword)
        : fractionatedDecrypt(text, options.keyword);
    case "otp":
      return encrypt
        ? otpEncrypt(text, options.pad)
        : otpDecrypt(text, options.pad);
    case "adfgvx":
      return encrypt
        ? adfgvxEncrypt(text, options.squareKey, options.columnKey)
        : adfgvxDecrypt(text, options.squareKey, options.columnKey);
    case "nihilist":
      return encrypt
        ? nihilistEncrypt(text, options.squareKey, options.additiveKey)
        : nihilistDecrypt(text, options.squareKey, options.additiveKey);
    case "bifid":
      return encrypt
        ? bifidEncrypt(text, options.keyword, options.period)
        : bifidDecrypt(text, options.keyword, options.period);
    case "aes": {
      if (encrypt) {
        const result = await aesEncrypt(text, options.password);
        return result.hex;
      }
      return aesDecrypt(text, options.password);
    }
    default:
      throw new Error(`Unknown cipher: ${id}`);
  }
}

export { generatePad, morbitKeyFromKeyword };
