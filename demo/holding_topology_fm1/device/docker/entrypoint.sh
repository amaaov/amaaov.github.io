#!/bin/sh
# HT-1 firmware builder entrypoint.
# Prefer /ht/device when the parent tree is mounted (so app/ht → ../firmware resolves).
# fm1-base's build.py resolves source Paths and requires them under ROOT (= device/).
# Symlinks into ../firmware escape that tree, so we build from a materialized copy.
set -e

SRC_TREE=""
if [ -d /ht/device ]; then
  SRC_TREE=/ht/device
elif [ -d /work ]; then
  SRC_TREE=/work
else
  echo "ht1-entrypoint: neither /ht/device nor /work is mounted" >&2
  exit 1
fi

if [ -z "${JIELI_TOOLCHAIN:-}" ] || [ ! -x "${JIELI_TOOLCHAIN}/pi32v2/bin/clang" ]; then
  echo "ht1-entrypoint: JIELI_TOOLCHAIN missing or incomplete: ${JIELI_TOOLCHAIN:-}" >&2
  exit 1
fi
if [ -z "${AC79_SDK:-}" ] || [ ! -d "${AC79_SDK}/cpu/wl82/tools" ]; then
  echo "ht1-entrypoint: AC79_SDK missing or incomplete: ${AC79_SDK:-}" >&2
  exit 1
fi

if [ ! -f "$SRC_TREE/base/tools/build.py" ]; then
  url="${FM1_BASE_URL:-https://github.com/joakimeriksson/fm1-base.git}"
  ref="${FM1_BASE_REF:-main}"
  echo "ht1-entrypoint: cloning fm1-base ($ref) into $SRC_TREE/base"
  git clone --depth 1 --branch "$ref" "$url" "$SRC_TREE/base"
fi

WORK=/tmp/ht1-fw-build
rm -rf "$WORK"
mkdir -p "$WORK"
# Keep base as a symlink (large, already under SRC_TREE). Copy app and scripts.
ln -s "$SRC_TREE/base" "$WORK/base"
cp -a "$SRC_TREE/build.sh" "$WORK/"
if [ -f "$SRC_TREE/setup-base.sh" ]; then
  cp -a "$SRC_TREE/setup-base.sh" "$WORK/"
fi
cp -a "$SRC_TREE/app" "$WORK/app"
# firmware.json screenshot is resolved from the device root (commonpath of base + app).
if [ -d "$SRC_TREE/docs" ]; then
  cp -a "$SRC_TREE/docs" "$WORK/docs"
fi

# Replace app/ht symlinks with real files so Path.resolve() stays under WORK.
# Resolve against SRC_TREE (where ../firmware exists), not WORK (where that path is broken).
for link in "$SRC_TREE"/app/ht/*; do
  [ -e "$link" ] || [ -L "$link" ] || continue
  name=$(basename "$link")
  dest="$WORK/app/ht/$name"
  if [ -L "$link" ]; then
    target=$(readlink -f "$link")
    if [ ! -f "$target" ]; then
      echo "ht1-entrypoint: broken ht symlink $link → $target" >&2
      exit 1
    fi
    rm -f "$dest"
    cp -a "$target" "$dest"
  fi
done

echo "ht1-entrypoint: JIELI_TOOLCHAIN=$JIELI_TOOLCHAIN"
echo "ht1-entrypoint: AC79_SDK=$AC79_SDK"
echo "ht1-entrypoint: ./build.sh $*"
cd "$WORK"
./build.sh "$@"

mkdir -p "$SRC_TREE/app/build"
copied=0
for pattern in \
  "$WORK/app/build/"*.fwsc \
  "$WORK/app/build/"*.bin \
  "$WORK/app/build/firmware.json" \
  "$WORK/app/build/"*-usb.json
do
  for file in $pattern; do
    if [ -f "$file" ]; then
      cp -a "$file" "$SRC_TREE/app/build/"
      echo "ht1-entrypoint: wrote $(basename "$file") → $SRC_TREE/app/build/"
      copied=$((copied + 1))
    fi
  done
done
if [ "$copied" -eq 0 ]; then
  echo "ht1-entrypoint: build finished but no packages under $WORK/app/build" >&2
  ls -la "$WORK/app/build" 2>/dev/null || true
  exit 1
fi
