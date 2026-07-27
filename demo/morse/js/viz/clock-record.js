// Prefer VP8 for realtime encode; VP9 often lags behind live audio.
const RECORDER_MIME_CANDIDATES = [
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp8",
  "video/webm;codecs=vp9,opus",
  "video/webm",
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
];

/** Default square export resolution (face / ladder / LIVE plasma). */
export const EXPORT_CLOCK_SIDE = 1080;

/** Fixed capture rate so video duration tracks wall-clock audio. */
export const EXPORT_VIDEO_FPS = 30;

/** Cap how often the export canvas is painted (capture duplicates between). */
export const EXPORT_PAINT_MS = Math.round(1000 / EXPORT_VIDEO_FPS);

const VIDEO_BITS_PER_SECOND = 12_000_000;
const AUDIO_BITS_PER_SECOND = 192_000;

/** Scale encode bitrate with export area; capped for browser encoders. */
export function videoBitsForSide(side, baseBits = VIDEO_BITS_PER_SECOND) {
  const ratio = Math.max(1, Number(side) / EXPORT_CLOCK_SIDE) ** 2;
  return Math.round(baseBits * Math.min(ratio, 8));
}
const STOP_TIMEOUT_MS = 12_000;

export function pickRecorderMimeType(
  isTypeSupported = globalThis.MediaRecorder?.isTypeSupported?.bind(
    globalThis.MediaRecorder,
  ),
) {
  if (typeof isTypeSupported !== "function") return "";
  for (const mime of RECORDER_MIME_CANDIDATES) {
    if (isTypeSupported(mime)) return mime;
  }
  return "";
}

/** @deprecated use pickRecorderMimeType */
export function pickWebmMimeType(isTypeSupported) {
  return pickRecorderMimeType(isTypeSupported);
}

export function clockMediaFilename(source, extension) {
  const slug = String(source || "morse")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `morse-clock-${slug || "morse"}.${extension}`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function extensionForMime(mimeType) {
  if (String(mimeType || "").includes("mp4")) return "mp4";
  return "webm";
}

export function videoExportSupported(
  canvas = null,
  isTypeSupported = globalThis.MediaRecorder?.isTypeSupported?.bind(
    globalThis.MediaRecorder,
  ),
  mediaRecorderAvailable = typeof MediaRecorder !== "undefined",
) {
  if (!mediaRecorderAvailable) return false;
  if (!pickRecorderMimeType(isTypeSupported)) return false;
  if (canvas && typeof canvas.captureStream !== "function") return false;
  return true;
}

/** Silence / delay tail so the last tones and frames are not cut off. */
export function exportTailMs(settings = {}) {
  const delayMs = Math.max(0, Number(settings.delayMs) || 0);
  const delayMix = Math.min(1, Math.max(0, Number(settings.delayMix) || 0));
  return Math.round(350 + delayMs * delayMix * 4);
}

/**
 * Record canvas + audio via MediaRecorder at a fixed video frame rate.
 */
export function createClockRecorder({
  canvas,
  audioStream = null,
  videoFps = EXPORT_VIDEO_FPS,
  videoBitsPerSecond = VIDEO_BITS_PER_SECOND,
  audioBitsPerSecond = AUDIO_BITS_PER_SECOND,
} = {}) {
  let mediaRecorder = null;
  let chunks = [];
  let running = false;
  let videoStream = null;
  let recorderMime = "";

  function startRecorder() {
    const mimeType = pickRecorderMimeType();
    if (!mimeType || typeof MediaRecorder === "undefined") return null;
    if (!canvas?.captureStream) return null;
    if (!audioStream?.getAudioTracks?.().length) return null;

    const fps = Math.max(1, Number(videoFps) || EXPORT_VIDEO_FPS);
    videoStream = canvas.captureStream(fps);
    const tracks = [
      ...videoStream.getVideoTracks(),
      ...audioStream.getAudioTracks(),
    ];
    const mixed = new MediaStream(tracks);
    chunks = [];
    const options = {
      mimeType,
      videoBitsPerSecond,
      audioBitsPerSecond,
    };
    let recorder;
    try {
      recorder = new MediaRecorder(mixed, options);
    } catch {
      recorder = new MediaRecorder(mixed, { mimeType });
    }
    recorderMime = mimeType;
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    recorder.start(250);
    return recorder;
  }

  return {
    start() {
      if (running) return { mode: "idle" };
      running = true;
      try {
        mediaRecorder = startRecorder();
      } catch {
        mediaRecorder = null;
        for (const track of videoStream?.getTracks?.() || []) track.stop();
        videoStream = null;
      }
      if (!mediaRecorder) {
        running = false;
        return { mode: "unsupported", mimeType: "" };
      }
      return { mode: "video", mimeType: recorderMime };
    },

    async stop() {
      if (!running) {
        return { videoBlob: null, mimeType: "" };
      }
      running = false;
      let videoBlob = null;
      if (mediaRecorder) {
        videoBlob = await stopMediaRecorder(mediaRecorder, chunks, STOP_TIMEOUT_MS);
      }
      for (const track of videoStream?.getTracks?.() || []) track.stop();
      videoStream = null;
      mediaRecorder = null;
      const result = { videoBlob, webmBlob: videoBlob, mimeType: recorderMime };
      chunks = [];
      recorderMime = "";
      return result;
    },

    cancel() {
      running = false;
      try {
        if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
      } catch {
        /* already stopped */
      }
      for (const track of videoStream?.getTracks?.() || []) track.stop();
      videoStream = null;
      mediaRecorder = null;
      chunks = [];
      recorderMime = "";
    },

    get active() {
      return running;
    },
  };
}

function stopMediaRecorder(mediaRecorder, chunks, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      const type = mediaRecorder.mimeType || "video/webm";
      const blob = new Blob(chunks, { type });
      resolve(blob.size > 0 ? blob : null);
    };
    const timer = setTimeout(finish, timeoutMs);
    mediaRecorder.onerror = () => {
      clearTimeout(timer);
      finish();
    };
    mediaRecorder.onstop = () => {
      clearTimeout(timer);
      finish();
    };
    if (mediaRecorder.state === "inactive") {
      clearTimeout(timer);
      finish();
      return;
    }
    try {
      mediaRecorder.requestData?.();
      mediaRecorder.stop();
    } catch {
      clearTimeout(timer);
      finish();
    }
  });
}
