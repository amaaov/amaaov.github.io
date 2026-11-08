const NS = "http://www.w3.org/2000/svg";
const BODY = "#1d1d20";
const TRAY = "#0e0e10";
const KEY_W = "#d9dadc";
const KEY_B = "#c9cacd";
const KNOB_FILL = "#0a0a0b";
const BTNC = "#2a2a2e";
const LABEL = "#e8e8ea";
const LEGEND = "#a6a6ad";

const WHITE_K = [0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18, 19, 21, 23, 24, 26];
const BLACK_K = [1, 3, 5, 8, 10, 13, 15, 17, 20, 22, 25];
const BLACK_AFTER = [0, 1, 2, 4, 5, 7, 8, 9, 11, 12, 14];

function svgEl(tag, attrs = {}, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }
  parent.appendChild(node);
  return node;
}

function textLabel(parent, x, y, content, size, fill, weight = 600) {
  const node = svgEl(
    "text",
    {
      x,
      y,
      "text-anchor": "middle",
      "font-family": "'Iowan Old Style', Palatino, Georgia, serif",
      "font-size": size,
      "font-weight": weight,
      fill,
      "pointer-events": "none",
    },
    parent,
  );
  node.textContent = content;
  return node;
}

function valueToAngle(value) {
  return -135 + value * 270;
}

export function mountDeviceFace(root, { onKnob, onButton, onKey } = {}) {
  root.innerHTML = "";
  root.classList.add("device");

  const svg = svgEl(
    "svg",
    {
      id: "panel",
      viewBox: "0 0 1000 640",
      role: "application",
      "aria-label": "M-VAVE FM-1 panel for Holding Topology",
    },
    root,
  );

  const knobs = {};
  const buttons = {};
  const keys = [];

  svgEl("rect", { x: 4, y: 4, width: 992, height: 632, rx: 44, fill: BODY }, svg);

  function addKnob(x, y, radius, name) {
    const group = svgEl("g", { class: "ctl knob" }, svg);
    svgEl("circle", { cx: x, cy: y, r: radius + 5, fill: TRAY }, group);
    svgEl(
      "circle",
      { cx: x, cy: y, r: radius, fill: KNOB_FILL, stroke: "#3a3a40", "stroke-width": 2 },
      group,
    );
    const indicator = svgEl(
      "line",
      {
        x1: x,
        y1: y - radius + 5,
        x2: x,
        y2: y - radius + 15,
        stroke: LABEL,
        "stroke-width": 3,
        "stroke-linecap": "round",
        class: "knob-indicator",
      },
      group,
    );
    textLabel(group, x, y + radius + 16, name, 11, LEGEND);
    svgEl("circle", { cx: x, cy: y, r: radius + 14, fill: "transparent" }, group);
    knobs[name] = { group, indicator, x, y, radius, value: 0.5 };
    return knobs[name];
  }

  function addButton(x, y, width, height, name) {
    const group = svgEl("g", { class: "ctl button" }, svg);
    svgEl(
      "rect",
      {
        x,
        y,
        width,
        height,
        rx: 9,
        fill: BTNC,
        stroke: "#46464c",
        "stroke-width": 1.5,
        class: "btnface",
      },
      group,
    );
    textLabel(group, x + width / 2, y + height / 2 + 4, name.replace("-", "−"), 11, LABEL);
    buttons[name] = { group, lit: false };
    return buttons[name];
  }

  addKnob(105, 100, 24, "MASTER");
  addKnob(215, 100, 24, "SELECT");
  addKnob(105, 210, 24, "PRESETS");
  addKnob(215, 210, 24, "ALGORITHM");
  addKnob(610, 100, 22, "KNOB1");
  addKnob(714, 100, 22, "KNOB2");
  addKnob(818, 100, 22, "KNOB3");
  addKnob(922, 100, 22, "KNOB4");

  svgEl("rect", { x: 58, y: 262, width: 210, height: 58, rx: 14, fill: TRAY }, svg);
  addButton(72, 272, 82, 38, "OCT-");
  addButton(170, 272, 82, 38, "OCT+");
  svgEl("rect", { x: 300, y: 44, width: 236, height: 236, rx: 26, fill: "#0a0a0b" }, svg);
  svgEl("rect", { x: 568, y: 160, width: 400, height: 140, rx: 18, fill: TRAY }, svg);

  const row1 = ["FX", "SEL", "ENV", "LFO", "EDIT", "GLO"];
  const row2 = ["HOME", "SAVE", "ARP", "SEQ", "PLAY", "REC"];
  for (let index = 0; index < 6; index += 1) {
    addButton(582 + index * 63, 174, 54, 48, row1[index]);
    addButton(582 + index * 63, 236, 54, 48, row2[index]);
  }

  const keyOriginX = 36;
  const keyOriginY = 340;
  const keyWidth = 928;
  const keyHeight = 270;
  svgEl(
    "rect",
    { x: keyOriginX, y: keyOriginY, width: keyWidth, height: keyHeight, rx: 18, fill: TRAY },
    svg,
  );
  const pitch = (keyWidth - 24) / 16;
  const whiteWidth = pitch * 0.78;
  const whiteY = keyOriginY + keyHeight * 0.46;
  const whiteHeight = keyHeight * 0.49;
  const blackY = keyOriginY + keyHeight * 0.05;
  const blackHeight = keyHeight * 0.31;
  const left = (index) => keyOriginX + 12 + index * pitch + (pitch - whiteWidth) / 2;

  for (let index = 0; index < 16; index += 1) {
    const group = svgEl("g", { class: "ctl key" }, svg);
    svgEl(
      "rect",
      {
        x: left(index),
        y: whiteY,
        width: whiteWidth,
        height: whiteHeight,
        rx: whiteWidth / 2,
        fill: KEY_W,
        class: "keyface white",
      },
      group,
    );
    if (index < 12) {
      textLabel(
        group,
        left(index) + whiteWidth / 2,
        whiteY + whiteHeight - 14,
        `V${index + 1}`,
        12,
        "#1a1714",
        700,
      );
    }
    keys[WHITE_K[index]] = { group, kind: "white", index, voice: index < 12 ? index : null };
  }

  BLACK_AFTER.forEach((after, blackIndex) => {
    const group = svgEl("g", { class: "ctl key" }, svg);
    const cx = keyOriginX + 12 + (after + 1) * pitch;
    svgEl(
      "rect",
      {
        x: cx - whiteWidth / 2,
        y: blackY,
        width: whiteWidth,
        height: blackHeight,
        rx: whiteWidth / 2,
        fill: KEY_B,
        class: "keyface black",
      },
      group,
    );
    keys[BLACK_K[blackIndex]] = { group, kind: "black", index: blackIndex };
  });

  const screen = document.createElement("canvas");
  screen.id = "screen";
  screen.width = 240;
  screen.height = 240;
  screen.setAttribute("aria-label", "FM-1 juggling court display");
  root.appendChild(screen);

  function placeHits() {
    root.querySelectorAll(".hit").forEach((node) => node.remove());
    const place = (control, className, payload) => {
      const box = control.group.getBBox();
      const hit = document.createElement("div");
      hit.className = `hit${className ? ` ${className}` : ""}`;
      Object.assign(hit.style, {
        left: `${box.x / 10}%`,
        top: `${box.y / 6.4}%`,
        width: `${box.width / 10}%`,
        height: `${box.height / 6.4}%`,
      });
      hit.tabIndex = 0;
      hit.dataset.control = payload.name;
      hit.dataset.kind = payload.kind;
      if (payload.voice != null) {
        hit.dataset.voice = String(payload.voice);
      }
      if (payload.keyIndex != null) {
        hit.dataset.keyIndex = String(payload.keyIndex);
      }
      hit.setAttribute("role", payload.kind === "knob" ? "slider" : "button");
      hit.setAttribute("aria-label", payload.label);
      hit.addEventListener("touchstart", (event) => event.preventDefault(), { passive: false });
      root.appendChild(hit);
      control.hit = hit;
    };

    for (const [name, knob] of Object.entries(knobs)) {
      place(knob, "knob", { name, kind: "knob", label: name });
    }
    for (const [name, button] of Object.entries(buttons)) {
      place(button, "button", { name, kind: "button", label: name });
    }
    keys.forEach((key, midi) => {
      if (!key) {
        return;
      }
      place(key, "key", {
        name: `KEY${midi}`,
        kind: "key",
        label:
          key.kind === "white" && key.voice != null ? `Voice ${key.voice + 1}` : `Key ${midi}`,
        voice: key.voice,
        keyIndex: midi,
      });
    });
  }

  function setKnobValue(name, value) {
    const knob = knobs[name];
    if (!knob) {
      return;
    }
    knob.value = Math.min(1, Math.max(0, value));
    const angle = valueToAngle(knob.value);
    knob.indicator.setAttribute("transform", `rotate(${angle} ${knob.x} ${knob.y})`);
    if (knob.hit) {
      knob.hit.setAttribute("aria-valuenow", String(Math.round(knob.value * 100)));
      knob.hit.setAttribute("aria-valuemin", "0");
      knob.hit.setAttribute("aria-valuemax", "100");
    }
  }

  function setButtonLit(name, lit) {
    const button = buttons[name];
    if (!button) {
      return;
    }
    button.lit = lit;
    button.group.classList.toggle("lit", lit);
  }

  function setKeyLit(midi, lit) {
    const key = keys[midi];
    if (!key) {
      return;
    }
    key.group.classList.toggle("lit", lit);
  }

  placeHits();

  let drag = null;
  root.addEventListener("pointerdown", (event) => {
    const hit = event.target.closest(".hit");
    if (!hit) {
      return;
    }
    event.preventDefault();
    if (hit.dataset.kind === "knob") {
      drag = {
        name: hit.dataset.control,
        y: event.clientY,
        value: knobs[hit.dataset.control].value,
      };
      return;
    }
    if (hit.dataset.kind === "button") {
      onButton?.(hit.dataset.control, true);
      const release = () => {
        onButton?.(hit.dataset.control, false);
        window.removeEventListener("pointerup", release);
      };
      window.addEventListener("pointerup", release);
      return;
    }
    if (hit.dataset.kind === "key") {
      onKey?.({
        midi: Number(hit.dataset.keyIndex),
        voice: hit.dataset.voice == null ? null : Number(hit.dataset.voice),
        down: true,
      });
    }
  });

  window.addEventListener("pointermove", (event) => {
    if (!drag) {
      return;
    }
    const delta = (drag.y - event.clientY) / 140;
    const next = Math.min(1, Math.max(0, drag.value + delta));
    setKnobValue(drag.name, next);
    onKnob?.(drag.name, next);
  });

  window.addEventListener("pointerup", () => {
    drag = null;
  });

  root.addEventListener("keydown", (event) => {
    const hit = event.target.closest?.(".hit");
    if (!hit || hit.dataset.kind !== "knob") {
      return;
    }
    const step = event.shiftKey ? 0.08 : 0.02;
    if (["ArrowUp", "ArrowRight", "PageUp"].includes(event.key)) {
      event.preventDefault();
      const next = Math.min(1, knobs[hit.dataset.control].value + step);
      setKnobValue(hit.dataset.control, next);
      onKnob?.(hit.dataset.control, next);
    }
    if (["ArrowDown", "ArrowLeft", "PageDown"].includes(event.key)) {
      event.preventDefault();
      const next = Math.max(0, knobs[hit.dataset.control].value - step);
      setKnobValue(hit.dataset.control, next);
      onKnob?.(hit.dataset.control, next);
    }
    if (event.key === "Enter" || event.key === " ") {
      if (hit.dataset.kind === "button") {
        event.preventDefault();
        onButton?.(hit.dataset.control, true);
        onButton?.(hit.dataset.control, false);
      }
    }
  });

  return {
    screen,
    knobs,
    buttons,
    keys,
    setKnobValue,
    setButtonLit,
    setKeyLit,
    refreshHits: placeHits,
  };
}
