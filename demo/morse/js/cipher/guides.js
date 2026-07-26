/** Short operator notes for the active method. */
export const CIPHER_GUIDES = {
  none: "Output matches input. No cipher step.",
  atbash: "Reverses the alphabet (A↔Z). No key required.",
  caesar:
    "Shifts every letter by a fixed amount (0–25). Classic ROT13 uses shift 13.",
  affine:
    "Letter map (a×x + b) mod 26. a must be coprime with 26 (1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25).",
  substitution:
    "Builds a cipher alphabet from the keyword, then fills unused letters A–Z in order.",
  vigenere:
    "Polyalphabetic shift: each plaintext letter moves by the matching keyword letter, repeating the keyword.",
  beaufort:
    "Vigenère-family cipher using complementary subtraction against the keyword.",
  autokey:
    "Like Vigenère, but after the keyword the key stream continues with the plaintext itself.",
  playfair:
    "Encrypts letter pairs on a 5×5 keyword square (I and J share a cell).",
  railfence:
    "Writes letters in a zig-zag across the rails, then reads each rail left to right.",
  columnar:
    "Writes under the keyword in rows, then reads columns in the keyword’s alphabetical order.",
  bacon:
    "Each letter becomes a fixed 5-symbol biliteral pattern (classically two typefaces; here A/B groups).",
  pollux:
    "Morse-native hand cipher: dit, dah, and space map to digits with deliberate ambiguity.",
  morbit:
    "Morse-native: pairs of Morse symbols map to digits through a key that is a permutation of 1–9.",
  fractionated:
    "Converts Morse to a fractionated stream, then reconstitutes letters through a keyed alphabet.",
  otp:
    "One-time pad / Vernam: combine each letter with a pad letter. Pad must be at least as long as the message and used once.",
  adfgvx:
    "Fractionates through a 6×6 square (36 unique A–Z and 0–9), then columnar transposition with the column key.",
  nihilist:
    "Polybius-square numbers plus an additive key stream. Square key seeds the square; add key is the running key.",
  bifid:
    "Fractionates through a Polybius square in periods, then recombines row/column streams into ciphertext.",
  aes: "Password derives an AES-GCM key (PBKDF2). Modern sealed payload shown as hex, then Morse-encoded if needed.",
};
