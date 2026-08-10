/*
 * © Andrei Makarov / amaaov
 * Licensed under CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
 * SPDX-License-Identifier: CC-BY-4.0
 */

(function () {
  var STORAGE_KEY = "fw-quest-v01-checks";
  var NAME_KEY = "fw-quest-v01-name";
  var GEAR_KEY = "fw-quest-v01-gear";
  var OPEN_KEY = "fw-quest-v01-open";
  var SCROLL_KEY = "fw-quest-v01-scroll";
  var FORMAT_KEY = "fw-quest-v01-cert-format";
  var PROGRAMME = "Квест навыков: уницикл со свободным ходом";
  var VERSION = "v0.1 · 4 августа 2026";

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  var grades = Array.prototype.slice.call(
    document.querySelectorAll(".quest-log[data-grade-id]")
  );
  var boxes = Array.prototype.slice.call(
    document.querySelectorAll('input[type="checkbox"][data-grade]')
  );
  var dockGrade = document.getElementById("dock-grade");
  var dockFill = document.getElementById("dock-fill");
  var dockBar = document.getElementById("dock-bar");
  var dockMeta = document.getElementById("dock-meta");
  var btnCert = document.getElementById("btn-certificate");
  var btnReset = document.getElementById("btn-reset");
  var modal = document.getElementById("cert-modal");
  var certDialog = modal && modal.querySelector(".cert-dialog");
  var certName = document.getElementById("cert-name");
  var certGear = document.getElementById("cert-gear");
  var certCanvas = document.getElementById("cert-canvas");
  var certFormatMeta = document.getElementById("cert-format-meta");
  var lastFocus = null;
  var modalKeyHandler = null;

  var CERT_FORMATS = {
    "landscape-16x9": { id: "landscape-16x9", label: "Альбом", w: 1920, h: 1080 },
    "classic-4x3": { id: "classic-4x3", label: "Классика", w: 1440, h: 1080 },
    "square-1x1": { id: "square-1x1", label: "Квадрат", w: 1080, h: 1080 },
    "portrait-4x5": { id: "portrait-4x5", label: "Портрет", w: 1080, h: 1350 },
  };

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }
  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  function loadOpen() {
    try {
      return JSON.parse(localStorage.getItem(OPEN_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }
  function persistOpen() {
    var open = {};
    grades.forEach(function (d) {
      open[d.id] = !!d.open;
    });
    localStorage.setItem(OPEN_KEY, JSON.stringify(open));
  }
  function persist() {
    var state = {};
    boxes.forEach(function (b) {
      if (b.checked) state[b.id] = true;
    });
    saveState(state);
    if (certName) localStorage.setItem(NAME_KEY, certName.value.trim());
    if (certGear) localStorage.setItem(GEAR_KEY, certGear.value.trim());
    persistOpen();
    localStorage.setItem(SCROLL_KEY, String(window.scrollY || 0));
  }
  function restore() {
    var state = loadState();
    boxes.forEach(function (b) {
      b.checked = !!state[b.id];
    });
    if (certName) certName.value = localStorage.getItem(NAME_KEY) || "";
    if (certGear) certGear.value = localStorage.getItem(GEAR_KEY) || "";
    var open = loadOpen();
    grades.forEach(function (d) {
      if (Object.prototype.hasOwnProperty.call(open, d.id)) d.open = !!open[d.id];
    });
    var fmt = localStorage.getItem(FORMAT_KEY);
    if (fmt) {
      var input = document.querySelector('input[name="cert-format"][value="' + fmt + '"]');
      if (input) input.checked = true;
    }
  }
  function restoreScroll() {
    var y = parseInt(localStorage.getItem(SCROLL_KEY) || "", 10);
    if (!isFinite(y) || y < 0) return;
    var apply = function () {
      window.scrollTo(0, y);
    };
    apply();
    requestAnimationFrame(function () {
      apply();
      requestAnimationFrame(apply);
    });
  }

  function gradeStats(details) {
    var id = details.getAttribute("data-grade-id");
    var gradeBoxes = boxes.filter(function (b) {
      return b.getAttribute("data-grade") === id;
    });
    var required = gradeBoxes.filter(function (b) {
      return b.getAttribute("data-optional") !== "1";
    });
    var electives = gradeBoxes.filter(function (b) {
      return b.getAttribute("data-optional") === "1";
    });
    var reqDone = required.filter(function (b) {
      return b.checked;
    }).length;
    var elDone = electives.filter(function (b) {
      return b.checked;
    }).length;
    var needElective = electives.length > 0;
    var complete =
      required.length > 0 &&
      reqDone === required.length &&
      (!needElective || elDone >= 1);
    return {
      id: id,
      seal: details.getAttribute("data-seal") || id,
      title: details.getAttribute("data-title") || id,
      done: gradeBoxes.filter(function (b) {
        return b.checked;
      }).length,
      total: gradeBoxes.length,
      reqDone: reqDone,
      reqTotal: required.length,
      elDone: elDone,
      complete: complete,
    };
  }

  function updateUI() {
    var completed = [];
    var ridingSealed = [];
    var overallDone = 0;
    var overallTotal = 0;
    grades.forEach(function (details) {
      var s = gradeStats(details);
      overallDone += s.done;
      overallTotal += s.total;
      details.classList.toggle("is-complete", s.complete);
      var prog = details.querySelector(".grade-progress");
      if (prog) {
        if (s.id === "fw4") {
          prog.textContent = s.reqDone + "/" + s.reqTotal + " обяз. · " + s.elDone + " выбор.";
        } else {
          prog.textContent = s.done + "/" + s.total;
        }
      }
      var rail = document.querySelector('.rail-inner a[href="#' + details.id + '"]');
      if (rail) rail.classList.toggle("is-complete", s.complete);
      if (s.complete) {
        completed.push(s);
        if (s.id !== "gate") ridingSealed.push(s);
      }
    });
    var highest = ridingSealed.length ? ridingSealed[ridingSealed.length - 1] : null;
    if (dockGrade) {
      dockGrade.textContent = highest
        ? highest.seal + " · " + highest.title
        : "Ездовой грейд ещё не запечатан";
    }
    if (dockMeta) {
      dockMeta.textContent =
        overallDone + " / " + overallTotal + " задач · " + VERSION;
    }
    if (dockFill && overallTotal) {
      var pct = Math.round((100 * overallDone) / overallTotal);
      dockFill.style.width = pct + "%";
      if (dockBar) {
        dockBar.setAttribute("aria-valuenow", String(pct));
        dockBar.setAttribute("aria-valuetext", overallDone + " из " + overallTotal + " задач");
      }
    }
    if (btnCert) {
      var unlocked = ridingSealed.length > 0;
      btnCert.disabled = !unlocked;
      btnCert.setAttribute("aria-disabled", unlocked ? "false" : "true");
      btnCert.setAttribute(
        "aria-label",
        unlocked
          ? "Открыть сертификат для " + (highest ? highest.seal : "запечатанного грейда")
          : "Сертификат заблокирован, пока не запечатан ездовой грейд FW1–FW4"
      );
    }
  }

  function getFocusable(root) {
    if (!root) return [];
    return Array.prototype.slice
      .call(
        root.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input:not([type="hidden"]):not([disabled]), select, [tabindex]:not([tabindex="-1"])'
        )
      )
      .filter(function (el) {
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      });
  }

  function setBackgroundInert(on) {
    document.querySelectorAll(".skip-link, .page, .dock").forEach(function (node) {
      if (on) {
        node.setAttribute("inert", "");
        node.setAttribute("aria-hidden", "true");
      } else {
        node.removeAttribute("inert");
        node.removeAttribute("aria-hidden");
      }
    });
  }

  function currentFormat() {
    var checked = document.querySelector('input[name="cert-format"]:checked');
    var id = (checked && checked.value) || "landscape-16x9";
    return CERT_FORMATS[id] || CERT_FORMATS["landscape-16x9"];
  }

  function updateFormatMeta() {
    var fmt = currentFormat();
    if (certFormatMeta) {
      certFormatMeta.textContent = fmt.w + " × " + fmt.h + " · " + fmt.label;
    }
    document.querySelectorAll(".cert-format-option").forEach(function (label) {
      var input = label.querySelector('input[name="cert-format"]');
      label.classList.toggle("is-selected", !!(input && input.checked));
    });
    localStorage.setItem(FORMAT_KEY, fmt.id);
  }

  var GRADE_COSMOLOGY = {
    fw1: {
      seal: "FW1",
      body: "Меркурий",
      rule: "Зажигание в периапсисе",
      motto: "ПЕРВЫЙ ИМПУЛЬС",
      capability: "Старт и остановка с плечами вперёд, свободный коаст",
      paper: ["#f6efe4", "#efe6d6", "#e8dcc8"],
      ink: "#1c1410",
      accent: "#b07830",
      metal: "#8a5c28",
      waves: 3,
      waveAmp: 0.018,
      orbits: 2,
      eccentricity: 0.12,
      spokes: 6,
      watermark: "ignition",
    },
    fw2: {
      seal: "FW2",
      body: "Венера",
      rule: "Скраб тормоза · свободный коаст",
      motto: "ДВОЙНАЯ ФАЗА",
      capability: "Остановки с плечами вперёд, импульс и float вместе",
      paper: ["#f4ebe8", "#ede2de", "#e6d8d2"],
      ink: "#1a1214",
      accent: "#a05058",
      metal: "#784048",
      waves: 5,
      waveAmp: 0.022,
      orbits: 3,
      eccentricity: 0.2,
      spokes: 8,
      watermark: "dual",
    },
    fw3: {
      seal: "FW3",
      body: "Земля–Луна",
      rule: "Связанная длинная орбита",
      motto: "НЕПРЕРЫВНЫЙ ПУТЬ",
      capability: "Длинный выезд, посадки, мягкий рельеф",
      paper: ["#eaf0f2", "#e2eae8", "#d8e2e0"],
      ink: "#101820",
      accent: "#3a7088",
      metal: "#2c5868",
      waves: 6,
      waveAmp: 0.016,
      orbits: 4,
      eccentricity: 0.08,
      spokes: 8,
      watermark: "bound",
    },
    fw4: {
      seal: "FW4",
      body: "Марс",
      rule: "Эксцентричный грунт · узлы прыжков",
      motto: "ПЕЧАТЬ РЕЛЬЕФА",
      capability: "Волны, хоп, длинный float, задания по выбору",
      paper: ["#f4eae4", "#ecdfd6", "#e4d4c8"],
      ink: "#201410",
      accent: "#a04828",
      metal: "#783820",
      waves: 7,
      waveAmp: 0.028,
      orbits: 5,
      eccentricity: 0.32,
      spokes: 10,
      watermark: "eccentric",
    },
  };

  function hashSeed(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      var t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function drawWheel(ctx, cx, cy, R, copper, ice, spokes) {
    spokes = spokes || 8;
    ctx.strokeStyle = copper;
    ctx.lineWidth = Math.max(2, R * 0.035);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = ice;
    ctx.lineWidth = Math.max(1, R * 0.018);
    for (var i = 0; i < spokes; i++) {
      var a = (i / spokes) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * 0.22, cy + Math.sin(a) * R * 0.22);
      ctx.lineTo(cx + Math.cos(a) * R * 0.92, cy + Math.sin(a) * R * 0.92);
      ctx.stroke();
    }
    ctx.strokeStyle = copper;
    ctx.lineWidth = Math.max(2, R * 0.03);
    ctx.beginPath();
    ctx.moveTo(cx, cy - R * 0.22);
    ctx.lineTo(cx, cy - R * 1.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy - R * 1.22, R * 0.28, R * 0.1, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawWaveBands(ctx, w, h, metal, accent, seed, s, cosmo) {
    var rand = mulberry32(seed);
    var bands = cosmo.waves;
    var amp = h * cosmo.waveAmp;
    ctx.save();
    ctx.lineWidth = Math.max(0.8, 1.1 * s);
    for (var b = 0; b < bands; b++) {
      var y0 = h * (0.55 + b * 0.06) + rand() * h * 0.02;
      var phase = rand() * Math.PI * 2;
      var freq = 2.2 + rand() * 2.8 + cosmo.eccentricity * 4;
      ctx.strokeStyle = b % 2 === 0 ? metal : accent;
      ctx.globalAlpha = 0.07 + rand() * 0.06;
      ctx.beginPath();
      for (var x = 0; x <= w; x += 4) {
        var y =
          y0 +
          Math.sin((x / w) * Math.PI * freq + phase) * amp +
          Math.sin((x / w) * Math.PI * (freq * 0.37) + phase * 1.7) * amp * 0.35;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawOrbitWatermarks(ctx, w, h, metal, accent, cosmo, s) {
    ctx.save();
    var cx = w * 0.5;
    var cy = h * 0.52;
    var baseR = Math.min(w, h) * 0.22;
    ctx.strokeStyle = metal;
    ctx.lineWidth = Math.max(0.7, 0.9 * s);
    for (var i = 0; i < cosmo.orbits; i++) {
      var rx = baseR * (0.55 + i * 0.22);
      var ry = rx * (1 - cosmo.eccentricity * (0.4 + i * 0.08));
      ctx.globalAlpha = 0.045 + i * 0.012;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, (i * Math.PI) / 11, 0, Math.PI * 2);
      ctx.stroke();
    }
    // periapsis / apoapsis marks
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(cx + baseR * 0.95, cy, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = metal;
    ctx.beginPath();
    ctx.arc(cx - baseR * (0.95 - cosmo.eccentricity), cy, 2.8 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawDiagonalSealWatermark(ctx, w, h, seal, metal, s) {
    ctx.save();
    ctx.translate(w * 0.5, h * 0.55);
    ctx.rotate(-Math.PI / 7);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = metal;
    ctx.globalAlpha = 0.045;
    ctx.font = "700 " + Math.round(Math.min(w, h) * 0.18) + "px Syne, sans-serif";
    ctx.fillText(seal, 0, 0);
    ctx.globalAlpha = 0.03;
    ctx.font = "600 " + Math.round(22 * s) + "px IBM Plex Mono, monospace";
    for (var row = -2; row <= 2; row++) {
      for (var col = -3; col <= 3; col++) {
        if (row === 0 && col === 0) continue;
        ctx.fillText(seal, col * 140 * s, row * 90 * s);
      }
    }
    ctx.restore();
  }

  function drawUnicycleWatermark(ctx, w, h, metal, accent, cosmo, s) {
    ctx.save();
    ctx.globalAlpha = 0.055;
    var cx = w * (cosmo.watermark === "eccentric" ? 0.78 : 0.22);
    var cy = h * 0.62;
    var R = Math.min(w, h) * 0.11;
    drawWheel(ctx, cx, cy, R, metal, accent, cosmo.spokes);
    if (cosmo.watermark === "dual") {
      ctx.globalAlpha = 0.04;
      drawWheel(ctx, w * 0.78, h * 0.32, R * 0.7, accent, metal, cosmo.spokes);
    }
    if (cosmo.watermark === "ignition") {
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1, 1.4 * s);
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.35, -0.9, 0.4);
      ctx.stroke();
    }
    if (cosmo.watermark === "bound") {
      ctx.globalAlpha = 0.04;
      ctx.strokeStyle = metal;
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.4, R * 2.2, R * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (cosmo.watermark === "eccentric") {
      ctx.globalAlpha = 0.05;
      ctx.strokeStyle = accent;
      ctx.beginPath();
      ctx.ellipse(w * 0.35, h * 0.38, R * 1.8, R * 1.05, 0.4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMicroBand(ctx, y, width, text, color, padX, s) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.font = "500 " + Math.round(10 * s) + "px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    var x = padX;
    var metrics = ctx.measureText(text + "   ·   ");
    var unit = metrics.width || 120;
    while (x < padX + width) {
      ctx.fillText(text, x, y);
      x += unit;
    }
    ctx.restore();
  }

  function drawCertificate() {
    if (!certCanvas) return;
    var fmt = currentFormat();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    certCanvas.width = Math.floor(fmt.w * dpr);
    certCanvas.height = Math.floor(fmt.h * dpr);
    certCanvas.style.aspectRatio = fmt.w + " / " + fmt.h;
    var ctx = certCanvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var W = fmt.w;
    var H = fmt.h;
    var shortSide = Math.min(W, H);
    var s = shortSide / 1080;

    var completed = grades.map(gradeStats).filter(function (g) {
      return g.complete && g.id !== "gate";
    });
    var highest = completed.length ? completed[completed.length - 1] : null;
    var cosmo = highest
      ? GRADE_COSMOLOGY[highest.id] || GRADE_COSMOLOGY.fw1
      : GRADE_COSMOLOGY.fw1;
    var name = (certName && certName.value.trim()) || "Ездок";
    var gear = (certGear && certGear.value.trim()) || "Втулка / тормоз / колесо не указаны";
    var date = new Date().toISOString().slice(0, 10);
    var serial = hashSeed(
      [cosmo.seal, date, name, String(completed.length)].join("|")
    )
      .toString(16)
      .toUpperCase()
      .slice(0, 10);

    var paper0 = cosmo.paper[0];
    var paper1 = cosmo.paper[1];
    var paper2 = cosmo.paper[2];
    var metal = cosmo.metal;
    var accent = cosmo.accent;
    var ink = cosmo.ink;
    var mute = "rgba(28, 24, 32, 0.7)";

    var bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, paper0);
    bg.addColorStop(0.5, paper1);
    bg.addColorStop(1, paper2);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Security / cosmology layers
    drawOrbitWatermarks(ctx, W, H, metal, accent, cosmo, s);
    drawWaveBands(ctx, W, H, metal, accent, hashSeed(cosmo.seal + "waves"), s, cosmo);
    drawDiagonalSealWatermark(ctx, W, H, cosmo.seal, metal, s);
    drawUnicycleWatermark(ctx, W, H, metal, accent, cosmo, s);

    // star dust unique per grade
    var rand = mulberry32(hashSeed(cosmo.seal + date));
    ctx.fillStyle = accent;
    for (var st = 0; st < 28 + cosmo.orbits * 8; st++) {
      ctx.globalAlpha = 0.04 + rand() * 0.08;
      ctx.beginPath();
      ctx.arc(
        W * (0.06 + rand() * 0.88),
        H * (0.06 + rand() * 0.88),
        (0.6 + rand() * 1.8) * s,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    var inset = Math.max(28, shortSide * 0.035);
    ctx.strokeStyle = metal;
    ctx.lineWidth = Math.max(2.5, W * 0.0035);
    ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(1, W * 0.0015);
    ctx.strokeRect(inset + 10 * s, inset + 10 * s, W - inset * 2 - 20 * s, H - inset * 2 - 20 * s);

    var padX = Math.max(80, W * 0.1);
    drawMicroBand(
      ctx,
      inset + 18 * s,
      W - padX * 2,
      cosmo.seal + " · " + cosmo.body.toUpperCase() + " · " + cosmo.rule.toUpperCase() + " · " + serial,
      accent,
      padX,
      s
    );
    drawMicroBand(
      ctx,
      H - inset - 16 * s,
      W - padX * 2,
      "КВЕСТ ФРИВИЛА · " + VERSION + " · " + date + " · НЕЗАВИСИМО ОТ IUF",
      metal,
      padX,
      s
    );

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = accent;
    ctx.font = "600 " + Math.round(13 * s) + "px IBM Plex Mono, monospace";
    ctx.fillText(cosmo.body.toUpperCase() + "  ·  " + cosmo.motto, W / 2, H * 0.14);

    ctx.fillStyle = ink;
    ctx.font = "600 " + Math.round(W * 0.026) + "px Syne, sans-serif";
    ctx.fillText(PROGRAMME, W / 2, H * 0.19);

    ctx.fillStyle = mute;
    ctx.font = "italic " + Math.round(15 * s) + "px Newsreader, serif";
    ctx.fillText(cosmo.rule, W / 2, H * 0.235);

    ctx.fillStyle = ink;
    ctx.font = "700 " + Math.round(W * 0.048) + "px Syne, sans-serif";
    ctx.fillText(name, W / 2, H * 0.32);

    ctx.fillStyle = metal;
    ctx.font = "600 " + Math.round(W * 0.02) + "px Newsreader, serif";
    ctx.fillText(
      highest ? cosmo.seal + " — " + highest.title : "Ездовой грейд не запечатан",
      W / 2,
      H * 0.385
    );

    ctx.fillStyle = mute;
    ctx.font = "italic " + Math.round(14 * s) + "px Newsreader, serif";
    ctx.fillText(cosmo.capability, W / 2, H * 0.43);

    var wheelR = Math.min(W, H) * (0.09 + cosmo.eccentricity * 0.04);
    ctx.save();
    ctx.globalAlpha = 0.95;
    drawWheel(ctx, W / 2, H * 0.58, wheelR, metal, accent, cosmo.spokes);
    // grade-unique periapsis marker on the drawn wheel
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(
      W / 2 + wheelR * (1 - cosmo.eccentricity * 0.5),
      H * 0.58,
      Math.max(2.5, 3.2 * s),
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = mute;
    ctx.font = "500 " + Math.round(13 * s) + "px IBM Plex Mono, monospace";
    wrapText(ctx, gear, W / 2, H * 0.74, W * 0.68, 18 * s);

    var seals = completed
      .map(function (g) {
        return g.seal;
      })
      .join(" · ");
    ctx.fillStyle = accent;
    ctx.font = "700 " + Math.round(16 * s) + "px IBM Plex Mono, monospace";
    ctx.fillText(seals || "—", W / 2, H * 0.82);

    ctx.fillStyle = mute;
    ctx.font = "400 " + Math.round(11 * s) + "px IBM Plex Mono, monospace";
    ctx.fillText(
      "Космологическая печать " +
        cosmo.seal +
        " · e=" +
        cosmo.eccentricity.toFixed(2) +
        " · волны " +
        cosmo.waves +
        " · " +
        date,
      W / 2,
      H * 0.88
    );
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    var words = text.split(/\s+/);
    var line = "";
    var yy = y;
    for (var n = 0; n < words.length; n++) {
      var test = line + words[n] + " ";
      if (ctx.measureText(test).width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, yy);
        line = words[n] + " ";
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    ctx.fillText(line.trim(), x, yy);
  }

  function openModal() {
    if (!modal || !certDialog) return;
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    setBackgroundInert(true);
    updateFormatMeta();
    drawCertificate();
    modalKeyHandler = function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
        return;
      }
      if (e.key !== "Tab") return;
      var focusable = getFocusable(certDialog);
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", modalKeyHandler);
    window.setTimeout(function () {
      if (certName) certName.focus();
      else certDialog.focus();
    }, 0);
  }
  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = "";
    setBackgroundInert(false);
    if (modalKeyHandler) {
      document.removeEventListener("keydown", modalKeyHandler);
      modalKeyHandler = null;
    }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function downloadCert() {
    drawCertificate();
    var a = document.createElement("a");
    a.download = "freewheel-quest-certificate.png";
    a.href = certCanvas.toDataURL("image/png");
    a.click();
  }

  // Slow plasma field continuous through the document; fixed canvas shows the viewport slice.
  (function plasmaBg() {
    var canvas = document.getElementById("cosmos-canvas");
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d", { alpha: false });
    var w = 0;
    var h = 0;
    var viewW = 0;
    var viewH = 0;
    var t0 = performance.now();
    var imageData = null;
    var pixels = null;
    var scrollY = 0;
    var docH = 1;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Palette: charcoal cosmos / ice / copper
    var C0 = [8, 10, 18];
    var C1 = [50, 90, 140];
    var C2 = [201, 146, 74];

    function resize() {
      viewW = window.innerWidth;
      viewH = window.innerHeight;
      w = Math.max(1, Math.floor(viewW / 2));
      h = Math.max(1, Math.floor(viewH / 2));
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = viewW + "px";
      canvas.style.height = viewH + "px";
      imageData = ctx.createImageData(w, h);
      pixels = imageData.data;
      docH = Math.max(document.documentElement.scrollHeight, viewH, 1);
    }
    function onScroll() {
      scrollY = window.scrollY || window.pageYOffset || 0;
      docH = Math.max(document.documentElement.scrollHeight, viewH, 1);
    }
    function lerp(a, b, t) {
      return a + (b - a) * t;
    }
    function mix3(a, b, t) {
      return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    }
    function paint(now) {
      var t = reduce ? 0 : (now - t0) / 1000;
      var span = Math.max(docH, viewH, 1);
      var i = 0;
      for (var y = 0; y < h; y++) {
        var pageY = scrollY + (y / h) * viewH;
        var ny = pageY / span;
        for (var x = 0; x < w; x++) {
          var nx = x / w;
          var wave =
            Math.sin(ny * 9.5 + t * 0.22) * 0.5 +
            Math.sin(ny * 4.2 - t * 0.14 + nx * 1.4) * 0.32 +
            Math.sin(ny * 16 + t * 0.09 + Math.sin(t * 0.05 + nx * 2)) * 0.18 +
            Math.sin((ny + nx * 0.1) * 6.4 - t * 0.17) * 0.16;
          var v = (wave + 1.2) / 2.4;
          v = Math.min(1, Math.max(0, v));
          var col =
            v < 0.45 ? mix3(C0, C1, v / 0.45) : mix3(C1, C2, (v - 0.45) / 0.55);
          pixels[i++] = col[0] | 0;
          pixels[i++] = col[1] | 0;
          pixels[i++] = col[2] | 0;
          pixels[i++] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }
    function frame(now) {
      paint(now);
      if (!reduce) requestAnimationFrame(frame);
    }
    resize();
    onScroll();
    window.addEventListener("resize", function () {
      resize();
      if (reduce) paint(t0);
    });
    window.addEventListener(
      "scroll",
      function () {
        onScroll();
        if (reduce) paint(t0);
      },
      { passive: true }
    );
    requestAnimationFrame(frame);
  })();

  boxes.forEach(function (b) {
    b.addEventListener("change", function () {
      persist();
      updateUI();
    });
  });
  grades.forEach(function (d) {
    d.addEventListener("toggle", function () {
      persistOpen();
    });
  });
  if (certName) certName.addEventListener("input", persist);
  if (certGear) certGear.addEventListener("input", persist);
  document.querySelectorAll('input[name="cert-format"]').forEach(function (input) {
    input.addEventListener("change", function () {
      updateFormatMeta();
      drawCertificate();
    });
  });
  if (btnCert) btnCert.addEventListener("click", openModal);
  if (btnReset) {
    btnReset.addEventListener("click", function () {
      if (!window.confirm("Сбросить все отмеченные задачи на этом устройстве?")) return;
      boxes.forEach(function (b) {
        b.checked = false;
      });
      persist();
      updateUI();
      if (dockGrade) dockGrade.focus();
    });
  }
  var btnClose = document.getElementById("btn-close-cert");
  var btnDraw = document.getElementById("btn-redraw-cert");
  var btnDl = document.getElementById("btn-download-cert");
  if (btnClose) btnClose.addEventListener("click", closeModal);
  if (btnDraw) btnDraw.addEventListener("click", drawCertificate);
  if (btnDl) btnDl.addEventListener("click", downloadCert);
  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeModal();
    });
  }
  window.addEventListener("scroll", function () {
    localStorage.setItem(SCROLL_KEY, String(window.scrollY || 0));
  }, { passive: true });

  restore();
  updateUI();
  updateFormatMeta();
  restoreScroll();
})();
