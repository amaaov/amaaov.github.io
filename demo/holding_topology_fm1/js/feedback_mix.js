/**
 * Stereo generative mix: dual-delay + drive, granular delay, tape loop,
 * plus HT court FX (scatter blend, 3-band EQ, compressor).
 */

import { TRACK_COUNT } from "./mix_composition.js";
import {
  TAPE_LOOP_MAXIMUM_SECONDS,
  compressAmount,
  eqShelfGain,
  fillTapeLoop,
  scatterPlan,
  tapePlan,
  writeTapeLoop,
} from "./ht_fx.js";
import {
  DEFAULT_ANALOG,
  createAnalogCharacter,
  makeSoftDriveCurve,
} from "./analog_character.js";
import {
  createGranularDelayState,
  granularDelayPlan,
  processGranularDelay,
} from "./granular_delay.js";

/** Panel MASTER times patch mix level. Panel 0 is full silence. */
export function masterGainFromPanel(panelMaster, patchMaster = 0.55) {
  return Math.max(0, Number(panelMaster) || 0) * Math.max(0, Number(patchMaster) || 0);
}

export function createFeedbackMix(audioContext, destination) {
  const master = audioContext.createGain();
  /** Panel MASTER (0 = silence). Patch mix.master only scales when panel > 0. */
  let panelMaster = 0.72;
  let patchMaster = 0.55;
  master.gain.value = masterGainFromPanel(panelMaster, patchMaster);

  function applyMasterGain(now = audioContext.currentTime, timeConstant = 0.05) {
    master.gain.setTargetAtTime(masterGainFromPanel(panelMaster, patchMaster), now, timeConstant);
  }

  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 12;
  compressor.ratio.value = 4.5;
  compressor.attack.value = 0.008;
  compressor.release.value = 0.22;

  const courtGate = audioContext.createGain();
  courtGate.gain.value = 1;
  const drySum = audioContext.createGain();
  drySum.gain.value = 0.85;

  const drive = audioContext.createWaveShaper();
  drive.curve = makeSoftDriveCurve(0.4);
  drive.oversample = "4x";

  const delayA = audioContext.createDelay(1.5);
  const delayB = audioContext.createDelay(1.5);
  const feedbackA = audioContext.createGain();
  const feedbackB = audioContext.createGain();
  const crossA = audioContext.createGain();
  const crossB = audioContext.createGain();
  const delayMix = audioContext.createGain();
  delayMix.gain.value = 0.7;
  feedbackA.gain.value = 0.22;
  feedbackB.gain.value = 0.2;
  crossA.gain.value = 0.14;
  crossB.gain.value = 0.14;
  delayA.delayTime.value = 0.28;
  delayB.delayTime.value = 0.33;

  const wetFilter = audioContext.createBiquadFilter();
  wetFilter.type = "lowpass";
  // Keep delay returns dark — bright feedback was screaming into every engine.
  wetFilter.frequency.value = 3800;
  wetFilter.Q.value = 0.45;

  const reverb = audioContext.createConvolver();
  reverb.buffer = makeImpulse(audioContext, 1.8, 3.2);
  const reverbSend = audioContext.createGain();
  reverbSend.gain.value = 1;
  const reverbReturn = audioContext.createGain();
  reverbReturn.gain.value = 0.28;

  const chainToVoices = audioContext.createGain();
  chainToVoices.gain.value = 0.18;

  const dryBlend = audioContext.createGain();
  dryBlend.gain.value = 0.85;
  const wetBlend = audioContext.createGain();
  wetBlend.gain.value = 0.28;

  const postSum = audioContext.createGain();
  postSum.gain.value = 1;

  const scatter = audioContext.createDelay(0.5);
  const scatterFeedback = audioContext.createGain();
  const scatterGain = audioContext.createGain();
  scatter.delayTime.value = 0.08;
  scatterFeedback.gain.value = 0;
  scatterGain.gain.value = 0;

  const eqLow = audioContext.createBiquadFilter();
  eqLow.type = "lowshelf";
  eqLow.frequency.value = 90;
  const eqMid = audioContext.createBiquadFilter();
  eqMid.type = "peaking";
  eqMid.frequency.value = 280;
  eqMid.Q.value = 0.8;
  const eqHigh = audioContext.createBiquadFilter();
  eqHigh.type = "highshelf";
  eqHigh.frequency.value = 1200;

  const tapeDry = audioContext.createGain();
  tapeDry.gain.value = 1;
  const tapeWet = audioContext.createGain();
  tapeWet.gain.value = 0;

  const tapeState = {
    write: 0,
    play: 0,
    filled: 0,
    loopSamples: Math.floor(audioContext.sampleRate * 4),
    speed: 1,
    reverse: false,
    recording: false,
    held: false,
    wet: 0,
    ring: null,
    processor: null,
  };

  const grainState = createGranularDelayState(audioContext.sampleRate, 2);
  let grainPlan = granularDelayPlan(0, 0.28);
  let grainAmount = 0;
  let grainDelaySeconds = 0.28;
  const grainWet = audioContext.createGain();
  grainWet.gain.value = 0;

  const tracks = Array.from({ length: TRACK_COUNT }, () => createTrackBus(audioContext));
  // Music tracks (0–2) pass through sidechain duck; perc (3) is the key and stays unducked.
  const musicBus = audioContext.createGain();
  musicBus.gain.value = 1;
  const sidechainDuck = audioContext.createGain();
  sidechainDuck.gain.value = 1;
  let sidechainDepth = 0.55;
  for (let index = 0; index < TRACK_COUNT; index += 1) {
    const track = tracks[index];
    track.reverbOut.connect(reverbSend);
    if (index === 3) {
      track.output.connect(courtGate);
    } else {
      track.output.connect(musicBus);
    }
  }
  musicBus.connect(sidechainDuck);
  sidechainDuck.connect(courtGate);
  courtGate.connect(drySum);

  // Court path: dry → drive → dual delay with cross-feedback → lowpass → wet
  drySum.connect(drive);
  drive.connect(delayA);
  drive.connect(delayB);
  delayA.connect(feedbackA);
  delayB.connect(feedbackB);
  feedbackA.connect(delayA);
  feedbackB.connect(delayB);
  delayA.connect(crossB);
  delayB.connect(crossA);
  crossA.connect(delayA);
  crossB.connect(delayB);
  delayA.connect(delayMix);
  delayB.connect(delayMix);
  delayMix.connect(wetFilter);

  wetFilter.connect(wetBlend);
  drySum.connect(dryBlend);
  wetBlend.connect(postSum);
  dryBlend.connect(postSum);
  reverbSend.connect(reverb);
  reverb.connect(reverbReturn);
  reverbReturn.connect(postSum);

  // Soft scatter pre-blur into the granular delay return.
  postSum.connect(scatter);
  scatter.connect(scatterFeedback);
  scatterFeedback.connect(scatter);
  scatter.connect(scatterGain);
  scatterGain.connect(tapeDry);
  postSum.connect(tapeDry);
  grainWet.connect(postSum);

  tapeDry.connect(eqLow);
  eqLow.connect(eqMid);
  eqMid.connect(eqHigh);
  eqHigh.connect(compressor);

  const analog = createAnalogCharacter(audioContext, DEFAULT_ANALOG);
  // Brickwall after the character bus — waveguide blow-ups were silencing playback.
  const safety = audioContext.createWaveShaper();
  safety.curve = makeSoftDriveCurve(0.85);
  safety.oversample = "4x";
  const safetyGain = audioContext.createGain();
  safetyGain.gain.value = 0.92;
  compressor.connect(analog.input);
  analog.output.connect(safety);
  safety.connect(safetyGain);
  safetyGain.connect(master);

  if (typeof audioContext.createScriptProcessor === "function") {
    tapeState.ring = new Float32Array(
      Math.max(1, Math.floor(audioContext.sampleRate * TAPE_LOOP_MAXIMUM_SECONDS)),
    );

    const grainProcessor = audioContext.createScriptProcessor(1024, 1, 1);
    grainProcessor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const output = event.outputBuffer.getChannelData(0);
      processGranularDelay(grainState, input, output, grainPlan);
    };
    wetFilter.connect(grainProcessor);
    grainProcessor.connect(grainWet);

    const processor = audioContext.createScriptProcessor(1024, 1, 1);
    tapeState.processor = processor;
    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const output = event.outputBuffer.getChannelData(0);
      const activeSamples =
        tapeState.held && tapeState.filled > 0
          ? Math.min(tapeState.loopSamples, tapeState.filled)
          : tapeState.loopSamples;
      if (tapeState.recording && activeSamples > 0) {
        tapeState.write = writeTapeLoop(tapeState.ring, tapeState.write, input, {
          recording: true,
          loopSamples: tapeState.loopSamples,
        });
        tapeState.filled = Math.min(tapeState.loopSamples, tapeState.filled + input.length);
      }
      if (tapeState.wet > 0 && activeSamples > 0 && tapeState.filled > 0) {
        tapeState.play = fillTapeLoop(
          tapeState.ring,
          tapeState.play,
          activeSamples,
          Math.abs(tapeState.speed) || 1,
          tapeState.reverse,
          output,
        );
      } else {
        output.fill(0);
      }
    };
    postSum.connect(processor);
    processor.connect(tapeWet);
    // Tape return also hits analog character so loops stay warm, not sterile.
    tapeWet.connect(analog.input);
  }

  // Lower chain-to-voice FM injection so delay HF cannot FM every oscillator hot.
  chainToVoices.gain.value = 0.06;

  wetFilter.connect(chainToVoices);
  master.connect(destination);

  let compressUnit = 0.45;

  function applyCompressorUnit(unit, now) {
    compressUnit = compressAmount(unit);
    const threshold = -12 - compressUnit * 18;
    const ratio = 1.8 + compressUnit * 6;
    const knee = 24 - compressUnit * 14;
    compressor.threshold.setTargetAtTime(threshold, now, 0.08);
    compressor.ratio.setTargetAtTime(ratio, now, 0.08);
    compressor.knee.setTargetAtTime(knee, now, 0.08);
  }

  function applyEq(eq, now) {
    const lows = eq?.eqLows ?? eq?.lows ?? 0.55;
    const mids = eq?.eqMids ?? eq?.mids ?? 0.6;
    const highs = eq?.eqHighs ?? eq?.highs ?? 0.5;
    eqLow.gain.setTargetAtTime(eqShelfGain(lows), now, 0.1);
    eqMid.gain.setTargetAtTime(eqShelfGain(mids), now, 0.1);
    eqHigh.gain.setTargetAtTime(eqShelfGain(highs), now, 0.1);
  }

  function refreshGrainPlan(now = audioContext.currentTime) {
    grainPlan = granularDelayPlan(grainAmount, grainDelaySeconds);
    grainWet.gain.setTargetAtTime(grainPlan.mix > 0 ? 1 : 0, now, 0.08);
  }

  function applyScatter(amount, now, timeSeconds = audioContext.currentTime) {
    grainAmount = clamp(amount, 0, 1);
    refreshGrainPlan(now);
    const plan = scatterPlan(amount * 0.45, timeSeconds);
    scatter.delayTime.setTargetAtTime(plan.time, now, 0.05);
    scatterGain.gain.setTargetAtTime(plan.gain * (amount > 0 ? amount * 0.35 : 0), now, 0.08);
    scatterFeedback.gain.setTargetAtTime(plan.feedback * (amount > 0.08 ? 0.35 : 0), now, 0.08);
    sidechainDepth = plan.duck || 0.4;
  }

  function applyTape(effects, now = audioContext.currentTime) {
    const plan = tapePlan(effects);
    const wasRecording = tapeState.recording;
    const wasHeld = tapeState.held;
    const seconds = plan.tapeLoopSeconds > 0 ? plan.tapeLoopSeconds : 4;
    tapeState.loopSamples = Math.max(1, Math.floor(audioContext.sampleRate * seconds));
    tapeState.speed = Math.abs(plan.tapeSpeed) || 1;
    tapeState.reverse = plan.tapeSpeed < 0;
    tapeState.recording = plan.tapeRecording;
    tapeState.held = plan.tapeHeld;
    tapeState.wet = plan.tapeWet;
    if (plan.tapeRecording && !wasRecording) {
      tapeState.write = 0;
      tapeState.play = 0;
      tapeState.filled = 0;
      if (tapeState.ring) {
        tapeState.ring.fill(0);
      }
    }
    if (plan.tapeHeld && !wasHeld) {
      tapeState.play = 0;
    }
    if (!plan.tapeRecording && !plan.tapeHeld && plan.tapeLoopSeconds <= 0) {
      tapeState.filled = 0;
      tapeState.write = 0;
      tapeState.play = 0;
    }
    const wetTarget = plan.tapeHeld
      ? Math.max(0.55, plan.tapeWet)
      : plan.tapeRecording
        ? Math.max(0.25, plan.tapeWet * 0.55)
        : plan.tapeWet;
    tapeWet.gain.setTargetAtTime(wetTarget, now, 0.05);
  }

  return {
    master,
    courtGate,
    compressor,
    drive,
    delayA,
    delayB,
    feedbackA,
    feedbackB,
    crossA,
    crossB,
    delayMix,
    wetFilter,
    reverb,
    reverbSend,
    reverbReturn,
    chainToVoices,
    dryBlend,
    wetBlend,
    scatter,
    scatterGain,
    scatterFeedback,
    eqLow,
    eqMid,
    eqHigh,
    tapeDry,
    tapeWet,
    tapeState,
    analog,
    chainDelay: delayA,
    chainDrive: drive,
    chainFb: feedbackA,
    chainCross: crossA,
    chainReturn: wetBlend,
    chainFilter: wetFilter,
    tracks,
    connectVoice(voiceOutput, trackIndex) {
      const track = tracks[((trackIndex % TRACK_COUNT) + TRACK_COUNT) % TRACK_COUNT];
      voiceOutput.connect(track.input);
      return track;
    },
    connectDrumBus(drumOutput) {
      drumOutput.connect(tracks[3].input);
    },
    applyMix(mix, now = audioContext.currentTime) {
      if (!mix) {
        return;
      }
      patchMaster = mix.master ?? 0.55;
      applyMasterGain(now, 0.08);
      reverbReturn.gain.setTargetAtTime((mix.reverb ?? 0.3) * 0.7, now, 0.1);
      if (mix.reverbDecay) {
        reverb.buffer = makeImpulse(audioContext, Math.min(2.8, mix.reverbDecay), 3);
      }
      const comp = mix.compressor ?? {};
      if (mix.compress != null) {
        applyCompressorUnit(mix.compress, now);
      } else {
        compressor.threshold.setTargetAtTime(Math.min(-14, comp.threshold ?? -22), now, 0.08);
        compressor.knee.setTargetAtTime(comp.knee ?? 18, now, 0.08);
        compressor.ratio.setTargetAtTime(Math.min(8, comp.ratio ?? 2.8), now, 0.08);
        compressor.attack.setTargetAtTime(Math.max(0.01, comp.attack ?? 0.02), now, 0.08);
        compressor.release.setTargetAtTime(Math.max(0.15, comp.release ?? 0.28), now, 0.08);
      }
      applyEq(mix.eq ?? mix, now);
      applyScatter(mix.scatter ?? 0, now);
      if (mix.tape != null || mix.tapeDry != null || mix.speed != null) {
        applyTape(
          {
            tape: mix.tape ?? 0,
            tapeDry: mix.tapeDry ?? 0.75,
            speed: mix.speed ?? 1,
            recording: mix.tapeRecording,
            held: mix.tapeHeld,
          },
          now,
        );
      }
      const chain = mix.chain ?? {};
      delayA.delayTime.setTargetAtTime(chain.delay ?? 0.28, now, 0.1);
      delayB.delayTime.setTargetAtTime((chain.delay ?? 0.28) * 1.17, now, 0.1);
      drive.curve = makeSoftDriveCurve(chain.drive ?? 0.4);
      if (mix.analog) {
        analog.apply(mix.analog, now);
      }
      const fb = Math.min(0.68, chain.crossFeedback ?? 0.35);
      const returnLevel = chain.returnLevel ?? 0.25;
      feedbackA.gain.setTargetAtTime(fb * 0.78, now, 0.1);
      feedbackB.gain.setTargetAtTime(fb * 0.7, now, 0.1);
      crossA.gain.setTargetAtTime(fb * 0.42, now, 0.1);
      crossB.gain.setTargetAtTime(fb * 0.42, now, 0.1);
      wetBlend.gain.setTargetAtTime(clamp(returnLevel * 1.2, 0.02, 0.8), now, 0.1);
      dryBlend.gain.setTargetAtTime(clamp(0.95 - returnLevel * 0.5, 0.35, 0.95), now, 0.1);
      chainToVoices.gain.setTargetAtTime(0.04 + returnLevel * 0.12, now, 0.1);
      wetFilter.frequency.setTargetAtTime(
        Math.max(900, Math.min(5200, chain.filterHz ?? 3800)),
        now,
        0.12,
      );
      wetFilter.Q.setTargetAtTime(Math.min(1.1, chain.filterQ ?? 0.45), now, 0.1);
    },
    applyTrackSnapshot(snapshot, now = audioContext.currentTime) {
      if (!snapshot) {
        return;
      }
      for (const row of snapshot) {
        const track = tracks[row.index];
        if (!track) {
          continue;
        }
        const level = row.active ? Math.max(0.0001, row.level) : 0.0001;
        track.level.gain.setTargetAtTime(level, now, 0.12);
        track.panner.pan.setTargetAtTime(clamp(row.pan ?? 0, -0.95, 0.95), now, 0.15);
        track.reverbSend.gain.setTargetAtTime(
          Math.max(0.0001, (row.reverbSend ?? 0.25) * 0.8),
          now,
          0.12,
        );
      }
    },
    setCourtGate(amount, now = audioContext.currentTime, timeConstant = 0.08) {
      courtGate.gain.setTargetAtTime(clamp(amount, 0.0001, 1.2), now, timeConstant);
    },
    setMaster(level, now = audioContext.currentTime) {
      panelMaster = Math.min(1, Math.max(0, Number(level) || 0));
      applyMasterGain(now, 0.05);
    },
    getMaster() {
      return panelMaster;
    },
    setReverb(amount, now = audioContext.currentTime) {
      reverbReturn.gain.setTargetAtTime(amount * 0.7, now, 0.1);
    },
    setChainReturn(amount, now = audioContext.currentTime) {
      const level = clamp(amount, 0, 1);
      wetBlend.gain.setTargetAtTime(clamp(level * 1.2, 0.02, 0.8), now, 0.1);
      dryBlend.gain.setTargetAtTime(clamp(0.95 - level * 0.5, 0.35, 0.95), now, 0.1);
      chainToVoices.gain.setTargetAtTime(0.04 + level * 0.12, now, 0.1);
    },
    setDryWet(dry, wet, now = audioContext.currentTime) {
      dryBlend.gain.setTargetAtTime(Math.max(0.0001, dry), now, 0.08);
      wetBlend.gain.setTargetAtTime(Math.max(0.0001, wet), now, 0.08);
    },
    setLyraFeedback(amount, now = audioContext.currentTime) {
      const fb = Math.min(0.68, Math.max(0.02, amount));
      feedbackA.gain.setTargetAtTime(fb * 0.78, now, 0.08);
      feedbackB.gain.setTargetAtTime(fb * 0.7, now, 0.08);
      crossA.gain.setTargetAtTime(fb * 0.42, now, 0.08);
      crossB.gain.setTargetAtTime(fb * 0.42, now, 0.08);
      chainToVoices.gain.setTargetAtTime(0.03 + fb * 0.14, now, 0.08);
    },
    setCompress(amount, now = audioContext.currentTime) {
      applyCompressorUnit(amount, now);
    },
    setEq(eq, now = audioContext.currentTime) {
      applyEq(eq, now);
    },
    setScatter(amount, now = audioContext.currentTime) {
      applyScatter(amount, now);
    },
    setGrainDelay(seconds, now = audioContext.currentTime) {
      grainDelaySeconds = clamp(Number(seconds) || 0.28, 0.02, 1.85);
      refreshGrainPlan(now);
    },
    getGrainPlan() {
      return { ...grainPlan, amount: grainAmount };
    },
    /** Perc hit → duck music bus (true sidechain key from drums). */
    pulseSidechain(velocity = 0.8, now = audioContext.currentTime) {
      const depth = Math.min(0.92, sidechainDepth * (0.35 + Math.min(1, velocity) * 0.75));
      const floor = 1 - depth * 0.82;
      sidechainDuck.gain.cancelScheduledValues(now);
      sidechainDuck.gain.setValueAtTime(Math.max(0.12, floor), now);
      sidechainDuck.gain.setTargetAtTime(1, now + 0.012, 0.12 + (1 - depth) * 0.18);
    },
    getSidechainDepth() {
      return sidechainDepth;
    },
    setTape(effects, now = audioContext.currentTime) {
      applyTape(effects, now);
    },
    setAnalog(settings, now = audioContext.currentTime) {
      analog.apply(settings, now);
    },
    getCompress() {
      return compressUnit;
    },
    getTapeView() {
      const length = Math.max(1, tapeState.loopSamples);
      return {
        record: (((tapeState.write % length) + length) % length) / length,
        play: (((tapeState.play % length) + length) % length) / length,
        filled: clamp(tapeState.filled / length, 0, 1),
        recording: tapeState.recording,
        held: tapeState.held,
        wet: tapeState.wet,
      };
    },
  };
}

function createTrackBus(audioContext) {
  const input = audioContext.createGain();
  const level = audioContext.createGain();
  const panner = audioContext.createStereoPanner();
  const output = audioContext.createGain();
  const reverbSend = audioContext.createGain();
  const reverbOut = audioContext.createGain();
  level.gain.value = 0.75;
  panner.pan.value = 0;
  reverbSend.gain.value = 0.28;
  input.connect(level);
  level.connect(panner);
  panner.connect(output);
  panner.connect(reverbSend);
  reverbSend.connect(reverbOut);
  return {
    input,
    level,
    panner,
    output,
    reverbSend,
    reverbOut,
    chainSend: reverbSend,
    chainOut: reverbOut,
  };
}

function makeImpulse(audioContext, seconds, decay) {
  const length = Math.max(1, Math.floor(audioContext.sampleRate * seconds));
  const buffer = audioContext.createBuffer(2, length, audioContext.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      const envelope = (1 - index / length) ** decay;
      // Darker, sparser IR — bright dense noise reads as digital grit.
      const dark = envelope * (0.55 + 0.45 * Math.exp(-index / (audioContext.sampleRate * 0.12)));
      if (index < 28 || Math.random() > 0.978) {
        data[index] = (Math.random() * 2 - 1) * dark * (channel === 0 ? 0.48 : 0.44);
      }
    }
  }
  return buffer;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
