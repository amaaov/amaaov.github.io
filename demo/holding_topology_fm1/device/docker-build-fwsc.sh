#!/bin/sh
# Build HT-1 .fwsc inside Docker (linux/amd64) and copy packages to OUT/.
#
# Prerequisites on the host:
#   - Docker (or podman with a docker-compatible CLI)
#   - JieLi AC79 SDK checkout (Apache-2.0), default ~/fw-AC79_AIoT_SDK
#
#   git clone --depth 1 --branch AC79NN_SDK_V1.2.1_2023-12-13 \
#       https://gitee.com/Jieli-Tech/fw-AC79_AIoT_SDK.git ~/fw-AC79_AIoT_SDK
#
# Usage:
#   ./docker-build-fwsc.sh                  # USB-only ht.fwsc / ht-usb.fwsc
#   ./docker-build-fwsc.sh --with-ble       # Bluetooth package (needs SDK BT libs)
#   ./docker-build-fwsc.sh --release 0.1
#   ./docker-build-fwsc.sh --out ./dist
#   HT1_DOCKER_NO_CACHE=1 ./docker-build-fwsc.sh
#
# Env:
#   AC79_SDK           SDK checkout (default: $HOME/fw-AC79_AIoT_SDK)
#   HT1_IMAGE          image tag (default: ht1-fw-builder)
#   FM1_BASE_URL/REF   passed into the container when base/ is missing
#   HT1_DOCKER_PLATFORM  default linux/amd64
set -e
cd "$(dirname "$0")"

IMAGE="${HT1_IMAGE:-ht1-fw-builder}"
PLATFORM="${HT1_DOCKER_PLATFORM:-linux/amd64}"
AC79_SDK="${AC79_SDK:-$HOME/fw-AC79_AIoT_SDK}"
OUT=""
WITH_BLE=0
BUILD_ARGS="--no-ble"
RELEASE=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --with-ble)
      WITH_BLE=1
      BUILD_ARGS=""
      shift
      ;;
    --no-ble)
      WITH_BLE=0
      BUILD_ARGS="--no-ble"
      shift
      ;;
    --release)
      RELEASE="$2"
      shift 2
      ;;
    --out)
      OUT="$2"
      shift 2
      ;;
    -h|--help)
      sed -n '2,25p' "$0"
      exit 0
      ;;
    *)
      # pass-through extras to build.sh inside the container
      BUILD_ARGS="$BUILD_ARGS $1"
      shift
      ;;
  esac
done

if [ -n "$RELEASE" ]; then
  BUILD_ARGS="$BUILD_ARGS --release $RELEASE"
fi

if [ ! -d "$AC79_SDK/cpu/wl82/tools" ]; then
  echo "docker-build-fwsc: AC79_SDK not found or incomplete: $AC79_SDK" >&2
  echo "  Clone branch AC79NN_SDK_V1.2.1_2023-12-13 from gitee.com/Jieli-Tech/fw-AC79_AIoT_SDK" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker-build-fwsc: docker not on PATH" >&2
  exit 1
fi

CACHE_ARGS=""
if [ "${HT1_DOCKER_NO_CACHE:-0}" = "1" ]; then
  CACHE_ARGS="--no-cache"
fi

echo "docker-build-fwsc: building image $IMAGE ($PLATFORM)"
# shellcheck disable=SC2086
docker build $CACHE_ARGS --platform "$PLATFORM" -t "$IMAGE" .

if [ ! -f base/tools/build.py ]; then
  echo "docker-build-fwsc: base/ missing — will clone fm1-base inside the container on first run"
fi

OUT="${OUT:-$(pwd)/out}"
mkdir -p "$OUT"

echo "docker-build-fwsc: running ./build.sh $BUILD_ARGS"
# Mount the device tree and the SDK. JieLi toolchain is inside the image.
# shellcheck disable=SC2086
docker run --rm --platform "$PLATFORM" \
  -v "$(pwd):/work" \
  -v "$AC79_SDK:/sdk:ro" \
  -e AC79_SDK=/sdk \
  -e JIELI_TOOLCHAIN=/opt/jieli/toolchain \
  -e JIELI_DOCKER=0 \
  -e "FM1_BASE_URL=${FM1_BASE_URL:-}" \
  -e "FM1_BASE_REF=${FM1_BASE_REF:-}" \
  "$IMAGE" $BUILD_ARGS

# Collect packages written under app/build/
copied=0
for pattern in \
  "app/build/ht.fwsc" \
  "app/build/ht-usb.fwsc" \
  "app/build/ht-"*.fwsc
do
  # shellcheck disable=SC2086
  for file in $pattern; do
    if [ -f "$file" ]; then
      cp -f "$file" "$OUT/"
      echo "docker-build-fwsc: extracted $(basename "$file") → $OUT/"
      copied=$((copied + 1))
    fi
  done
done

if [ "$copied" -eq 0 ]; then
  echo "docker-build-fwsc: no .fwsc found under app/build/ after build" >&2
  ls -la app/build 2>/dev/null || true
  exit 1
fi

# Optional app.bin companions (useful for hub / debug)
for file in app/build/ht.bin app/build/ht-usb.bin; do
  if [ -f "$file" ]; then
    cp -f "$file" "$OUT/"
    echo "docker-build-fwsc: extracted $(basename "$file") → $OUT/"
  fi
done

echo "docker-build-fwsc: done ($copied package(s) in $OUT)"
ls -la "$OUT"/*.fwsc 2>/dev/null || true
