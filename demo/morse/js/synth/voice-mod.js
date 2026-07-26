/** Per-voice pitch LFO tap and ENV→pitch / ENV→filter. */

export function attachVoiceModulation(context, { buses, chainNodes }, voice, params = {}) {
  if (!voice) return;
  const now = voice.now ?? context.currentTime;
  const attack = Math.max(0.001, params.attack ?? 0.008);
  const decay = Math.max(0.001, params.decay ?? 0.04);
  const sustain = Math.max(0.0001, params.sustain ?? 0.85);
  const release = Math.max(0.001, params.release ?? 0.03);
  const baseHz = params.frequency ?? 700;
  const filterBase = params.filterHz ?? 3200;
  const envToPitch = params.envToPitch ?? 0;
  const envToFilter = params.envToFilter ?? 0;

  const pitchTap = context.createGain();
  pitchTap.gain.value = 1;
  buses.pitch.connect(pitchTap);
  voice.push?.(pitchTap);
  for (const node of [...(voice.nodes || [])]) {
    if (node instanceof OscillatorNode) {
      // Skip sub-audio LFOs so pitch mod does not latch onto modulation oscillators.
      if (node.frequency.value < 40) continue;
      pitchTap.connect(node.frequency);
    } else if (node instanceof AudioBufferSourceNode) {
      const rateMod = context.createGain();
      rateMod.gain.value = 0.12;
      pitchTap.connect(rateMod);
      rateMod.connect(node.playbackRate);
      voice.push?.(rateMod);
    }
  }
  wrapStop(voice, (when, prior) => {
    try {
      buses.pitch.disconnect(pitchTap);
    } catch {
      /* already disconnected */
    }
    prior(when);
  });

  if (envToPitch > 0.001) {
    const env = context.createConstantSource();
    const peak = envToPitch * baseHz * 0.25;
    env.offset.setValueAtTime(0, now);
    env.offset.linearRampToValueAtTime(peak, now + attack);
    env.offset.linearRampToValueAtTime(peak * sustain, now + attack + decay);
    env.start(now);
    for (const node of voice.nodes || []) {
      if (node instanceof OscillatorNode) env.connect(node.frequency);
    }
    voice.push?.(env);
    wrapStop(voice, (when, prior) => {
      const stopAt = Math.max(when, context.currentTime);
      env.offset.cancelScheduledValues(stopAt);
      env.offset.setValueAtTime(Math.max(env.offset.value, 0), stopAt);
      env.offset.linearRampToValueAtTime(0, stopAt + release);
      try {
        env.stop(stopAt + release + 0.02);
      } catch {
        /* already stopped */
      }
      prior(when);
    });
  }

  if (envToFilter > 0.001 && chainNodes?.filter) {
    const param = chainNodes.filter.frequency;
    const open = filterBase * (1 + envToFilter * 2.2);
    const rest = filterBase;
    param.cancelScheduledValues(now);
    param.setValueAtTime(rest * (0.35 + (1 - envToFilter) * 0.4), now);
    param.linearRampToValueAtTime(open, now + attack);
    param.linearRampToValueAtTime(rest + (open - rest) * sustain, now + attack + decay);
    wrapStop(voice, (when, prior) => {
      const stopAt = Math.max(when, context.currentTime);
      param.cancelScheduledValues(stopAt);
      param.setTargetAtTime(rest, stopAt, Math.max(0.01, release * 0.3));
      prior(when);
    });
  }
}

function wrapStop(voice, handler) {
  const prior = voice.stop.bind(voice);
  voice.stop = (when) => handler(when, prior);
}
