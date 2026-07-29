import {
  CIPHERS,
  applyCipher,
  generatePad,
} from "../cipher/index.js";
import { CIPHER_GUIDES } from "../cipher/guides.js";
import {
  compressMorseText,
  decompressMorseText,
} from "../morse/compress.js";
import { bindTablist } from "./tabs.js";

const FIELD_IDS = {
  shift: "key-shift",
  a: "key-a",
  b: "key-b",
  keyword: "key-keyword",
  rails: "key-rails",
  pad: "key-pad",
  morbitKey: "key-morbit",
  squareKey: "key-square",
  columnKey: "key-column",
  additiveKey: "key-additive",
  period: "key-period",
  password: "key-password",
};

const FIELD_HTML = {
  shift: `<label>Shift <input id="key-shift" type="number" min="0" max="25" placeholder="0–25" inputmode="numeric"></label>`,
  a: `<label>a <input id="key-a" type="number" min="1" max="25" placeholder="coprime w/ 26" inputmode="numeric"></label>`,
  b: `<label>b <input id="key-b" type="number" min="0" max="25" placeholder="0–25" inputmode="numeric"></label>`,
  keyword: `<label>Keyword <input id="key-keyword" type="text" placeholder="letters" autocomplete="off"></label>`,
  rails: `<label>Rails <input id="key-rails" type="number" min="2" max="12" placeholder="2–12" inputmode="numeric"></label>`,
  pad: `<label>Pad <input id="key-pad" type="text" placeholder="≥ message length" autocomplete="off"></label>`,
  morbitKey: `<label>Morbit <input id="key-morbit" type="text" placeholder="digits 1–9 once each" autocomplete="off"></label>`,
  squareKey: `<label>Square <input id="key-square" type="text" placeholder="square letters / A–Z0–9" autocomplete="off"></label>`,
  columnKey: `<label>Column <input id="key-column" type="text" placeholder="column keyword" autocomplete="off"></label>`,
  additiveKey: `<label>Add <input id="key-additive" type="text" placeholder="additive keyword" autocomplete="off"></label>`,
  period: `<label>Period <input id="key-period" type="number" min="1" max="40" placeholder="1–40" inputmode="numeric"></label>`,
  password: `<label>Password <input id="key-password" type="password" placeholder="shared secret" autocomplete="new-password"></label>`,
};

const NUMBER_KEYS = new Set(["shift", "a", "b", "rails", "period"]);
const METHOD_CIPHERS = CIPHERS.filter((cipher) => cipher.id !== "none");
const DEFAULT_METHOD = METHOD_CIPHERS[0]?.id || "atbash";

const MODE_STATUS = {
  plain: "Plain output",
  encrypt: "Encrypt on output",
  decrypt: "Decrypt on output",
};

function readRaw(key) {
  return document.getElementById(FIELD_IDS[key])?.value?.trim() ?? "";
}

function readOptions(cipher) {
  const options = {};
  for (const key of cipher?.keys || []) {
    const raw = readRaw(key);
    if (raw === "") {
      options[key] = "";
      continue;
    }
    options[key] = NUMBER_KEYS.has(key) ? Number(raw) : raw;
  }
  return options;
}

function hasMissingKeys(cipher, options) {
  return (cipher?.keys || []).some((key) => {
    const value = options[key];
    return value === "" || value == null || Number.isNaN(value);
  });
}

function compressNote(before, after) {
  if (before && after) return " Morse compress before and after cipher.";
  if (before) return " Morse compress before cipher.";
  if (after) return " Morse compress after cipher.";
  return "";
}

/**
 * Top-bar cipher controls. PLAIN passes input through; ENCRYPT / DECRYPT rewrite output only.
 * Optional Morse digraph compression wraps the cipher (before and/or after on encrypt; reversed on decrypt).
 */
export function bindCipherBar({
  modeTabs,
  select,
  methodLabel,
  keys,
  guide,
  generatePadButton,
  compressRow,
  compressBeforeButton,
  compressAfterButton,
  getPlainText,
  onChange,
  announce,
}) {
  let mode = "plain";
  let lastMethod = DEFAULT_METHOD;
  let compressBefore = false;
  let compressAfter = false;

  select.innerHTML = METHOD_CIPHERS.map(
    (cipher) => `<option value="${cipher.id}">${cipher.name}</option>`,
  ).join("");
  select.value = DEFAULT_METHOD;

  function activeId() {
    return mode === "plain" ? "none" : select.value || DEFAULT_METHOD;
  }

  function currentCipher() {
    return METHOD_CIPHERS.find((entry) => entry.id === select.value);
  }

  function syncModeTabs() {
    for (const tab of modeTabs) {
      const selected = tab.dataset.cipherMode === mode;
      tab.setAttribute("aria-selected", selected ? "true" : "false");
      tab.tabIndex = selected ? 0 : -1;
    }
  }

  function syncCompressUi() {
    const active = mode !== "plain";
    if (compressRow) compressRow.hidden = !active;
    if (compressBeforeButton) {
      compressBeforeButton.setAttribute(
        "aria-pressed",
        compressBefore && active ? "true" : "false",
      );
      compressBeforeButton.disabled = !active;
    }
    if (compressAfterButton) {
      compressAfterButton.setAttribute(
        "aria-pressed",
        compressAfter && active ? "true" : "false",
      );
      compressAfterButton.disabled = !active;
    }
  }

  function syncMethodVisibility() {
    const active = mode !== "plain";
    if (methodLabel) methodLabel.hidden = !active;
    keys.hidden = !active;
    generatePadButton.hidden = !(active && select.value === "otp");
    if (guide) guide.hidden = !active;
    syncCompressUi();
  }

  function renderGuide(cipher, { pending = false } = {}) {
    if (!guide) return;
    if (mode === "plain") {
      guide.textContent = "";
      select?.removeAttribute("aria-describedby");
      return;
    }
    const base = CIPHER_GUIDES[cipher?.id] || "";
    const note = compressNote(compressBefore, compressAfter);
    const pendingNote = pending
      ? " Enter the parameters above to transform output."
      : "";
    guide.textContent = `${base}${note}${pendingNote}`;
    if (guide.id) select?.setAttribute("aria-describedby", guide.id);
  }

  function renderKeys() {
    if (mode === "plain") {
      keys.innerHTML = "";
      generatePadButton.hidden = true;
      renderGuide(null);
      return;
    }
    const cipher = currentCipher();
    keys.innerHTML = (cipher?.keys || [])
      .map((key) => FIELD_HTML[key])
      .join("");
    generatePadButton.hidden = cipher?.id !== "otp";
    renderGuide(cipher, { pending: hasMissingKeys(cipher, readOptions(cipher)) });
  }

  function runCompressStages(text, direction) {
    let next = text;
    if (direction === "encrypt") {
      if (compressBefore) next = compressMorseText(next);
      return next;
    }
    if (compressAfter) next = decompressMorseText(next);
    return next;
  }

  function runPostCipherStages(text, direction) {
    let next = text;
    if (direction === "encrypt") {
      if (compressAfter) next = compressMorseText(next);
      return next;
    }
    if (compressBefore) next = decompressMorseText(next);
    return next;
  }

  async function emit() {
    const id = activeId();
    const plain = getPlainText();
    if (mode === "plain" || id === "none") {
      onChange({
        id: "none",
        mode,
        text: plain,
        compressBefore: false,
        compressAfter: false,
      });
      return;
    }
    const cipher = currentCipher();
    const options = readOptions(cipher);
    if (hasMissingKeys(cipher, options)) {
      renderGuide(cipher, { pending: true });
      onChange({
        id,
        mode,
        text: plain,
        pending: true,
        compressBefore,
        compressAfter,
      });
      return;
    }
    renderGuide(cipher);
    const cipherMode = mode === "plain" ? "encrypt" : mode;
    try {
      const prepared = runCompressStages(plain, cipherMode);
      const ciphered = await applyCipher(id, cipherMode, prepared, options);
      const text = runPostCipherStages(ciphered, cipherMode);
      onChange({ id, mode, text, compressBefore, compressAfter });
    } catch (error) {
      announce(error.message || "Cipher failed");
      onChange({
        id,
        mode,
        text: plain,
        error: true,
        compressBefore,
        compressAfter,
      });
    }
  }

  function setCipherMode(next, { announceChange = true } = {}) {
    if (!next || next === mode) return;
    if (mode !== "plain") lastMethod = select.value || DEFAULT_METHOD;
    mode = next;
    if (mode !== "plain") select.value = lastMethod;
    syncModeTabs();
    syncMethodVisibility();
    renderKeys();
    emit();
    if (announceChange) announce(MODE_STATUS[mode] || mode);
  }

  function setCompress(which, enabled) {
    const next = Boolean(enabled);
    if (which === "before") {
      if (next === compressBefore) return;
      compressBefore = next;
    } else {
      if (next === compressAfter) return;
      compressAfter = next;
    }
    syncCompressUi();
    renderGuide(currentCipher(), {
      pending: hasMissingKeys(currentCipher(), readOptions(currentCipher())),
    });
    emit();
    const label = which === "before" ? "before" : "after";
    announce(
      next
        ? `Morse compress ${label} cipher`
        : `Morse compress ${label} off`,
    );
  }

  for (const tab of modeTabs) {
    tab.addEventListener("click", () => setCipherMode(tab.dataset.cipherMode));
  }
  const tablist = modeTabs[0]?.closest('[role="tablist"]');
  bindTablist(tablist, (tab) => setCipherMode(tab.dataset.cipherMode));
  select.addEventListener("change", () => {
    lastMethod = select.value || DEFAULT_METHOD;
    renderKeys();
    emit();
    const name = currentCipher()?.name || select.value;
    announce(`Method ${name}`);
  });
  keys.addEventListener("input", () => emit());
  generatePadButton.addEventListener("click", () => {
    const padField = document.getElementById("key-pad");
    if (!padField) return;
    const letters = (getPlainText().match(/[A-Za-z]/gu) || []).length;
    padField.value = generatePad(Math.max(32, letters));
    announce("Pad generated");
    emit();
  });
  compressBeforeButton?.addEventListener("click", () => {
    setCompress("before", !compressBefore);
  });
  compressAfterButton?.addEventListener("click", () => {
    setCompress("after", !compressAfter);
  });

  syncModeTabs();
  syncMethodVisibility();
  renderKeys();
  emit();

  return {
    refresh: emit,
    getMode: () => mode,
    getId: () => activeId(),
    getCompressBefore: () => compressBefore,
    getCompressAfter: () => compressAfter,
  };
}
