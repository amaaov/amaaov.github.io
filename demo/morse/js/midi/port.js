/**
 * Web MIDI straight-key output. Solo note on/off plus keyed multi-voice
 * for ensemble layers. All Notes Off on stop.
 */
export function createMidiPort() {
  let access = null;
  let outputId = "";
  let note = 69;
  let channel = 0;
  let velocity = 96;
  let down = false;
  /** @type {Map<string, { channel: number, note: number }>} */
  const keyed = new Map();
  /** @type {Set<number>} */
  const usedChannels = new Set();

  function supported() {
    return typeof navigator !== "undefined" && Boolean(navigator.requestMIDIAccess);
  }

  function currentOutput() {
    if (!access || !outputId) return null;
    return access.outputs.get(outputId) || null;
  }

  function listOutputs() {
    if (!access) return [];
    return [...access.outputs.values()].map((port) => ({
      id: port.id,
      name: port.name || port.id,
    }));
  }

  async function enable() {
    if (!supported()) {
      throw new Error("Web MIDI unavailable in this browser");
    }
    access = await navigator.requestMIDIAccess({ sysex: false });
    const outputs = listOutputs();
    if (!outputId && outputs[0]) outputId = outputs[0].id;
    return outputs;
  }

  function setOutput(id) {
    outputId = String(id || "");
  }

  function setSettings(next = {}) {
    if (next.note != null) note = Math.max(0, Math.min(127, Number(next.note) || 69));
    if (next.channel != null) {
      channel = Math.max(0, Math.min(15, Number(next.channel) || 0));
    }
    if (next.velocity != null) {
      velocity = Math.max(1, Math.min(127, Number(next.velocity) || 96));
    }
  }

  function getSettings() {
    return { note, channel, velocity, outputId };
  }

  function clampChannel(value) {
    return Math.max(0, Math.min(15, Number(value) || 0));
  }

  function clampNote(value) {
    return Math.max(0, Math.min(127, Number(value) || 69));
  }

  function clampVelocity(value) {
    return Math.max(1, Math.min(127, Number(value) || 96));
  }

  function noteOn() {
    const output = currentOutput();
    if (!output) return false;
    output.send([0x90 | channel, note, velocity]);
    usedChannels.add(channel);
    down = true;
    return true;
  }

  function noteOff() {
    const output = currentOutput();
    if (!output) {
      down = false;
      return;
    }
    if (down) output.send([0x80 | channel, note, 0]);
    down = false;
  }

  function keyOff(id) {
    const key = String(id || "");
    const active = keyed.get(key);
    if (!active) return;
    keyed.delete(key);
    const output = currentOutput();
    if (!output) return;
    output.send([0x80 | active.channel, active.note, 0]);
  }

  function keyOn(id, patch = {}) {
    const key = String(id || "");
    if (!key) return false;
    const output = currentOutput();
    if (!output) return false;
    keyOff(key);
    const ch = clampChannel(patch.channel ?? channel);
    const n = clampNote(patch.note ?? note);
    const vel = clampVelocity(patch.velocity ?? velocity);
    output.send([0x90 | ch, n, vel]);
    keyed.set(key, { channel: ch, note: n });
    usedChannels.add(ch);
    return true;
  }

  function program(channelNibble, programNumber) {
    const output = currentOutput();
    if (!output) return false;
    const ch = clampChannel(channelNibble);
    const pgm = Math.max(0, Math.min(127, Number(programNumber) || 0));
    output.send([0xc0 | ch, pgm]);
    usedChannels.add(ch);
    return true;
  }

  function releaseKeys() {
    for (const id of [...keyed.keys()]) keyOff(id);
  }

  function allNotesOff() {
    const output = currentOutput();
    if (!output) return;
    const channels = usedChannels.size ? [...usedChannels] : [channel];
    for (const ch of channels) {
      output.send([0xb0 | ch, 123, 0]);
    }
    usedChannels.clear();
  }

  /** Solo-path stop: release the straight-key note and ANO on its channel. */
  function stop() {
    noteOff();
    const output = currentOutput();
    if (output) output.send([0xb0 | channel, 123, 0]);
  }

  /** Release solo + keyed ensemble voices and ANO on every channel used. */
  function stopAll() {
    noteOff();
    releaseKeys();
    allNotesOff();
  }

  return {
    supported,
    enable,
    listOutputs,
    setOutput,
    setSettings,
    getSettings,
    noteOn,
    noteOff,
    keyOn,
    keyOff,
    program,
    releaseKeys,
    stop,
    stopAll,
    get ready() {
      return Boolean(currentOutput());
    },
    get enabled() {
      return Boolean(access);
    },
    get activeKeys() {
      return keyed.size;
    },
  };
}
