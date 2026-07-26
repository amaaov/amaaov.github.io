import { ENGINES, paramsForEngine } from "../synth/engines.js";
import { ENV_UI, LFO_UI } from "../synth/mod-params.js";
import { loadUserSample } from "../synth/engines/sampler-buffers.js";

const SHARED = [
  ["frequency", "Tone Hz", 300, 1200, 1, 700],
  ["filterHz", "Filter Hz", 200, 8000, 10, 3200],
  ["resonance", "Resonance", 0.1, 18, 0.1, 0.7],
  ["delayMs", "Delay ms", 0, 800, 1, 120],
  ["feedback", "Feedback", 0, 0.9, 0.01, 0.12],
  ["delayMix", "Delay mix", 0, 0.9, 0.01, 0.08],
  ["drive", "Drive", 0, 0.8, 0.01, 0],
  ["master", "Master", 0, 0.8, 0.01, 0.32],
];

function rangeLabel(name, label, min, max, step, value) {
  return `<label data-param="${name}">${label}
    <input name="${name}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">
  </label>`;
}

function fieldset(title, rows, className) {
  return `<fieldset class="${className}">
    <legend>${title}</legend>
    ${rows
      .map(([name, label, min, max, step, value]) =>
        rangeLabel(name, label, min, max, step, value),
      )
      .join("")}
  </fieldset>`;
}

/**
 * Builds ENV/LFO modulation, shared FX, and engine controls.
 * Engine list lives in an external select next to the synth icon.
 */
export function bindSynthPanel(form, { engineSelect, onChange, announce } = {}) {
  if (!form) return () => {};

  if (engineSelect) {
    engineSelect.innerHTML = ENGINES.map(
      (engine) => `<option value="${engine.id}">${engine.name}</option>`,
    ).join("");
  }

  form.innerHTML = `
    <div id="engine-params" class="engine-params" aria-live="polite"></div>
    <p id="sampler-slot" class="sampler-slot" hidden>
      <label class="file-label btn">Load sample
        <input id="sample-file" type="file" accept="audio/*" hidden>
      </label>
    </p>
    ${fieldset("Envelope", ENV_UI, "synth-env")}
    ${fieldset("LFOs & modulation", LFO_UI, "synth-lfo")}
    ${fieldset("Tone & effects", SHARED, "synth-shared")}
    <p class="hint">Shape 0=sine 1=tri 2=square 3=saw. Amounts add LFO or ENV into pitch, filter, amp, delay, resonance, drive.</p>
  `;

  const engineParams = form.querySelector("#engine-params");
  const samplerSlot = form.querySelector("#sampler-slot");
  const sampleFile = form.querySelector("#sample-file");

  function engineId() {
    return engineSelect?.value || "sine";
  }

  function renderEngineParams(id, values = {}) {
    const defs = paramsForEngine(id);
    engineParams.innerHTML = defs.length
      ? `<p class="hint engine-params-label">Engine controls</p>${defs
          .map((def) =>
            rangeLabel(
              def.id,
              def.label,
              def.min,
              def.max,
              def.step,
              values[def.id] ?? def.value,
            ),
          )
          .join("")}`
      : "";
    samplerSlot.hidden = id !== "sampler";
  }

  function readForm() {
    const next = { engine: engineId() };
    for (const [key, value] of new FormData(form).entries()) {
      next[key] =
        Number.isNaN(Number(value)) || key === "engine" ? value : Number(value);
    }
    return next;
  }

  function emit() {
    onChange?.(readForm());
  }

  engineSelect?.addEventListener("change", () => {
    renderEngineParams(engineId(), readForm());
    emit();
    const name = ENGINES.find((entry) => entry.id === engineId())?.name;
    announce?.(name ? `Engine ${name}` : "Engine changed");
  });

  form.addEventListener("input", emit);

  sampleFile?.addEventListener("change", async () => {
    const file = sampleFile.files?.[0];
    if (!file) return;
    try {
      await loadUserSample(file);
      announce?.(`Sample loaded: ${file.name}`);
      emit();
    } catch {
      announce?.("Could not decode sample");
    }
  });

  renderEngineParams(engineId());

  return {
    applySettings(settings) {
      if (engineSelect && settings.engine) engineSelect.value = settings.engine;
      for (const [key, value] of Object.entries(settings)) {
        if (key === "engine") continue;
        const input = form.elements.namedItem(key);
        if (input) input.value = value;
      }
      renderEngineParams(settings.engine || engineId(), settings);
    },
    read: readForm,
  };
}
