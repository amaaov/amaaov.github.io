import { getAudioContext } from "../context.js";
import { createFilter } from "../effects.js";

// Create a mixer channel
export function createMixerChannel(audioContext, name) {
  if (!audioContext) return null;

  // Create channel nodes
  const input = audioContext.createGain();
  const output = audioContext.createGain();
  const envelope = audioContext.createGain();

  // Create filter with default frequency
  const eq = createFilter(audioContext, 1000); // Default to 1kHz
  if (!eq) {
    console.error("Failed to create filter for channel:", name);
    return null;
  }

  const pan = audioContext.createStereoPanner();

  // Set initial gains
  input.gain.setValueAtTime(0.7, audioContext.currentTime);
  output.gain.setValueAtTime(0.7, audioContext.currentTime);
  envelope.gain.setValueAtTime(1.0, audioContext.currentTime);

  // Connect channel nodes
  input.connect(envelope);
  envelope.connect(eq);
  eq.connect(pan);
  pan.connect(output);

  // Create channel object
  const channel = {
    input,
    output,
    envelope,
    eq,
    pan,
    name,
    cleanup() {
      try {
        input.disconnect();
        output.disconnect();
        envelope.disconnect();
        eq.disconnect();
        pan.disconnect();
      } catch (error) {
        console.warn(`Error cleaning up channel ${name}:`, error);
      }
    }
  };

  console.log(`Created mixer channel "${name}" with signal path:`, {
    routing: "input -> envelope -> eq -> pan -> output -> mainMixer",
    gains: {
      input: input.gain.value,
      output: output.gain.value
    }
  });

  return channel;
}

// Update channel envelope
export function updateChannelEnvelope(channel, attack, decay, sustain, release) {
  if (!channel?.envelope) return;

  const now = getAudioContext()?.currentTime;
  if (!now) return;

  const env = channel.envelope.gain;
  env.cancelScheduledValues(now);
  env.setValueAtTime(0, now);
  env.linearRampToValueAtTime(1, now + attack);
  env.linearRampToValueAtTime(sustain, now + attack + decay);
}

// Update channel gain
export function updateChannelGain(channel, value) {
  if (!channel?.output?.gain) return;

  const now = getAudioContext()?.currentTime;
  if (!now) return;

  channel.output.gain.setTargetAtTime(value, now, 0.1);
}

// Update channel pan
export function updateChannelPan(channel, value) {
  if (!channel?.pan?.pan) return;

  const now = getAudioContext()?.currentTime;
  if (!now) return;

  channel.pan.pan.setTargetAtTime(value, now, 0.1);
}

// Update channel EQ
export function updateChannelEQ(channel, frequency, gain, Q) {
  if (!channel?.eq) return;

  const now = getAudioContext()?.currentTime;
  if (!now) return;

  if (frequency) channel.eq.frequency.setTargetAtTime(frequency, now, 0.1);
  if (gain) channel.eq.gain.setTargetAtTime(gain, now, 0.1);
  if (Q) channel.eq.Q.setTargetAtTime(Q, now, 0.1);
}

// Set channel active state
export function setChannelActive(channel, active) {
  if (!channel?.output?.gain) return;

  const now = getAudioContext()?.currentTime;
  if (!now) return;

  const value = active ? 1 : 0;
  channel.output.gain.setTargetAtTime(value, now, 0.1);
}

// Clean up channel
export function cleanupChannel(channel) {
  if (!channel) return;

  try {
    if (channel.cleanup) {
      channel.cleanup();
    }
  } catch (error) {
    console.warn("Error cleaning up channel:", error);
  }
}
