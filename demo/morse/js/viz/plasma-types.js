/** Plasma field styles for the clock plasma view. */

export const PLASMA_TYPES = [
  { id: "classic", label: "CLASSIC" },
  { id: "letter-burn", label: "LETTER BURN" },
  { id: "clouds", label: "CLOUDS" },
  { id: "oil-water", label: "OIL WATER" },
  { id: "campfire", label: "CAMPFIRE" },
  { id: "lens", label: "LENS REFLECTIONS" },
  { id: "water", label: "WATER REFLECTIONS" },
  { id: "tsukuyomi", label: "TSUKUYOMI" },
  { id: "amaterasu", label: "AMATERASU" },
  { id: "susanoo", label: "SUSANOO" },
  { id: "kaleidoscope", label: "KALEIDOSCOPE" },
  { id: "sand", label: "SAND DRAWING" },
];

const TYPE_IDS = new Set(PLASMA_TYPES.map((entry) => entry.id));

export function normalizePlasmaType(value) {
  const id = String(value || "classic").toLowerCase();
  return TYPE_IDS.has(id) ? id : "classic";
}

export function plasmaTypeLabel(value) {
  const id = normalizePlasmaType(value);
  return PLASMA_TYPES.find((entry) => entry.id === id)?.label || "CLASSIC";
}
