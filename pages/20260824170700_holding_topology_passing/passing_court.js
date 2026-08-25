import { passingCourtPicture, pictureWorldPoints } from "./passing_toss.js";
import { drawPassingCourt } from "./passing_draw.js";
import { defaultCamera, fitCameraDistance, orbitCamera } from "./passing_space.js";
import { arrangementForSource, PASSING_PATTERNS, patternById } from "./passing_patterns.js";
import { PASSING_PROPS, normalizeProp } from "./passing_prop.js";
import {
  COURT_BEATS_PER_MINUTE,
  COURT_DWELL_RATIO,
  advanceCourtClock,
  beatSecondsFromTempo,
  normalizeBeatsPerMinute,
  normalizeDwellRatio,
  signLabel,
  stepCourtClock,
  toggleCourtPause,
} from "./passing_state.js";

function shareText(value) {
  return value.toFixed(2);
}

export function mountPassingCourt(root) {
  const canvas = root.querySelector("[data-passing-court]");
  const picker = root.querySelector("[data-passing-pattern]");
  const custom = root.querySelector("[data-passing-custom]");
  const propPicker = root.querySelector("[data-passing-prop]");
  const dwellInput = root.querySelector("[data-passing-dwell]");
  const tempoInput = root.querySelector("[data-passing-tempo]");
  const holdInput = root.querySelector("[data-passing-hold-twos]");
  const pauseButton = root.querySelector("[data-passing-pause]");
  const stepButton = root.querySelector("[data-passing-step]");
  const dwellReadout = root.querySelector("[data-passing-dwell-value]");
  const tempoReadout = root.querySelector("[data-passing-tempo-value]");
  const groupSign = root.querySelector("[data-passing-group-sign]");
  const groupQ = root.querySelector("[data-passing-group-q]");
  const groupShares = root.querySelector("[data-passing-group-shares]");
  const bodyList = root.querySelector("[data-passing-bodies]");
  if (canvas === null) {
    throw new Error("passing court canvas is missing");
  }
  PASSING_PATTERNS.forEach((fixture) => {
    if (picker === null) {
      return;
    }
    const option = document.createElement("option");
    option.value = fixture.id;
    option.textContent = `${fixture.label} (${fixture.people})`;
    picker.append(option);
  });
  PASSING_PROPS.forEach((entry) => {
    if (propPicker === null) {
      return;
    }
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.label;
    propPicker.append(option);
  });
  let selected = patternById("four-pps-zips");
  if (picker !== null) {
    picker.value = selected.id;
  }
  let source = selected.source;
  let arrangement = selected.arrangement;
  let prop = "club";
  let dwellRatio = COURT_DWELL_RATIO;
  let beatsPerMinute = COURT_BEATS_PER_MINUTE;
  let holdTwos = true;
  let clock = { elapsed: 0, lastStamp: 0, paused: false };
  if (propPicker !== null) {
    propPicker.value = prop;
  }
  if (dwellInput !== null) {
    dwellInput.value = String(dwellRatio);
  }
  if (tempoInput !== null) {
    tempoInput.value = String(beatsPerMinute);
  }
  if (holdInput !== null) {
    holdInput.checked = holdTwos;
  }
  let camera = defaultCamera();
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function currentPicture(timeBeat) {
    return passingCourtPicture({
      source,
      arrangement,
      prop,
      dwellRatio,
      holdTwos,
      timeBeat,
    });
  }

  function beatSeconds() {
    return beatSecondsFromTempo(beatsPerMinute);
  }

  function syncTransport() {
    if (pauseButton !== null) {
      pauseButton.textContent = clock.paused ? "Run" : "Pause";
      pauseButton.setAttribute("aria-pressed", clock.paused ? "true" : "false");
    }
  }

  function writeText(node, value) {
    if (node !== null && node.textContent !== value) {
      node.textContent = value;
    }
  }

  function fillBodyItem(item, row) {
    writeText(item.children[0], `${row.body + 1}  held ${row.held}  incoming ${row.inbound}  `);
    writeText(item.children[1], signLabel(row.sign));
  }

  function renderBodies(rows) {
    if (bodyList === null) {
      return;
    }
    if (bodyList.childElementCount !== rows.length) {
      bodyList.replaceChildren(...rows.map((row) => {
        const item = document.createElement("li");
        const counts = document.createElement("span");
        const sign = document.createElement("span");
        sign.setAttribute("data-body-sign", "");
        item.append(counts, sign);
        fillBodyItem(item, row);
        return item;
      }));
      return;
    }
    rows.forEach((row, index) => {
      fillBodyItem(bodyList.children[index], row);
    });
  }

  function renderState(picture) {
    const group = picture.group;
    writeText(groupSign, signLabel(group.sign));
    writeText(groupQ, `q ${picture.held} / ${picture.ballCount}`);
    writeText(
      groupShares,
      `Pα ${shareText(picture.occupancy.pAlpha)}  Pακ ${shareText(picture.occupancy.pPolymorphy)}  Pκ ${shareText(picture.occupancy.pKappa)}  r ${dwellRatio}  ${beatsPerMinute} bpm`,
    );
    renderBodies(picture.bodyRetention);
    writeText(dwellReadout, String(dwellRatio));
    writeText(tempoReadout, String(beatsPerMinute));
  }

  function stageSize() {
    return {
      width: Math.max(Math.round(canvas.clientWidth) || 960, 320),
      height: Math.max(Math.round(canvas.clientHeight) || 560, 240),
    };
  }

  function resize() {
    const { width, height } = stageSize();
    canvas.width = width;
    canvas.height = height;
    const points = [];
    for (let beat = 0; beat < 6; beat += 0.5) {
      points.push(...pictureWorldPoints(currentPicture(beat)));
    }
    camera.distance = fitCameraDistance(points, camera, width, height);
  }

  function loadPattern() {
    const written = custom?.value.trim();
    try {
      if (written) {
        source = written;
        arrangement = arrangementForSource(written);
      } else {
        selected = patternById(picker?.value || "four-pps-zips");
        source = selected.source;
        arrangement = selected.arrangement;
      }
      clock = { ...clock, elapsed: 0 };
      resize();
    } catch {
      return;
    }
  }

  function frame(stamp) {
    const size = stageSize();
    if (canvas.width !== size.width || canvas.height !== size.height) {
      resize();
    }
    clock = advanceCourtClock(clock, stamp);
    const picture = currentPicture(clock.elapsed / beatSeconds());
    drawPassingCourt(canvas.getContext("2d"), picture, camera, canvas.width, canvas.height);
    renderState(picture);
    requestAnimationFrame(frame);
  }

  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) {
      return;
    }
    camera = orbitCamera(camera, (event.clientX - lastX) * 0.008, (event.clientY - lastY) * 0.006);
    lastX = event.clientX;
    lastY = event.clientY;
  });
  canvas.addEventListener("pointerup", (event) => {
    dragging = false;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  });
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    camera = {
      ...camera,
      distance: Math.min(28, Math.max(3.5, camera.distance + event.deltaY * 0.01)),
    };
  }, { passive: false });
  picker?.addEventListener("change", () => {
    if (custom) {
      custom.value = "";
    }
    loadPattern();
  });
  custom?.addEventListener("change", loadPattern);
  propPicker?.addEventListener("change", () => {
    prop = normalizeProp(propPicker.value);
    resize();
  });
  dwellInput?.addEventListener("input", () => {
    dwellRatio = normalizeDwellRatio(dwellInput.value);
    resize();
  });
  tempoInput?.addEventListener("input", () => {
    beatsPerMinute = normalizeBeatsPerMinute(tempoInput.value);
  });
  holdInput?.addEventListener("change", () => {
    holdTwos = Boolean(holdInput.checked);
    clock = { ...clock, elapsed: 0 };
    resize();
  });
  pauseButton?.addEventListener("click", () => {
    clock = toggleCourtPause(clock);
    syncTransport();
  });
  stepButton?.addEventListener("click", () => {
    clock = stepCourtClock(clock, beatSeconds());
    syncTransport();
  });
  syncTransport();
  resize();
  requestAnimationFrame(frame);
  return { patterns: PASSING_PATTERNS };
}
