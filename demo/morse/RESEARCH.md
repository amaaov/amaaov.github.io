# Morse channel — research notes

## Participants

amaaov / agent session 2026-07-26

## Decisions

Open-channel encryption here means methods historically or practically layered on telegraph, Morse radio, or similar clear-air links where the encoding is public and secrecy lives in a prior cipher step.

Morse itself is encoding, not encryption. The stack is always: plaintext → cipher → Morse (or Morse-native cipher that consumes Morse structure).

Included cipher families (implemented locally, no network):

1. Monoalphabetic — Atbash, Caesar/ROT, Affine, keyed substitution
2. Polyalphabetic — Vigenère, Beaufort, Autokey
3. Polygraphic — Playfair
4. Transposition — rail fence, columnar
5. Steganographic precursor — Baconian (biliteral)
6. Morse-native hand ciphers — Pollux, Morbit, Fractionated Morse
7. Perfect secrecy (classical) — one-time pad / Vernam over A–Z
8. Field telegraph — ADFGVX (WWI fractionating + transposition)
9. Field fractionating — Nihilist (Polybius + additive key), Bifid (Delastelle period fractionation)
10. Modern open-channel stack — password → PBKDF2 → AES-GCM via Web Crypto, then hex Morse

Excluded from this first cut: fictional alphabets, machine rotors (Enigma simulation), and puzzle-only glyph sets. Those are not typical open-channel operator tools.

Synth scope starts with CW classics (sine, square, triangle, saw) plus subtractive and simple FM/AM, then an effects chain (gain, filter, delay, feedback, waveshaper, dry/wet). Scene pack (descriptive names only): neon saw (detuned supersaw + mild drive), keygen lead (bright pulse/saw with crush and delay drip), pulse chip (PWM square, dah arp), crystal bell (short FM glass), soft canvas (dry triangle/sine GM-ish patches), rain grid (saw + noise bandpass tube), and scene arp (keygen lead with dah arpeggio). Extended engines: chord stack, voice organism (soft cross-mod swarm), techno lattice (punch envelopes + metal ping), rhythm organism (chaotic dit/dah bodies), ground wave (hum + soil noise + crackle), magnetic flux (heterodyne beat + grit sweep), noise field (pure white/pink/brown, no oscillators), drum kit (hat/kick mapping), didgeridoo (tube drone with breath buzz), tribal (djembe slap on dit, didgeridoo plus bass skin on dah), amazon (organismic canopy bed with mist/drift/swell plus continuous cicadas, crickets, bird murmur, and denser Morse-keyed birds, bugs, and animal calls), and sampler (procedural buffers or a loaded audio file). Each engine exposes its own parameters in the synth panel; shared tone/FX stay global. WPM lives next to Play and drives playback, tap decode, mic decode, and WAV export. A modulation section adds ADSR amp envelope plus ENV→filter and ENV→pitch, and three LFOs (rate, shape, amounts into pitch / filter / amp / delay / resonance / drive). Timbre controls stay behind a panel so the default surface stays translator-first.

## Effects

Research pass completed before implementation. Catalog drives the cipher menu order and help text.

WAV export renders the current synth engine and effects chain offline (OfflineAudioContext) at 16-bit mono 44.1 kHz, using live tone Hz, WPM, master, filter, delay, drive, and modulation settings. Toolbar WAV button and keyboard W. Falls back to a clean keyed sine CW render only when offline audio is unavailable.

Clock VIDEO records one full Morse pass (loop forced off for the session) as square video (1080 default; plasma quality 4K uses 2160) with live synth audio (WebM or MP4 by capability; MediaRecorder required). Capture uses a fixed 30fps offscreen canvas; export paints are hard-capped to that rate so heavy plasma does not block Morse timers. Morse waits use wall-clock elapsed time (not fixed 16ms step counts) so late setTimeout wakes do not stretch tempo. Prefer VP8 at ~12 Mbps; hold a short delay/effect tail before stop. Progress fills the disabled VIDEO button in the toolbar; no status text under the control. LETTERS checkbox toggles the Casio letter window on face and ladder (plasma is field-only); default on. FULL (keyboard F) expands the clock stage for device screen recording—native Fullscreen API when available, CSS immersive fallback on mobile—with Play / Stop / EXIT in the stage dock; Esc exits.

Input modes are tabs: TEXT, MORSE, TAP, MIC, IMG. Output modes stay visible: TEXT, MORSE, QR, MIDI, CLK. Detected output follows input (Morse for TEXT, text otherwise) and can be overridden. QR is a matrix view with GO / QR styles (GO default): same modules as a go board or a QR code; an ASCII checkbox renders either style as monospace text; graphic mode has a single Image control for SVG and ASCII mode copies text to the clipboard. TEXT input auto-detects pasted ASCII QR/GO boards (block, hash, or stone grids) and restores the payload. MIDI shows a straight-key score as text (note on/off times and hex bytes) and, when Web MIDI is connected to an output port, Play keys that note for each dit and dah at toolbar WPM. CLK is a beat view that packs short Morse letters onto one face until the window reaches O-weight (nine tone units) or the 16-tone cap; O (---) may stand alone, while E and other short letters share a face with neighbors when possible. FACE, LADR, and PLASMA styles. Idle shows the densest readable window in the message; during play a revolution covers the current packed window. FACE is a thin clock hand on a dial; LADR is a siteswap-style two-rail ladder (time up, L/R hands) with unit throws: 3 dit (odd/cross), 4 dah (even/same-hand fountain, three units), 1 zip (intra-letter), 0 rest (inter-letter). A prop rides the active step. PLASMA is demoscene plasma only: full low-res field, no dial, hand, sectors, or letter window. A type dropdown picks CLASSIC, LETTER BURN, CLOUDS, OIL WATER, CAMPFIRE, LENS REFLECTIONS, WATER REFLECTIONS, TSUKUYOMI, AMATERASU, SUSANOO, KALEIDOSCOPE, or SAND DRAWING; switches ease over about a second with a light domain morph. Optional cheap sin-hash grain can tint field samples; shades stay HSL from the field so the pixel loop stays light. Continuous idle motion; Morse progress drifts and morphs the whole field, dit/dah keying pulses amplitude globally, and synth tone Hz, filter, drive, resonance, WPM, LFO1, delay, and engine tint the waves. LETTER BURN burns the current letter from the top so fragments fall as ash dust; CLOUDS is soft plasma interference that billows into cloud formations on open sky; TSUKUYOMI is a crimson lunar veil; AMATERASU is black fire with sear edges; SUSANOO is storm-armor lightning; KALEIDOSCOPE mirrors plasma into rotating wedges with prismatic hue; Plasma quality LIVE/HIGH/1080/4K sets preview buffer and VIDEO export side (LIVE default; 4K is 2160 square); SAND DRAWING is finger painting on sand: soft groove strokes with side ridges on a warm bed. Drag to scrub when idle. IMG tries QR/GO decode first (BarcodeDetector when available, else module sampling of the same ECC-L matrices the output view encodes), then falls back to threshold preview plus horizontal blob scan for dit/dah recognition. QR payloads are Morse by default and restore text through the usual decoder.

PLAIN / ENCRYPT / DECRYPT tabs sit in the top bar. PLAIN passes input through with no cipher; ENCRYPT and DECRYPT show the method controls and rewrite output only. Key fields stay empty with placeholders as hints; transform waits until required parameters are filled. A short guide under the controls explains the active method. Input stays plain. Loop toggles continuous CW playback of the current output Morse.

Local history stores plaintext and Morse on this device (localStorage). Debounced after edits, also on Play. Panel Y: restore a row, clear all, or disable saving.

Ensemble (panel E) layers up to four concurrent word loops, each with its own text/Morse, WPM, and synth engine into a dry master bus. SAVE stores the current set as a local composition; the composition select swaps sets while keeping the master bus warm so a playing ensemble can continue without AudioContext restart lag. Toolbar Play / Loop / synth FX stay the single-output practice path; ensemble Play starts layers without replacing that path. Global Stop clears solo and ensemble together.

UI targets small screens and assistive tech: roving tabindex on tablists, dialog focus trap with inert shell, safe-area padding, 44px-class touch targets on coarse pointers, 16px form fields to avoid iOS zoom, and a non-resizable full-width viz square on narrow viewports.

## Next

- Improve microphone decoder under noisy room conditions

## Source

- Cipher Museum — Morse as encoding vs cipher layering
- Practical Cryptography — Fractionated Morse
- CipherChronicle / Boxentriq — Pollux, Morbit, Nihilist
- Bifid (Delastelle) period fractionation
- Historical ADFGVX descriptions (WWI French army field cipher)
- Web Audio API for CW tone, tap timing, and mic envelope detection
