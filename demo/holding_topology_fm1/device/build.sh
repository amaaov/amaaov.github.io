#!/bin/sh
# Build HT-1 for the M-VAVE FM-1 via fm1-base.
#   ./setup-base.sh
#   ./build.sh                 # app/build/ht.fwsc (needs JieLi toolchain + AC79 SDK)
#   ./build.sh --no-ble
#   ./build.sh --host          # host simulator
#   ./build.sh --web           # browser emulator
#   ./build.sh --release 0.1
# Env: JIELI_TOOLCHAIN, AC79_SDK, PYTHON, FM1_BASE_URL, FM1_BASE_REF
set -e
cd "$(dirname "$0")"
export JIELI_TOOLCHAIN="${JIELI_TOOLCHAIN:-$HOME/.jieli/toolchain}"
export AC79_SDK="${AC79_SDK:-$HOME/fw-AC79_AIoT_SDK}"
PY="${PYTHON:-python3}"
if [ ! -f base/tools/build.py ]; then
  echo "build.sh: no fm1-base in base/ — run ./setup-base.sh first" >&2
  exit 1
fi
"$PY" -c 'import PIL' 2>/dev/null || {
  echo "build.sh: $PY needs Pillow (pip3 install Pillow)" >&2
  exit 1
}
exec "$PY" base/tools/build.py app "$@"
