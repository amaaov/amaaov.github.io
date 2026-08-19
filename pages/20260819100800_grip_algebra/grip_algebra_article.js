import { cascadeHoldingFlags } from "./schedule.js";
import { trajectoryPositions } from "./toss.js";
import { renderLatexElements } from "./formula.js";
import { RELEASE_SIGN, signHasAkrateia, signHasKratos } from "./holding.js";
import {
  appendCourtTrails,
  compressStates,
  drawOccupancyTape,
  drawTossCourt,
  hexagonVertexIndex,
} from "./draw.js";

const PATTERNS = {
  hold02: { source: "02", holdTwos: true },
  hold2mux: { source: "2[22]", holdTwos: true },
  cascade3: { source: "3", holdTwos: true },
  multiplexHold: { source: "55500522", holdTwos: true },
  flashThenAllHeld: { source: "555001[22]2[23]", holdTwos: true },
  flashThenHeldLong: { source: "5550022[22]2[25]22", holdTwos: true },
  loop55500: { source: "55500", holdTwos: true },
  throwRestHold: { source: "([44],4)(0,0)([22],2)", holdTwos: true },
  threeUpHold: {
    source: "([26x],2)(2,6x)(6x,0)(0,2)(2,2)(2,[22])(2,[26x])(6x,2)(0,6x)(2,0)(2,2)([22],2)",
    holdTwos: true,
  },
};

const HANDS = [
  { x: 0.32, y: 0.84 },
  { x: 0.68, y: 0.84 },
];

const STILL_OBJECT = [{ x: 0.68, y: 0.82, held: true, hand: 1 }];

const ATLAS = [
  { canvasId: "atlas-00", kind: "empty" },
  { canvasId: "atlas-01", source: "02", dwellRatio: 0.7 },
  { canvasId: "atlas-10", source: "55500", dwellRatio: 0.75, lockState: RELEASE_SIGN },
  { canvasId: "atlas-11", source: "3", dwellRatio: 0.7 },
  { canvasId: "layer-object", kind: "still", layer: "object" },
  { canvasId: "layer-body", source: "02", dwellRatio: 0.7, layer: "body" },
  { canvasId: "layer-world", source: "55500", dwellRatio: 0.75, lockState: RELEASE_SIGN, layer: "world" },
];

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function currentPattern(form) {
  const selected = form.querySelector("[name='pattern']:checked");
  return PATTERNS[selected.value];
}

function setLamps(state) {
  document.getElementById("lamp-no-grip").classList.toggle("is-on", signHasAkrateia(state));
  document.getElementById("lamp-grip").classList.toggle("is-on", signHasKratos(state));
  document.getElementById("state-code").textContent = state;
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
  canvas.width = Math.max(1, Math.floor(bounds.width * pixelRatio));
  canvas.height = Math.max(1, Math.floor(bounds.height * pixelRatio));
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
  return (elapsed / beatSeconds) % 48;
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
  const court = document.getElementById("toss-court");
  const tape = document.getElementById("occupancy-tape");
  const readout = document.getElementById("state-path");
  const dwellOutput = document.getElementById("dwell-readout");
  const hexagon = document.getElementById("hexagon-panel");
  const pixelRatio = window.devicePixelRatio || 1;
  const canvases = [court, tape, ...ATLAS.map((card) => document.getElementById(card.canvasId)).filter(Boolean)];
  const fitAll = () => {
    canvases.forEach((canvas) => fitCanvas(canvas, pixelRatio));
  };
  fitAll();
  let elapsed = 0;
  let lastStamp = performance.now();
  const history = [];
  const courtTrails = [];
  const beatSeconds = 0.4;

  const frame = (stamp) => {
    const pattern = currentPattern(form);
    const dwellRatio = Number(form.dwell.value);
    dwellOutput.textContent = dwellRatio.toFixed(2);
    if (!reducedMotion()) {
      elapsed += (stamp - lastStamp) / 1000;
    }
    lastStamp = stamp;
    const timeBeat = (elapsed / beatSeconds) % 48;
    const pictured = trajectoryPositions({
      source: pattern.source,
      dwellRatio,
      holdTwos: pattern.holdTwos,
      timeBeat,
      hands: HANDS,
    });
    setLamps(pictured.state);
    appendCourtTrails(courtTrails, pictured);
    drawTossCourt(court, pictured.positions, pictured.hands ?? HANDS, courtTrails);
    history.push(pictured.state);
    if (history.length > 180) {
      history.shift();
    }
    drawOccupancyTape(tape, history);
    readout.textContent = compressStates(history).join(" → ");
    const cascade = pattern.source === "3";
    hexagon.hidden = !cascade;
    if (cascade) {
      markHexagon(cascadeHoldingFlags(timeBeat, dwellRatio));
    }
    ATLAS.forEach((card) => paintAtlasCard(card, elapsed, beatSeconds));
    if (!reducedMotion()) {
      window.requestAnimationFrame(frame);
    }
  };

  form.addEventListener("change", () => {
    elapsed = 0;
    history.length = 0;
    courtTrails.length = 0;
    if (reducedMotion()) {
      frame(performance.now());
    }
  });
  window.addEventListener("resize", () => {
    fitAll();
  });
  window.requestAnimationFrame(frame);
}

boot();
