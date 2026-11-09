# HT-1 firmware builder — linux/amd64 (JieLi pi32v2 clang is x86-64 only).
# The AC79 SDK is mounted at runtime (see docker-build-fwsc.sh); it is not baked in.
#
#   docker build --platform linux/amd64 -t ht1-fw-builder .
#   ./docker-build-fwsc.sh
#
FROM --platform=linux/amd64 debian:bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      git \
      libfribidi0 \
      python3 \
      python3-pil \
      python3-pip \
      xz-utils \
 && rm -rf /var/lib/apt/lists/* \
 && pip3 install --break-system-packages --no-cache-dir 'Pillow>=10'

# JieLi Linux toolchain (clang 4.0.1 for pi32v2) — same fetch as fm1-base tools/get_toolchain.sh
ARG JIELI_DEST=/opt/jieli
RUN mkdir -p "${JIELI_DEST}" \
 && curl -fL --retry 3 https://pkgman.jieliapp.com/s/linux-toolchain \
    | tar -xJ -C "${JIELI_DEST}" \
 && TC="$(ls -d "${JIELI_DEST}"/jieli-linux-toolchains-* | sort | tail -1)" \
 && ln -sfn "$(basename "$TC")" "${JIELI_DEST}/toolchain" \
 && test -x "${JIELI_DEST}/toolchain/pi32v2/bin/clang"

ENV JIELI_TOOLCHAIN=/opt/jieli/toolchain \
    JIELI_DOCKER=0 \
    AC79_SDK=/sdk \
    PYTHON=python3 \
    LANG=C.UTF-8

WORKDIR /work
COPY docker/entrypoint.sh /usr/local/bin/ht1-entrypoint
RUN chmod +x /usr/local/bin/ht1-entrypoint

ENTRYPOINT ["/usr/local/bin/ht1-entrypoint"]
# Args come from docker-build-fwsc.sh (default --no-ble there). Empty CMD so
# --with-ble is not overridden by a baked-in --no-ble.
CMD []
