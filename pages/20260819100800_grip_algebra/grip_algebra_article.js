import { cosmologyState } from "./court_cosmology.js";
import { applyCosmologySoundControls } from "./court_cosmology_sound.js";
import { cascadeHoldingFlags, playbackTimeBeat, playbackWindowBeats } from "./schedule.js";
import { courtPicture, trajectoryPositions } from "./toss.js";
import { renderLatexElements } from "./formula.js";
import { initializeFormalLawWorkbench } from "./formal_law_ui.js";
import { AIRBORNE_SIGN, signHasHeld, signHasUnheld } from "./holding.js";
import { relationPresence, relationsInPattern } from "./object_relation.js";
import { initializeSiteswapInterface } from "./siteswap_ui.js";
import { courtSoundPlan, occupancyChangeHand, soundDocumentOpen, soundSettingsFromForm } from "./court_sound.js";
import { occupancyGateOpen, soloedSigns, soundEnvelopeClock, soundEnvelopePhase } from "./court_sound_fx.js";
import { createCourtSoundEngine } from "./court_sound_engine.js";
import { mountSoundSynthControls, writeSoundDisplays } from "./court_sound_synth.js";
import { refreshTapeFace } from "./court_sound_marks.js";
import {
  courtFrameShouldPaint,
  courtPlaybackActive,
  createAnimationScheduler,
  normalizedPointer,
  viewportProgress,
} from "./animation_lifecycle.js";
import {
  appendCourtTrails,
  drawOccupancyTape,
  drawTossCourt,
  hexagonVertexIndex,
  recentStatePath,
} from "./draw.js";
import { bindInspectorLayout, fitDisplayCanvas } from "./simulator_layout.js";
import {
  applyIdentifiedRangeValues,
  applyNamedControlValues,
  applyRememberedDetails,
  readStoredSettings,
  rememberInteractiveSettings,
} from "./settings_store.js";

const HANDS = [
  { x: 0.32, y: 0.84 },
  { x: 0.68, y: 0.84 },
];

const STILL_OBJECT = [{ x: 0.68, y: 0.82, held: true, hand: 1 }];

const ATLAS = [
  { canvasId: "atlas-00", kind: "empty" },
  { canvasId: "atlas-01", source: "02", dwellRatio: 0.7 },
  { canvasId: "atlas-10", source: "55500", dwellRatio: 0.75, lockState: AIRBORNE_SIGN },
  { canvasId: "atlas-11", source: "3", dwellRatio: 0.7 },
  { canvasId: "layer-object", kind: "still", layer: "object" },
  { canvasId: "layer-body", source: "02", dwellRatio: 0.7, layer: "body" },
  { canvasId: "layer-world", source: "55500", dwellRatio: 0.75, lockState: AIRBORNE_SIGN, layer: "world" },
];

function setLamps(pictured) {
  const state = pictured.state;
  document.getElementById("lamp-no-grip").classList.toggle("is-on", signHasUnheld(state));
  document.getElementById("lamp-grip").classList.toggle("is-on", signHasHeld(state));
  document.getElementById("state-code").textContent = state;
  const presence = relationPresence(relationsInPattern(pictured.heldFlags ?? []));
  document.getElementById("lamp-tained")?.classList.toggle("is-on", presence.tained);
  document.getElementById("lamp-leased")?.classList.toggle("is-on", presence.leased);
  document.getElementById("lamp-drop")?.classList.toggle("is-on", presence.dropped);
}

function markHexagon(flags) {
  const nodes = document.querySelectorAll("[data-hex]");
  const active = hexagonVertexIndex(flags);
  nodes.forEach((node, index) => {
    node.classList.toggle("is-active", index === active);
  });
}

function fitCanvas(canvas, pixelRatio) {
  const bounds = canvas.getBoundingClientRect();
  return fitDisplayCanvas(canvas, pixelRatio, bounds.width, bounds.height);
}

function findTimeInState(source, dwellRatio, lockState) {
  for (let timeBeat = 8; timeBeat <= 28; timeBeat += 0.05) {
    const pictured = trajectoryPositions({
      source,
      dwellRatio,
      holdTwos: true,
      timeBeat,
      hands: HANDS,
    });
    if (pictured.state === lockState) {
      return timeBeat;
    }
  }
  return 12;
}

const lockedTimes = new Map();

function atlasTimeBeat(card, elapsed, beatSeconds) {
  if (card.lockState) {
    const key = `${card.source}:${card.dwellRatio}:${card.lockState}`;
    if (!lockedTimes.has(key)) {
      lockedTimes.set(key, findTimeInState(card.source, card.dwellRatio, card.lockState));
    }
    const origin = lockedTimes.get(key);
    return origin + 0.12 * Math.sin(elapsed * 1.4);
  }
  return ((elapsed / beatSeconds) % 48 + 48) % 48;
}

function paintAtlasCard(card, elapsed, beatSeconds) {
  const canvas = document.getElementById(card.canvasId);
  if (!canvas) {
    return;
  }
  if (card.kind === "empty") {
    drawTossCourt(canvas, [], HANDS);
    return;
  }
  if (card.kind === "still") {
    drawTossCourt(canvas, STILL_OBJECT, HANDS, [], card.layer);
    return;
  }
  const pictured = trajectoryPositions({
    source: card.source,
    dwellRatio: card.dwellRatio,
    holdTwos: true,
    timeBeat: atlasTimeBeat(card, elapsed, beatSeconds),
    hands: HANDS,
  });
  drawTossCourt(canvas, pictured.positions, pictured.hands ?? HANDS, [], card.layer);
}

function boot() {
  renderLatexElements(document);
  const form = document.getElementById("court-controls");
  const rememberRoot = form?.closest(".court-block") ?? form;
  mountSoundSynthControls(form?.querySelector(".sound-controls"), document.documentElement.lang);
  const stored = readStoredSettings();
  applyNamedControlValues(rememberRoot, stored.named);
  applyRememberedDetails(rememberRoot, stored.details);
  initializeFormalLawWorkbench(document);
  const workbench = document.getElementById("formal-law-lab");
  applyIdentifiedRangeValues(workbench, stored.ranges);
  if (workbench) {
    for (const input of workbench.querySelectorAll("input[type='range'][id]")) {
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  const court = document.getElementById("toss-court");
  const tape = document.getElementById("occupancy-tape");
  const readout = document.getElementById("state-path");
  const hexagon = document.getElementById("hexagon-panel");
  const canvases = [court, tape, ...ATLAS.map((card) => document.getElementById(card.canvasId)).filter(Boolean)];
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const courtPointer = { x: 0.5, y: 0.5 };
  const visibleAtlas = new Set();
  const atlasNeedsPaint = new Set(ATLAS.map((card) => card.canvasId));
  let courtScrollProgress = 0.5;
  let courtVisible = false;
  let courtNeedsPaint = true;
  let scrollInputsDirty = true;
  let elapsed = 0;
  let atlasElapsed = 0;
  let controls = null;
  let inspector = null;

  function rememberSettings() {
    rememberInteractiveSettings({
      form,
      workbench,
      rememberRoot,
      inspector,
    });
  }

  const fitAll = () => {
    const pixelRatio = window.devicePixelRatio || 1;
    let changed = false;
    for (const canvas of canvases) {
      changed = fitCanvas(canvas, pixelRatio) || changed;
    }
    if (!changed) {
      return;
    }
    courtNeedsPaint = true;
    for (const card of ATLAS) {
      atlasNeedsPaint.add(card.canvasId);
    }
  };

  const history = [];
  const courtTrails = [];
  const soundEngine = createCourtSoundEngine();
  let previousHeldFlags = [];
  let lastEventHand = null;
  let previousSoundState = null;
  let previousSoloKey = "";
  let soundStateChangedAt = 0;

  const clearPath = () => {
    elapsed = 0;
    history.length = 0;
    courtTrails.length = 0;
    previousHeldFlags = [];
    lastEventHand = null;
    previousSoundState = null;
    previousSoloKey = "";
    soundStateChangedAt = 0;
  };

  function soundEnabled() {
    return form.elements.namedItem("courtSound")?.checked === true;
  }

  function soundClockOpen() {
    if (soundEnabled()) {
      return true;
    }
    return form.elements.namedItem("patternCosmology")?.checked === true;
  }

  function updateSoundPresence() {
    soundEngine.setDocumentVisible(soundDocumentOpen(document.hidden));
    updateCourtActivity();
  }

  function applyCourtSound(pictured, weather) {
    const changedHand = occupancyChangeHand(
      previousHeldFlags,
      pictured.heldFlags ?? [],
      pictured.positions,
    );
    if (changedHand !== null) {
      lastEventHand = changedHand;
    }
    previousHeldFlags = pictured.heldFlags ?? [];
    applyCosmologySoundControls(form, weather);
    writeSoundDisplays(form.querySelector(".sound-controls") ?? form);
    const settings = soundSettingsFromForm(form);
    const nextPhase = soundEnvelopePhase(pictured.state, settings.solos);
    const soloKey = soloedSigns(settings.solos).join("+");
    const gateOpen = occupancyGateOpen(pictured.state, settings.solos);
    const clock = soundEnvelopeClock(previousSoundState, nextPhase, elapsed, {
      gateOpen,
      alreadyClosed: soloKey !== previousSoloKey && !gateOpen,
    });
    previousSoloKey = soloKey;
    if (clock) {
      previousSoundState = clock.phase;
      soundStateChangedAt = clock.changedAt;
    }
    if (!settings.enabled) {
      return;
    }
    const plan = courtSoundPlan({
      state: pictured.state,
      waves: settings.waves,
      effects: settings.effects,
      synth: settings.synth,
      synths: settings.synths,
      solos: settings.solos,
      audition: settings.audition,
      eventHand: lastEventHand,
      pointer: courtPointer,
      scrollProgress: courtScrollProgress,
      timeSeconds: elapsed,
      stateAgeSeconds: Math.max(0, elapsed - soundStateChangedAt),
    });
    soundEngine.apply(plan);
    refreshTapeFace(form, soundEngine.tapeView());
  }

  function interactionOffset(pointer, scrollProgress) {
    if (motionPreference.matches) {
      return 0;
    }
    return (pointer.x - 0.5) * 0.6 + (scrollProgress - 0.5) * 0.3;
  }

  function updateScrollInputs() {
    scrollInputsDirty = false;
    const viewportHeight = window.innerHeight;
    if (courtVisible) {
      courtScrollProgress = viewportProgress(court.getBoundingClientRect(), viewportHeight);
    }
  }

  function paintCourt(advancing) {
    const pattern = controls.currentRequest();
    const cosmology = cosmologyState({
      elapsedSeconds: elapsed,
      source: pattern.source,
      enabled: pattern.cosmology,
    });
    const weather = cosmology.weather;
    const dwellRatio = weather
      ? Math.min(0.98, Math.max(0.05, pattern.dwellRatio + weather.modulation))
      : pattern.dwellRatio;
    const beatSeconds = weather ? pattern.beatSeconds * weather.tempoBend : pattern.beatSeconds;
    const baseTimeBeat = elapsed / beatSeconds;
    const timeBeat = playbackTimeBeat(
      baseTimeBeat + interactionOffset(courtPointer, courtScrollProgress),
      {
        reverse: pattern.reverse,
        windowBeats: playbackWindowBeats(cosmology.source, pattern.holdTwos),
      },
    );
    const pictured = courtPicture({
      source: cosmology.source,
      dwellRatio,
      holdTwos: pattern.holdTwos,
      timeBeat,
      hands: HANDS,
      gravityScale: weather?.gravity ?? 1,
      wind: weather ? { x: weather.windX, y: weather.windY } : { x: 0, y: 0 },
    });
    setLamps(pictured);
    controls.updateState(pictured);
    const patternStatus = document.getElementById("pattern-status");
    if (patternStatus && patternStatus.dataset.status !== "error") {
      patternStatus.textContent = cosmology.active && cosmology.source !== pattern.source
        ? cosmology.source
        : "";
    }
    if (advancing || courtTrails.length === 0) {
      appendCourtTrails(
        courtTrails,
        pictured,
        weather ? Math.round(80 + weather.storm * 70) : 80,
      );
    }
    drawTossCourt(court, pictured.positions, pictured.hands ?? HANDS, courtTrails, null, weather);
    if (advancing || history.length === 0) {
      history.push(pictured.state);
      if (history.length > 180) {
        history.shift();
      }
    }
    drawOccupancyTape(tape, history);
    readout.textContent = recentStatePath(history).join(" → ");
    applyCourtSound(pictured, weather);
    const cascade = cosmology.source === "3";
    hexagon.hidden = !cascade;
    if (cascade) {
      markHexagon(cascadeHoldingFlags(timeBeat, dwellRatio));
    }
    courtNeedsPaint = false;
  }

  const scheduler = createAnimationScheduler({
    onFrame({ deltaSeconds }) {
      if (scrollInputsDirty) {
        updateScrollInputs();
      }
      const courtAdvancing = scheduler.isActive("court") && deltaSeconds > 0;
      if (courtAdvancing) {
        elapsed += deltaSeconds;
      }
      if (courtFrameShouldPaint({
        courtVisible,
        needsPaint: courtNeedsPaint,
        soundEnabled: soundClockOpen(),
        advancing: courtAdvancing,
      })) {
        paintCourt(courtAdvancing);
      }

      const animatedAtlasVisible = ATLAS.some(
        (card) => visibleAtlas.has(card.canvasId) && !card.kind,
      );
      if (animatedAtlasVisible) {
        atlasElapsed += deltaSeconds;
      }
      const beatSeconds = controls.currentRequest().beatSeconds;
      for (const card of ATLAS) {
        if (!visibleAtlas.has(card.canvasId) && !atlasNeedsPaint.has(card.canvasId)) {
          continue;
        }
        paintAtlasCard(card, atlasElapsed, beatSeconds);
        atlasNeedsPaint.delete(card.canvasId);
      }
    },
  });

  function updateCourtActivity() {
    if (!controls) return;
    scheduler.setActive("court", courtPlaybackActive({
      playing: controls.isPlaying(),
      courtVisible,
      soundEnabled: soundClockOpen(),
    }));
  }

  function requestCourtPaint() {
    courtNeedsPaint = true;
    scheduler.requestRender();
  }

  controls = initializeSiteswapInterface(form, {
    initialPlaying: !motionPreference.matches,
    onPatternChange() {
      if (!controls) return;
      history.length = 0;
      courtTrails.length = 0;
      previousHeldFlags = [];
      lastEventHand = null;
      previousSoundState = null;
      rememberSettings();
      requestCourtPaint();
    },
    onParametersChange() {
      if (!controls) return;
      history.length = 0;
      courtTrails.length = 0;
      previousHeldFlags = [];
      lastEventHand = null;
      previousSoundState = null;
      requestCourtPaint();
    },
    onPlaybackChange() {
      if (!controls) return;
      updateCourtActivity();
      requestCourtPaint();
    },
    onSoundChange() {
      if (!controls) return;
      const settings = soundSettingsFromForm(form);
      soundEngine.setEnabled(settings.enabled).then(() => {
        updateSoundPresence();
        requestCourtPaint();
      });
    },
    onStep() {
      if (!controls) return;
      elapsed += controls.currentRequest().beatSeconds / 4;
      requestCourtPaint();
    },
    onRestart() {
      if (!controls) return;
      clearPath();
      requestCourtPaint();
    },
  });

  function observeVisibility() {
    if (!("IntersectionObserver" in window)) {
      courtVisible = true;
      for (const card of ATLAS) {
        visibleAtlas.add(card.canvasId);
        if (!card.kind) {
          scheduler.setActive(`atlas:${card.canvasId}`, true);
        }
      }
      updateCourtActivity();
      updateSoundPresence();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const visible = entry.isIntersecting && entry.intersectionRatio > 0;
        if (entry.target === court) {
          courtVisible = visible;
          courtNeedsPaint ||= visible;
          updateCourtActivity();
          updateSoundPresence();
        } else {
          const card = ATLAS.find((candidate) => candidate.canvasId === entry.target.id);
          if (!card) continue;
          if (visible) {
            visibleAtlas.add(card.canvasId);
            atlasNeedsPaint.add(card.canvasId);
          } else {
            visibleAtlas.delete(card.canvasId);
          }
          if (!card.kind) {
            scheduler.setActive(`atlas:${card.canvasId}`, visible);
          }
        }
      }
      scrollInputsDirty = true;
      scheduler.requestRender();
    }, { threshold: 0.05 });

    observer.observe(court);
    for (const card of ATLAS) {
      observer.observe(document.getElementById(card.canvasId));
    }
  }

  function bindPointer(canvas, onPointer) {
    canvas.addEventListener("pointermove", (event) => {
      if (motionPreference.matches) return;
      onPointer(normalizedPointer(event, canvas.getBoundingClientRect()));
      scheduler.requestRender();
    });
    canvas.addEventListener("pointerleave", () => {
      onPointer({ x: 0.5, y: 0.5 });
      scheduler.requestRender();
    });
  }

  bindPointer(court, (pointer) => {
    Object.assign(courtPointer, pointer);
    courtNeedsPaint = true;
  });

  inspector = bindInspectorLayout(form, {
    language: document.documentElement.lang,
    width: stored.inspector?.width,
    collapsed: stored.inspector?.collapsed,
    onLayoutChange() {
      fitAll();
      scheduler.requestRender();
      rememberSettings();
    },
  });
  rememberRoot?.addEventListener("input", rememberSettings);
  rememberRoot?.addEventListener("change", rememberSettings);
  rememberRoot?.addEventListener("toggle", rememberSettings, true);
  workbench?.addEventListener("input", rememberSettings);
  if (soundSettingsFromForm(form).enabled) {
    const startStoredSound = () => {
      soundEngine.setEnabled(true).then(() => {
        updateSoundPresence();
        requestCourtPaint();
      });
    };
    document.addEventListener("pointerdown", startStoredSound, { once: true });
  }
  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(() => {
      fitAll();
      scheduler.requestRender();
    });
    for (const canvas of canvases) {
      resizeObserver.observe(canvas);
    }
  }
  window.addEventListener("resize", () => {
    fitAll();
    scrollInputsDirty = true;
    scheduler.requestRender();
  });
  window.addEventListener("scroll", () => {
    scrollInputsDirty = true;
    const soundOn = soundEnabled();
    if (!motionPreference.matches) {
      courtNeedsPaint ||= courtVisible || soundOn;
    } else if (soundOn) {
      courtNeedsPaint = true;
    }
    if (!motionPreference.matches || soundOn) {
      scheduler.requestRender();
    }
  }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    scheduler.setDocumentVisible(!document.hidden);
    updateSoundPresence();
  });

  const onMotionPreferenceChange = (event) => {
    scheduler.setMotionAllowed(!event.matches);
    if (event.matches) {
      controls.setPlaying(false);
    }
    courtNeedsPaint = true;
    for (const card of ATLAS) {
      atlasNeedsPaint.add(card.canvasId);
    }
    scheduler.requestRender();
  };
  motionPreference.addEventListener("change", onMotionPreferenceChange);

  scheduler.setMotionAllowed(!motionPreference.matches);
  fitAll();
  observeVisibility();
  scheduler.requestRender();
}

boot();
