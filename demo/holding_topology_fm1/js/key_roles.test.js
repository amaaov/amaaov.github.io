import test from "node:test";
import assert from "node:assert/strict";
import {
  KEY_MIDI_COUNT,
  KEY_PARAM_IDS,
  assertKeyMapShape,
  createKeyMap,
  describeKeyRole,
} from "./key_roles.js";

test("key map is deterministic for a seed and covers every midi", () => {
  const a = createKeyMap(0xaced42);
  const b = createKeyMap(0xaced42);
  const c = createKeyMap(0xaced43);
  assert.equal(a.length, KEY_MIDI_COUNT);
  assert.ok(assertKeyMapShape(a));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test("key map mixes play modulate combo and uses known params", () => {
  const map = createKeyMap(0x515151);
  const kinds = new Set(map.map((role) => role.kind));
  assert.ok(kinds.has("play") || kinds.has("combo") || kinds.has("burst"));
  assert.ok(kinds.has("modulate") || kinds.has("combo") || kinds.has("burst"));
  for (const role of map) {
    for (const param of role.params) {
      assert.ok(KEY_PARAM_IDS.includes(param.id), param.id);
    }
  }
  assert.ok(describeKeyRole(map[0]).length > 0);
});
