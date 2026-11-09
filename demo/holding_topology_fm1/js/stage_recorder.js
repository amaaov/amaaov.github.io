/**
 * Browser stage recorder — records court canvas + instrument bus until stop,
 * then downloads a WebM. Optional WebKit bridges stay available for hosts.
 */

function pickMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm",
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function stampName() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `holding-topology-stage-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.webm`;
}

/**
 * @param {{
 *   getAudioContext: () => AudioContext | null,
 *   getOutputBus: () => AudioNode | null,
 *   getCourtCanvas: () => HTMLCanvasElement | null,
 *   postNative?: (name: string, payload: object) => void,
 *   fps?: number,
 * }} options
 */
export function createStageRecorder(options) {
  const fps = options.fps ?? 30;
  let recording = false;
  let mediaRecorder = null;
  let chunks = [];
  let tap = null;
  let mimeType = "";

  function isRecording() {
    return recording;
  }

  function start() {
    if (recording) {
      return false;
    }
    const audio = options.getAudioContext?.();
    const bus = options.getOutputBus?.();
    const canvas = options.getCourtCanvas?.();
    if (!audio || !bus || !canvas || typeof MediaRecorder === "undefined") {
      return false;
    }
    mimeType = pickMimeType();
    if (!mimeType) {
      return false;
    }
    tap = audio.createMediaStreamDestination();
    try {
      bus.connect(tap);
    } catch {
      tap = null;
      return false;
    }
    const canvasStream = canvas.captureStream(fps);
    const mixed = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...tap.stream.getAudioTracks(),
    ]);
    chunks = [];
    try {
      mediaRecorder = new MediaRecorder(mixed, { mimeType, videoBitsPerSecond: 8_000_000 });
    } catch {
      try {
        bus.disconnect(tap);
      } catch {
        /* already disconnected */
      }
      tap = null;
      return false;
    }
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType || "video/webm" });
      chunks = [];
      if (blob.size > 0) {
        downloadBlob(blob, stampName());
      }
      if (tap && bus) {
        try {
          bus.disconnect(tap);
        } catch {
          /* already disconnected */
        }
      }
      tap = null;
      mediaRecorder = null;
    };
    mediaRecorder.start(1000);
    recording = true;
    options.postNative?.("htRecord", { state: "on", sampleRate: audio.sampleRate });
    return true;
  }

  function stop() {
    if (!recording) {
      return false;
    }
    recording = false;
    options.postNative?.("htRecord", { state: "off" });
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    } else {
      mediaRecorder = null;
      if (tap) {
        const bus = options.getOutputBus?.();
        if (bus) {
          try {
            bus.disconnect(tap);
          } catch {
            /* already disconnected */
          }
        }
        tap = null;
      }
    }
    return true;
  }

  function toggle() {
    if (recording) {
      stop();
      return false;
    }
    return start();
  }

  return {
    start,
    stop,
    toggle,
    isRecording,
  };
}
