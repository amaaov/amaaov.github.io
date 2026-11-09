# HT-1 — Holding Topology on the FM-1

Flashable app shell for the M-VAVE FM-1. Panel, seeds, generators, and key roles use the portable `ht_*` contract (`../firmware`). Device DSP covers waveguides, sidechain, court delay, EQ, tape, and analog character; the browser demo keeps the wider Web Audio catalogue.

## Licence

- This app (`app/`, device scripts): MIT — see `LICENSE.md`
- Portable generators (`../firmware`): MIT — see `../firmware/LICENSE.md`
- Browser demo (`../index.html`, `../js/`): CC BY 4.0 — see `../LICENSE.md`
- Platform: [fm1-base](https://github.com/charlesvestal/fm1-base) + felucca-bsp (MPL-2.0), fetched into `base/` by `setup-base.sh` (not vendored in git)
- First-party HT code does not rely on GPL sources (see `LICENSE.md` Provenance)

## One-time setup

```sh
cd demo/holding_topology_fm1/device
./setup-base.sh
```

Firmware builds also need (see fm1-base README):

- Docker (macOS) or native Linux x86-64
- JieLi Linux toolchain → `~/.jieli/toolchain` or `JIELI_TOOLCHAIN`
- JieLi AC79 SDK → `~/fw-AC79_AIoT_SDK` or `AC79_SDK`
- Python 3 + Pillow

## Build and install

### Docker (recommended on macOS)

Produces a flashable `.fwsc` without installing the JieLi toolchain on the host. Needs Docker and an AC79 SDK checkout:

```sh
git clone --depth 1 --branch AC79NN_SDK_V1.2.1_2023-12-13 \
  https://gitee.com/Jieli-Tech/fw-AC79_AIoT_SDK.git ~/fw-AC79_AIoT_SDK

./docker-build-fwsc.sh              # USB-only → out/ht-usb.fwsc (or ht.fwsc)
./docker-build-fwsc.sh --with-ble   # Bluetooth package
./docker-build-fwsc.sh --release 0.1 --out ./out
```

`Dockerfile` is `linux/amd64` (JieLi clang). The image downloads the toolchain; the SDK is mounted read-only from `$AC79_SDK` (default `~/fw-AC79_AIoT_SDK`).

Install onto a device (host still needs Python + mido/rtmidi, with `base/` present):

```sh
./setup-base.sh
python3 base/tools/fm1_install.py out/ht-usb.fwsc
```

### Native (Linux x86-64 or host tools + Docker for clang)

```sh
./setup-base.sh
./build.sh --host          # simulator binary under app/build/host/
./build.sh --no-ble        # app/build/ht-usb.fwsc
./build.sh                 # with Bluetooth
python3 base/tools/fm1_install.py app/build/ht.fwsc
```

Host smoke:

```sh
./build.sh --host
app/build/host/ht_host app/tests/basic.txt app/build/host
```


## Layout

| Path | Role |
| --- | --- |
| `app/app.c` / `app.h` | FM-1 panel, LCD court, PLAY seed, generator clock |
| `app/dsp/ht_voice.*` | Voice bank + bus orchestration |
| `app/dsp/ht_engines.*` | All non-waveguide engines (29 catalog) |
| `app/dsp/ht_waveguide.*` | Pipe / sax / didg / vargan + KS strings |
| `app/dsp/ht_sidechain.*` | Drum-key sidechain duck on music bus |
| `app/dsp/ht_court_chain.*` | Dual-delay court feedback |
| `app/dsp/ht_eq_bus.*` | 3-band EQ |
| `app/dsp/ht_tape.*` | Short mono tape loop (REC) |
| `app/dsp/ht_analog_bus.*` | Sat / warmth / wow / flutter / hiss |
| `app/ht/` | Symlinks into `../firmware` (`ht_*` contract) |
| `app/fm1.toml` | Package id `FM-1_91`, BLE, o2 units |
| `base/` | fm1-base (gitignored; from `setup-base.sh`) |

Host DSP smoke (no JieLi / fm1-base):

```sh
make -C app/dsp test
```

## Parity with the browser

| Concern | Browser (`../`) | Device (`device/`) |
| --- | --- | --- |
| Seeds, knobs, key roles, Euclid/Turing/atlas | JS + C contract | Same C contract |
| Pipe / string waveguides | Web Audio nodes | `ht_waveguide` float delays |
| Sidechain duck | `pulseSidechain` from drums | `ht_sidechain` (drums key music) |
| Court delay / EQ / compress | Web Audio nodes | `ht_court_chain` + `ht_eq_bus` + soft compress |
| Tape / scatter / analog | Web Audio bus | `ht_tape` + scatter + `ht_analog_bus` |
| Granular delay | `granular_delay.js` | `ht_grain_delay` on FX bus (scatter amount) |
| Drum ADSR by seed⊕pattern | `drum_kit.js` | `ht_drum_envelopes_from_seed` |
| Action looper | `action_looper.js` | `ht_action_loop` on seed-picked KNOB1–4 |
| Distinct PLAY / soft props | `createDistinctRndPatch` | soft object count + phrase/family diversify |
| Tempo 40…220 BPM | `bpmFromTempoKnob` | `HT_BPM_MIN/MAX` + `ht_soft_bpm` on PLAY |
| Silence open/tail/gap | `courtGate` + mix globals | Same via `ht_live_mix_globals` |
| Full engine catalogue (29) | Web Audio | `ht_engines` + `ht_waveguide` + `nature_synth` |
| Court LCD | Canvas | `cv_*` + `ht_court_draw_frame` strip |

## Next

1. Capture host screenshots into `app/docs/img/` for hub cards.
2. Optional: GitHub release workflow via `zvenson/fm1-build`.
3. Flash with `./docker-build-fwsc.sh` then `base/tools/fm1_install.py out/*.fwsc`.
