import { validScratchSeed } from './scratch_marks.js';

const valid = record => record && ['scratch', 'letter', 'element'].includes(record.kind) &&
  (record.kind !== 'scratch' || record.seed === undefined || validScratchSeed(record.seed)) &&
  (record.broken === undefined || typeof record.broken === 'boolean') &&
  (record.fracture === undefined || Number.isInteger(record.fracture) && record.fracture >= 0 && record.fracture <= 2) &&
  ['x', 'y', 'angle'].every(name => Number.isFinite(record[name])) && Math.abs(record.angle) <= (record.kind === 'letter' ? 720 : 30) &&
  (record.kind === 'scratch' ? record.x >= 0 && record.x <= 1 && record.y >= 0 && record.y <= 1 :
    Math.abs(record.x) <= (record.kind === 'letter' ? 80 : 24) && record.y >= 0 && record.y <= (record.kind === 'letter' ? 160 : 80) &&
    typeof record.selector === 'string' && record.selector.length <= 1024 &&
    (record.kind !== 'letter' || Number.isSafeInteger(record.offset) && record.offset >= 0 &&
      typeof record.character === 'string' && record.character.length > 0 && record.character.length <= 32));
const samePart = (left, right) => left.kind !== 'scratch' && left.kind === right.kind &&
  left.selector === right.selector && left.offset === right.offset;

export function createTraceStore(render, restore, random = Math.random) {
  const key = `amaaov.computerism.traces.${document.documentElement.lang}`;
  let entries = [];
  const save = () => { try { localStorage.setItem(key, JSON.stringify(entries.map(entry => entry.record))); } catch {} };

  function insert(record) {
    if (!valid(record)) return null;
    if (record.kind === 'scratch') {
      const seeds = new Set(entries.filter(entry => entry.record.kind === 'scratch').map(entry => entry.record.seed));
      let seed = record.seed ?? Math.floor(random() * 4294967296) >>> 0;
      while (seeds.has(seed)) seed = (seed + 1) >>> 0;
      record.seed = seed;
    }
    const element = render(record);
    if (!element) return null;
    entries = entries.filter(entry => !samePart(entry.record, record) && entry.element.isConnected);
    entries.push({ record, element });
    return element;
  }

  try {
    const stored = JSON.parse(localStorage.getItem(key));
    let migrated = false;
    if (Array.isArray(stored)) stored.slice(0, 200).forEach(record => {
      if (!valid(record)) return;
      record.repairs = Number.isInteger(record.repairs) && record.repairs >= 0 && record.repairs < 3 ? record.repairs : 0;
      const seed = record.seed;
      insert(record);
      migrated ||= seed !== record.seed;
    });
    if (migrated) save();
  } catch {}

  return {
    entries: () => entries.filter(entry => entry.element.isConnected),
    save,
    add(record) {
      // Existing traces remain at the 200-part ceiling; repairing frees room for new play.
      const previous = entries.find(entry => samePart(entry.record, record));
      if (entries.length >= 200 && !previous) return null;
      const updated = { ...record, repairs: 0 };
      if (previous?.record.broken) { updated.broken = true; updated.fracture = previous.record.fracture; }
      if (!insert(updated)) return null;
      const entry = entries.at(-1);
      entry.previouslyBroken = previous?.record.broken === true;
      save(); return entry;
    },
    mend(entry) {
      if (!entries.includes(entry)) return 0;
      entry.record.repairs += 1;
      if (entry.record.repairs === 3) {
        restore(entry.element, entry.record);
        entries = entries.filter(item => item !== entry);
      }
      save();
      return entry.record.repairs;
    },
    clear() {
      entries.forEach(entry => restore(entry.element, entry.record));
      entries = []; save();
    },
  };
}
