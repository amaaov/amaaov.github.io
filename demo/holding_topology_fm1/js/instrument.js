import { courtPicture } from "../../../pages/20260819100800_grip_algebra/toss.js";
import { schedulePlayable } from "../../../pages/20260819100800_grip_algebra/siteswap_episode.js";
import {
  createDistinctRndPatch,
  createRndPatch,
  regenerateHandStyle,
  regenerateTricks,
  uniqueSeed,
  SCALE_NAMES,
  PATCH_TYPES,
  SCALES,
  GENERATIVE_PATCH_TYPES,
} from "./rnd_patch.js";
import { degreeToMidi, isMicrotonalScale } from "./ht_tuning.js";
import { createLyraSynth } from "./lyra_synth.js";
import {
  advanceTrickSequencer,
  createTrickSequencer,
  currentTrick,
  currentTrickBeats,
  currentTrickEntry,
} from "./trick_sequencer.js";
import { MAX_WAIT_SECONDS, isRestTrick } from "./siteswap_episode.js";
import {
  DEFAULT_CONTROLS,
  bpmFromTempoKnob,
  tempoKnobFromBpm,
  delayFromFxKnob,
  driveFromEditKnob,
  dwellFromEnvKnob,
  envelopeFromEnvKnob,
  feedbackFromKnob,
  lfoDepthFromKnob,
  lfoDestinationFromKnob,
  lfoShapeFromKnob,
  objectCountFromSiteswapKnob,
  patchTypeFromAlgorithm,
  scaleIndexFromPresets,
  scatterFromFxKnob,
  wildnessFromGloKnob,
} from "./control_map.js";
import { createPixelCourt } from "./pixel_court.js";
import {
  cosmologyShouldAppear,
  cosmologyState,
} from "./cosmology.js";
import { sectionAtBeat } from "./mix_composition.js";
import { createKeyMap, describeKeyRole, KEY_MIDI_COUNT } from "./key_roles.js";
import { createActionLooper } from "./action_looper.js";

export function createInstrument({ face, statusNode, seedNode, sampleRate } = {}) {
  const controls = structuredClone(DEFAULT_CONTROLS);
  const court = createPixelCourt(face.screen);
  const actionLooper = createActionLooper({ seed: 1 });
  const state = {
    patch: null,
    sequencer: null,
    synth: null,
    audio: null,
    outputBus: null,
    beat: 0,
    lastFrame: 0,
    startedAt: performance.now(),
    firedBeats: new Set(),
    running: true,
    seedLocked: false,
    soundLocks: false,
    cosmology: false,
    reaction: "",
    lastLivePicture: null,
    waitStartedAt: 0,
    keyMap: createKeyMap(1),
    keyPulseTimers: new Map(),
  };

  function syncFaceKnobs() {
    face.setKnobValue("MASTER", controls.master);
    face.setKnobValue("SELECT", controls.select);
    face.setKnobValue("PRESETS", controls.presets);
    face.setKnobValue("ALGORITHM", controls.algorithm);
    face.setKnobValue("KNOB1", controls.knob1);
    face.setKnobValue("KNOB2", controls.knob2);
    face.setKnobValue("KNOB3", controls.knob3);
    face.setKnobValue("KNOB4", controls.knob4);
  }

  function announce(message) {
    state.reaction = message;
    if (statusNode) {
      statusNode.textContent = message;
    }
  }

  function updateSeedLabel() {
    if (!seedNode || !state.patch) {
      return;
    }
    const gen = state.patch.genKind ? ` · ${state.patch.genKind}` : "";
    const profile = state.patch.timbreProfile ? ` · ${state.patch.timbreProfile}` : "";
    const tracks = state.patch.composition
      ? ` · ${state.patch.composition.activeTracks}tr`
      : "";
    seedNode.textContent = `seed ${state.patch.seed.toString(16)} · ${state.patch.scaleName} · ${state.patch.patchType}${profile}${gen}${tracks}`;
  }

  async function ensureAudio() {
    if (state.audio) {
      await state.synth.resume();
      return;
    }
    const Context = window.AudioContext || window.webkitAudioContext;
    const audio = sampleRate ? new Context({ sampleRate }) : new Context();
    const outputBus = audio.createGain();
    outputBus.gain.value = 1;
    outputBus.connect(audio.destination);
    state.audio = audio;
    state.outputBus = outputBus;
    state.synth = createLyraSynth(audio, { destination: outputBus });
    await state.synth.resume();
    if (state.patch) {
      state.synth.applyPatch(state.patch);
    }
    applyLiveSound();
  }

  function biasFromControls() {
    const lfoTo = lfoDestinationFromKnob(controls.lfo);
    return {
      wildness: Math.max(0.55, wildnessFromGloKnob(controls.glo)),
      // Prefer, do not lock — PLAY must roam 3…7 objects.
      objectCountPrefer: objectCountFromSiteswapKnob(controls.knob3),
      throwBias: controls.knob3,
      bpm: bpmFromTempoKnob(controls.knob4),
      dwellRatio: dwellFromEnvKnob(controls.env),
      envAmount: controls.env,
      totalFeedback: feedbackFromKnob(controls.knob1),
      lfoDepth: lfoDepthFromKnob(controls.knob2),
      lfoTo,
      lfoToB: lfoDestinationFromKnob((controls.lfo + 0.35) % 1),
      lfoShape: lfoShapeFromKnob(controls.lfo),
      lfoShapeB: lfoShapeFromKnob((controls.lfo + 0.5) % 1),
      delayTime: delayFromFxKnob(controls.fx),
      scatter: scatterFromFxKnob(controls.fx),
      drive: driveFromEditKnob(controls.edit),
      patchType: patchTypeFromAlgorithm(controls.algorithm),
      scaleName: SCALE_NAMES[scaleIndexFromPresets(controls.presets, SCALE_NAMES.length)],
    };
  }

  function applyLiveSound() {
    if (!state.synth || !state.patch) {
      return;
    }
    // Live performance knobs only — do not overwrite generated patchType / scale / profile.
    state.patch.bpm = bpmFromTempoKnob(controls.knob4);
    state.patch.dwellRatio = dwellFromEnvKnob(controls.env);
    state.synth.setEnvelope(envelopeFromEnvKnob(controls.env));
    state.synth.setMaster(controls.master);
    state.synth.setFeedback(feedbackFromKnob(controls.knob1));
    const lfoTo = lfoDestinationFromKnob(controls.lfo);
    state.synth.setLfo(
      lfoDepthFromKnob(controls.knob2),
      0.08 + controls.lfo * 2.2,
      0.05 + controls.lfo * 1.6,
      controls.lfo > 0.5,
      {
        toA: lfoTo,
        toB: lfoDestinationFromKnob((controls.lfo + 0.35) % 1),
        shapeA: lfoShapeFromKnob(controls.lfo),
        shapeB: lfoShapeFromKnob((controls.lfo + 0.5) % 1),
      },
    );
    state.synth.setDelay(delayFromFxKnob(controls.fx));
    state.synth.setScatter(scatterFromFxKnob(controls.fx));
    state.synth.setDrive(driveFromEditKnob(controls.edit));
    controls.voiceMute.forEach((muted, index) => state.synth.setVoiceMute(index, muted));
  }

  function rebuildKeyMap(seed) {
    state.keyMap = createKeyMap(seed >>> 0);
    for (const timer of state.keyPulseTimers.values()) {
      clearTimeout(timer);
    }
    state.keyPulseTimers.clear();
    for (let midi = 0; midi < KEY_MIDI_COUNT; midi += 1) {
      const role = state.keyMap[midi];
      const lit =
        role &&
        (role.kind === "play" ||
          role.kind === "combo" ||
          role.kind === "burst" ||
          role.kind === "mute");
      face.setKeyLit(midi, Boolean(lit));
    }
  }

  function clampControl(value) {
    return Math.min(1, Math.max(0, value));
  }

  function nudgeKeyParam(param) {
    const { id, delta, mode } = param;
    const pulse = mode === "pulse" ? delta * 1.6 : delta;
    switch (id) {
      case "feedback":
        controls.knob1 = clampControl(controls.knob1 + pulse);
        break;
      case "lfoDepth":
        controls.knob2 = clampControl(controls.knob2 + pulse);
        break;
      case "tempo":
        controls.knob4 = clampControl(controls.knob4 + pulse);
        break;
      case "delay":
      case "scatter":
        controls.fx = clampControl(controls.fx + pulse);
        break;
      case "drive":
        controls.edit = clampControl(controls.edit + pulse);
        break;
      case "master":
        controls.master = clampControl(controls.master + pulse * 0.7);
        break;
      case "env":
        controls.env = clampControl(controls.env + pulse);
        break;
      case "wild":
        controls.glo = clampControl(controls.glo + pulse);
        break;
      case "reverb":
        if (state.patch?.composition?.mix) {
          const next = Math.min(
            0.95,
            Math.max(0.02, (state.patch.composition.mix.reverb ?? 0.3) + pulse),
          );
          state.patch.composition.mix.reverb = next;
          state.synth?.setReverb(next);
        }
        return;
      case "compress":
        if (state.patch?.composition?.mix) {
          const next = clampControl((state.patch.composition.mix.compress ?? 0.45) + pulse);
          state.patch.composition.mix.compress = next;
          state.synth?.setCompress(next);
        }
        return;
      case "eqHigh":
        if (state.patch?.composition?.mix) {
          const eq = state.patch.composition.mix.eq ?? {};
          const next = clampControl((eq.eqHighs ?? 0.5) + pulse);
          state.patch.composition.mix.eq = { ...eq, eqHighs: next };
          state.synth?.setEq(state.patch.composition.mix.eq);
        }
        return;
      default:
        return;
    }
    syncFaceKnobs();
    applyLiveSound();
  }

  function applyKeyRole(role) {
    if (!role) {
      return;
    }
    if (role.kind === "mute" && role.voices.length > 0) {
      const voice = role.voices[0];
      controls.voiceMute[voice] = !controls.voiceMute[voice];
      state.synth?.setVoiceMute(voice, controls.voiceMute[voice]);
      face.setKeyLit(role.midi, !controls.voiceMute[voice]);
      announce(
        controls.voiceMute[voice]
          ? `mute V${voice + 1}`
          : `V${voice + 1} on · ${describeKeyRole(role)}`,
      );
      return;
    }
    for (const param of role.params) {
      nudgeKeyParam(param);
      if (param.mode === "pulse") {
        const restore = -param.delta * 1.6;
        const existing = state.keyPulseTimers.get(`${role.midi}:${param.id}`);
        if (existing) {
          clearTimeout(existing);
        }
        state.keyPulseTimers.set(
          `${role.midi}:${param.id}`,
          setTimeout(() => {
            nudgeKeyParam({ ...param, delta: restore, mode: "nudge" });
            state.keyPulseTimers.delete(`${role.midi}:${param.id}`);
          }, 280),
        );
      }
    }
    if (role.voices.length > 0) {
      state.synth?.triggerKeyVoices(role.voices, role.height);
    }
    face.setKeyLit(role.midi, true);
    const flash = setTimeout(() => {
      const keep =
        role.kind === "play" ||
        role.kind === "combo" ||
        role.kind === "burst" ||
        (role.kind === "mute" && !controls.voiceMute[role.voices[0]]);
      face.setKeyLit(role.midi, Boolean(keep));
    }, 140);
    state.keyPulseTimers.set(`lit:${role.midi}`, flash);
    announce(describeKeyRole(role));
  }

  function applyPatch(patch, { keepKnobs = true } = {}) {
    state.patch = patch;
    state.sequencer = createTrickSequencer(patch.tricks, patch.beatsPerTrick);
    state.beat = 0;
    state.startedAt = performance.now();
    state.firedBeats = new Set();
    state.running = true;
    state.cosmology = cosmologyShouldAppear(
      patch.seed,
      wildnessFromGloKnob(controls.glo),
    );
    rebuildKeyMap(patch.seed);
    actionLooper.rebind(patch.seed ^ 0xa71c);
    court.clearTrails();
    if (!keepKnobs) {
      controls.knob1 = patch.totalFeedback;
      controls.knob2 = patch.hyperLfo.depth;
      controls.knob3 = (patch.objectCount - 3) / 4;
      controls.knob4 = tempoKnobFromBpm(patch.bpm);
      controls.env = (patch.dwellRatio - 0.28) / 0.4;
      controls.fx = (patch.delayTime - 0.08) / 0.7;
      controls.edit = (patch.drive - 0.05) / 0.9;
      controls.algorithm = PATCH_TYPES.indexOf(patch.patchType) / Math.max(1, PATCH_TYPES.length - 1);
      controls.presets = SCALE_NAMES.indexOf(patch.scaleName) / Math.max(1, SCALE_NAMES.length - 1);
      syncFaceKnobs();
    }
    if (state.synth) {
      state.synth.applyPatch(patch);
      applyLiveSound();
    }
    updateSeedLabel();
    announce(
      `${patch.objectCount} props · ${formatTrickAnnouncement(currentTrickEntry(state.sequencer), state.cosmology)} · ${patch.patchType}`,
    );
    face.setButtonLit("SAVE", state.seedLocked);
    face.setButtonLit("PLAY", true);
    face.setButtonLit("SEL", state.cosmology);
  }

  async function newPatch({ soundOnly = false } = {}) {
    await ensureAudio();
    const bias = biasFromControls();
    if (soundOnly && state.patch) {
      const next = createDistinctRndPatch(
        uniqueSeed(),
        {
          ...bias,
          objectCount: state.patch.objectCount,
          lockObjectCount: true,
        },
        state.patch,
      );
      next.tricks = state.patch.tricks;
      next.objectCount = state.patch.objectCount;
      applyPatch(next, { keepKnobs: false });
      announce(`sound ${next.seed.toString(16)}`);
      return;
    }
    if (state.seedLocked && state.patch) {
      // Locked seed keeps tricks; PLAY regenerates sound only.
      return newPatch({ soundOnly: true });
    }
    applyPatch(createDistinctRndPatch(uniqueSeed(), bias, state.patch), { keepKnobs: false });
  }

  function reshuffleTricks() {
    if (!state.patch) {
      return;
    }
    state.patch.objectCount = objectCountFromSiteswapKnob(controls.knob3);
    const seedExtra = uniqueSeed();
    state.patch.tricks = regenerateTricks(state.patch, seedExtra, controls.knob3);
    state.patch.handStyle = regenerateHandStyle(state.patch, seedExtra ^ 0x51e);
    state.sequencer = createTrickSequencer(state.patch.tricks, state.patch.beatsPerTrick);
    state.firedBeats.clear();
    const nextTrick = currentTrick(state.sequencer);
    if (!isRestTrick(nextTrick)) {
      state.synth?.syncDrumEnvelopes?.(nextTrick);
    }
    announce(`tricks → ${nextTrick}`);
  }

  function resequenceOnly() {
    if (!state.sequencer) {
      return;
    }
    const rotated = [
      ...state.sequencer.patterns.slice(1),
      state.sequencer.patterns[0],
    ];
    state.sequencer = createTrickSequencer(rotated, state.sequencer.beatsPerTrick);
    announce(`seq ${currentTrick(state.sequencer)}`);
  }

  function dispatchLooperAction(action) {
    if (action.kind === "button") {
      performButton(action.name, action.down !== false);
      if (action.down !== false) {
        performButton(action.name, false);
      }
    } else if (action.kind === "knob" && action.name && action.value != null) {
      performKnob(action.name, action.value);
    } else if (action.kind === "key" && action.midi != null) {
      performKey(action.midi);
    }
  }

  function performKnob(name, value) {
    const map = {
      MASTER: "master",
      SELECT: "select",
      PRESETS: "presets",
      ALGORITHM: "algorithm",
      KNOB1: "knob1",
      KNOB2: "knob2",
      KNOB3: "knob3",
      KNOB4: "knob4",
    };
    const key = map[name];
    if (!key) {
      return;
    }
    controls[key] = value;
    face.setKnobValue(name, value);
    applyLiveSound();
    const quiet = actionLooper.isReplaying();

    if (name === "KNOB3" && state.patch) {
      const objects = objectCountFromSiteswapKnob(value);
      if (objects !== state.patch.objectCount) {
        state.patch.objectCount = objects;
        if (!quiet) {
          announce(`${objects} props · turn SEQ for new siteswaps`);
        }
      } else if (!quiet) {
        announce(`siteswap bias ${Math.round(value * 100)}`);
      }
    } else if (name === "KNOB4") {
      if (!quiet) {
        announce(`${bpmFromTempoKnob(value)} bpm`);
      }
    } else if (name === "KNOB1") {
      if (!quiet) {
        announce(`feedback ${Math.round(value * 100)}`);
      }
    } else if (name === "KNOB2") {
      if (!quiet) {
        announce(`hyper LFO ${Math.round(value * 100)}`);
      }
    } else if (name === "MASTER") {
      if (!quiet) {
        announce(`level ${Math.round(value * 100)}`);
      }
    } else if (name === "PRESETS" && state.patch) {
      const scaleName = SCALE_NAMES[scaleIndexFromPresets(value, SCALE_NAMES.length)];
      state.patch.scaleName = scaleName;
      const degrees = SCALES[scaleName];
      state.patch.voices = state.patch.voices.map((voice, index) => ({
        ...voice,
        midi: degreeToMidi(
          state.patch.rootMidi,
          degrees[index % degrees.length],
          scaleName,
          Math.floor(index / degrees.length),
        ),
      }));
      state.synth?.applyPatch(state.patch);
      applyLiveSound();
      updateSeedLabel();
      announce(isMicrotonalScale(scaleName) ? `${scaleName} · micro` : scaleName);
    } else if (name === "ALGORITHM") {
      announce(`next PLAY bias · ${patchTypeFromAlgorithm(value)}`);
    } else if (name === "SELECT" && state.sequencer) {
      const count = state.sequencer.patterns.length;
      const index = Math.min(count - 1, Math.floor(value * count));
      state.sequencer = {
        ...state.sequencer,
        index,
        elapsedInTrick: 0,
      };
      announce(currentTrick(state.sequencer));
    }
  }

  function onKnob(name, value) {
    if (name === actionLooper.host()) {
      const previous = actionLooper.mode();
      const next = actionLooper.onHostKnob(value, state.beat);
      if (previous !== "recording" && next === "recording") {
        announce("act rec");
      } else if (previous === "recording" && next === "looping") {
        announce(`act loop · ${actionLooper.eventCount()}`);
      }
    } else if (!actionLooper.isReplaying()) {
      actionLooper.capture({ kind: "knob", name, value }, state.beat);
    }
    performKnob(name, value);
  }

  function performButton(name, down) {
    if (!down) {
      const stayLit =
        (name === "SAVE" && state.seedLocked) ||
        name === "PLAY" ||
        (name === "SEL" && state.cosmology) ||
        (name === "REC" && state.patch?.tapeLive && (state.patch.tapeLive.recording || state.patch.tapeLive.held));
      face.setButtonLit(name, stayLit);
      return;
    }
    face.setButtonLit(name, true);
    ensureAudio();
    switch (name) {
      case "PLAY":
        newPatch();
        break;
      case "REC": {
        if (!state.synth || !state.patch) {
          announce("tape needs audio");
          break;
        }
        const tape = state.synth.cycleTape();
        face.setButtonLit("REC", tape.mode !== "off");
        announce(
          tape.mode === "rec"
            ? `tape rec ${(state.patch.composition?.mix?.tape ?? 0).toFixed(1)}s`
            : tape.mode === "hold"
              ? "tape hold"
              : "tape off",
        );
        break;
      }
      case "SEQ":
        reshuffleTricks();
        break;
      case "ARP":
        resequenceOnly();
        break;
      case "SAVE":
        state.seedLocked = !state.seedLocked;
        announce(state.seedLocked ? "seed locked" : "seed unlocked");
        face.setButtonLit("SAVE", state.seedLocked);
        break;
      case "HOME":
        Object.assign(controls, structuredClone(DEFAULT_CONTROLS));
        syncFaceKnobs();
        applyLiveSound();
        announce("knobs recalled");
        break;
      case "ENV": {
        controls.env = (controls.env + 0.12) % 1;
        applyLiveSound();
        const envelope = envelopeFromEnvKnob(controls.env);
        announce(
          `ADSR ${envelope.attack.toFixed(2)}/${envelope.decay.toFixed(2)}/${envelope.sustain.toFixed(2)}`,
        );
        break;
      }
      case "LFO":
        controls.lfo = (controls.lfo + 0.15) % 1;
        applyLiveSound();
        announce(`LFO→ ${lfoDestinationFromKnob(controls.lfo)}`);
        break;
      case "FX":
        controls.fx = (controls.fx + 0.12) % 1;
        applyLiveSound();
        announce(
          `grain ${delayFromFxKnob(controls.fx).toFixed(2)}s · ${Math.round(scatterFromFxKnob(controls.fx) * 100)}`,
        );
        break;
      case "EDIT":
        controls.edit = (controls.edit + 0.12) % 1;
        applyLiveSound();
        announce(`drive ${Math.round(controls.edit * 100)}`);
        break;
      case "GLO":
        controls.glo = (controls.glo + 0.15) % 1;
        announce(`wildness ${Math.round(controls.glo * 100)} · next PLAY`);
        break;
      case "OCT-":
        transposeRoot(-12);
        break;
      case "OCT+":
        transposeRoot(12);
        break;
      case "SEL":
        state.cosmology = !state.cosmology;
        face.setButtonLit("SEL", state.cosmology);
        announce(state.cosmology ? "cosmology on" : "cosmology off");
        break;
      default:
        break;
    }
  }

  function onButton(name, down) {
    if (!actionLooper.isReplaying() && down && name !== "PLAY" && name !== "HOME") {
      actionLooper.capture({ kind: "button", name, down: true }, state.beat);
    }
    performButton(name, down);
  }

  function transposeRoot(semitones) {
    if (!state.patch) {
      return;
    }
    state.patch.rootMidi = clampMidi(state.patch.rootMidi + semitones);
    state.patch.voices = state.patch.voices.map((voice) => ({
      ...voice,
      midi: clampMidi(voice.midi + semitones),
    }));
    state.synth?.applyPatch(state.patch);
    applyLiveSound();
    updateSeedLabel();
    announce(`root ${state.patch.rootMidi}`);
  }

  function clampMidi(value) {
    return Math.min(96, Math.max(24, value));
  }

  function performKey(midi) {
    const role = state.keyMap?.[midi];
    if (!role) {
      state.synth?.triggerThrow(midi % 2, 3 + (midi % 5));
      announce(`key ${midi}`);
      return;
    }
    applyKeyRole(role);
  }

  function onKey({ midi, down }) {
    if (!down || midi == null) {
      return;
    }
    ensureAudio().then(() => {
      if (!actionLooper.isReplaying()) {
        actionLooper.capture({ kind: "key", midi, down: true }, state.beat);
      }
      performKey(midi);
    });
  }

  function formatTrickAnnouncement(entry, cosmology = false) {
    const source = typeof entry === "string" ? entry : entry?.source ?? "";
    const kind = typeof entry === "object" && entry?.kind ? entry.kind : null;
    if (isRestTrick(source)) {
      return cosmology ? `wait ${source.slice(1)} · cosmology` : `wait ${source.slice(1)}`;
    }
    const label = kind && kind !== "pattern" ? `${source} · ${kind}` : source;
    return cosmology ? `${label} · cosmology` : label;
  }

  function emptyCourtPicture(objectCount = 3) {
    return {
      positions: [],
      hands: [
        { x: 0.32, y: 0.82 },
        { x: 0.68, y: 0.82 },
      ],
      held: 0,
      airborne: 0,
      ballCount: objectCount,
      state: "",
    };
  }

  function fireThrows(source, beat, previousBeat) {
    if (!state.synth || !state.patch || isRestTrick(source)) {
      return;
    }
    let schedule;
    try {
      schedule = schedulePlayable(source, state.patch.holdTwos, Math.ceil(beat) + 8);
    } catch {
      return;
    }
    for (const event of schedule.events) {
      if (event.height <= 0 || event.hold) {
        continue;
      }
      if (event.beat <= previousBeat || event.beat > beat) {
        continue;
      }
      const key = `${source}:${event.beat}:${event.ball}`;
      if (state.firedBeats.has(key)) {
        continue;
      }
      state.firedBeats.add(key);
      if (state.firedBeats.size > 240) {
        state.firedBeats.clear();
      }
      state.synth.triggerThrow(event.fromHand, event.height);
    }
  }

  function fireGenerators(beat, previousBeat) {
    if (!state.synth || !state.patch?.generators) {
      return;
    }
    const generative = GENERATIVE_PATCH_TYPES.has(state.patch.patchType);
    const droneLike =
      state.patch.patchType === "drone" ||
      state.patch.patchType === "vowel_chant" ||
      state.patch.patchType === "orbit";
    // Eighth notes keep space between hits; 16ths stacked with throws sounded fragmented
    const stepSize = generative ? 0.5 : droneLike ? 1 : 0.5;
    const located = state.patch.composition
      ? sectionAtBeat(state.patch.composition, state.beat)
      : null;
    const density =
      (located?.section?.density ?? 0.65) * (generative ? 0.9 : droneLike ? 0.35 : 0.55);
    const drumsOpen =
      state.patch.drumsOpen !== false &&
      state.patch.composition?.tracks?.[3]?.active !== false;
    const drumDensity = generative ? density * 1.05 : density * 0.75;
    let tick = Math.floor(previousBeat / stepSize) + 1;
    const last = Math.floor(beat / stepSize);
    while (tick <= last) {
      const key = `gen:${tick}`;
      if (!state.firedBeats.has(key)) {
        state.firedBeats.add(key);
        const chance = ((Math.imul(tick + 17, 2654435761) >>> 0) % 1000) / 1000;
        const synthHit = state.patch.generators.synth.step();
        const allowSynth =
          state.patch.patchType !== "atlas_drums" || chance < density * 0.35;
        if (synthHit.gate && chance < density && allowSynth) {
          const trackHint = synthHit.midi < 48 ? 0 : synthHit.midi > 64 ? 2 : 1;
          state.synth.triggerGenNote(synthHit.midi, synthHit.velocity, undefined, trackHint);
        }
        if (drumsOpen) {
          const drumHits = state.patch.generators.drums.step();
          if (chance < drumDensity) {
            for (const hit of drumHits) {
              if (hit.gate && hit.part !== "hat") {
                state.synth.triggerDrum(hit.part, hit.velocity);
              } else if (hit.gate && hit.part === "hat" && (tick & 1) === 0) {
                state.synth.triggerDrum(hit.part, hit.velocity * 0.7);
              }
            }
          }
        }
      }
      tick += 1;
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!state.running || !state.patch || !state.sequencer) {
      court.draw(
        {
          positions: [],
          hands: [
            { x: 0.32, y: 0.82 },
            { x: 0.68, y: 0.82 },
          ],
        },
        null,
      );
      return;
    }

    const elapsed = state.lastFrame ? (now - state.lastFrame) / 1000 : 0;
    state.lastFrame = now;
    const elapsedSeconds = (now - state.startedAt) / 1000;
    let beatsPerSecond = state.patch.bpm / 60;

    const oneshot =
      state.patch.patchType === "jingle" || state.patch.patchType === "call_response";
    const wasResting = isRestTrick(currentTrick(state.sequencer));
    const preSource = currentTrick(state.sequencer);
    const preResting = isRestTrick(preSource);
    const preCosmos = preResting
      ? { active: false, source: preSource, weather: null }
      : cosmologyState({
          source: preSource,
          enabled: state.cosmology,
          elapsedSeconds,
        });
    if (preCosmos.weather) {
      beatsPerSecond *= preCosmos.weather.tempoBend;
    }

    const previousCompositionBeat = state.beat;
    state.beat += elapsed * beatsPerSecond;

    const loopActions = actionLooper.tick(state.beat, previousCompositionBeat);
    if (loopActions.length > 0) {
      actionLooper.withReplay(() => {
        for (const action of loopActions) {
          dispatchLooperAction(action);
        }
      });
    }

    const advanced = advanceTrickSequencer(state.sequencer, elapsed * beatsPerSecond, {
      loopTricks: !oneshot,
    });
    state.sequencer = advanced.sequencer;
    if (advanced.changed) {
      announce(formatTrickAnnouncement(currentTrickEntry(state.sequencer), state.cosmology));
      state.firedBeats.clear();
      if (isRestTrick(currentTrick(state.sequencer))) {
        state.waitStartedAt = now;
      } else {
        state.synth?.syncDrumEnvelopes?.(currentTrick(state.sequencer));
      }
    }
    if (advanced.finished && oneshot) {
      state.running = false;
      announce(`${state.patch.patchType} done · PLAY`);
    }

    // Cap wait wall-clock so a slow tempo cannot hold a break past MAX_WAIT_SECONDS.
    if (isRestTrick(currentTrick(state.sequencer)) && state.waitStartedAt > 0) {
      const waited = (now - state.waitStartedAt) / 1000;
      if (waited >= MAX_WAIT_SECONDS) {
        const span = currentTrickBeats(state.sequencer);
        const remain = Math.max(0.001, span - state.sequencer.elapsedInTrick);
        const forced = advanceTrickSequencer(state.sequencer, remain + 0.001, {
          loopTricks: !oneshot,
        });
        state.sequencer = forced.sequencer;
        if (forced.changed) {
          announce(formatTrickAnnouncement(currentTrickEntry(state.sequencer), state.cosmology));
          state.firedBeats.clear();
        }
      }
    }

    const trickEntry = currentTrickEntry(state.sequencer);
    const baseSource = currentTrick(state.sequencer);
    const resting = isRestTrick(baseSource);
    if (!wasResting && resting) {
      state.waitStartedAt = now;
    }
    const cosmos = resting
      ? { active: false, source: baseSource, weather: null }
      : cosmologyState({
          source: baseSource,
          enabled: state.cosmology,
          elapsedSeconds,
        });
    const weather = cosmos.weather;

    const sectionChanged = state.synth?.applyCompositionBeat(state.beat);
    if (sectionChanged) {
      announce(
        `${formatTrickAnnouncement(currentTrickEntry(state.sequencer))} · ${sectionChanged.name}`,
      );
    }

    const source = cosmos.active ? cosmos.source : baseSource;
    const localBeat = state.sequencer.elapsedInTrick;
    const previousLocal = localBeat - elapsed * beatsPerSecond;
    fireThrows(source, localBeat, previousLocal);

    let pictured;
    if (resting) {
      const fading = state.lastLivePicture;
      pictured = fading
        ? {
            ...emptyCourtPicture(state.patch.objectCount),
            hands: fading.hands,
            positions: (fading.positions ?? []).map((position) => ({
              ...position,
              held: false,
              abandoned: true,
            })),
            held: 0,
            airborne: 0,
            ballCount: state.patch.objectCount,
          }
        : emptyCourtPicture(state.patch.objectCount);
    } else {
      pictured = courtPicture({
        source,
        dwellRatio: state.patch.dwellRatio,
        holdTwos: state.patch.holdTwos,
        timeBeat: localBeat,
        gravityScale: weather?.gravity ?? 1,
        wind: weather ? { x: weather.windX, y: weather.windY } : { x: 0, y: 0 },
        handStyle: state.patch.handStyle ?? null,
      });
      state.lastLivePicture = pictured;
    }

    // Silence modes only on episode rests. Empty court frames during play stay
    // open — otherwise delay/feedback tails dominate every engine.
    const silenceMode = resting
      ? trickEntry?.silence === "gap"
        ? "gap"
        : "tail"
      : "open";
    if (silenceMode === "open") {
      fireGenerators(state.beat, previousCompositionBeat);
    }

    const mix = state.patch.composition?.mix;
    const delayTime = state.patch.delayTime ?? mix?.chain?.delay ?? 0.28;
    const reverbAmount = mix?.reverb ?? 0.3;
    const wetAmount = mix?.chain?.returnLevel ?? 0.45;
    court.pushTrail(pictured);
    court.draw(pictured, weather, {
      showPattern: source,
      delay: delayTime,
      reverb: reverbAmount,
      wet: wetAmount,
      echoOnly: resting,
    });
    if (silenceMode === "open") {
      state.synth?.onOccupancy(pictured);
    }
    state.synth?.applyLiveMix({
      beat: state.beat,
      elapsedSeconds,
      weather: state.cosmology ? weather : null,
      silenceMode,
    });
  }

  syncFaceKnobs();
  applyPatch(createRndPatch(uniqueSeed(), biasFromControls()), { keepKnobs: false });
  requestAnimationFrame(frame);

  return {
    controls,
    state,
    onKnob,
    onButton,
    onKey,
    newPatch,
    ensureAudio,
    getAudioContext: () => state.audio,
    getOutputBus: () => state.outputBus,
    getCourtCanvas: () => face.screen,
  };
}
