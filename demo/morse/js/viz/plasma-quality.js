/** Preview buffer and VIDEO export side for plasma rendering. */

export const PLASMA_MAX_BUFFER = 3840;

export const PLASMA_QUALITIES = [
  { id: "live", label: "LIVE", previewBuffer: 400, exportSide: 1080 },
  { id: "high", label: "HIGH", previewBuffer: 720, exportSide: 1080 },
  { id: "1080", label: "1080", previewBuffer: 1080, exportSide: 1080 },
  { id: "4k", label: "4K", previewBuffer: 1620, exportSide: 2160 },
];

const QUALITY_IDS = new Set(PLASMA_QUALITIES.map((entry) => entry.id));

export function normalizePlasmaQuality(value) {
  const id = String(value || "live").toLowerCase();
  return QUALITY_IDS.has(id) ? id : "live";
}

export function plasmaQuality(value) {
  const id = normalizePlasmaQuality(value);
  return PLASMA_QUALITIES.find((entry) => entry.id === id) || PLASMA_QUALITIES[0];
}

export function plasmaQualityLabel(value) {
  return plasmaQuality(value).label;
}

export function clampPlasmaBuffer(value, fallback = 720) {
  const size = Math.floor(Number(value) || fallback);
  return Math.max(48, Math.min(PLASMA_MAX_BUFFER, size));
}
