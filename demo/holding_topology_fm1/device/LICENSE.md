# Holding Topology HT-1 — device app

MIT License

Copyright (c) 2026 Andrei Makarov / amaaov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Scope

This MIT grant covers first-party material in this tree: `app/` (including
`dsp/` and mirrored `ht/`), and the device build scripts in this directory
(`setup-base.sh`, `build.sh`, Docker helpers, and related docs authored here).

Portable generators live under `../firmware` and are also MIT; see
`../firmware/LICENSE.md`.

## Provenance

First-party code in this tree does not include, link against, or derive
from GPL sources. Generators, panel contract, and device DSP are original
MIT works for Holding Topology.

## Dependencies (not under this MIT grant)

- [fm1-base](https://github.com/charlesvestal/fm1-base) and felucca-bsp:
  MPL-2.0. Fetched into `base/` by `setup-base.sh`; not vendored in this git
  tree. Keep MPL notices when redistributing combined firmware that includes
  those works.
- JieLi AC79 SDK and toolchain: vendor terms. Required to build on-device
  images; not redistributed from this repository.
