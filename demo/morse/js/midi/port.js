/**
 * Web MIDI straight-key output. Reactive note on/off; All Notes Off on stop.
 */
export function createMidiPort() {
  let access = null;
  let outputId = "";
  let note = 69;
  let channel = 0;
  let velocity = 96;
  let down = false;

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

  function noteOn() {
    const output = currentOutput();
    if (!output) return false;
    output.send([0x90 | channel, note, velocity]);
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

  function stop() {
    const output = currentOutput();
    noteOff();
    if (output) output.send([0xb0 | channel, 123, 0]);
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
    stop,
    get ready() {
      return Boolean(currentOutput());
    },
    get enabled() {
      return Boolean(access);
    },
  };
}
