const STORAGE_KEY = "morse-channel.ensemble.compositions";
const COUNTER_KEY = "morse-channel.ensemble.composition-counter";
const MAX_COMPOSITIONS = 24;

function safeParse(raw, fallback) {
  try {
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function clamp01(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function clampInt(value, min, max, fallback) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizeTrack(track) {
  if (!track || typeof track !== "object") return null;
  const gain = Number(track.gain);
  const pan = Number(track.pan);
  const delayMs = Number(track.delayMs);
  const midiProgramRaw = track.midiProgram;
  let midiProgram = -1;
  if (midiProgramRaw != null && midiProgramRaw !== "") {
    const parsed = Math.round(Number(midiProgramRaw));
    if (Number.isFinite(parsed)) midiProgram = parsed < 0 ? -1 : clampInt(parsed, 0, 127, -1);
  }
  return {
    text: String(track.text || ""),
    morse: String(track.morse || ""),
    wpm: Number(track.wpm) || 18,
    engine: String(track.engine || "sine"),
    frequency: Number(track.frequency) || 700,
    gain: Number.isFinite(gain) ? Math.max(0, Math.min(1, gain)) : 0.35,
    pan: Number.isFinite(pan) ? Math.max(-1, Math.min(1, pan)) : 0,
    delayMix: clamp01(track.delayMix, 0),
    delayMs: Number.isFinite(delayMs)
      ? Math.max(1, Math.min(1200, delayMs))
      : 180,
    delayFeedback: clamp01(track.delayFeedback, 0.2),
    muted: Boolean(track.muted),
    midiChannel: clampInt(track.midiChannel, 1, 16, 1),
    midiNote: clampInt(track.midiNote, 0, 127, 69),
    midiVelocity: clampInt(track.midiVelocity, 1, 127, 96),
    midiProgram,
    midiEnabled: track.midiEnabled == null ? true : Boolean(track.midiEnabled),
  };
}

function normalizeMaster(master) {
  if (!master || typeof master !== "object") {
    return { reverb: 0.18, compression: 0.35 };
  }
  return {
    reverb: clamp01(master.reverb, 0.18),
    compression: clamp01(master.compression, 0.35),
  };
}

/**
 * Local ensemble compositions in localStorage.
 * Default names are rising integers: 1, 2, 3, …
 */
export function createCompositionStore({
  storage = globalThis.localStorage,
  maxCompositions = MAX_COMPOSITIONS,
} = {}) {
  const listeners = new Set();

  function readAll() {
    const items = safeParse(storage?.getItem?.(STORAGE_KEY), []);
    return Array.isArray(items) ? items : [];
  }

  function writeAll(items) {
    storage?.setItem?.(STORAGE_KEY, JSON.stringify(items.slice(0, maxCompositions)));
    notify();
  }

  function readCounter() {
    const raw = Number(storage?.getItem?.(COUNTER_KEY));
    if (Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
    const fromNames = readAll().reduce((max, item) => {
      const value = Number(String(item.name || "").trim());
      return Number.isInteger(value) && value > max ? value : max;
    }, 0);
    return fromNames;
  }

  function writeCounter(value) {
    storage?.setItem?.(COUNTER_KEY, String(value));
  }

  function notify() {
    const snapshot = list();
    for (const listener of listeners) listener(snapshot);
  }

  function list() {
    return readAll().map((item) => ({
      id: item.id,
      name: item.name,
      at: item.at,
      tracks: Array.isArray(item.tracks)
        ? item.tracks.map(normalizeTrack).filter(Boolean)
        : [],
      master: normalizeMaster(item.master),
    }));
  }

  function get(id) {
    return list().find((item) => item.id === id) || null;
  }

  function nextDefaultName() {
    return String(readCounter() + 1);
  }

  function save({ name, tracks, master, id } = {}) {
    const normalized = (tracks || []).map(normalizeTrack).filter(Boolean);
    if (normalized.length === 0) return null;
    const masterSettings = normalizeMaster(master);
    const items = readAll();
    const provided = String(name ?? "").trim();
    const nextName = provided || nextDefaultName();
    if (!id) {
      const asNumber = Number(nextName);
      if (Number.isInteger(asNumber) && asNumber > readCounter()) {
        writeCounter(asNumber);
      }
    }
    if (id) {
      const index = items.findIndex((item) => item.id === id);
      if (index >= 0) {
        items[index] = {
          ...items[index],
          name: nextName,
          at: Date.now(),
          tracks: normalized,
          master: masterSettings,
        };
        writeAll(items);
        return get(id);
      }
    }
    const created = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: nextName,
      at: Date.now(),
      tracks: normalized,
      master: masterSettings,
    };
    items.unshift(created);
    writeAll(items);
    return get(created.id);
  }

  function remove(id) {
    writeAll(readAll().filter((item) => item.id !== id));
  }

  function subscribe(listener) {
    listeners.add(listener);
    listener(list());
    return () => listeners.delete(listener);
  }

  return { list, get, save, remove, subscribe, nextDefaultName };
}
