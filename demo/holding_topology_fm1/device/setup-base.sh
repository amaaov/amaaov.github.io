#!/bin/sh
# Fetch fm1-base (MPL-2.0) into device/base for HT-1 builds.
# First-party HT app code does not rely on GPL sources.
set -e
cd "$(dirname "$0")"
if [ -f base/tools/build.py ]; then
  echo "setup-base: base/ already present"
  exit 0
fi
if [ -d base ] && [ ! -f base/tools/build.py ]; then
  echo "setup-base: base/ exists but is incomplete; remove it and re-run" >&2
  exit 1
fi
REF="${FM1_BASE_REF:-main}"
URL="${FM1_BASE_URL:-https://github.com/charlesvestal/fm1-base.git}"
echo "setup-base: cloning $URL ($REF) → base/"
git clone --depth 1 --branch "$REF" --recursive "$URL" base
echo "setup-base: ok — next: ./build.sh --host   or   ./build.sh"
