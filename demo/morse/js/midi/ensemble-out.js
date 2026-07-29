import { unitMsForWpm } from "./score.js";

/**
 * Drive per-track straight-key MIDI from ensemble progress events.
 * Uses midiPort.keyOn/keyOff so layers can sound on different channels at once.
 */
export function createEnsembleMidiOut(midiPort) {
  const releaseTimers = new Map();
  const programsSent = new Set();

  function clearTimer(id) {
    const timer = releaseTimers.get(id);
    if (timer) clearTimeout(timer);
    releaseTimers.delete(id);
  }

  function release(id) {
    if (id == null) return;
    clearTimer(id);
    midiPort?.keyOff?.(id);
  }

  function channelNibble(track) {
    return Math.max(0, Math.min(15, (Number(track.midiChannel) || 1) - 1));
  }

  function ensureProgram(track) {
    if (track.midiProgram == null || track.midiProgram < 0) return;
    const ch = channelNibble(track);
    const key = `${track.id}:${ch}:${track.midiProgram}`;
    if (programsSent.has(key)) return;
    midiPort?.program?.(ch, track.midiProgram);
    programsSent.add(key);
  }

  function onTrackProgress(track, event) {
    if (!track?.id) return;
    if (!midiPort?.ready || track.midiEnabled === false) {
      release(track.id);
      return;
    }
    clearTimer(track.id);
    if (!event || (event.token !== "." && event.token !== "-")) {
      midiPort.keyOff(track.id);
      return;
    }
    ensureProgram(track);
    const note = Math.max(0, Math.min(127, Number(track.midiNote) ?? 69));
    const velocity = Math.max(1, Math.min(127, Number(track.midiVelocity) || 96));
    midiPort.keyOn(track.id, {
      channel: channelNibble(track),
      note,
      velocity,
    });
    const duration = unitMsForWpm(track.wpm) * (event.token === "-" ? 3 : 1);
    releaseTimers.set(
      track.id,
      setTimeout(() => {
        midiPort.keyOff(track.id);
        releaseTimers.delete(track.id);
      }, duration),
    );
  }

  function stop() {
    for (const id of [...releaseTimers.keys()]) clearTimer(id);
    programsSent.clear();
    midiPort?.releaseKeys?.();
  }

  return { onTrackProgress, release, stop };
}
