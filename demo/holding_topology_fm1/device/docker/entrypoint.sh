#!/bin/sh
# Inside the ht1-fw-builder container: ensure fm1-base, then build HT-1.
set -e
cd /work

if [ ! -f base/tools/build.py ]; then
  echo "ht1-entrypoint: fetching fm1-base into base/"
  REF="${FM1_BASE_REF:-main}"
  URL="${FM1_BASE_URL:-https://github.com/charlesvestal/fm1-base.git}"
  rm -rf base
  git clone --depth 1 --branch "$REF" --recursive "$URL" base
fi

if [ ! -x "${JIELI_TOOLCHAIN}/pi32v2/bin/clang" ]; then
  echo "ht1-entrypoint: missing clang at JIELI_TOOLCHAIN=$JIELI_TOOLCHAIN" >&2
  exit 1
fi

if [ ! -d "${AC79_SDK}/cpu/wl82/tools" ]; then
  echo "ht1-entrypoint: AC79_SDK incomplete at $AC79_SDK" >&2
  echo "  Mount a checkout of https://gitee.com/Jieli-Tech/fw-AC79_AIoT_SDK" >&2
  echo "  branch AC79NN_SDK_V1.2.1_2023-12-13 as /sdk (see docker-build-fwsc.sh)." >&2
  exit 1
fi

export JIELI_DOCKER=0
export JIELI_TOOLCHAIN
export AC79_SDK
export PYTHON="${PYTHON:-python3}"

echo "ht1-entrypoint: JIELI_TOOLCHAIN=$JIELI_TOOLCHAIN"
echo "ht1-entrypoint: AC79_SDK=$AC79_SDK"
echo "ht1-entrypoint: ./build.sh $*"
exec ./build.sh "$@"
