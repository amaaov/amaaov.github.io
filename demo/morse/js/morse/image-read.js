/**
 * IMG recognize: QR/GO matrix first, then horizontal Morse line scan.
 */

import { textToMorse, normalizeMorse } from "./encode.js";
import { morseToText } from "./decode.js";
import {
  drawThresholdPreview,
  recognizeMorseFromImageData,
} from "./image.js";
import { decodeQrPayloadFromImageData } from "./image-matrix.js";

const MORSE_PAYLOAD = /^[.\-\/\s]+$/u;

export function payloadToInput(payload) {
  const raw = String(payload ?? "").trim();
  if (!raw) return null;
  const morse = normalizeMorse(raw);
  if (morse && MORSE_PAYLOAD.test(morse) && /[.-]/u.test(morse)) {
    return {
      morse,
      text: morseToText(morse),
      kind: "qr-morse",
    };
  }
  return {
    text: raw,
    morse: textToMorse(raw),
    kind: "qr-text",
  };
}

async function detectWithBarcode(canvas) {
  if (typeof BarcodeDetector !== "function") return null;
  try {
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const codes = await detector.detect(canvas);
    const raw = codes?.[0]?.rawValue;
    return raw ? String(raw) : null;
  } catch {
    return null;
  }
}

export async function recognizeFromImage({
  sourceCanvas,
  previewCanvas,
  options = {},
} = {}) {
  if (!sourceCanvas?.width) {
    return { ok: false, reason: "empty" };
  }

  const barcodePayload = await detectWithBarcode(sourceCanvas);
  const fromBarcode = payloadToInput(barcodePayload);
  if (fromBarcode) {
    return { ok: true, ...fromBarcode, via: "barcode" };
  }

  const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const sourceData = context.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height,
  );
  const matrixPayload = decodeQrPayloadFromImageData(sourceData);
  const fromMatrix = payloadToInput(matrixPayload);
  if (fromMatrix) {
    if (previewCanvas) {
      drawThresholdPreview(sourceCanvas, previewCanvas, {
        ...options,
        bandTop: 0,
        bandBottom: 1,
      });
    }
    return { ok: true, ...fromMatrix, via: "matrix" };
  }

  const imageData = previewCanvas
    ? drawThresholdPreview(sourceCanvas, previewCanvas, options)
    : sourceData;
  const morse = recognizeMorseFromImageData(imageData, options);
  if (!morse) {
    return { ok: false, reason: "none" };
  }
  return {
    ok: true,
    morse,
    text: morseToText(morse),
    kind: "line",
    via: "line",
  };
}
