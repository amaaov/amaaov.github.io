# HT-1 Holding Topology

Juggling-court generators on the M-VAVE FM-1.

## Controls

| Control | Action |
| --- | --- |
| PLAY | Start: new unique seed, restart Turing + atlas generators. Press again to stop. Boots stopped. |
| SEQ | Reshuffle generators from the current seed family |
| KNOB 1–4 | Feedback, LFO depth, siteswap/objects, tempo |
| PRESETS / ALGORITHM | Scale and patch-type bias |
| ENV / LFO / FX / EDIT / GLO | Envelope, LFO, delay/scatter, drive, wildness (tap to raise) |
| HOME | Recall default knobs |
| SAVE | Store octave / lock hint |
| OCT− / OCT+ | Transpose |
| REC | Tape arm: record into the short loop / play back |
| SEL | Cosmology weather on/off (stronger storm/chaos into the mix) |
| ARP | Episode gap rest (near-mute court gate) |
| SEQ | Reshuffle generators + tail rest |
| Keys | Seeded roles (play / burst / mute, …) |

MASTER is the hardware volume pot. The LCD shows a simple three-ball court and live BPM / feedback / octave.

## Sound on device

Device DSP (MIT, under `app/dsp/`) covers the full 29-engine catalogue:

- Waveguides: pipe, saxophone, didgeridoo, vargan, guitar, violin, piano, karplus
- Oscillators: subtractive, FM, acid, noise, supersaw, additive, organ, vowel, ring_mod, am, phase_distortion, waveshape, wavetable, granular, PWM
- Nature / dub: bubble (pop vs waterfall), bird (chirp / trill / bark / owl), forest (canopy vs gust), dolphin whistle, fire (camp vs forest blaze), dub_bass (funk slap vs reggae dub)
- Bus: sidechain → court dual-delay → scatter → tape → EQ → compress → analog

Timbres `amazon_canopy` and `jamaica_dub` soft-bias PLAY toward nature and riddim engines without locking the rest of the catalogue.

Seeds pick across all engines; KNOB 1 feeds physical feedback; FX/EDIT shape scatter and drive.

## Install

Build a `.fwsc` with `device/build.sh`, then:

```
python3 base/tools/fm1_install.py app/build/ht.fwsc
```

Hold OCT− and OCT+ for five seconds to enter update mode. Installing third-party firmware is at your own risk; the web installer path in fm1-base can restore stock firmware.
