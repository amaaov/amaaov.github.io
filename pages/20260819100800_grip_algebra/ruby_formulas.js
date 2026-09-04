import { measurementRubyFormulas } from "./ruby_formulas_measurement.js";
import { topologyRubyFormulas } from "./ruby_formulas_topology.js";

export const FORMULA_MODE_STORAGE_KEY = "amaaov.grip-algebra.formula-mode";

const rubyFormulas = new Map([
  ...topologyRubyFormulas,
  ...measurementRubyFormulas,
]);

export function rubyFormulaEntries() {
  return [...rubyFormulas.entries()];
}

export function rubySourceFor(key) {
  return rubyFormulas.get(key) ?? null;
}

export function normalizeFormulaMode(value) {
  return value === "ruby" ? "ruby" : "math";
}

function availableStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function readFormulaMode(storage) {
  try {
    return normalizeFormulaMode(storage?.getItem(FORMULA_MODE_STORAGE_KEY));
  } catch {
    return "math";
  }
}

function writeFormulaMode(storage, mode) {
  try {
    storage?.setItem(FORMULA_MODE_STORAGE_KEY, mode);
  } catch {
    return;
  }
}

function mountRubyAlternative(formula) {
  const source = rubySourceFor(formula.dataset.rubyFormula);
  if (!source) {
    return null;
  }
  const code = formula.ownerDocument.createElement("code");
  code.textContent = source;
  const alternative = formula.ownerDocument.createElement("pre");
  alternative.className = "ruby-formula";
  alternative.hidden = true;
  alternative.append(code);
  formula.append(alternative);
  return alternative;
}

export function initializeRubyFormulas(root = document, storage = availableStorage()) {
  const toggle = root.querySelector("[data-formula-mode-toggle]");
  const formulas = [...root.querySelectorAll(".formula[data-ruby-formula]")]
    .map((formula) => ({ formula, alternative: mountRubyAlternative(formula) }))
    .filter(({ alternative }) => alternative);
  if (!toggle || formulas.length === 0) {
    return null;
  }

  let mode = readFormulaMode(storage);
  const applyMode = () => {
    const showRuby = mode === "ruby";
    toggle.setAttribute("aria-pressed", String(showRuby));
    for (const { formula, alternative } of formulas) {
      formula.classList.toggle("shows-ruby", showRuby);
      alternative.hidden = !showRuby;
    }
  };

  toggle.addEventListener("click", () => {
    mode = mode === "ruby" ? "math" : "ruby";
    writeFormulaMode(storage, mode);
    applyMode();
  });
  toggle.hidden = false;
  applyMode();
  return { mode: () => mode, count: formulas.length };
}
