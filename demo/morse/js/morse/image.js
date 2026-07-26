/**
 * Simple in-browser Morse-from-image: threshold → horizontal blob scan.
 * Interactive knobs (threshold, invert, band) live in the UI.
 */
export function recognizeMorseFromImageData(imageData, {
  threshold = 140,
  invert = false,
  bandTop = 0.35,
  bandBottom = 0.65,
} = {}) {
  const { width, height, data } = imageData;
  const top = Math.floor(height * Math.min(bandTop, bandBottom));
  const bottom = Math.ceil(height * Math.max(bandTop, bandBottom));
  const ink = new Uint8Array(width);

  for (let x = 0; x < width; x += 1) {
    let dark = 0;
    let count = 0;
    for (let y = top; y < bottom; y += 1) {
      const index = (y * width + x) * 4;
      const luma =
        0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
      const isInk = invert ? luma > threshold : luma < threshold;
      if (isInk) dark += 1;
      count += 1;
    }
    ink[x] = dark / count > 0.18 ? 1 : 0;
  }

  const runs = [];
  let index = 0;
  while (index < width) {
    const value = ink[index];
    let end = index + 1;
    while (end < width && ink[end] === value) end += 1;
    runs.push({ value, length: end - index });
    index = end;
  }

  const markRuns = runs.filter((run) => run.value === 1);
  if (!markRuns.length) return "";

  const lengths = markRuns.map((run) => run.length).sort((a, b) => a - b);
  const ditWidth = lengths[Math.floor(lengths.length / 2)] || 1;
  const dahCut = ditWidth * 2.2;
  const letterGap = ditWidth * 1.6;
  const wordGap = ditWidth * 4.5;

  let morse = "";
  let letter = "";
  for (let runIndex = 0; runIndex < runs.length; runIndex += 1) {
    const run = runs[runIndex];
    if (run.value === 1) {
      letter += run.length >= dahCut ? "-" : ".";
      continue;
    }
    if (!letter) continue;
    if (run.length >= wordGap) {
      morse += `${letter} / `;
      letter = "";
    } else if (run.length >= letterGap) {
      morse += `${letter} `;
      letter = "";
    }
  }
  if (letter) morse += letter;
  return morse.trim().replace(/ {2,}/gu, " ");
}

export function drawThresholdPreview(sourceCanvas, targetCanvas, options) {
  const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const imageData = context.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const preview = targetCanvas.getContext("2d");
  targetCanvas.width = sourceCanvas.width;
  targetCanvas.height = sourceCanvas.height;
  const out = preview.createImageData(imageData.width, imageData.height);
  const { threshold = 140, invert = false, bandTop = 0.35, bandBottom = 0.65 } =
    options;
  const top = Math.floor(imageData.height * Math.min(bandTop, bandBottom));
  const bottom = Math.ceil(imageData.height * Math.max(bandTop, bandBottom));

  for (let index = 0; index < imageData.data.length; index += 4) {
    const pixel = index / 4;
    const y = Math.floor(pixel / imageData.width);
    const luma =
      0.299 * imageData.data[index] +
      0.587 * imageData.data[index + 1] +
      0.114 * imageData.data[index + 2];
    const isInk = invert ? luma > threshold : luma < threshold;
    const inBand = y >= top && y < bottom;
    const tone = isInk ? 20 : 220;
    out.data[index] = inBand && isInk ? 40 : tone;
    out.data[index + 1] = inBand && isInk ? 220 : tone;
    out.data[index + 2] = inBand && isInk ? 120 : tone;
    out.data[index + 3] = 255;
  }
  preview.putImageData(out, 0, 0);
  return imageData;
}
