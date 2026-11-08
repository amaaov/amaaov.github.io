# Holding Topology FM-1 firmware

## Simulator (shipped)

Open `/demo/holding_topology_fm1/index.html`. Full FM-1 device face: LCD court, knobs, buttons, keys.

| Control | Reaction |
| --- | --- |
| KNOB 1 | Total feedback |
| KNOB 2 | LFO depth |
| KNOB 3 | Siteswap bias / props |
| KNOB 4 | Tempo |
| MASTER | Level |
| PRESETS | Scale |
| ALGORITHM | Patch type bias |
| SELECT | Trick step |
| PLAY | New unique seed + composition |
| REC | Tape arm: rec → hold → off |
| SEQ | New tricks |
| ARP | Rotate tricks |
| ENV / LFO / FX / EDIT / GLO | ADSR / LFO route / delay+scatter / drive / wildness |
| SEL | Cosmology toggle |
| HOME | Recall knobs |
| SAVE | Lock seed |
| OCT− / OCT+ | Root ±12 |
| Keys 0–26 | Seeded roles: play / modulate / combo / burst / mute |

LCD shows only juggling as a 240×240 pixel frame. Court generators feed synth and drums. Court rests use silence modes open / tail / gap. No menu pages.

## Portable C (this folder)

Host-testable contract aligned with the JS spine (`js/control_map.js`, `js/rnd_patch.js`, `js/court_gen.js`, …):

| C | Role |
| --- | --- |
| `include/ht_patch.h` | Voice / track / patch / engine / timbre counts |
| `include/ht_controls.h` + `src/ht_controls.c` | Panel state + PLAY bias |
| `include/ht_gen.h` + `src/ht_gen.c` | Euclid / Turing / Markov / Morph / Atlas |
| `include/ht_mix.h` + `src/ht_mix.c` | 4-track composition + silence |
| `include/ht_court.h` + `src/ht_court.c` | Silence mode; RGB565 stub |
| `include/ht_fx.h` + `src/ht_fx.c` | Tape / scatter / ADSR / LFO / grain plan / drum ADSR / analog maps |
| `include/ht_action_loop.h` + `src/ht_action_loop.c` | Ephemeral host-knob action looper |
| `include/ht_siteswap.h` + `src/ht_siteswap.c` | Solo Lab parse/schedule + parametric family generate |
| `include/ht_keys.h` + `src/ht_keys.c` | Seeded 27-key role map |

Parity: `js/firmware_contract.test.js` and `make -C firmware test`.

## Device package (flashable)

See **`../device/`** — HT-1 app on [fm1-base](https://github.com/charlesvestal/fm1-base) (MPL-2.0 platform).

```sh
cd ../device
./setup-base.sh
./build.sh --host    # simulator
./build.sh           # app/build/ht.fwsc (JieLi toolchain + AC79 SDK)
python3 base/tools/fm1_install.py app/build/ht.fwsc
```

`device/app/ht/` symlinks this folder into the fm1-base unity/o2 build. Device DSP (`device/app/dsp/`) covers waveguides, tape, scatter, and analog bus; host check: `make -C ../device/app/dsp test`.
