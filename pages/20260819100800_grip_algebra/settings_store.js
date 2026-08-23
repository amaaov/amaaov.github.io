export const SETTINGS_STORAGE_KEY = "amaaov.grip-algebra.20260819100800";
const MAXIMUM_STORED_TEXT = 2000;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function listedControls(root) {
  if (!root) {
    return [];
  }
  if (root.querySelectorAll) {
    return [...root.querySelectorAll("input[name], select[name], textarea[name]")];
  }
  if (root.elements) {
    return [...root.elements];
  }
  return [];
}

function clampToControl(control, raw) {
  const next = Number(raw);
  if (!Number.isFinite(next)) {
    return null;
  }
  const minimum = control.min === "" ? next : Number(control.min);
  const maximum = control.max === "" ? next : Number(control.max);
  return String(Math.min(maximum, Math.max(minimum, next)));
}

export function readStoredSettings(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function writeStoredSettings(storage, settings) {
  try {
    storage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    return;
  }
}

export function collectNamedControlValues(root) {
  const values = {};
  for (const control of listedControls(root)) {
    if (!control.name || control.type === "button" || control.type === "submit") {
      continue;
    }
    values[control.name] = control.type === "checkbox"
      ? Boolean(control.checked)
      : String(control.dataset?.skyBase ?? control.value);
  }
  return values;
}

export function applyNamedControlValues(root, values) {
  if (!isRecord(values)) {
    return;
  }
  for (const control of listedControls(root)) {
    if (!control.name || !(control.name in values)) {
      continue;
    }
    applyControlValue(control, values[control.name]);
  }
}

export function collectIdentifiedRangeValues(root) {
  const values = {};
  for (const control of root?.querySelectorAll?.("input[type='range'][id]") ?? []) {
    values[control.id] = String(control.value);
  }
  return values;
}

export function applyIdentifiedRangeValues(root, values) {
  if (!isRecord(values) || !root?.querySelectorAll) {
    return;
  }
  for (const control of root.querySelectorAll("input[type='range'][id]")) {
    if (control.id in values) {
      applyControlValue(control, values[control.id]);
    }
  }
}

export function collectRememberedDetails(root) {
  const values = {};
  for (const details of root?.querySelectorAll?.("[data-remember='open']") ?? []) {
    if (details.id) {
      values[details.id] = Boolean(details.open);
    }
  }
  return values;
}

export function applyRememberedDetails(root, values) {
  if (!isRecord(values) || !root?.querySelectorAll) {
    return;
  }
  for (const details of root.querySelectorAll("[data-remember='open']")) {
    if (details.id in values) {
      details.open = Boolean(values[details.id]);
    }
  }
}

export function applyControlValue(control, raw) {
  if (control.type === "checkbox") {
    control.checked = Boolean(raw);
    return;
  }
  if (control.tagName === "SELECT" || control.type === "select-one") {
    const allowed = [...(control.options ?? [])].map((option) => option.value);
    if (allowed.includes(String(raw))) {
      control.value = String(raw);
    }
    return;
  }
  if (control.type === "number" || control.type === "range") {
    const next = clampToControl(control, raw);
    if (next !== null) {
      control.value = next;
    }
    return;
  }
  control.value = String(raw).slice(0, MAXIMUM_STORED_TEXT);
}

export function restoreInteractiveSettings({
  storage = globalThis.localStorage,
  form,
  workbench,
  rememberRoot,
} = {}) {
  const stored = readStoredSettings(storage);
  applyNamedControlValues(rememberRoot ?? form, stored.named);
  applyIdentifiedRangeValues(workbench, stored.ranges);
  applyRememberedDetails(rememberRoot ?? form, stored.details);
  return stored;
}

export function rememberInteractiveSettings({
  storage = globalThis.localStorage,
  form,
  workbench,
  rememberRoot,
  inspector,
} = {}) {
  writeStoredSettings(storage, {
    named: collectNamedControlValues(rememberRoot ?? form),
    ranges: collectIdentifiedRangeValues(workbench),
    details: collectRememberedDetails(rememberRoot ?? form),
    inspector: inspector
      ? { width: inspector.width(), collapsed: inspector.collapsed() }
      : undefined,
  });
}
