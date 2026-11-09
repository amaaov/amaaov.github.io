import { VOICE_COUNT } from "./control_map.js";
import {
  MOD_STATE_EDGE,
  MOD_SUSTAIN,
  MOD_THROW,
  OCC_MIXED,
  modMatrixCombine,
  occupancySign,
} from "./ht_mod_matrix.js";
import { noteToHz } from "./ht_tuning.js";
import { createFormantBank, vowelFromIndex } from "./vowel_formants.js";
import { PIPE_KINDS, createPipeVoice } from "./pipe_synth.js";
import { STRING_KINDS, createStringVoice } from "./string_synth.js";
import {
  NATURE_ENGINES,
  createNatureVoice,
  natureModeIndex,
} from "./nature_synth.js";
import { createDrumKit, drumEnvelopesFromSeed } from "./drum_kit.js";

const WIND_ENGINES = new Set(PIPE_KINDS);
const STRING_ENGINES = new Set(STRING_KINDS);
const NATURE_ENGINE_SET = new Set(NATURE_ENGINES);
import { createFeedbackMix } from "./feedback_mix.js";
import { mixSnapshotForSection, sectionAtBeat } from "./mix_composition.js";
import { liveMixGlobals, liveMixSnapshot } from "./mix_motion.js";
import {
  DEFAULT_ENVELOPE,
  oscillatorTypeForLfoShape,
} from "./ht_fx.js";
import {
  DEFAULT_ANALOG,
  createVoiceDrift,
  makeSoftDriveCurve,
} from "./analog_character.js";

export { VOICE_COUNT };

function midiToHz(midi) {
  return noteToHz(midi);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createLyraSynth(audioContext) {
  const mix = createFeedbackMix(audioContext, audioContext.destination);
  const drums = createDrumKit(audioContext, mix.tracks[3].input);

  const voices = Array.from({ length: VOICE_COUNT }, (_, index) =>
    createVoice(audioContext, index),
  );
  for (const voice of voices) {
    const trackIndex = Math.floor(indexTrack(voice.index));
    mix.connectVoice(voice.output, trackIndex);
    voice.trackIndex = trackIndex;
    mix.chainToVoices.connect(voice.fmGain);
    voice.drift = createVoiceDrift(audioContext, voice.index, DEFAULT_ANALOG.drift);
    voice.drift.output.connect(voice.osc.detune);
  }

  wirePairFm(voices);
  const lfoA = audioContext.createOscillator();
  const lfoB = audioContext.createOscillator();
  const lfoSum = audioContext.createGain();
  const lfoPitch = audioContext.createGain();
  const lfoCutoff = audioContext.createGain();
  const lfoLevel = audioContext.createGain();
  const lfoPan = audioContext.createGain();
  const lfoWidth = audioContext.createGain();
  lfoA.type = "sine";
  lfoB.type = "triangle";
  lfoA.frequency.value = 0.35;
  lfoB.frequency.value = 0.55;
  lfoSum.gain.value = 1;
  lfoPitch.gain.value = 0;
  lfoCutoff.gain.value = 0;
  lfoLevel.gain.value = 0;
  lfoPan.gain.value = 0;
  lfoWidth.gain.value = 0;
  lfoA.connect(lfoSum);
  lfoB.connect(lfoSum);
  lfoSum.connect(lfoPitch);
  lfoSum.connect(lfoCutoff);
  lfoSum.connect(lfoLevel);
  lfoSum.connect(lfoPan);
  lfoSum.connect(lfoWidth);
  for (const voice of voices) {
    lfoPitch.connect(voice.osc.detune);
    lfoCutoff.connect(voice.filter.frequency);
    lfoLevel.connect(voice.levelMod.gain);
    lfoWidth.connect(voice.osc.detune);
  }
  for (const track of mix.tracks) {
    lfoPan.connect(track.panner.pan);
  }
  const lfoLink = audioContext.createGain();
  lfoLink.gain.value = 0;
  lfoA.connect(lfoLink);
  lfoLink.connect(lfoB.frequency);
  lfoA.start();
  lfoB.start();

  let patch = null;
  let lastHeld = 0;
  let lastOccupancyState = "";
  let sectionIndex = -1;
  const voiceMute = Array.from({ length: VOICE_COUNT }, () => false);

  function applyFeedback(amount) {
    if (!patch) {
      return;
    }
    const fb = clamp(amount, 0.05, 0.85);
    patch.totalFeedback = fb;
    const now = audioContext.currentTime;
    mix.setLyraFeedback(fb, now);
    if (patch.composition?.mix) {
      patch.composition.mix.chain.crossFeedback = fb;
      patch.composition.mix.chain.returnLevel = fb * 0.45;
    }
  }

  function routeLfoDepths(depth, toA, toB) {
    const amount = clamp(depth, 0, 1);
    const targets = new Set([toA, toB].filter(Boolean));
    const share = targets.size > 1 ? 0.7 : 1;
    lfoPitch.gain.setTargetAtTime(
      targets.has("pitch") ? amount * 48 * share : 0,
      audioContext.currentTime,
      0.05,
    );
    lfoCutoff.gain.setTargetAtTime(
      targets.has("cutoff") ? amount * 1200 * share : 0,
      audioContext.currentTime,
      0.05,
    );
    lfoLevel.gain.setTargetAtTime(
      targets.has("level") ? amount * 0.35 * share : 0,
      audioContext.currentTime,
      0.05,
    );
    lfoPan.gain.setTargetAtTime(
      targets.has("pan") ? amount * 0.45 * share : 0,
      audioContext.currentTime,
      0.05,
    );
    lfoWidth.gain.setTargetAtTime(
      targets.has("width") ? amount * 22 * share : 0,
      audioContext.currentTime,
      0.05,
    );
  }

  function applyLfo(depth, rateA, rateB, link, options = {}) {
    if (!patch) {
      return;
    }
    patch.hyperLfo.depth = depth;
    if (rateA != null) {
      patch.hyperLfo.rateA = rateA;
      lfoA.frequency.setTargetAtTime(rateA, audioContext.currentTime, 0.05);
    }
    if (rateB != null) {
      patch.hyperLfo.rateB = rateB;
      lfoB.frequency.setTargetAtTime(rateB, audioContext.currentTime, 0.05);
    }
    if (link != null) {
      patch.hyperLfo.link = link;
      lfoLink.gain.setTargetAtTime(link ? 0.35 : 0, audioContext.currentTime, 0.05);
    }
    if (options.toA) {
      patch.hyperLfo.toA = options.toA;
    }
    if (options.toB) {
      patch.hyperLfo.toB = options.toB;
    }
    if (options.shapeA) {
      patch.hyperLfo.shapeA = options.shapeA;
      lfoA.type = oscillatorTypeForLfoShape(options.shapeA);
    }
    if (options.shapeB) {
      patch.hyperLfo.shapeB = options.shapeB;
      lfoB.type = oscillatorTypeForLfoShape(options.shapeB);
    }
    routeLfoDepths(depth, patch.hyperLfo.toA ?? "pitch", patch.hyperLfo.toB ?? "cutoff");
  }

  function applyMasterFx() {
    if (!patch?.composition?.mix) {
      return;
    }
    const board = patch.composition.mix;
    const now = audioContext.currentTime;
    mix.setCompress(board.compress ?? 0.45, now);
    mix.setEq(board.eq ?? {}, now);
    mix.setScatter(board.scatter ?? 0, now);
    mix.setTape(
      {
        tape: board.tape ?? 0,
        tapeDry: board.tapeDry ?? 0.75,
        speed: board.speed ?? 1,
        recording: patch.tapeLive?.recording,
        held: patch.tapeLive?.held,
      },
      now,
    );
  }

  function configureVoice(voice, spec, patchType, now) {
    const hz = midiToHz(spec.midi);
    voice.baseHz = hz;
    voice.trackIndex = spec.trackIndex ?? indexTrack(voice.index);
    const useNoise = spec.engine === "noise";
    const useWind = WIND_ENGINES.has(spec.engine);
    const useString = STRING_ENGINES.has(spec.engine);
    const useNature = NATURE_ENGINE_SET.has(spec.engine);
    const usePhysical = useWind || useString;
    const useExternal = usePhysical || useNature;
    if (spec.engine === "wavetable") {
      voice.osc.setPeriodicWave(makeWavetable(audioContext, spec.sharp, voice.index));
    } else if (!useNoise && !useExternal) {
      voice.osc.type = oscillatorTypeForEngine(spec.engine, voice.index);
    }
    voice.modulator.type =
      spec.engine === "fm" || spec.engine === "organ" || spec.engine === "phase_distortion"
        ? "sine"
        : "triangle";
    voice.osc.frequency.setTargetAtTime(hz, now, 0.05);
    const modRatio =
      spec.engine === "ring_mod" || spec.engine === "am"
        ? 0.5 + spec.sharp * 1.5
        : 1.5 + spec.sharp * 0.8;
    voice.modulator.frequency.setTargetAtTime(hz * modRatio, now, 0.05);
    const fmDepth =
      spec.engine === "fm"
        ? 0.35
        : spec.engine === "phase_distortion"
          ? 0.25
          : spec.engine === "ring_mod" || spec.engine === "am"
            ? 0.08
            : 0.18;
    voice.fmGain.gain.setTargetAtTime(
      spec.active && !useNoise && !useExternal ? spec.modDepth * hz * fmDepth : 0,
      now,
      0.08,
    );
    voice.selfFb.gain.setTargetAtTime(
      spec.active && !useNoise && !useExternal
        ? spec.selfFeedback * (spec.engine === "organ" ? 0.45 : 0.22)
        : 0,
      now,
      0.08,
    );
    voice.amGain.gain.setTargetAtTime(1, now, 0.05);
    voice.modAmp.gain.setTargetAtTime(
      spec.engine === "am" || spec.engine === "ring_mod" ? 0.22 + spec.sharp * 0.25 : 0,
      now,
      0.05,
    );
    const oscLevel = useNoise || useExternal ? 0.0001 : spec.engine === "vowel" ? 1.15 : 1;
    voice.oscGain.gain.setTargetAtTime(oscLevel, now, 0.05);
    const noiseLevel = useNoise && spec.active ? 0.7 + spec.sharp * 0.35 : 0.0001;
    voice.noiseGain.gain.setTargetAtTime(noiseLevel, now, 0.05);
    voice.shaper.curve = waveshapeCurve(spec.engine, spec.sharp);
    voice.filter.type = useNoise || useWind ? "bandpass" : "lowpass";
    const cutoff = filterCutoffForEngine(spec.engine, hz, spec.sharp);
    voice.baseCutoff = cutoff;
    voice.filter.frequency.setTargetAtTime(cutoff, now, 0.08);
    voice.filter.Q.setTargetAtTime(
      useNoise
        ? 0.4 + spec.sharp * 2
        : spec.engine === "acid"
          ? 4 + spec.sharp * 6
          : spec.engine === "vowel"
            ? 0.35
            : 0.6,
      now,
      0.08,
    );
    const held =
      spec.active &&
      (spec.hold === true ||
        (spec.hold !== false &&
          (patchType === "drone" ||
            patchType === "vowel_chant" ||
            patchType === "orbit" ||
            spec.engine === "violin" ||
            spec.engine === "didgeridoo" ||
            spec.engine === "forest" ||
            spec.engine === "fire" ||
            spec.engine === "dub_bass")));
    const holdPeak = spec.level * engineHoldLevel(spec.engine);
    voice.amp.gain.cancelScheduledValues(now);
    voice.amp.gain.setTargetAtTime(held && !useNature ? holdPeak : 0.0001, now, 0.15);
    voice.sharp = spec.sharp;
    voice.active = spec.active;
    voice.engine = spec.engine;
    voice.hold = Boolean(held);
    voice.vowel = spec.vowel ?? vowelFromIndex(voice.index);
    if (spec.engine === "vowel") {
      voice.formants.setVowel(voice.vowel, now);
      voice.formants.setBypass(false, now);
    } else {
      voice.formants.setBypass(true, now);
    }
    if (useWind && spec.active) {
      voice.pipe.setKind(spec.engine);
      voice.pipe.setActive(true, now);
      voice.pipe.setPitch(hz, spec.sharp, now);
      if (spec.engine === "didgeridoo") {
        voice.pipe.setVowel?.(voice.vowel, now);
      }
      voice.string.setActive(false, now);
      voice.nature.noteOff(now);
    } else if (useString && spec.active) {
      voice.string.setKind(spec.engine === "karplus" ? "karplus" : spec.engine, now);
      voice.string.setActive(true, now);
      voice.string.setPitch(hz, spec.sharp, now);
      voice.pipe.setActive(false, now);
      voice.nature.noteOff(now);
    } else if (useNature && spec.active) {
      const mode = natureModeIndex(spec.engine, spec.midi, patch?.seed ?? voice.index);
      voice.nature.setKind(spec.engine, now);
      voice.nature.setMode(mode, now);
      voice.nature.noteOn(spec.midi, Math.round((spec.level ?? 0.5) * 127), mode, now);
      if (held) {
        voice.nature.setLevel(holdPeak, now);
      }
      voice.pipe.setActive(false, now);
      voice.string.setActive(false, now);
    } else {
      voice.pipe.setActive(false, now);
      voice.string.setActive(false, now);
      voice.nature.noteOff(now);
    }
  }

  function applySection(section, now = audioContext.currentTime) {
    if (!patch?.composition || !section) {
      return;
    }
    const snapshot = mixSnapshotForSection(patch.composition, section);
    mix.applyTrackSnapshot(snapshot, now);
    mix.setReverb(section.reverb ?? patch.composition.mix.reverb, now);
    applyFeedback(section.feedback ?? patch.totalFeedback);
    sectionIndex = patch.composition.sections.indexOf(section);
  }

  return {
    voices,
    drums,
    mix,
    voiceCount: VOICE_COUNT,
    async resume() {
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
    },
    setMaster(level) {
      mix.setMaster(level);
    },
    setFeedback: applyFeedback,
    setLfo: applyLfo,
    setEnvelope(envelope) {
      if (!patch) {
        return;
      }
      patch.envelope = { ...DEFAULT_ENVELOPE, ...patch.envelope, ...envelope };
    },
    setDrumEnvelopes(next) {
      if (!patch) {
        return;
      }
      patch.drumEnvelopes = next;
      drums.setEnvelopes(next);
    },
    syncDrumEnvelopes(patternSource = "") {
      if (!patch) {
        return null;
      }
      const next = drumEnvelopesFromSeed(patch.seed >>> 0, patternSource);
      patch.drumEnvelopes = next;
      drums.setEnvelopes(next);
      return next;
    },
    setScatter(amount) {
      if (!patch?.composition?.mix) {
        return;
      }
      patch.composition.mix.scatter = amount;
      mix.setScatter(amount);
    },
    setCompress(amount) {
      if (!patch?.composition?.mix) {
        return;
      }
      patch.composition.mix.compress = amount;
      mix.setCompress(amount);
    },
    setEq(eq) {
      if (!patch?.composition?.mix) {
        return;
      }
      patch.composition.mix.eq = { ...patch.composition.mix.eq, ...eq };
      mix.setEq(patch.composition.mix.eq);
    },
    cycleTape() {
      if (!patch) {
        return { mode: "off" };
      }
      if (!patch.tapeLive) {
        patch.tapeLive = { recording: false, held: false };
      }
      if (!patch.composition) {
        return { mode: "off" };
      }
      if (!patch.composition.mix) {
        patch.composition.mix = {};
      }
      // Ensure a usable loop window even if the patch left tape at 0.
      if (!(patch.composition.mix.tape > 0.4)) {
        patch.composition.mix.tape = 4;
      }
      if (patch.composition.mix.tapeDry == null) {
        patch.composition.mix.tapeDry = 0.8;
      }
      const live = patch.tapeLive;
      if (!live.recording && !live.held) {
        live.recording = true;
        live.held = false;
      } else if (live.recording) {
        live.recording = false;
        live.held = true;
      } else {
        live.recording = false;
        live.held = false;
      }
      applyMasterFx();
      return {
        mode: live.recording ? "rec" : live.held ? "hold" : "off",
        view: mix.getTapeView(),
      };
    },
    getTapeView() {
      return mix.getTapeView();
    },
    setDelay(seconds) {
      if (!patch) {
        return;
      }
      patch.delayTime = seconds;
      const now = audioContext.currentTime;
      mix.delayA.delayTime.setTargetAtTime(seconds, now, 0.08);
      mix.delayB.delayTime.setTargetAtTime(seconds * 1.17, now, 0.08);
      mix.setGrainDelay?.(seconds, now);
      if (patch.composition?.mix?.chain) {
        patch.composition.mix.chain.delay = seconds;
      }
    },
    setDrive(amount) {
      if (!patch) {
        return;
      }
      patch.drive = amount;
      mix.drive.curve = makeSoftDriveCurve(amount);
      if (patch.composition?.mix?.chain) {
        patch.composition.mix.chain.drive = amount;
      }
      if (patch.composition?.mix?.analog) {
        mix.setAnalog({ ...patch.composition.mix.analog, drive: amount * 0.85 });
      }
    },
    setReverb(amount) {
      mix.setReverb(amount);
      if (patch?.composition?.mix) {
        patch.composition.mix.reverb = amount;
      }
    },
    setVoiceMute(index, muted) {
      voiceMute[index] = muted;
      const voice = voices[index];
      if (!voice) {
        return;
      }
      voice.output.gain.setTargetAtTime(muted ? 0.0001 : 0.7, audioContext.currentTime, 0.04);
    },
    applyPatch(nextPatch) {
      patch = nextPatch;
      if (!patch.envelope) {
        patch.envelope = { ...DEFAULT_ENVELOPE };
      }
      if (!patch.drumEnvelopes) {
        patch.drumEnvelopes = drumEnvelopesFromSeed(patch.seed >>> 0, "");
      }
      drums.setEnvelopes(patch.drumEnvelopes);
      if (!patch.tapeLive) {
        patch.tapeLive = { recording: false, held: false };
      }
      sectionIndex = -1;
      const now = audioContext.currentTime;
      if (nextPatch.composition?.mix) {
        mix.applyMix(
          {
            ...nextPatch.composition.mix,
            tapeRecording: nextPatch.tapeLive.recording,
            tapeHeld: nextPatch.tapeLive.held,
          },
          now,
        );
      }
      const analog =
        nextPatch.composition?.mix?.analog ?? nextPatch.analog ?? DEFAULT_ANALOG;
      mix.setAnalog(analog, now);
      const driftAmount = analog.drift ?? DEFAULT_ANALOG.drift;
      for (const voice of voices) {
        voice.drift?.apply(driftAmount, now);
      }
      mix.delayA.delayTime.setTargetAtTime(nextPatch.delayTime, now, 0.08);
      mix.delayB.delayTime.setTargetAtTime(nextPatch.delayTime * 1.17, now, 0.08);
      mix.drive.curve = makeSoftDriveCurve(nextPatch.drive);
      applyFeedback(nextPatch.totalFeedback);
      lfoA.type = oscillatorTypeForLfoShape(nextPatch.hyperLfo.shapeA ?? "sine");
      lfoB.type = oscillatorTypeForLfoShape(nextPatch.hyperLfo.shapeB ?? "triangle");
      lfoA.frequency.setTargetAtTime(nextPatch.hyperLfo.rateA, now, 0.08);
      lfoB.frequency.setTargetAtTime(nextPatch.hyperLfo.rateB, now, 0.08);
      lfoLink.gain.setTargetAtTime(nextPatch.hyperLfo.link ? 0.25 : 0, now, 0.08);
      routeLfoDepths(
        nextPatch.hyperLfo.depth,
        nextPatch.hyperLfo.toA ?? "pitch",
        nextPatch.hyperLfo.toB ?? "cutoff",
      );
      for (const voice of voices) {
        const spec = nextPatch.voices[voice.index] ?? {
          midi: 48 + voice.index,
          engine: "organ",
          sharp: 0.3,
          modDepth: 0.2,
          selfFeedback: 0.2,
          level: 0.4,
          active: false,
          vowel: vowelFromIndex(voice.index),
          trackIndex: indexTrack(voice.index),
        };
        configureVoice(voice, spec, nextPatch.patchType, now);
      }
      const first = nextPatch.composition?.sections?.[0];
      if (first) {
        applySection(first, now);
      }
    },
    applyCompositionBeat(beat) {
      if (!patch?.composition) {
        return null;
      }
      const located = sectionAtBeat(patch.composition, beat);
      if (located.section && located.index !== sectionIndex) {
        applySection(located.section);
        return located.section;
      }
      return null;
    },
    /**
     * Continuous generative mix: track levels/pans/sends drift over time.
     * Court rests prefer delay/reverb tails; rare gaps mute fully and briefly.
     */
    applyLiveMix({
      beat = 0,
      elapsedSeconds = 0,
      weather = null,
      silent = false,
      silenceMode = null,
    } = {}) {
      const mode = silenceMode ?? (silent ? "tail" : "open");
      if (!patch?.composition) {
        mix.setCourtGate(mode === "gap" ? 0.02 : 1, audioContext.currentTime, 0.08);
        return;
      }
      const now = audioContext.currentTime;
      const snapshot = liveMixSnapshot(patch.composition, {
        beat,
        elapsedSeconds,
        weather,
        seed: patch.seed,
        silenceMode: mode,
      });
      mix.applyTrackSnapshot(snapshot, now);
      const globals = liveMixGlobals(patch.composition, { weather, silenceMode: mode });
      mix.setReverb(globals.reverb, now);
      mix.wetFilter.frequency.setTargetAtTime(globals.filterHz, now, 0.15);
      mix.setDryWet(globals.dry ?? 0.55, globals.wet, now);
      applyFeedback(globals.feedback);
      mix.setCourtGate(globals.courtGate ?? 1, now, mode === "gap" ? 0.04 : 0.1);
      for (const voice of voices) {
        if (!voice.active) {
          continue;
        }
        if (mode === "tail" || mode === "gap") {
          // Cut dry energy; court FX keeps ringing. Hard-choke waveguides so
          // idle delay loops cannot feed the bus under a ducked amp.
          voice.amp.gain.setTargetAtTime(0.0001, now, mode === "gap" ? 0.04 : 0.1);
          voice.pipe.setActive(false, now);
          voice.string.setActive(false, now);
          voice.nature.noteOff(now);
        } else if (voice.hold) {
          const level =
            (patch.voices[voice.index]?.level ?? 0.5) * engineHoldLevel(voice.engine);
          voice.amp.gain.setTargetAtTime(
            NATURE_ENGINE_SET.has(voice.engine) ? 0.0001 : level,
            now,
            0.14,
          );
          if (WIND_ENGINES.has(voice.engine)) {
            voice.pipe.setActive(true, now);
            voice.pipe.setPitch(voice.baseHz || 220, voice.sharp ?? 0.4, now);
            voice.nature.noteOff(now);
          } else if (STRING_ENGINES.has(voice.engine)) {
            voice.string.setActive(true, now);
            voice.string.setPitch(voice.baseHz || 220, voice.sharp ?? 0.4, now);
            voice.nature.noteOff(now);
          } else if (NATURE_ENGINE_SET.has(voice.engine)) {
            voice.nature.setLevel(level, now);
            voice.pipe.setActive(false, now);
            voice.string.setActive(false, now);
          } else {
            voice.pipe.setActive(false, now);
            voice.string.setActive(false, now);
            voice.nature.noteOff(now);
          }
        } else if (
          !WIND_ENGINES.has(voice.engine) &&
          !STRING_ENGINES.has(voice.engine) &&
          !NATURE_ENGINE_SET.has(voice.engine)
        ) {
          // Non-physical engines must never leave waveguides open into amp.
          voice.pipe.setActive(false, now);
          voice.string.setActive(false, now);
          voice.nature.noteOff(now);
        }
      }
    },
    setCourtSilence(silent) {
      this.applyLiveMix({
        beat: 0,
        elapsedSeconds: audioContext.currentTime,
        weather: null,
        silenceMode: silent ? "tail" : "open",
      });
    },
    onOccupancy({ held, airborne, ballCount, state, hand = 1, objectIndex = 0 }) {
      if (!patch) {
        return;
      }
      const now = audioContext.currentTime;
      const sign = state || occupancySign(held, airborne, ballCount);
      const edge = lastOccupancyState && lastOccupancyState !== sign;
      const sustain = modMatrixCombine({
        state: sign,
        objectCount: ballCount || 3,
        objectIndex,
        hand,
        dwellPhase: ballCount > 0 ? held / ballCount : 0.5,
        transition: edge ? MOD_STATE_EDGE : MOD_SUSTAIN,
      });
      applyFeedback(
        clamp(patch.totalFeedback * (0.55 + sustain.feedback * 0.55), 0.05, 0.85),
      );
      routeLfoDepths(
        patch.hyperLfo.depth * (0.5 + sustain.cutoff * 0.9),
        patch.hyperLfo.toA ?? "pitch",
        patch.hyperLfo.toB ?? "cutoff",
      );
      if (edge && sustain.audible) {
        triggerVoiceBurst(
          voices,
          patch,
          voiceMute,
          Math.max(0, held - 1),
          now,
          0.2 + sustain.burstGain * 0.35,
        );
      } else if (held > lastHeld) {
        triggerVoiceBurst(voices, patch, voiceMute, held - 1, now, 0.35);
      }
      lastHeld = held;
      lastOccupancyState = sign;
      for (const voice of voices) {
        if (!voice.active) {
          continue;
        }
        const detune =
          sustain.detune * 18 * (voice.index % 2 === 0 ? 1 : -1);
        voice.osc.detune.setTargetAtTime(detune, now, 0.05);
        if (voice.filter?.frequency) {
          voice.filter.frequency.setTargetAtTime(
            420 + sustain.cutoff * 2400,
            now,
            0.08,
          );
        }
        if (voice.engine === "vowel" && patch.patchType === "vowel_chant") {
          voice.formants.setVowel(vowelFromIndex(held + voice.index), now);
        }
      }
    },
    triggerThrow(handIndex, height, time = audioContext.currentTime) {
      if (!patch) {
        return;
      }
      const mod = modMatrixCombine({
        state: lastOccupancyState || OCC_MIXED,
        objectCount: Math.max(3, height),
        objectIndex: height % 7,
        hand: handIndex,
        dwellPhase: 0,
        transition: MOD_THROW,
      });
      const active = voices.filter((voice) => voice.active && !voiceMute[voice.index]);
      const pool = active.length > 0 ? active : voices;
      const voice = pool[((handIndex + height) % pool.length + pool.length) % pool.length];
      if (!voice || voiceMute[voice.index] || !mod.audible) {
        return;
      }
      const duration = clamp(
        0.18 + height * 0.06 + mod.burstGain * 0.2,
        0.16,
        patch.patchType === "stutter" ? 0.35 : 0.95,
      );
      if (voice.osc?.detune) {
        voice.osc.detune.setTargetAtTime(mod.detune * 22 * (handIndex === 0 ? -1 : 1), time, 0.03);
      }
      if (voice.engine === "vowel") {
        voice.formants.setVowel(vowelFromIndex(height + handIndex), time);
      }
      if (voice.engine === "granular") {
        triggerGrains(audioContext, voice, patch, time, duration, height);
        return;
      }
      triggerVoiceBurst(voices, patch, voiceMute, voice.index, time, duration);
      if (patch.fmStructure === "tree" && !voiceMute[(voice.index + 1) % VOICE_COUNT]) {
        triggerVoiceBurst(
          voices,
          patch,
          voiceMute,
          (voice.index + 1) % VOICE_COUNT,
          time + 0.02,
          duration * 0.75,
        );
      }
      if (patch.patchType === "cascade_choir") {
        triggerVoiceBurst(
          voices,
          patch,
          voiceMute,
          (voice.index + 3) % VOICE_COUNT,
          time + 0.03,
          duration * 0.65,
        );
      }
    },
    /** Fire one or more concrete voice indexes (keyboard roles). */
    triggerKeyVoices(voiceIndexes, height = 4, time = audioContext.currentTime) {
      if (!patch || !Array.isArray(voiceIndexes) || voiceIndexes.length === 0) {
        return;
      }
      const duration = clamp(0.28 + height * 0.05, 0.22, 1.05);
      voiceIndexes.forEach((index, order) => {
        const voice = voices[((index % VOICE_COUNT) + VOICE_COUNT) % VOICE_COUNT];
        if (!voice || voiceMute[voice.index]) {
          return;
        }
        const start = time + order * 0.012;
        if (voice.engine === "granular") {
          triggerGrains(audioContext, voice, patch, start, duration, height);
          return;
        }
        if (voice.engine === "vowel") {
          voice.formants.setVowel(vowelFromIndex(height + voice.index), start);
        }
        triggerVoiceBurst(voices, patch, voiceMute, voice.index, start, duration);
      });
    },
    triggerGenNote(midi, velocity = 100, time = audioContext.currentTime, trackHint = null) {
      if (!patch) {
        return;
      }
      const trackIndex = trackHint ?? (midi < 48 ? 0 : midi < 60 ? 2 : 1);
      const preferred =
        patch.composition?.tracks?.[trackIndex]?.voiceIndexes
          ?.map((index) => voices[index])
          .filter((voice) => voice && voice.active && !voiceMute[voice.index]) ?? [];
      const fallback = voices.filter((voice) => voice.active && !voiceMute[voice.index]);
      const pool = preferred.length > 0 ? preferred : fallback.length > 0 ? fallback : voices;
      const voice = pool[(midi + patch.seed) % pool.length];
      if (!voice) {
        return;
      }
      const hz = midiToHz(midi);
      voice.baseHz = hz;
      voice.osc.frequency.setTargetAtTime(hz, time, 0.04);
      voice.modulator.frequency.setTargetAtTime(hz * (1.5 + voice.sharp * 0.8), time, 0.04);
      if (WIND_ENGINES.has(voice.engine)) {
        voice.pipe.setKind(voice.engine);
        voice.pipe.setPitch(hz, voice.sharp ?? 0.4, time);
      }
      if (STRING_ENGINES.has(voice.engine)) {
        voice.string.setKind(voice.engine === "karplus" ? "karplus" : voice.engine, time);
        voice.string.setPitch(hz, voice.sharp ?? 0.4, time);
      }
      if (NATURE_ENGINE_SET.has(voice.engine)) {
        voice.nature.setKind(voice.engine, time);
        voice.nature.setMode(natureModeIndex(voice.engine, midi, patch.seed), time);
      }
      if (voice.engine === "vowel") {
        voice.formants.setVowel(vowelFromIndex(midi), time);
      }
      if (voice.engine === "granular") {
        triggerGrains(audioContext, voice, patch, time, 0.35, midi % 7);
        return;
      }
      const duration = clamp(0.28 + (velocity / 127) * 0.55, 0.25, 1.1);
      triggerVoiceBurst(voices, patch, voiceMute, voice.index, time, duration);
    },
    triggerDrum(part, velocity = 100, time = audioContext.currentTime) {
      drums.trigger(part, time, velocity);
      if (typeof mix.pulseSidechain === "function") {
        const kickWeight = part === "kick" ? 1 : part === "snare" ? 0.75 : 0.4;
        mix.pulseSidechain((velocity / 127) * kickWeight, time);
      }
    },
    getSectionIndex() {
      return sectionIndex;
    },
  };
}

function indexTrack(voiceIndex) {
  return Math.min(3, Math.floor(voiceIndex / 3));
}

function createVoice(audioContext, index) {
  const osc = audioContext.createOscillator();
  const modulator = audioContext.createOscillator();
  const fmGain = audioContext.createGain();
  const selfFb = audioContext.createGain();
  const amGain = audioContext.createGain();
  const modAmp = audioContext.createGain();
  const oscGain = audioContext.createGain();
  const noiseGain = audioContext.createGain();
  const shaper = audioContext.createWaveShaper();
  const filter = audioContext.createBiquadFilter();
  const amp = audioContext.createGain();
  const levelMod = audioContext.createGain();
  const output = audioContext.createGain();
  const formants = createFormantBank(audioContext);
  const pipe = createPipeVoice(audioContext, "pipe");
  const string = createStringVoice(audioContext, "guitar");
  const nature = createNatureVoice(audioContext, "forest");
  const noise = audioContext.createBufferSource();
  noise.buffer = createNoiseBuffer(audioContext);
  noise.loop = true;
  osc.type = index % 2 === 0 ? "triangle" : "sawtooth";
  modulator.type = "sine";
  amp.gain.value = 0.0001;
  levelMod.gain.value = 1;
  output.gain.value = 0.72;
  fmGain.gain.value = 0;
  selfFb.gain.value = 0;
  amGain.gain.value = 1;
  modAmp.gain.value = 0;
  oscGain.gain.value = 1;
  noiseGain.gain.value = 0.0001;
  filter.type = "lowpass";
  filter.frequency.value = 4200;
  shaper.curve = waveshapeCurve("organ", 0.3);
  shaper.oversample = "4x";
  modulator.connect(fmGain);
  fmGain.connect(osc.frequency);
  modulator.connect(modAmp);
  modAmp.connect(amGain.gain);
  osc.connect(oscGain);
  oscGain.connect(shaper);
  noise.connect(noiseGain);
  noiseGain.connect(shaper);
  shaper.connect(amGain);
  amGain.connect(filter);
  filter.connect(formants.input);
  formants.output.connect(amp);
  pipe.output.connect(amp);
  string.output.connect(amp);
  nature.output.connect(amp);
  amp.connect(levelMod);
  levelMod.connect(output);
  amp.connect(selfFb);
  selfFb.connect(osc.frequency);
  osc.start();
  modulator.start();
  noise.start();
  return {
    index,
    trackIndex: indexTrack(index),
    osc,
    noise,
    oscGain,
    noiseGain,
    modulator,
    fmGain,
    selfFb,
    amGain,
    modAmp,
    shaper,
    filter,
    amp,
    levelMod,
    output,
    formants,
    pipe,
    string,
    nature,
    baseHz: 110,
    baseCutoff: 4200,
    active: false,
    sharp: 0.3,
    engine: "organ",
    vowel: vowelFromIndex(index),
  };
}

function createNoiseBuffer(audioContext) {
  const length = audioContext.sampleRate * 2;
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

function wirePairFm(voices) {
  for (let index = 0; index < voices.length; index += 2) {
    const a = voices[index];
    const b = voices[index + 1];
    if (!a || !b) {
      continue;
    }
    const gain = a.output.context.createGain();
    gain.gain.value = 6;
    a.osc.connect(gain);
    gain.connect(b.osc.frequency);
    const back = b.output.context.createGain();
    back.gain.value = 4;
    b.osc.connect(back);
    back.connect(a.osc.frequency);
  }
}

function triggerVoiceBurst(voices, patch, voiceMute, voiceIndex, time, duration) {
  const count = voices.length;
  const voice = voices[((voiceIndex % count) + count) % count];
  if (!voice || voiceMute[voice.index]) {
    return;
  }
  const oneshot =
    patch.patchType === "jingle" ||
    patch.patchType === "stutter" ||
    patch.patchType === "call_response" ||
    patch.patchType === "euclid_groove" ||
    patch.patchType === "atlas_drums" ||
    patch.patchType === "turing_line" ||
    patch.patchType === "markov_walk";
  if (!voice.active && !oneshot) {
    return;
  }
  const level = patch.voices[voice.index]?.level ?? 0.5;
  const peak = level * engineBurstLevel(voice.engine);
  const envelope = { ...DEFAULT_ENVELOPE, ...patch.envelope };
  const physical = WIND_ENGINES.has(voice.engine) || STRING_ENGINES.has(voice.engine);
  const nature = NATURE_ENGINE_SET.has(voice.engine);
  const attack = physical || nature
    ? Math.min(0.04, envelope.attack)
    : Math.max(0.005, envelope.attack);
  const decay = Math.max(0.02, envelope.decay);
  const sustain = clamp(envelope.sustain, 0.05, 1);
  const release = Math.max(0.08, envelope.release, duration * 0.45);
  if (nature) {
    const midi = patch.voices[voice.index]?.midi ?? 48;
    const mode = natureModeIndex(voice.engine, midi, patch.seed ?? voice.index);
    voice.nature.setKind(voice.engine, time);
    voice.nature.setMode(mode, time);
    voice.nature.noteOn(midi, Math.round(peak * 127), mode, time);
    if (!voice.hold) {
      voice.nature.noteOff(time + attack + decay + release);
    }
    return;
  }
  const current = Math.max(voice.amp.gain.value, 0.0001);
  voice.amp.gain.cancelScheduledValues(time);
  voice.amp.gain.setValueAtTime(current, time);
  voice.amp.gain.linearRampToValueAtTime(peak, time + attack);
  voice.amp.gain.linearRampToValueAtTime(peak * sustain, time + attack + decay);
  const filterEnv = clamp(envelope.filterEnv ?? 0, 0, 1);
  const baseCutoff = voice.baseCutoff || 4200;
  if (filterEnv > 0.02 && !physical) {
    const open = baseCutoff * (1 + filterEnv * 2.4);
    voice.filter.frequency.cancelScheduledValues(time);
    voice.filter.frequency.setValueAtTime(Math.max(voice.filter.frequency.value, baseCutoff * 0.7), time);
    voice.filter.frequency.linearRampToValueAtTime(open, time + attack);
    voice.filter.frequency.linearRampToValueAtTime(baseCutoff, time + attack + decay + release * 0.5);
  }
  if (WIND_ENGINES.has(voice.engine)) {
    voice.pipe.setKind(voice.engine);
    voice.pipe.setActive(true, time);
    voice.pipe.setPitch(voice.baseHz || 220, voice.sharp ?? 0.4, time);
    voice.pipe.pluck(time, level);
  } else if (STRING_ENGINES.has(voice.engine)) {
    voice.string.setKind(voice.engine === "karplus" ? "karplus" : voice.engine, time);
    voice.string.setActive(true, time);
    voice.string.setPitch(voice.baseHz || 220, voice.sharp ?? 0.4, time);
    voice.string.pluck(time, level);
  }
  if (voice.hold) {
    voice.amp.gain.setTargetAtTime(peak * sustain * 0.85, time + attack + decay, 0.2);
  } else {
    voice.amp.gain.linearRampToValueAtTime(0.0001, time + attack + decay + release);
  }
}

function triggerGrains(audioContext, voice, patch, time, duration, height) {
  const grainCount = 4 + (height % 5);
  const base = voice.baseHz || 110;
  const level = (patch.voices[voice.index]?.level ?? 0.5) * 0.42;
  const body = Math.max(voice.amp.gain.value, 0.0001);
  voice.amp.gain.cancelScheduledValues(time);
  voice.amp.gain.setValueAtTime(body, time);
  voice.amp.gain.linearRampToValueAtTime(level * 1.1, time + 0.02);
  voice.amp.gain.linearRampToValueAtTime(0.0001, time + Math.max(0.18, duration));
  for (let index = 0; index < grainCount; index += 1) {
    const start = time + index * 0.024;
    const osc = audioContext.createOscillator();
    const amp = audioContext.createGain();
    osc.type = index % 2 === 0 ? "sine" : "triangle";
    osc.frequency.value = base * (0.85 + (index % 3) * 0.22);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(level, start + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + Math.min(0.08, duration * 0.4));
    osc.connect(amp);
    amp.connect(voice.output);
    osc.start(start);
    osc.stop(start + 0.1);
  }
}

function engineHoldLevel(engine) {
  switch (engine) {
    case "vowel":
      return 0.62;
    case "violin":
    case "didgeridoo":
      return 0.38;
    case "pipe":
    case "saxophone":
      return 0.32;
    case "guitar":
    case "piano":
    case "karplus":
      return 0.22;
    case "vargan":
      return 0.18;
    case "additive":
    case "organ":
      return 0.42;
    case "granular":
      return 0.28;
    case "forest":
    case "fire":
      return 0.4;
    case "dub_bass":
      return 0.5;
    case "bubble":
      return 0.3;
    case "bird":
    case "dolphin":
      return 0.22;
    default:
      return 0.34;
  }
}

function engineBurstLevel(engine) {
  switch (engine) {
    case "vowel":
      return 0.85;
    case "pipe":
    case "saxophone":
    case "didgeridoo":
      return 0.48;
    case "guitar":
    case "piano":
    case "karplus":
    case "vargan":
      return 0.55;
    case "violin":
      return 0.5;
    case "additive":
    case "wavetable":
      return 0.7;
    case "ring_mod":
    case "am":
      return 0.68;
    case "granular":
      return 0.55;
    case "noise":
      return 0.6;
    case "dub_bass":
      return 0.72;
    case "bird":
    case "dolphin":
      return 0.62;
    case "bubble":
      return 0.5;
    case "forest":
    case "fire":
      return 0.45;
    default:
      return 0.48;
  }
}

function oscillatorTypeForEngine(engine, index) {
  switch (engine) {
    case "subtractive":
    case "supersaw":
    case "acid":
    case "vowel":
    case "waveshape":
      return "sawtooth";
    case "noise":
    case "pwm":
      return "square";
    case "pipe":
    case "saxophone":
    case "didgeridoo":
    case "vargan":
      return "triangle";
    case "karplus":
    case "guitar":
    case "violin":
    case "piano":
    case "additive":
    case "phase_distortion":
    case "granular":
    case "ring_mod":
    case "am":
      return "sine";
    case "fm":
      return index % 2 === 0 ? "sine" : "triangle";
    case "wavetable":
      return "sine";
    default:
      return index % 2 === 0 ? "triangle" : "square";
  }
}

function filterCutoffForEngine(engine, hz, sharp) {
  if (engine === "acid" || engine === "subtractive") {
    return hz * (2 + sharp * 8);
  }
  if (engine === "noise") {
    return 800 + sharp * 5500;
  }
  if (engine === "pwm") {
    return 1800 + sharp * 4000;
  }
  if (engine === "vowel") {
    return 9000 + sharp * 2000;
  }
  if (engine === "dub_bass") {
    return 180 + sharp * 900;
  }
  if (engine === "forest" || engine === "bubble" || engine === "fire") {
    return 700 + sharp * 2800;
  }
  if (engine === "bird" || engine === "dolphin") {
    return hz * (2.5 + sharp * 4);
  }
  if (WIND_ENGINES.has(engine) || STRING_ENGINES.has(engine)) {
    return hz * (2.2 + sharp * 3);
  }
  if (engine === "additive" || engine === "wavetable") {
    return 7000 + sharp * 3500;
  }
  return 5200 + sharp * 4000;
}

function waveshapeCurve(engine, sharp) {
  const samples = 512;
  const curve = new Float32Array(samples);
  const amount = 0.2 + sharp * 0.8;
  for (let index = 0; index < samples; index += 1) {
    const x = (index * 2) / (samples - 1) - 1;
    if (engine === "waveshape" || engine === "phase_distortion") {
      const folded = Math.sin((Math.PI / 2) * x * (1 + amount * 3));
      // Soft fold + slight even tilt — less brittle than pure hard fold.
      const shaped = Math.tanh(folded * (1 + amount * 1.6));
      curve[index] = shaped + 0.06 * amount * x * x;
    } else if (engine === "organ" || engine === "subtractive" || engine === "supersaw") {
      // Gentle always-on sat so clean engines are not perfectly digital.
      curve[index] = Math.tanh(x * (1.05 + amount * 0.35));
    } else {
      curve[index] = Math.tanh(x * 1.08);
    }
  }
  return curve;
}

function makeWavetable(audioContext, sharp, index) {
  const size = 32;
  const real = new Float32Array(size);
  const imag = new Float32Array(size);
  real[0] = 0;
  for (let harmonic = 1; harmonic < size; harmonic += 1) {
    const fall = 1 / (harmonic ** (0.6 + sharp));
    real[harmonic] = ((index + harmonic) % 2 === 0 ? 1 : -1) * fall * (1 - sharp * 0.4);
    imag[harmonic] = Math.sin(harmonic * sharp * Math.PI) * fall * 0.5;
  }
  return audioContext.createPeriodicWave(real, imag, { disableNormalization: false });
}

