const ENTRIES_KEY = "morse-channel.history.entries";
const PREFS_KEY = "morse-channel.history.prefs";
const MAX_ENTRIES = 40;

function defaultPrefs() {
  return { enabled: true };
}

function safeParse(raw, fallback) {
  try {
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Local history in localStorage. Disable stops writes; clear wipes entries.
 */
export function createHistoryStore({
  storage = globalThis.localStorage,
  maxEntries = MAX_ENTRIES,
} = {}) {
  const listeners = new Set();

  function readPrefs() {
    const prefs = safeParse(storage?.getItem?.(PREFS_KEY), defaultPrefs());
    return { enabled: prefs.enabled !== false };
  }

  function writePrefs(prefs) {
    storage?.setItem?.(PREFS_KEY, JSON.stringify(prefs));
    notify();
  }

  function readEntries() {
    const entries = safeParse(storage?.getItem?.(ENTRIES_KEY), []);
    return Array.isArray(entries) ? entries : [];
  }

  function writeEntries(entries) {
    storage?.setItem?.(ENTRIES_KEY, JSON.stringify(entries.slice(0, maxEntries)));
    notify();
  }

  function notify() {
    const snapshot = { enabled: isEnabled(), entries: list() };
    for (const listener of listeners) listener(snapshot);
  }

  function isEnabled() {
    return readPrefs().enabled;
  }

  function list() {
    return readEntries();
  }

  function setEnabled(enabled) {
    writePrefs({ enabled: Boolean(enabled) });
  }

  function clear() {
    storage?.removeItem?.(ENTRIES_KEY);
    notify();
  }

  function push(entry) {
    if (!isEnabled()) return null;
    const text = String(entry.text || "").trim();
    const morse = String(entry.morse || "").trim();
    if (!text && !morse) return null;

    const next = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: Date.now(),
      text,
      morse,
      inputMode: entry.inputMode || "text",
      cipherId: entry.cipherId || "none",
      cipherMode: entry.cipherMode || "plain",
    };
    const entries = readEntries().filter(
      (item) => item.text !== next.text || item.morse !== next.morse,
    );
    entries.unshift(next);
    writeEntries(entries);
    return next;
  }

  function subscribe(listener) {
    listeners.add(listener);
    listener({ enabled: isEnabled(), entries: list() });
    return () => listeners.delete(listener);
  }

  return { isEnabled, setEnabled, list, push, clear, subscribe };
}
