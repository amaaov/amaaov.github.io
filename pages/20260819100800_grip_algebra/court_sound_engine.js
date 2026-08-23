import { pulseHarmonics } from "./court_sound_synth.js";
import { driveCurve, masterPlan } from "./court_sound_master.js";
import { TAPE_LOOP_MAXIMUM_SECONDS, fillTapeLoop, tapeLoopView, writeTapeLoop } from "./court_sound_fx.js";

const OSCILLATOR_WAVES = {
  sine: "sine",
  triangle: "triangle",
  pulse: "square",
};

function brownNoiseBuffer(context) {
  const length = Math.max(1, Math.floor(context.sampleRate * 2));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const samples = buffer.getChannelData(0);
  let last = 0;
  for (let index = 0; index < length; index += 1) {
    last = last * 0.97 + (Math.random() * 2 - 1) * 0.06;
    samples[index] = last;
  }
  return buffer;
}

export function writeAudioParam(param, value, time, timeConstant = 0) {
  if (!param) {
    return;
  }
  if (timeConstant > 0 && typeof param.setTargetAtTime === "function") {
    param.setTargetAtTime(value, time, timeConstant);
    return;
  }
  if (typeof param.setValueAtTime === "function") {
    param.setValueAtTime(value, time);
    return;
  }
  param.value = value;
}

function applyVoiceWave(context, oscillator, waveName, pulseWidth, cache) {
  if (
    waveName === "pulse"
    && typeof oscillator.setPeriodicWave === "function"
    && typeof context.createPeriodicWave === "function"
  ) {
    const width = pulseWidth ?? 0.28;
    if (cache.width !== width || !cache.wave) {
      const harmonics = pulseHarmonics(width);
      cache.wave = context.createPeriodicWave(harmonics.real, harmonics.imaginary);
      cache.width = width;
    }
    oscillator.setPeriodicWave(cache.wave);
    return;
  }
  oscillator.type = OSCILLATOR_WAVES[waveName] ?? "sine";
}

export function createCourtSoundEngine({
  AudioContextConstructor = globalThis.AudioContext ?? globalThis.webkitAudioContext,
} = {}) {
  let context = null;
  let graph = null;
  let enabled = false;
  let visible = true;

  function connectGraph() {
    const lowpass = context.createBiquadFilter();
    lowpass.type = "lowpass";
    const dry = context.createGain();
    const wet = context.createGain();
    const delay = context.createDelay(2.5);
    const feedback = context.createGain();
    const delayTone = context.createBiquadFilter();
    delayTone.type = "lowpass";
    delayTone.frequency.value = 420;
    const scatter = context.createDelay(0.5);
    const scatterFeedback = context.createGain();
    const scatterGain = context.createGain();
    scatterFeedback.gain.value = 0;
    scatterGain.gain.value = 0;
    const panner = context.createStereoPanner();
    const eqLow = context.createBiquadFilter();
    eqLow.type = "lowshelf";
    eqLow.frequency.value = 90;
    const eqMid = context.createBiquadFilter();
    eqMid.type = "peaking";
    eqMid.frequency.value = 280;
    eqMid.Q.value = 0.8;
    const eqHigh = context.createBiquadFilter();
    eqHigh.type = "highshelf";
    eqHigh.frequency.value = 1200;
    const shaper = context.createWaveShaper();
    shaper.oversample = "2x";
    const compressor = context.createDynamicsCompressor();
    const master = context.createGain();
    master.gain.value = 1;
    const voices = [0, 1].map(() => {
      const oscillator = context.createOscillator();
      const noise = context.createBufferSource();
      noise.buffer = brownNoiseBuffer(context);
      noise.loop = true;
      const toneGain = context.createGain();
      const noiseGain = context.createGain();
      toneGain.gain.value = 0;
      noiseGain.gain.value = 0;
      const phaseDelay = context.createDelay(0.05);
      const foldShaper = context.createWaveShaper();
      oscillator.connect(phaseDelay);
      phaseDelay.connect(foldShaper);
      foldShaper.connect(toneGain);
      noise.connect(noiseGain);
      toneGain.connect(lowpass);
      noiseGain.connect(lowpass);
      oscillator.start();
      noise.start();
      return {
        oscillator,
        noise,
        toneGain,
        noiseGain,
        phaseDelay,
        foldShaper,
        pulseWave: { width: null, wave: null },
      };
    });

    lowpass.connect(dry);
    lowpass.connect(wet);
    wet.connect(delayTone);
    delayTone.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    const tapeDry = context.createGain();
    tapeDry.gain.value = 1;
    delay.connect(tapeDry);
    lowpass.connect(scatter);
    scatter.connect(scatterFeedback);
    scatterFeedback.connect(scatter);
    scatter.connect(scatterGain);
    scatterGain.connect(tapeDry);
    dry.connect(tapeDry);
    tapeDry.connect(panner);
    const reverseGain = context.createGain();
    reverseGain.gain.value = 0;
    const tape = {
      write: 0,
      play: 0,
      filled: 0,
      loopSamples: Math.floor((context.sampleRate ?? 44100) * 0.8),
      speed: 1,
      reverse: false,
      recording: false,
      held: false,
      wet: 0,
      ring: null,
    };
    if (typeof context.createScriptProcessor === "function") {
      const processor = context.createScriptProcessor(1024, 1, 1);
      tape.ring = new Float32Array(Math.max(1, Math.floor(context.sampleRate * TAPE_LOOP_MAXIMUM_SECONDS)));
      tape.processor = processor;
      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const output = event.outputBuffer.getChannelData(0);
        const loopSamples = tape.loopSamples;
        if (tape.recording && loopSamples > 0) {
          tape.write = writeTapeLoop(tape.ring, tape.write, input, {
            recording: true,
            loopSamples,
          });
          tape.filled = Math.min(loopSamples, tape.filled + input.length);
        }
        if (tape.wet > 0 && loopSamples > 0) {
          tape.play = fillTapeLoop(
            tape.ring,
            tape.play,
            loopSamples,
            tape.speed,
            tape.reverse,
            output,
          );
        } else {
          output.fill(0);
        }
      };
      lowpass.connect(processor);
      processor.connect(reverseGain);
      reverseGain.connect(panner);
    }
    panner.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(shaper);
    shaper.connect(compressor);
    compressor.connect(master);
    master.connect(context.destination);
    graph = {
      voices,
      lowpass,
      dry,
      wet,
      delay,
      delayTone,
      feedback,
      scatter,
      scatterFeedback,
      scatterGain,
      reverseGain,
      tapeDry,
      tape,
      panner,
      eqLow,
      eqMid,
      eqHigh,
      shaper,
      compressor,
      master,
    };
  }

  async function ensureContext() {
    if (!AudioContextConstructor) {
      return null;
    }
    if (!context) {
      context = new AudioContextConstructor();
      connectGraph();
    }
    if (context.state === "suspended" && typeof context.resume === "function") {
      await context.resume();
    }
    return context;
  }

  return {
    isEnabled() {
      return enabled;
    },
    async setEnabled(on) {
      enabled = Boolean(on);
      if (!enabled) {
        if (context && typeof context.suspend === "function") {
          await context.suspend();
        }
        return;
      }
      await ensureContext();
    },
    async setDocumentVisible(nextVisible) {
      visible = nextVisible;
      if (!context) {
        return;
      }
      if (!enabled || !visible) {
        if (typeof context.suspend === "function") {
          await context.suspend();
        }
        return;
      }
      if (typeof context.resume === "function") {
        await context.resume();
      }
    },
    apply(plan) {
      if (!enabled || !graph || !context) {
        return;
      }
      const now = context.currentTime ?? 0;
      const glide = Math.max(0, plan.glide ?? 0);
      const fade = Math.max(0, plan.release ?? 0);
      graph.voices.forEach((voice, index) => {
        const spec = plan.voices[index];
        if (!spec || plan.silent) {
          writeAudioParam(voice.toneGain.gain, 0, now, fade);
          writeAudioParam(voice.noiseGain.gain, 0, now, fade);
          return;
        }
        const noisy = spec.wave === "noise";
        applyVoiceWave(context, voice.oscillator, spec.wave, plan.pulseWidth, voice.pulseWave);
        if (voice.foldShaper) {
          voice.foldShaper.curve = driveCurve(plan.fold ?? 0);
        }
        writeAudioParam(voice.oscillator.frequency, spec.frequency, now, glide);
        if (voice.oscillator.detune) {
          writeAudioParam(voice.oscillator.detune, spec.detuneCents, now, 0);
        }
        writeAudioParam(voice.phaseDelay.delayTime, spec.phaseDelaySeconds, now, 0);
        writeAudioParam(voice.toneGain.gain, noisy ? 0 : spec.gain, now, 0);
        writeAudioParam(voice.noiseGain.gain, noisy ? spec.gain * 0.55 : 0, now, 0);
      });
      if (plan.filterType) {
        graph.lowpass.type = plan.filterType;
      }
      writeAudioParam(graph.lowpass.frequency, plan.lowpassFrequency, now, 0);
      if (graph.lowpass.Q) {
        writeAudioParam(graph.lowpass.Q, plan.filterQ ?? 1, now, 0);
      }
      writeAudioParam(graph.dry.gain, plan.dry ?? (plan.silent ? 0 : 1 - plan.wet), now, 0);
      writeAudioParam(graph.wet.gain, plan.wet, now, 0);
      writeAudioParam(graph.delay.delayTime, plan.delayTime, now, 0);
      writeAudioParam(graph.feedback.gain, plan.feedback, now, 0);
      if (graph.delayTone) {
        writeAudioParam(graph.delayTone.frequency, plan.delayToneFrequency ?? 420, now, 0);
      }
      writeAudioParam(graph.scatter.delayTime, plan.scatterTime, now, 0);
      if (graph.scatterFeedback) {
        writeAudioParam(graph.scatterFeedback.gain, plan.scatterFeedback ?? 0, now, 0);
      }
      writeAudioParam(graph.scatterGain.gain, plan.scatterGain, now, 0);
      if (graph.reverseGain) {
        writeAudioParam(graph.reverseGain.gain, plan.tapeWet ?? 0, now, 0);
      }
      if (graph.tapeDry) {
        writeAudioParam(graph.tapeDry.gain, plan.tapeDry ?? 1, now, 0);
      }
      if (graph.tape && context.sampleRate) {
        const loopSamples = Math.max(0, Math.floor((plan.tapeLoopSeconds ?? 0) * context.sampleRate));
        if (loopSamples !== graph.tape.loopSamples) {
          graph.tape.write = 0;
          graph.tape.play = 0;
          graph.tape.filled = Math.min(graph.tape.filled, loopSamples);
        }
        graph.tape.loopSamples = loopSamples;
        graph.tape.speed = plan.tapeSpeed ?? 1;
        graph.tape.reverse = false;
        graph.tape.recording = Boolean(plan.tapeRecording);
        graph.tape.held = Boolean(plan.tapeHeld);
        graph.tape.wet = plan.tapeWet ?? 0;
      }
      writeAudioParam(graph.panner.pan, plan.pan, now, 0);
      const master = plan.master ?? masterPlan();
      if (graph.eqLow.gain) {
        writeAudioParam(graph.eqLow.gain, master.lowGain, now, 0);
      }
      if (graph.eqMid.gain) {
        writeAudioParam(graph.eqMid.gain, master.midGain, now, 0);
      }
      if (graph.eqHigh.gain) {
        writeAudioParam(graph.eqHigh.gain, master.highGain, now, 0);
      }
      graph.shaper.curve = driveCurve(master.drive);
      writeAudioParam(graph.compressor.threshold, master.threshold, now, 0);
      writeAudioParam(graph.compressor.ratio, master.ratio, now, 0);
      if (graph.compressor.knee) {
        writeAudioParam(graph.compressor.knee, master.knee, now, 0);
      }
      if (graph.compressor.attack) {
        writeAudioParam(graph.compressor.attack, master.attack, now, 0);
      }
      if (graph.compressor.release) {
        writeAudioParam(graph.compressor.release, master.release, now, 0);
      }
      writeAudioParam(graph.master.gain, master.makeup, now, 0);
    },
    tapeView() {
      if (!graph?.tape) {
        return tapeLoopView();
      }
      return tapeLoopView({
        write: graph.tape.write,
        play: graph.tape.play,
        loopSamples: graph.tape.loopSamples || 1,
        filled: graph.tape.filled,
        recording: graph.tape.recording,
        held: graph.tape.held,
      });
    },
  };
}
