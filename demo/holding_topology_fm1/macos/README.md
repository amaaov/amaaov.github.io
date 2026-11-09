# Holding Topology Stage (macOS, native)

Fully native macOS app: C DSP + portable `ht_*` generators, SwiftUI court. No WebView, no JavaScript in the audio or render path.

## What it does

- Court only (hands + props + trails), black 9:16-friendly window
- Click / Space / Cmd+N → hard scene reset (new seed; FX buffers cleared)
- Other keys → chaos (often a new seed; pointer move ignored)
- Cmd+R → record 4K vertical MOV to `~/Movies`
- Status line shows siteswap, beat, and bpm as the phrase moves
- Audio: 32-bit float PCM at **96 kHz** (compile-time; see below for 192 kHz)

## Stack

- language or combo: SwiftUI + AVAudioEngine host; C voice bank / engines / siteswap / mod matrix / gen
- nearest authority: macOS audio unit graph + CoreGraphics court blit
- source: `device/app/dsp/*` and `firmware/src/ht_*` with `-DHT_STAGE_NATIVE -DHT_DSP_SAMPLE_RATE=96000`

## Build and run

From `demo/holding_topology_fm1`:

```sh
make run          # build latest native app and launch
make build        # build only
make open         # open Xcode
make clean-native
```

## 192 kHz

In `project.yml` set:

```text
-DHT_DSP_SAMPLE_RATE=192000.0f
```

Rebuild. Grain/tape/waveguide buffers are enlarged under `HT_STAGE_NATIVE` for high rates. Pass the same rate into `StageController(sampleRate:)`.

## Record

- Video: 2160×3840 HEVC, nearest-neighbour court upscale
- Audio: linear PCM, 32-bit float, session sample rate (96 kHz default)

## Notes

- “32kbit” is treated as **32-bit float**, not 32 kbit/s.
- Browser `stage.html` remains a separate JS demo (WebAudio); this app does not load it.
- Browser record: Cmd/Ctrl+R in `stage.html` uses `js/stage_recorder.js` (WebM download until stop).
