(function () {
  var STORAGE_KEY = "poi-quest-v04-checks";
  var NAME_KEY = "poi-quest-v04-name";
  var GEAR_KEY = "poi-quest-v04-gear";
  var SCROLL_KEY = "poi-quest-v04-scroll";
  var OPEN_KEY = "poi-quest-v04-open";
  var TERMS_KEY = "poi-quest-v04-terms-full";

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  var grades = Array.prototype.slice.call(
    document.querySelectorAll(".quest-log[data-grade-id]")
  );
  var boxes = Array.prototype.slice.call(
    document.querySelectorAll('input[type="checkbox"][data-grade]')
  );

  var dockGrade = document.getElementById("dock-grade");
  var dockFill = document.getElementById("dock-fill");
  var dockMeta = document.getElementById("dock-meta");
  var dockProgress = document.getElementById("dock-progress");
  var btnCert = document.getElementById("btn-certificate");
  var btnReset = document.getElementById("btn-reset");
  var modal = document.getElementById("cert-modal");
  var certDialog = modal
    ? modal.querySelector(".cert-dialog")
    : null;
  var certName = document.getElementById("cert-name");
  var certGear = document.getElementById("cert-gear");
  var certCanvas = document.getElementById("cert-canvas");
  var certFormatMeta = document.getElementById("cert-format-meta");
  var certificateWrap = document.getElementById("certificate");
  var FORMAT_KEY = "poi-quest-v04-cert-format";
  var lastFocusBeforeModal = null;
  var modalKeyHandler = null;

  var CERT_FORMATS = {
    "landscape-16x9": {
      id: "landscape-16x9",
      label: "Landscape",
      ratio: "16:9",
      w: 1920,
      h: 1080,
    },
    "classic-4x3": {
      id: "classic-4x3",
      label: "Classic",
      ratio: "4:3",
      w: 1440,
      h: 1080,
    },
    "square-1x1": {
      id: "square-1x1",
      label: "Square",
      ratio: "1:1",
      w: 1080,
      h: 1080,
    },
    "portrait-4x5": {
      id: "portrait-4x5",
      label: "Portrait",
      ratio: "4:5",
      w: 1080,
      h: 1350,
    },
    "tall-9x16": {
      id: "tall-9x16",
      label: "Tall",
      ratio: "9:16",
      w: 1080,
      h: 1920,
    },
  };

  function currentCertFormat() {
    var checked = document.querySelector('input[name="cert-format"]:checked');
    var id = (checked && checked.value) || "landscape-16x9";
    return CERT_FORMATS[id] || CERT_FORMATS["landscape-16x9"];
  }

  function updateFormatMeta() {
    var fmt = currentCertFormat();
    if (certFormatMeta) {
      certFormatMeta.textContent =
        fmt.w + " × " + fmt.h + " · " + fmt.label + " " + fmt.ratio;
    }
    document.querySelectorAll(".cert-format-option").forEach(function (label) {
      var input = label.querySelector('input[name="cert-format"]');
      label.classList.toggle("is-selected", !!(input && input.checked));
    });
    if (certificateWrap) {
      certificateWrap.classList.toggle("is-portrait", fmt.h > fmt.w);
    }
  }

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
    grades.forEach(function (details) {
      open[details.id] = !!details.open;
    });
    localStorage.setItem(OPEN_KEY, JSON.stringify(open));
  }

  function persistScroll() {
    localStorage.setItem(
      SCROLL_KEY,
      String(window.scrollY || window.pageYOffset || 0)
    );
  }

  function restore() {
    var state = loadState();
    boxes.forEach(function (box) {
      box.checked = !!state[box.id];
    });
    if (certName) certName.value = localStorage.getItem(NAME_KEY) || "";
    if (certGear) certGear.value = localStorage.getItem(GEAR_KEY) || "";

    var open = loadOpen();
    grades.forEach(function (details) {
      if (Object.prototype.hasOwnProperty.call(open, details.id)) {
        details.open = !!open[details.id];
      }
    });
  }

  function restoreScroll() {
    var raw = localStorage.getItem(SCROLL_KEY);
    if (raw == null || raw === "") return;
    var y = parseInt(raw, 10);
    if (!isFinite(y) || y < 0) return;
    var apply = function () {
      window.scrollTo(0, y);
    };
    apply();
    requestAnimationFrame(function () {
      apply();
      requestAnimationFrame(apply);
    });
    window.addEventListener("load", apply, { once: true });
  }

  function persist() {
    var state = {};
    boxes.forEach(function (box) {
      if (box.checked) state[box.id] = true;
    });
    saveState(state);
    if (certName) localStorage.setItem(NAME_KEY, certName.value.trim());
    if (certGear) localStorage.setItem(GEAR_KEY, certGear.value.trim());
    persistOpen();
    persistScroll();
  }

  function gradeStats(details) {
    var id = details.getAttribute("data-grade-id");
    var gradeBoxes = boxes.filter(function (b) {
      return b.getAttribute("data-grade") === id;
    });
    var done = gradeBoxes.filter(function (b) {
      return b.checked;
    }).length;
    var blurbNode = details.querySelector(".title-wrap > span:not(.grade-track)");
    if (!blurbNode) {
      var wrap = details.querySelector(".title-wrap");
      blurbNode = wrap ? wrap.querySelector("span") : null;
    }
    return {
      id: id,
      seal: details.getAttribute("data-seal") || id,
      title: details.getAttribute("data-title") || id,
      blurb: blurbNode ? blurbNode.textContent.trim() : "",
      done: done,
      total: gradeBoxes.length,
      complete: gradeBoxes.length > 0 && done === gradeBoxes.length,
      boxes: gradeBoxes,
    };
  }

  function compute() {
    var stats = grades.map(gradeStats);
    var highest = null;
    for (var i = 0; i < stats.length; i++) {
      if (stats[i].complete) highest = stats[i];
      else break;
    }
    var active = null;
    for (var j = 0; j < stats.length; j++) {
      if (!stats[j].complete) {
        active = stats[j];
        break;
      }
    }
    if (!active && stats.length) active = stats[stats.length - 1];
    return { stats: stats, highest: highest, active: active };
  }

  function refreshUI() {
    var result = compute();
    var active = result.active;
    var highest = result.highest;

    result.stats.forEach(function (s) {
      var details = document.getElementById(s.id);
      if (!details) return;
      details.classList.toggle("is-complete", s.complete);
      var pct = s.total ? Math.round((100 * s.done) / s.total) : 0;
      var fill = details.querySelector('[data-fill-for="' + s.id + '"]');
      if (fill) fill.style.width = pct + "%";
      var pill = details.querySelector('[data-progress-for="' + s.id + '"]');
      if (pill) {
        pill.textContent = s.done + " / " + s.total;
        pill.setAttribute(
          "aria-label",
          s.done +
            " of " +
            s.total +
            " objectives complete" +
            (s.complete ? ", grade complete" : "")
        );
      }
      var status = details.querySelector('[data-complete-for="' + s.id + '"]');
      if (status) {
        status.textContent = s.complete ? "Grade complete." : "";
      }
      var star = details.querySelector(".grade-star");
      if (star) {
        star.setAttribute("aria-hidden", s.complete ? "false" : "true");
        star.setAttribute("title", s.complete ? "Grade complete" : "");
      }
      var railLink = document.querySelector('.rank-rail a[href="#' + s.id + '"]');
      if (railLink) {
        railLink.classList.toggle("is-complete", s.complete);
        if (s.complete) railLink.setAttribute("title", s.seal + " complete");
        else railLink.removeAttribute("title");
      }
    });

    if (dockGrade && active) {
      dockGrade.textContent = active.title;
    }
    if (dockFill && active) {
      var pct = active.total ? Math.round((100 * active.done) / active.total) : 0;
      dockFill.style.width = pct + "%";
      if (dockProgress) {
        dockProgress.setAttribute("aria-valuenow", String(pct));
        dockProgress.setAttribute(
          "aria-valuetext",
          pct +
            " percent, " +
            active.done +
            " of " +
            active.total +
            " objectives in " +
            active.title
        );
      }
    }
    if (dockMeta && active) {
      var highLabel = highest ? highest.seal : "none yet";
      dockMeta.textContent =
        active.done +
        "/" +
        active.total +
        " · " +
        (highest ? highest.seal : "—");
      dockMeta.setAttribute(
        "aria-label",
        active.done +
          " of " +
          active.total +
          " objectives in active grade. Highest contiguous clear: " +
          highLabel +
          "."
      );
    }
    if (btnCert) {
      btnCert.disabled = !highest;
      btnCert.textContent = highest ? "Log · " + highest.seal : "Practice log";
      btnCert.setAttribute("aria-disabled", highest ? "false" : "true");
    }
  }

  function setBackgroundInert(inert) {
    var nodes = document.querySelectorAll(
      ".skip-link, .shell, .quest-dock"
    );
    nodes.forEach(function (node) {
      if (inert) {
        node.setAttribute("aria-hidden", "true");
        node.setAttribute("inert", "");
      } else {
        node.removeAttribute("aria-hidden");
        node.removeAttribute("inert");
      }
    });
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

  var prevComplete = {};

  function syncPrevComplete(stats) {
    stats.forEach(function (s) {
      prevComplete[s.id] = s.complete;
    });
  }

  function openNextAfterCompletion(stats) {
    var opened = null;
    for (var i = 0; i < stats.length - 1; i++) {
      if (!stats[i].complete || prevComplete[stats[i].id]) continue;
      var next = document.getElementById(stats[i + 1].id);
      if (!next) continue;
      next.open = true;
      opened = next;
    }
    if (opened) {
      persistOpen();
      var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      opened.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "nearest",
      });
    }
  }

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
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function wrapLines(ctx, text, maxW) {
    var words = String(text).split(/\s+/);
    var lines = [];
    var line = "";
    words.forEach(function (word) {
      var test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function roundRect(ctx, x, y, w, h, rad) {
    var r = Math.min(rad, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  var ZODIAC = [
    { name: "Capricorn", icon: "capricorn", element: "earth" },
    { name: "Aquarius", icon: "aquarius", element: "air" },
    { name: "Pisces", icon: "pisces", element: "water" },
    { name: "Aries", icon: "aries", element: "fire" },
    { name: "Taurus", icon: "taurus", element: "earth" },
    { name: "Gemini", icon: "gemini", element: "air" },
    { name: "Cancer", icon: "cancer", element: "water" },
    { name: "Leo", icon: "leo", element: "fire" },
    { name: "Virgo", icon: "virgo", element: "earth" },
    { name: "Libra", icon: "libra", element: "air" },
    { name: "Scorpio", icon: "scorpio", element: "water" },
    { name: "Sagittarius", icon: "sagittarius", element: "fire" },
  ];

  var PLANET_DAYS = [
    { name: "Sun", icon: "sun", hue: 42 },
    { name: "Moon", icon: "moon", hue: 210 },
    { name: "Mars", icon: "mars", hue: 8 },
    { name: "Mercury", icon: "mercury", hue: 155 },
    { name: "Jupiter", icon: "jupiter", hue: 270 },
    { name: "Venus", icon: "venus", hue: 340 },
    { name: "Saturn", icon: "saturn", hue: 50 },
  ];

  var ELEMENT_TINT = {
    fire: { h: 12, s: 0.45 },
    earth: { h: 85, s: 0.28 },
    air: { h: 200, s: 0.32 },
    water: { h: 215, s: 0.4 },
  };

  // Per-grade banknote note: planetary body + poi motif + checkable denom.
  var GRADE_NOTES = {
    ENT: {
      body: "Mercury",
      icon: "mercury",
      mark: "MER",
      denom: "03",
      motto: "FIRST ORBIT",
      capability: "Principal cascade exists; charter accepted.",
      paper: ["#f7f2ea", "#efe8dc", "#e8e0d4"],
      ink: "#241c14",
      accent: "#8a6030",
      metal: "#6a4828",
      pattern: "cascade",
      petals: 3,
    },
    "1A": {
      body: "Moon",
      icon: "moon",
      mark: "LUN",
      denom: "11",
      motto: "SILVER PATH",
      capability: "Foundational three — endurance and plane retention.",
      paper: ["#eef2f6", "#e6ecf2", "#dde6ee"],
      ink: "#141c28",
      accent: "#406888",
      metal: "#305068",
      pattern: "columns",
      petals: 4,
    },
    "1B": {
      body: "Venus",
      icon: "venus",
      mark: "VEN",
      denom: "12",
      motto: "ROSE DWELL",
      capability: "Extra-spin cascade, wallplane BC, orientation-preserving turns.",
      paper: ["#f8f0f2", "#f2e6ea", "#ecdee4"],
      ink: "#281418",
      accent: "#a04068",
      metal: "#803050",
      pattern: "mills",
      petals: 5,
    },
    "1C": {
      body: "Mars",
      icon: "mars",
      mark: "MAR",
      denom: "13",
      motto: "IRON THROW",
      capability: "Halfshower ownership; forward cascade acquisition; three-up 360.",
      paper: ["#f8f0ec", "#f2e6e0", "#ecdcd4"],
      ink: "#281410",
      accent: "#a03830",
      metal: "#802820",
      pattern: "shower",
      petals: 4,
    },
    "2A": {
      body: "Jupiter",
      icon: "jupiter",
      mark: "JUP",
      denom: "21",
      motto: "ROYAL CASCADE",
      capability: "Forward cascade consolidated; natural 180; four-poi opened.",
      paper: ["#f0f0f6", "#e8e8f2", "#e0e0ec"],
      ink: "#181820",
      accent: "#4040a0",
      metal: "#303080",
      pattern: "sync",
      petals: 6,
    },
    "2B": {
      body: "Saturn",
      icon: "saturn",
      mark: "SAT",
      denom: "22",
      motto: "RINGED LAW",
      capability: "Synchronous forward; corrected odd turns; dual plane-transition proof.",
      paper: ["#f2eee8", "#ebe6de", "#e4ddd4"],
      ink: "#201c14",
      accent: "#706040",
      metal: "#584830",
      pattern: "rings",
      petals: 5,
    },
    "2C": {
      body: "Uranus",
      icon: "uranus",
      mark: "URA",
      denom: "23",
      motto: "SIDEWAYS SKY",
      capability: "Long forward runs; chain connections; four-poi pirouettes.",
      paper: ["#eef4f2", "#e6eeec", "#dee8e4"],
      ink: "#142018",
      accent: "#207060",
      metal: "#185848",
      pattern: "snake",
      petals: 6,
    },
    "3A": {
      body: "Neptune",
      icon: "neptune",
      mark: "NEP",
      denom: "31",
      motto: "DEEP PLANE",
      capability: "Four endurance and siteswap depth; five flash with WS5.",
      paper: ["#eef2f6", "#e6ecf4", "#dee6f0"],
      ink: "#141c30",
      accent: "#3060a0",
      metal: "#284888",
      pattern: "waves",
      petals: 7,
    },
    "3B": {
      body: "Pluto",
      icon: "pluto",
      mark: "PLU",
      denom: "32",
      motto: "UNDERWORLD PASS",
      capability: "Forward four opened; five endurance and halfshower grown.",
      paper: ["#f2ecf2", "#ebe4ea", "#e4dce4"],
      ink: "#201420",
      accent: "#703888",
      metal: "#582868",
      pattern: "void",
      petals: 6,
    },
    "3C": {
      body: "Sun",
      icon: "sun",
      mark: "SOL",
      denom: "33",
      motto: "SOLAR SEAL",
      capability: "Stable five control; advanced four connections.",
      paper: ["#faf4ec", "#f4ece0", "#eee4d4"],
      ink: "#281808",
      accent: "#b07020",
      metal: "#885818",
      pattern: "solar",
      petals: 8,
    },
    "4A": {
      body: "Fixed Stars",
      icon: "stars",
      mark: "STR",
      denom: "41",
      motto: "CONSTELLATION",
      capability: "Long five runs; corrected odd turns on five.",
      paper: ["#eef0f6", "#e6e8f2", "#dee0ec"],
      ink: "#141428",
      accent: "#4050a8",
      metal: "#684888",
      pattern: "stars",
      petals: 8,
    },
    "4B": {
      body: "Nodes",
      icon: "nodes",
      mark: "NOD",
      denom: "42",
      motto: "ECLIPSE GATE",
      capability: "Forward five opened; dual transition proof on five.",
      paper: ["#f4eef0", "#ece6e8", "#e4dee0"],
      ink: "#201418",
      accent: "#903050",
      metal: "#702840",
      pattern: "eclipse",
      petals: 7,
    },
    "4C": {
      body: "Cosmos",
      icon: "cosmos",
      mark: "COS",
      denom: "43",
      motto: "FULL FIRMAMENT",
      capability: "Peak mixed five; full transition authorship; long connections.",
      paper: ["#f0eef4", "#e8e6f0", "#e0dee8"],
      ink: "#181420",
      accent: "#3860a8",
      metal: "#8040a0",
      pattern: "galaxy",
      petals: 9,
    },
  };

  function sunSign(month, day) {
    var md = month * 100 + day;
    if (md >= 1222 || md <= 119) return ZODIAC[0];
    if (md <= 218) return ZODIAC[1];
    if (md <= 320) return ZODIAC[2];
    if (md <= 419) return ZODIAC[3];
    if (md <= 520) return ZODIAC[4];
    if (md <= 620) return ZODIAC[5];
    if (md <= 722) return ZODIAC[6];
    if (md <= 822) return ZODIAC[7];
    if (md <= 922) return ZODIAC[8];
    if (md <= 1022) return ZODIAC[9];
    if (md <= 1121) return ZODIAC[10];
    return ZODIAC[11];
  }

  function moonPhase(date) {
    var synodic = 29.530588853;
    var known = Date.UTC(2000, 0, 6, 18, 14, 0);
    var age = ((date.getTime() - known) / 86400000) % synodic;
    if (age < 0) age += synodic;
    var idx = Math.floor((age / synodic) * 8) % 8;
    var names = [
      "New Moon",
      "Waxing Crescent",
      "First Quarter",
      "Waxing Gibbous",
      "Full Moon",
      "Waning Gibbous",
      "Last Quarter",
      "Waning Crescent",
    ];
    return { age: age, index: idx, name: names[idx], frac: age / synodic };
  }

  function astroForDate(dateStr) {
    var parts = String(dateStr).split("-").map(Number);
    var y = parts[0] || new Date().getFullYear();
    var m = parts[1] || 1;
    var d = parts[2] || 1;
    var date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    var sign = sunSign(m, d);
    var moon = moonPhase(date);
    var day = PLANET_DAYS[date.getUTCDay()];
    return {
      sign: sign,
      moon: moon,
      day: day,
      element: sign.element,
      label: sign.name + "  ·  " + moon.name + "  ·  " + day.name + "'s day",
    };
  }

  function hexToRgb(hex) {
    var h = hex.replace("#", "");
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  function rgbToHex(r, g, b) {
    function c(n) {
      return ("0" + Math.max(0, Math.min(255, Math.round(n))).toString(16)).slice(-2);
    }
    return "#" + c(r) + c(g) + c(b);
  }

  function relativeLuminance(rgb) {
    function channel(c) {
      c = c / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  }

  function contrastRatio(fgHex, bgHex) {
    var a = relativeLuminance(hexToRgb(fgHex));
    var b = relativeLuminance(hexToRgb(bgHex));
    var lighter = Math.max(a, b);
    var darker = Math.min(a, b);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function ensureContrast(fgHex, bgHex, minRatio) {
    if (contrastRatio(fgHex, bgHex) >= minRatio) return fgHex;
    var bgL = relativeLuminance(hexToRgb(bgHex));
    var step = bgL > 0.5 ? -10 : 10;
    var rgb = hexToRgb(fgHex);
    var i;
    for (i = 0; i < 24; i++) {
      rgb.r = Math.max(0, Math.min(255, rgb.r + step));
      rgb.g = Math.max(0, Math.min(255, rgb.g + step));
      rgb.b = Math.max(0, Math.min(255, rgb.b + step));
      var next = rgbToHex(rgb.r, rgb.g, rgb.b);
      if (contrastRatio(next, bgHex) >= minRatio) return next;
    }
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  function tintHex(hex, hueKey, amount) {
    var rgb = hexToRgb(hex);
    var tint = ELEMENT_TINT[hueKey] || { h: 200, s: 0.3 };
    var rad = (tint.h * Math.PI) / 180;
    var a = amount * tint.s * 0.7;
    return rgbToHex(
      rgb.r + Math.cos(rad) * 28 * a,
      rgb.g + Math.cos(rad + 2.1) * 22 * a,
      rgb.b + Math.sin(rad) * 34 * a
    );
  }

  function serialFromParts(seal, date, name, count) {
    var h = hashSeed([seal, date, name, String(count)].join("|")).toString(16).toUpperCase();
    return "PQ" + h.slice(0, 4) + "-" + h.slice(4, 8) + "-" + h.slice(8, 12);
  }

  function drawPoiHead(ctx, x, y, r, fill, stroke) {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke || fill;
    ctx.lineWidth = Math.max(1, r * 0.18);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.55);
    ctx.quadraticCurveTo(x + r * 0.35, y + r * 1.35, x - r * 0.05, y + r * 1.85);
    ctx.stroke();
    ctx.restore();
  }

  // Banknote ink icons — stroked astronomy marks, never color-emoji.
  function strokeInkIcon(ctx, key, r) {
    ctx.beginPath();
    switch (key) {
      case "sun":
        ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
        ctx.moveTo(r * 0.08, 0);
        ctx.arc(0, 0, r * 0.08, 0, Math.PI * 2);
        var i;
        for (i = 0; i < 8; i++) {
          var a = (i / 8) * Math.PI * 2;
          ctx.moveTo(Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52);
          ctx.lineTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78);
        }
        break;
      case "moon":
        ctx.arc(0, 0, r * 0.62, -0.85, 2.35, false);
        ctx.arc(r * 0.22, -r * 0.08, r * 0.5, 2.2, -0.7, true);
        break;
      case "mercury":
        ctx.arc(0, -r * 0.08, r * 0.34, 0, Math.PI * 2);
        ctx.moveTo(0, r * 0.26);
        ctx.lineTo(0, r * 0.72);
        ctx.moveTo(-r * 0.28, r * 0.48);
        ctx.lineTo(r * 0.28, r * 0.48);
        ctx.moveTo(-r * 0.34, -r * 0.42);
        ctx.quadraticCurveTo(-r * 0.05, -r * 0.78, r * 0.34, -r * 0.42);
        break;
      case "venus":
        ctx.arc(0, -r * 0.12, r * 0.38, 0, Math.PI * 2);
        ctx.moveTo(0, r * 0.26);
        ctx.lineTo(0, r * 0.78);
        ctx.moveTo(-r * 0.28, r * 0.5);
        ctx.lineTo(r * 0.28, r * 0.5);
        break;
      case "mars":
        ctx.arc(-r * 0.08, r * 0.1, r * 0.38, 0, Math.PI * 2);
        ctx.moveTo(r * 0.12, -r * 0.12);
        ctx.lineTo(r * 0.62, -r * 0.62);
        ctx.moveTo(r * 0.28, -r * 0.62);
        ctx.lineTo(r * 0.62, -r * 0.62);
        ctx.lineTo(r * 0.62, -r * 0.28);
        break;
      case "jupiter":
        ctx.moveTo(r * 0.42, -r * 0.55);
        ctx.quadraticCurveTo(-r * 0.55, -r * 0.55, -r * 0.45, 0);
        ctx.quadraticCurveTo(-r * 0.35, r * 0.45, r * 0.2, r * 0.2);
        ctx.moveTo(-r * 0.55, r * 0.05);
        ctx.lineTo(r * 0.55, r * 0.05);
        break;
      case "saturn":
        ctx.moveTo(0, -r * 0.7);
        ctx.lineTo(0, r * 0.55);
        ctx.moveTo(-r * 0.38, -r * 0.28);
        ctx.lineTo(r * 0.38, -r * 0.28);
        ctx.moveTo(-r * 0.05, r * 0.15);
        ctx.quadraticCurveTo(r * 0.55, r * 0.15, r * 0.5, r * 0.65);
        break;
      case "uranus":
        ctx.arc(0, r * 0.28, r * 0.28, 0, Math.PI * 2);
        ctx.moveTo(0, -r * 0.7);
        ctx.lineTo(0, r * 0.0);
        ctx.moveTo(-r * 0.42, -r * 0.42);
        ctx.lineTo(-r * 0.42, -r * 0.05);
        ctx.lineTo(r * 0.42, -r * 0.05);
        ctx.lineTo(r * 0.42, -r * 0.42);
        break;
      case "neptune":
        ctx.moveTo(0, -r * 0.72);
        ctx.lineTo(0, r * 0.72);
        ctx.moveTo(-r * 0.48, -r * 0.35);
        ctx.quadraticCurveTo(-r * 0.15, -r * 0.7, 0, -r * 0.2);
        ctx.quadraticCurveTo(r * 0.15, -r * 0.7, r * 0.48, -r * 0.35);
        ctx.moveTo(-r * 0.28, r * 0.28);
        ctx.lineTo(r * 0.28, r * 0.28);
        break;
      case "pluto":
        ctx.arc(0, -r * 0.18, r * 0.34, 0, Math.PI * 2);
        ctx.moveTo(0, r * 0.16);
        ctx.lineTo(0, r * 0.72);
        ctx.moveTo(-r * 0.28, r * 0.42);
        ctx.lineTo(r * 0.28, r * 0.42);
        ctx.moveTo(-r * 0.22, -r * 0.55);
        ctx.lineTo(-r * 0.22, r * 0.05);
        break;
      case "stars":
        ctx.moveTo(0, -r * 0.72);
        ctx.lineTo(r * 0.18, -r * 0.18);
        ctx.lineTo(r * 0.72, 0);
        ctx.lineTo(r * 0.18, r * 0.18);
        ctx.lineTo(0, r * 0.72);
        ctx.lineTo(-r * 0.18, r * 0.18);
        ctx.lineTo(-r * 0.72, 0);
        ctx.lineTo(-r * 0.18, -r * 0.18);
        ctx.closePath();
        break;
      case "nodes":
        ctx.arc(0, r * 0.08, r * 0.48, Math.PI * 0.15, Math.PI * 0.85, true);
        ctx.moveTo(-r * 0.42, r * 0.28);
        ctx.quadraticCurveTo(-r * 0.55, -r * 0.55, 0, -r * 0.55);
        ctx.quadraticCurveTo(r * 0.55, -r * 0.55, r * 0.42, r * 0.28);
        break;
      case "cosmos":
        ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
        ctx.moveTo(r * 0.55, 0);
        ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
        ctx.moveTo(r * 0.78, 0);
        ctx.ellipse(0, 0, r * 0.78, r * 0.42, 0.4, 0, Math.PI * 2);
        break;
      case "aries":
        ctx.moveTo(-r * 0.55, r * 0.35);
        ctx.quadraticCurveTo(-r * 0.55, -r * 0.55, 0, -r * 0.1);
        ctx.quadraticCurveTo(r * 0.55, -r * 0.55, r * 0.55, r * 0.35);
        break;
      case "taurus":
        ctx.arc(0, r * 0.18, r * 0.38, 0, Math.PI * 2);
        ctx.moveTo(-r * 0.55, -r * 0.55);
        ctx.quadraticCurveTo(-r * 0.2, -r * 0.05, -r * 0.28, r * 0.05);
        ctx.moveTo(r * 0.55, -r * 0.55);
        ctx.quadraticCurveTo(r * 0.2, -r * 0.05, r * 0.28, r * 0.05);
        break;
      case "gemini":
        ctx.moveTo(-r * 0.28, -r * 0.65);
        ctx.lineTo(-r * 0.28, r * 0.65);
        ctx.moveTo(r * 0.28, -r * 0.65);
        ctx.lineTo(r * 0.28, r * 0.65);
        ctx.moveTo(-r * 0.5, -r * 0.45);
        ctx.lineTo(r * 0.5, -r * 0.45);
        ctx.moveTo(-r * 0.5, r * 0.45);
        ctx.lineTo(r * 0.5, r * 0.45);
        break;
      case "cancer":
        ctx.arc(-r * 0.22, -r * 0.08, r * 0.28, 0.2, Math.PI * 1.6);
        ctx.arc(r * 0.22, r * 0.08, r * 0.28, Math.PI + 0.2, Math.PI * 2.6);
        break;
      case "leo":
        ctx.arc(-r * 0.1, 0, r * 0.42, 0.3, Math.PI * 1.7);
        ctx.moveTo(r * 0.2, -r * 0.35);
        ctx.quadraticCurveTo(r * 0.7, -r * 0.55, r * 0.55, r * 0.15);
        break;
      case "virgo":
        ctx.moveTo(-r * 0.55, r * 0.55);
        ctx.lineTo(-r * 0.55, -r * 0.45);
        ctx.lineTo(-r * 0.15, r * 0.15);
        ctx.lineTo(r * 0.2, -r * 0.45);
        ctx.lineTo(r * 0.2, r * 0.2);
        ctx.quadraticCurveTo(r * 0.55, r * 0.55, r * 0.55, r * 0.15);
        break;
      case "libra":
        ctx.moveTo(-r * 0.65, r * 0.1);
        ctx.lineTo(r * 0.65, r * 0.1);
        ctx.moveTo(-r * 0.45, r * 0.42);
        ctx.lineTo(r * 0.45, r * 0.42);
        ctx.moveTo(-r * 0.35, r * 0.1);
        ctx.quadraticCurveTo(0, -r * 0.7, r * 0.35, r * 0.1);
        break;
      case "scorpio":
        ctx.moveTo(-r * 0.55, r * 0.45);
        ctx.lineTo(-r * 0.55, -r * 0.35);
        ctx.lineTo(-r * 0.15, r * 0.2);
        ctx.lineTo(r * 0.2, -r * 0.35);
        ctx.lineTo(r * 0.2, r * 0.35);
        ctx.lineTo(r * 0.55, r * 0.55);
        ctx.moveTo(r * 0.35, r * 0.35);
        ctx.lineTo(r * 0.55, r * 0.55);
        ctx.lineTo(r * 0.55, r * 0.25);
        break;
      case "sagittarius":
        ctx.moveTo(-r * 0.55, r * 0.55);
        ctx.lineTo(r * 0.55, -r * 0.55);
        ctx.moveTo(r * 0.15, -r * 0.55);
        ctx.lineTo(r * 0.55, -r * 0.55);
        ctx.lineTo(r * 0.55, -r * 0.15);
        ctx.moveTo(-r * 0.15, -r * 0.15);
        ctx.lineTo(r * 0.15, r * 0.15);
        break;
      case "capricorn":
        ctx.moveTo(-r * 0.55, -r * 0.15);
        ctx.quadraticCurveTo(-r * 0.2, -r * 0.7, 0, -r * 0.1);
        ctx.quadraticCurveTo(r * 0.25, r * 0.45, r * 0.55, r * 0.15);
        ctx.moveTo(r * 0.15, r * 0.05);
        ctx.quadraticCurveTo(r * 0.55, r * 0.55, r * 0.2, r * 0.65);
        break;
      case "aquarius":
        ctx.moveTo(-r * 0.65, -r * 0.18);
        ctx.lineTo(-r * 0.25, r * 0.05);
        ctx.lineTo(r * 0.15, -r * 0.18);
        ctx.lineTo(r * 0.55, r * 0.05);
        ctx.moveTo(-r * 0.65, r * 0.22);
        ctx.lineTo(-r * 0.25, r * 0.45);
        ctx.lineTo(r * 0.15, r * 0.22);
        ctx.lineTo(r * 0.55, r * 0.45);
        break;
      case "pisces":
        ctx.arc(-r * 0.15, 0, r * 0.45, -1.2, 1.2);
        ctx.arc(r * 0.15, 0, r * 0.45, Math.PI - 1.2, Math.PI + 1.2);
        ctx.moveTo(0, -r * 0.55);
        ctx.lineTo(0, r * 0.55);
        break;
      default:
        ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    }
    ctx.stroke();
  }

  function drawInkIcon(ctx, key, x, y, size, color, alpha) {
    var a = alpha == null ? 1 : alpha;
    var r = size * 0.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    // Soft halo — keeps the mark present without snatching focus.
    ctx.globalAlpha = 0.12 * a;
    ctx.lineWidth = Math.max(1.5, size * 0.16);
    strokeInkIcon(ctx, key, r * 1.05);
    // Main ink stroke.
    ctx.globalAlpha = 0.62 * a;
    ctx.lineWidth = Math.max(1.2, size * 0.085);
    strokeInkIcon(ctx, key, r);
    // Fine hairline for engraved feel.
    ctx.globalAlpha = 0.28 * a;
    ctx.lineWidth = Math.max(0.7, size * 0.035);
    strokeInkIcon(ctx, key, r * 0.92);
    ctx.restore();
  }

  function drawGuilloche(ctx, cx, cy, radius, petals, color, alpha) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1;
    var rings = 3;
    var r;
    var t;
    for (r = 0; r < rings; r++) {
      ctx.beginPath();
      for (t = 0; t <= Math.PI * 2 + 0.02; t += 0.02) {
        var rad =
          radius * (0.55 + r * 0.16) +
          Math.sin(t * petals) * (10 + r * 4) +
          Math.cos(t * (petals + 2)) * 5;
        var x = Math.cos(t) * rad;
        var y = Math.sin(t) * rad;
        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMicroBand(ctx, y, w, text, color, x0, s) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.font = Math.max(8, Math.round(9 * s)) + "px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    var unit = text + "   ·   ";
    var line = "";
    while (ctx.measureText(line + unit).width < w) line += unit;
    ctx.fillText(line, x0 || 0, y);
    ctx.restore();
  }

  function drawCornerPoi(ctx, x, y, rot, color, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, 2 * s);
    ctx.beginPath();
    ctx.arc(0, 0, 26 * s, 0.12 * Math.PI, 1.55 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 16 * s, 0.2 * Math.PI, 1.4 * Math.PI);
    ctx.stroke();
    drawPoiHead(ctx, 24 * s, -3 * s, 5 * s, color, color);
    drawPoiHead(ctx, -3 * s, 24 * s, 5 * s, color, color);
    ctx.restore();
  }

  var SITESWAP_LADDER = [
    "3",
    "423",
    "441",
    "522",
    "531",
    "534",
    "53",
    "744",
    "7531",
    "97531",
  ];

  var POI_GUARD_CODES = [
    "BN3",
    "P3",
    "WS3",
    "WH3",
    "4BN-S",
    "4WS-S",
    "4BN-A",
    "WS5",
    "5BN",
    "5BXS",
  ];

  function drawCascadeWatermark(ctx, cx, cy, scale, color, alpha) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.5;
    var pts = [
      [-70 * scale, 40 * scale],
      [0, -55 * scale],
      [70 * scale, 40 * scale],
      [-35 * scale, -10 * scale],
      [35 * scale, -10 * scale],
    ];
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.quadraticCurveTo(pts[3][0], pts[3][1] - 40 * scale, pts[1][0], pts[1][1]);
    ctx.quadraticCurveTo(pts[4][0], pts[4][1] - 40 * scale, pts[2][0], pts[2][1]);
    ctx.stroke();
    var i;
    for (i = 0; i < 3; i++) {
      drawPoiHead(ctx, pts[i][0], pts[i][1], 7 * scale, color, color);
    }
    ctx.restore();
  }

  function drawFountainWatermark(ctx, cx, cy, scale, color, alpha) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, 1.4 * scale);
    var side;
    for (side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.moveTo(side * 28 * scale, 48 * scale);
      ctx.quadraticCurveTo(side * 55 * scale, 0, side * 28 * scale, -48 * scale);
      ctx.quadraticCurveTo(side * 8 * scale, 0, side * 28 * scale, 48 * scale);
      ctx.stroke();
      drawPoiHead(ctx, side * 28 * scale, -48 * scale, 5.5 * scale, color, color);
      drawPoiHead(ctx, side * 28 * scale, 48 * scale, 5.5 * scale, color, color);
    }
    ctx.restore();
  }

  function drawShowerWatermark(ctx, cx, cy, scale, color, alpha) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, 1.3 * scale);
    ctx.beginPath();
    ctx.moveTo(-50 * scale, 40 * scale);
    ctx.quadraticCurveTo(0, -90 * scale, 50 * scale, 40 * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(42 * scale, 36 * scale);
    ctx.lineTo(-42 * scale, 44 * scale);
    ctx.stroke();
    drawPoiHead(ctx, -50 * scale, 40 * scale, 5 * scale, color, color);
    drawPoiHead(ctx, 50 * scale, 40 * scale, 5 * scale, color, color);
    drawPoiHead(ctx, 0, -55 * scale, 4.5 * scale, color, color);
    ctx.restore();
  }

  function drawMillsMessWatermark(ctx, cx, cy, scale, color, alpha) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, 1.25 * scale);
    ctx.beginPath();
    ctx.moveTo(-60 * scale, 30 * scale);
    ctx.bezierCurveTo(-20 * scale, -70 * scale, 20 * scale, 70 * scale, 60 * scale, -30 * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(60 * scale, 30 * scale);
    ctx.bezierCurveTo(20 * scale, -70 * scale, -20 * scale, 70 * scale, -60 * scale, -30 * scale);
    ctx.stroke();
    drawPoiHead(ctx, -55 * scale, 20 * scale, 5 * scale, color, color);
    drawPoiHead(ctx, 0, -8 * scale, 5 * scale, color, color);
    drawPoiHead(ctx, 55 * scale, 20 * scale, 5 * scale, color, color);
    ctx.restore();
  }

  function drawSiteswapLadder(ctx, x, y0, y1, color, s, alpha, align) {
    var ladder = SITESWAP_LADDER;
    var n = ladder.length;
    var h = y1 - y0;
    var i;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1, 1.1 * s);
    ctx.globalAlpha = alpha * 0.85;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();
    ctx.font = "600 " + Math.round(11 * s) + "px 'JetBrains Mono', monospace";
    ctx.textAlign = align === "right" ? "right" : "left";
    ctx.textBaseline = "middle";
    for (i = 0; i < n; i++) {
      var t = i / (n - 1);
      var y = y0 + h * t;
      var arm = (14 + (i % 3) * 6) * s;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      if (align === "right") {
        ctx.moveTo(x, y);
        ctx.lineTo(x - arm, y);
      } else {
        ctx.moveTo(x, y);
        ctx.lineTo(x + arm, y);
      }
      ctx.stroke();
      ctx.globalAlpha = alpha * 1.15;
      ctx.fillText(
        ladder[i],
        align === "right" ? x - arm - 6 * s : x + arm + 6 * s,
        y
      );
      drawPoiHead(
        ctx,
        align === "right" ? x - arm : x + arm,
        y,
        2.4 * s,
        color,
        color
      );
    }
    ctx.restore();
  }

  function drawPoiGuardField(ctx, w, h, color, seed, s) {
    var rand = mulberry32(seed);
    var i;
    ctx.save();
    for (i = 0; i < 10; i++) {
      var x = 70 + rand() * (w - 140);
      var y = 80 + rand() * (h - 160);
      if (x > w * 0.3 && x < w * 0.7 && y > h * 0.32 && y < h * 0.68) {
        x = rand() > 0.5 ? 60 + rand() * w * 0.16 : w * 0.78 + rand() * w * 0.12;
      }
      var len = (36 + rand() * 54) * s;
      var ang = (rand() - 0.5) * 1.4;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.globalAlpha = 0.04 + rand() * 0.035;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, 1.2 * s);
      ctx.beginPath();
      ctx.moveTo(0, -len * 0.45);
      ctx.quadraticCurveTo(len * 0.15, 0, 0, len * 0.55);
      ctx.stroke();
      drawPoiHead(ctx, 0, -len * 0.45, 3.2 * s, color, color);
      drawPoiHead(ctx, 0, len * 0.55, 3.2 * s, color, color);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawSiteswapMicrogrid(ctx, w, h, color, seed, s) {
    var rand = mulberry32(seed);
    var pool = SITESWAP_LADDER.concat(POI_GUARD_CODES).concat([
      "97531",
      "b97531",
      "A711",
      "66661",
    ]);
    ctx.save();
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var i;
    for (i = 0; i < 22; i++) {
      var x = 48 + rand() * (w - 96);
      var y = 48 + rand() * (h - 96);
      if (x > w * 0.32 && x < w * 0.68 && y > h * 0.3 && y < h * 0.7 && rand() > 0.4) {
        continue;
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rand() - 0.5) * 0.9);
      ctx.globalAlpha = 0.028 + rand() * 0.03;
      ctx.font =
        (rand() > 0.5 ? "600 " : "700 ") +
        Math.round((9 + rand() * 13) * s) +
        "px 'JetBrains Mono', monospace";
      ctx.fillText(pool[i % pool.length], 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawHiddenCheckMarks(ctx, w, h, note, serial, metal, s) {
    // Deliberate low-contrast marks for visual verification.
    ctx.save();
    ctx.globalAlpha = 0.045;
    ctx.fillStyle = metal;
    ctx.font = "700 " + Math.round(220 * s) + "px 'Source Serif 4', Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(note.denom, w * 0.5, h * 0.48);

    ctx.globalAlpha = 0.035;
    ctx.font = "600 " + Math.round(28 * s) + "px 'JetBrains Mono', monospace";
    ctx.save();
    ctx.translate(w * 0.14, h * 0.55);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(serial, 0, 0);
    ctx.restore();

    ctx.globalAlpha = 0.04;
    ctx.font = "600 " + Math.round(22 * s) + "px 'JetBrains Mono', monospace";
    ctx.fillText(note.pattern.toUpperCase() + " · " + note.mark, w * 0.78, h * 0.72);

    // Tiny ladder checksum strip — hard to clone by eye.
    ctx.globalAlpha = 0.032;
    ctx.font = "600 " + Math.round(10 * s) + "px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText(SITESWAP_LADDER.join("·"), w * 0.22, h * 0.88);
    ctx.restore();
  }

  function drawOrbitField(ctx, w, h, color, seed, density) {
    var rand = mulberry32(seed);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.07;
    ctx.lineWidth = 1;
    var i;
    for (i = 0; i < 10 + density; i++) {
      var cx = w * (0.15 + rand() * 0.7);
      var cy = h * (0.15 + rand() * 0.7);
      var rx = 36 + rand() * 140;
      var ry = 18 + rand() * 80;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWaveBands(ctx, w, h, color, accent, seed, s) {
    var rand = mulberry32(seed);
    ctx.save();
    ctx.lineWidth = Math.max(1, 1.1 * s);
    var bands = 7;
    var b;
    var x;
    for (b = 0; b < bands; b++) {
      var y0 = h * (0.12 + b * 0.12);
      var amp = (8 + rand() * 14) * s;
      var freq = 0.006 + rand() * 0.01;
      var phase = rand() * Math.PI * 2;
      ctx.strokeStyle = b % 2 ? accent : color;
      ctx.globalAlpha = 0.07 + (b % 3) * 0.015;
      ctx.beginPath();
      for (x = 36; x < w - 36; x += 3) {
        var y = y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.2 + phase) * amp * 0.35;
        if (x === 36) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGlyphField(ctx, w, h, note, astro, color, seed, s) {
    var rand = mulberry32(seed);
    var icons = [note.icon, astro.sign.icon, astro.day.icon, "stars", "moon"];
    var digits = SITESWAP_LADDER.concat(POI_GUARD_CODES).concat([note.denom, "BN", "P"]);
    ctx.save();
    var i;
    for (i = 0; i < 14; i++) {
      var x = 50 + rand() * (w - 100);
      var y = 50 + rand() * (h - 100);
      if (x > w * 0.28 && x < w * 0.72 && y > h * 0.28 && y < h * 0.72) {
        if (rand() > 0.35) {
          x = rand() > 0.5 ? 40 + rand() * w * 0.18 : w * 0.82 + rand() * w * 0.12;
        }
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rand() - 0.5) * 0.7);
      if (rand() > 0.42) {
        drawInkIcon(
          ctx,
          icons[i % icons.length],
          0,
          0,
          (18 + rand() * 26) * s,
          color,
          0.35 + rand() * 0.35
        );
      } else {
        ctx.globalAlpha = 0.04 + rand() * 0.05;
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font =
          "600 " +
          Math.round((12 + rand() * 16) * s) +
          "px 'JetBrains Mono', monospace";
        ctx.fillText(digits[i % digits.length], 0, 0);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawOrnamentRule(ctx, cx, y, half, color, s) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(1, 1.2 * s);
    ctx.beginPath();
    ctx.moveTo(cx - half, y);
    ctx.lineTo(cx - 18 * s, y);
    ctx.moveTo(cx + 18 * s, y);
    ctx.lineTo(cx + half, y);
    ctx.stroke();
    drawPoiHead(ctx, cx - 22 * s, y, 3.5 * s, color, color);
    drawPoiHead(ctx, cx, y, 5 * s, color, color);
    drawPoiHead(ctx, cx + 22 * s, y, 3.5 * s, color, color);
    ctx.restore();
  }

  function drawSignature(ctx, x, y, width, label, script, color, mute, s, align) {
    ctx.save();
    ctx.textAlign = align || "left";
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(1, 1.15 * s);
    var x0 = align === "right" ? x - width : x;
    var x1 = align === "right" ? x : x + width;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.font =
      "italic 600 " +
      Math.round(26 * s) +
      "px 'Source Serif 4', Georgia, serif";
    ctx.fillText(script, align === "right" ? x1 - 4 * s : x0 + 4 * s, y - 18 * s);
    ctx.fillStyle = mute;
    ctx.font = "500 " + Math.round(12 * s) + "px 'JetBrains Mono', monospace";
    ctx.fillText(label, align === "right" ? x1 : x0, y + 22 * s);
    ctx.restore();
  }

  function drawPatternAccent(ctx, note, astro, w, h, metal, accent, s) {
    var p = note.pattern;
    ctx.save();
    if (p === "rings") {
      ctx.globalAlpha = 0.09;
      ctx.strokeStyle = metal;
      var r;
      for (r = 0; r < 5; r++) {
        ctx.beginPath();
        ctx.ellipse(w * 0.84, h * 0.24, (50 + r * 16) * s, (16 + r * 5) * s, -0.4, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (p === "solar") {
      ctx.translate(w * 0.84, h * 0.22);
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.09;
      var i;
      for (i = 0; i < 18; i++) {
        var a = (i / 18) * Math.PI * 2 + astro.moon.frac;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 18 * s, Math.sin(a) * 18 * s);
        ctx.lineTo(Math.cos(a) * 72 * s, Math.sin(a) * 72 * s);
        ctx.stroke();
      }
    } else if (p === "stars" || p === "galaxy" || p === "void") {
      var rand = mulberry32(hashSeed(note.denom + astro.sign.name));
      ctx.fillStyle = metal;
      var j;
      for (j = 0; j < 36; j++) {
        ctx.globalAlpha = 0.05 + rand() * 0.09;
        ctx.beginPath();
        ctx.arc(50 + rand() * (w - 100), 50 + rand() * (h - 100), 0.7 + rand() * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (p === "eclipse") {
      ctx.globalAlpha = 0.1;
      drawPoiHead(ctx, w * 0.84, h * 0.22, 26 * s, metal, metal);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = note.paper[1];
      ctx.beginPath();
      ctx.arc(w * 0.84 + 12 * s, h * 0.22, 24 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function paintCertificate(ctx, data, fmt) {
    var w = fmt.w;
    var hgt = fmt.h;
    var aspect = w / hgt;
    var portrait = aspect <= 0.85;
    var classic = aspect >= 1.15 && aspect < 1.5;
    var shortSide = Math.min(w, hgt);
    var s = shortSide / 1080;
    if (classic) s *= 1.02;
    if (portrait) s *= 1.04;

    var inset = Math.round(Math.max(52, shortSide * 0.048));
    var padX = Math.round(Math.max(120, w * 0.12));
    var padY = Math.round(Math.max(100, hgt * 0.09));
    if (portrait) {
      padX = Math.round(Math.max(108, w * 0.125));
      padY = Math.round(Math.max(112, hgt * 0.085));
    }

    var note = GRADE_NOTES[data.seal] || GRADE_NOTES.ENT;
    var astro = astroForDate(data.date);
    var moonBoost = 0.06 + Math.abs(0.5 - astro.moon.frac) * 0.16;
    var dayShift = (astro.day.hue % 360) / 360;
    var serial = serialFromParts(data.seal, data.date, data.name, data.count);

    var paper0 = tintHex(note.paper[0], astro.element, 0.2 + dayShift * 0.12);
    var paper1 = tintHex(note.paper[1], astro.element, 0.3);
    var paper2 = tintHex(note.paper[2], astro.element, 0.16);
    var metal = ensureContrast(tintHex(note.metal, astro.element, 0.16), paper1, 4.5);
    var accent = ensureContrast(tintHex(note.accent, astro.element, 0.26 + moonBoost), paper1, 4.5);
    var ink = ensureContrast(note.ink, paper1, 7);
    // Secondary ink kept ≥ ~4.5:1-ish on paper via darker mute.
    var mute = "rgba(28, 24, 32, 0.72)";

    function fs(size) {
      return Math.max(11, Math.round(size * s));
    }
    function font(weight, size, family) {
      return weight + " " + fs(size) + "px " + family;
    }

    ctx.clearRect(0, 0, w, hgt);
    var bg = ctx.createLinearGradient(0, 0, w, hgt);
    bg.addColorStop(0, paper0);
    bg.addColorStop(0.5, paper1);
    bg.addColorStop(1, paper2);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, hgt);

    drawOrbitField(ctx, w, hgt, metal, hashSeed(data.seal + data.date), note.petals);
    drawWaveBands(ctx, w, hgt, metal, accent, hashSeed(data.seal + "waves"), s);
    drawSiteswapMicrogrid(ctx, w, hgt, metal, hashSeed(serial + "ss"), s);
    drawPoiGuardField(ctx, w, hgt, accent, hashSeed(data.seal + "poi"), s);
    drawGlyphField(ctx, w, hgt, note, astro, metal, hashSeed(data.date + note.icon), s);
    drawPatternAccent(ctx, note, astro, w, hgt, metal, accent, s);

    // Pattern watermarks — cascade / fountain / shower / mills as security layers.
    drawCascadeWatermark(ctx, w * 0.18, hgt * 0.55, s * 0.75, metal, 0.03);
    drawFountainWatermark(ctx, w * 0.82, hgt * 0.28, s * 0.7, accent, 0.028);
    drawShowerWatermark(ctx, w * 0.16, hgt * 0.28, s * 0.65, metal, 0.026);
    drawMillsMessWatermark(ctx, w * 0.84, hgt * 0.62, s * 0.7, accent, 0.026);

    // Dual siteswap ladders — quiet rails in the outer margin only.
    drawSiteswapLadder(
      ctx,
      padX * 0.38,
      padY + 48 * s,
      hgt - padY - 64 * s,
      metal,
      s,
      0.038,
      "left"
    );
    drawSiteswapLadder(
      ctx,
      w - padX * 0.38,
      padY + 48 * s,
      hgt - padY - 64 * s,
      accent,
      s,
      0.032,
      "right"
    );

    drawHiddenCheckMarks(ctx, w, hgt, note, serial, metal, s);

    drawGuilloche(ctx, w * 0.16, hgt * 0.68, 100 * s, 4 + (note.petals % 4), metal, 0.09);
    drawGuilloche(ctx, w * 0.84, hgt * 0.68, 105 * s, 5 + (note.petals % 3), accent, 0.08);
    drawGuilloche(ctx, w * 0.5, hgt * 0.18, 70 * s, 6, metal, 0.05);

    // Frame
    ctx.strokeStyle = metal;
    ctx.lineWidth = Math.max(2, 2.8 * s);
    roundRect(ctx, inset, inset, w - inset * 2, hgt - inset * 2, 12 * s);
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(1, 1.15 * s);
    roundRect(
      ctx,
      inset + 18 * s,
      inset + 18 * s,
      w - (inset + 18 * s) * 2,
      hgt - (inset + 18 * s) * 2,
      9 * s
    );
    ctx.stroke();
    ctx.globalAlpha = 1;

    var corner = inset + 42 * s;
    drawCornerPoi(ctx, corner, corner, 0, metal, s);
    drawCornerPoi(ctx, w - corner, corner, Math.PI / 2, metal, s);
    drawCornerPoi(ctx, w - corner, hgt - corner, Math.PI, metal, s);
    drawCornerPoi(ctx, corner, hgt - corner, -Math.PI / 2, metal, s);

    drawMicroBand(
      ctx,
      padY - 4 * s,
      w - padX * 2,
      "POI QUEST NOTE · " +
        note.motto +
        " · " +
        note.body.toUpperCase() +
        " · " +
        note.mark +
        " · " +
        SITESWAP_LADDER.join(" ") +
        " · SERIES V0.4 · CC BY 4.0",
      metal,
      padX,
      s
    );
    drawMicroBand(
      ctx,
      hgt - padY + 18 * s,
      w - padX * 2,
      serial +
        " · " +
        note.pattern.toUpperCase() +
        " · " +
        POI_GUARD_CODES.join(" ") +
        " · " +
        astro.sign.name.toUpperCase() +
        " · " +
        astro.day.name.toUpperCase() +
        " · PRACTICE LOG",
      accent,
      padX,
      s
    );

    // Simple top-to-bottom stack. No vertical centering, no gap compression.
    var textMax = w - padX * 2;
    var y = padY + 48 * s;
    var type = {
      label: 13,
      eyebrow: 13,
      title: 28,
      body: 17,
      name: 38,
      meta: 15,
      headerSeal: 48,
      headerBody: 20,
      sealMark: 24,
    };
    var lh = {
      label: 22 * s,
      body: 28 * s,
      title: 36 * s,
      name: 48 * s,
      meta: 24 * s,
    };
    var gap = {
      afterHeader: 44 * s,
      afterSeal: 44 * s,
      section: 34 * s,
      tight: 16 * s,
      beforeSig: 48 * s,
    };
    var sealR = portrait ? 30 * s : 26 * s;
    var sigY = hgt - padY - 72 * s;
    var contentFloor = sigY - gap.beforeSig;

    var capabilityText = data.capability || data.blurb || note.capability || "";
    var pathText = data.pathLabel ? "Path  " + data.pathLabel : "Path  " + data.seal;
    var recordText =
      data.gradeDone +
      "/" +
      data.gradeTotal +
      " at " +
      data.seal +
      "  ·  " +
      data.cumulDone +
      "/" +
      data.cumulTotal +
      " through path";
    var metaText = "Recorded  " + data.date + "  ·  " + note.motto + "  ·  " + data.gear;

    function linesFor(weight, size, family, text, maxLines) {
      ctx.font = font(weight, size, family);
      return wrapLines(ctx, text, textMax).slice(0, maxLines || 2);
    }
    var gradeLines = linesFor("600", type.title, "'Source Serif 4', Georgia, serif", data.title, 2);
    var capabilityLines = linesFor(
      "italic",
      type.body,
      "'Source Serif 4', Georgia, serif",
      capabilityText,
      portrait ? 2 : 1
    );
    var nameLines = linesFor("600", type.name, "'Source Serif 4', Georgia, serif", data.name, 2);
    var pathLines = linesFor("500", type.meta, "'JetBrains Mono', monospace", pathText, 1);
    var recordLines = linesFor("500", type.meta, "'Source Sans 3', sans-serif", recordText, 1);
    var metaLines = linesFor("500", type.meta, "'Source Sans 3', sans-serif", metaText, 1);

    // Header — left seal meta, right planetary body (not stacked on the body copy).
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = accent;
    ctx.font = font("600", type.label, "'JetBrains Mono', monospace");
    ctx.fillText("SERIES V0.4", padX, y);
    ctx.fillStyle = metal;
    ctx.font = font("700", type.headerSeal, "'Source Serif 4', Georgia, serif");
    ctx.fillText(data.seal, padX, y + 48 * s);
    ctx.fillStyle = mute;
    ctx.font = font("600", type.label, "'JetBrains Mono', monospace");
    ctx.fillText("DENOMINATION  " + note.denom, padX, y + 74 * s);

    ctx.textAlign = "right";
    ctx.fillStyle = metal;
    ctx.font = font("600", type.headerBody, "'Source Serif 4', Georgia, serif");
    ctx.fillText(note.body, w - padX, y + 6 * s);
    drawInkIcon(ctx, note.icon, w - padX - 18 * s, y + 48 * s, 32 * s, metal, 0.7);
    ctx.fillStyle = mute;
    ctx.font = font("italic", 14, "'Source Serif 4', Georgia, serif");
    ctx.fillText(note.motto, w - padX, y + 74 * s);

    y += 100 * s;
    drawOrnamentRule(ctx, w / 2, y, Math.min(220 * s, textMax * 0.36), metal, s);
    y += gap.afterHeader;

    // Compact seal, then copy below it — never over it.
    ctx.textAlign = "center";
    ctx.fillStyle = accent;
    ctx.font = font("600", type.eyebrow, "'JetBrains Mono', monospace");
    ctx.fillText("HISTORICAL PRACTICE RECORD  ·  v0.4", w / 2, y);
    y += lh.label + gap.tight;

    var sealCx = w / 2;
    var sealCy = y + sealR;
    drawInkIcon(ctx, note.icon, sealCx, sealCy, sealR * 1.35, metal, 0.14);
    ctx.save();
    ctx.translate(sealCx, sealCy);
    drawGuilloche(ctx, 0, 0, sealR, 5 + (note.petals % 4), metal, 0.26);
    ctx.strokeStyle = metal;
    ctx.lineWidth = Math.max(1.4, 1.8 * s);
    ctx.beginPath();
    ctx.arc(0, 0, sealR * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(0.9, 0.95 * s);
    ctx.beginPath();
    ctx.arc(0, 0, sealR * 0.74, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.font = font("700", type.sealMark, "'JetBrains Mono', monospace");
    ctx.textBaseline = "middle";
    ctx.fillText(data.seal, 0, 0);
    ctx.restore();

    y = sealCy + sealR + gap.afterSeal;

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = accent;
    ctx.font = font("600", type.eyebrow, "'JetBrains Mono', monospace");
    ctx.fillText("POI CAPABILITY LEVEL", w / 2, y);
    y += lh.label + gap.tight;

    ctx.fillStyle = ink;
    ctx.font = font("600", type.title, "'Source Serif 4', Georgia, serif");
    gradeLines.forEach(function (line) {
      if (y > contentFloor - lh.title) return;
      ctx.fillText(line, w / 2, y);
      y += lh.title;
    });

    y += gap.tight;
    ctx.fillStyle = mute;
    ctx.font = font("italic", type.body, "'Source Serif 4', Georgia, serif");
    capabilityLines.forEach(function (line) {
      if (y > contentFloor - lh.body) return;
      ctx.fillText(line, w / 2, y);
      y += lh.body;
    });

    y += gap.section;
    if (y < contentFloor - lh.name * 2) {
      ctx.fillStyle = mute;
      ctx.font = font("italic", type.body, "'Source Serif 4', Georgia, serif");
      ctx.fillText("highest completed grade recorded for", w / 2, y);
      y += lh.label + gap.tight;

      ctx.fillStyle = metal;
      ctx.font = font("600", type.name, "'Source Serif 4', Georgia, serif");
      nameLines.forEach(function (line) {
        if (y > contentFloor - lh.name) return;
        ctx.fillText(line, w / 2, y);
        y += lh.name;
      });
    }

    y += gap.tight;
    if (y < contentFloor - 48 * s) {
      drawOrnamentRule(ctx, w / 2, y, Math.min(150 * s, textMax * 0.26), metal, s);
      y += gap.section;

      ctx.fillStyle = ink;
      ctx.font = font("500", type.meta, "'JetBrains Mono', monospace");
      pathLines.forEach(function (line) {
        if (y > contentFloor - lh.meta) return;
        ctx.fillText(line, w / 2, y);
        y += lh.meta;
      });

      y += gap.tight * 0.5;
      ctx.fillStyle = mute;
      ctx.font = font("500", type.meta, "'Source Sans 3', sans-serif");
      recordLines.forEach(function (line) {
        if (y > contentFloor - lh.meta) return;
        ctx.fillText(line, w / 2, y);
        y += lh.meta;
      });

      y += gap.tight;
      metaLines.forEach(function (line) {
        if (y > contentFloor - lh.meta) return;
        ctx.fillText(line, w / 2, y);
        y += lh.meta;
      });
    }

    var sigW = Math.min(240 * s, textMax * 0.32);
    drawSignature(
      ctx,
      padX,
      sigY,
      sigW,
      "PRACTITIONER",
      data.name.length > 28 ? data.name.slice(0, 26) + "…" : data.name,
      metal,
      mute,
      s,
      "left"
    );
    drawSignature(
      ctx,
      w - padX,
      sigY,
      sigW,
      "ISSUE MARK",
      note.body,
      accent,
      mute,
      s,
      "right"
    );

    ctx.textAlign = "left";
    ctx.fillStyle = accent;
    ctx.font = font("600", 10, "'JetBrains Mono', monospace");
    ctx.fillText("CHECK  " + serial, padX, sigY + 32 * s);
    ctx.textAlign = "right";
    ctx.fillStyle = mute;
    ctx.fillText(
      note.denom + " · " + data.count + " OBJ · " + note.pattern.toUpperCase(),
      w - padX,
      sigY + 32 * s
    );

    ctx.textAlign = "center";
    ctx.fillStyle = mute;
    ctx.font = font("500", 11, "'Source Sans 3', sans-serif");
    ctx.fillText(
      "Self-tracked historical record  ·  not peer-reviewed  ·  CC BY 4.0",
      w / 2,
      hgt - padY + 16 * s
    );

    if (localStorage.getItem("poi-quest-cert-debug") === "1") {
      ctx.save();
      ctx.strokeStyle = "rgba(180,40,40,0.45)";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(padX, padY + 32 * s, textMax, contentFloor - (padY + 32 * s));
      ctx.beginPath();
      ctx.moveTo(padX, sigY);
      ctx.lineTo(w - padX, sigY);
      ctx.stroke();
      ctx.restore();
    }
  }

  function gatherCertData() {
    var result = compute();
    if (!result.highest) return null;
    var h = result.highest;
    var name = (certName && certName.value.trim()) || "Anonymous practitioner";
    var gear = (certGear && certGear.value.trim()) || "undeclared";
    var date = new Date().toISOString().slice(0, 10);
    var path = [];
    var cumulDone = 0;
    var cumulTotal = 0;
    var i;
    for (i = 0; i < result.stats.length; i++) {
      var s = result.stats[i];
      if (!s.complete) break;
      path.push(s.seal);
      cumulDone += s.done;
      cumulTotal += s.total;
    }
    var note = GRADE_NOTES[h.seal] || GRADE_NOTES.ENT;
    return {
      highest: h,
      seal: h.seal,
      title: h.title,
      blurb: h.blurb || note.capability || "",
      capability: note.capability || h.blurb || "",
      path: path,
      pathLabel: path.join(" → "),
      gradeDone: h.done,
      gradeTotal: h.total,
      cumulDone: cumulDone,
      cumulTotal: cumulTotal,
      name: name,
      gear: gear,
      date: date,
      count: h.done,
      programme: "Poi Juggling Skill Quest · Cumulative BN Charter · v0.4",
    };
  }

  function renderCertificate() {
    if (!certCanvas) return null;
    var data = gatherCertData();
    if (!data) return null;
    var fmt = currentCertFormat();
    updateFormatMeta();
    certCanvas.width = fmt.w;
    certCanvas.height = fmt.h;
    var ctx = certCanvas.getContext("2d");
    paintCertificate(ctx, data, fmt);
    data.format = fmt;
    certCanvas.setAttribute(
      "aria-label",
      "Historical practice record for " +
        data.name +
        ", poi capability level " +
        data.seal +
        " — " +
        data.title +
        ", path " +
        data.pathLabel +
        ", recorded " +
        data.date +
        ", " +
        fmt.label +
        " " +
        fmt.ratio +
        " frame"
    );
    return data;
  }

  function openModal() {
    if (!gatherCertData() || !modal) return;
    lastFocusBeforeModal = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    setBackgroundInert(true);
    var paint = function () {
      renderCertificate();
    };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(paint);
    } else {
      paint();
    }
    modalKeyHandler = function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
        return;
      }
      if (e.key !== "Tab" || !certDialog) return;
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
      else if (certDialog) certDialog.focus();
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
    if (lastFocusBeforeModal && typeof lastFocusBeforeModal.focus === "function") {
      lastFocusBeforeModal.focus();
    } else if (btnCert) {
      btnCert.focus();
    }
  }

  function savePng() {
    var data = renderCertificate();
    if (!data || !certCanvas) return;
    var fmt = data.format || currentCertFormat();
    certCanvas.toBlob(function (blob) {
      if (!blob) return;
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download =
        "poi-quest-" +
        data.seal.toLowerCase() +
        "-" +
        fmt.id +
        "-" +
        data.date +
        ".png";
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  }

  // Rank rail highlight + stuck background
  var rail = document.querySelector(".rank-rail");
  var railSentinel = document.querySelector(".rank-rail-sentinel");
  if (rail && "IntersectionObserver" in window) {
    if (railSentinel) {
      var stuckObserver = new IntersectionObserver(
        function (entries) {
          var entry = entries[0];
          if (!entry) return;
          rail.classList.toggle("is-stuck", !entry.isIntersecting);
        },
        { threshold: 0 }
      );
      stuckObserver.observe(railSentinel);
    }
    var links = Array.prototype.slice.call(rail.querySelectorAll("a[href^='#']"));
    var sections = links
      .map(function (a) {
        return document.querySelector(a.getAttribute("href"));
      })
      .filter(Boolean);
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          links.forEach(function (a) {
            var on = a.getAttribute("href") === "#" + entry.target.id;
            a.classList.toggle("is-active", on);
            if (on) a.setAttribute("aria-current", "true");
            else a.removeAttribute("aria-current");
          });
        });
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: 0.01 }
    );
    sections.forEach(function (section) {
      observer.observe(section);
    });
    links.forEach(function (a) {
      a.addEventListener("click", function () {
        var el = document.querySelector(a.getAttribute("href"));
        if (el && el.tagName === "DETAILS") el.open = true;
      });
    });
  }

  restore();
  refreshUI();
  syncPrevComplete(compute().stats);
  restoreScroll();

  var scrollTimer = null;
  window.addEventListener(
    "scroll",
    function () {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(persistScroll, 120);
    },
    { passive: true }
  );
  window.addEventListener("pagehide", persistScroll);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") persistScroll();
  });

  grades.forEach(function (details) {
    details.addEventListener("toggle", persistOpen);
  });

  boxes.forEach(function (box) {
    box.addEventListener("change", function () {
      persist();
      refreshUI();
      var stats = compute().stats;
      openNextAfterCompletion(stats);
      syncPrevComplete(stats);
    });
  });

  if (btnCert) btnCert.addEventListener("click", openModal);
  if (btnReset) {
    btnReset.addEventListener("click", function () {
      if (!window.confirm("Clear all checked objectives in this browser?")) return;
      boxes.forEach(function (box) {
        box.checked = false;
      });
      persist();
      refreshUI();
      syncPrevComplete(compute().stats);
    });
  }

  var btnClose = document.getElementById("btn-close-cert");
  var btnPng = document.getElementById("btn-save-png");
  var btnPrint = document.getElementById("btn-print");

  if (btnClose) btnClose.addEventListener("click", closeModal);
  if (btnPng) btnPng.addEventListener("click", savePng);
  if (btnPrint) {
    btnPrint.addEventListener("click", function () {
      renderCertificate();
      window.print();
    });
  }
  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeModal();
    });
  }
  if (certName) {
    certName.addEventListener("input", function () {
      persist();
      if (modal && !modal.hidden) renderCertificate();
    });
  }
  if (certGear) {
    certGear.addEventListener("input", function () {
      persist();
      if (modal && !modal.hidden) renderCertificate();
    });
  }

  var savedFormat = localStorage.getItem(FORMAT_KEY);
  if (savedFormat && CERT_FORMATS[savedFormat]) {
    var savedInput = document.querySelector(
      'input[name="cert-format"][value="' + savedFormat + '"]'
    );
    if (savedInput) savedInput.checked = true;
  } else if (savedFormat) {
    localStorage.removeItem(FORMAT_KEY);
  }
  updateFormatMeta();
  document.querySelectorAll('input[name="cert-format"]').forEach(function (input) {
    input.addEventListener("change", function () {
      localStorage.setItem(FORMAT_KEY, input.value);
      updateFormatMeta();
      if (modal && !modal.hidden) renderCertificate();
    });
  });
  var termsToggle = document.getElementById("vocab-full-names");
  var termsLabel = document.querySelector(".vocab-toggle-label");

  function applyTermsMode(full) {
    document.body.classList.toggle("terms-full", !!full);
    if (termsToggle) termsToggle.checked = !!full;
    if (termsLabel) {
      termsLabel.textContent = full
        ? termsLabel.getAttribute("data-when-on") || "Show shorthands"
        : termsLabel.getAttribute("data-when-off") || "Show full names";
    }
    document.querySelectorAll(".term").forEach(function (el) {
      el.classList.remove("is-tip-open");
      var tip = el.querySelector(".term-tip");
      if (tip) tip.setAttribute("aria-hidden", "true");
      var key = el.getAttribute("data-term") || "";
      var fullName = el.getAttribute("data-full") || "";
      if (full) {
        el.setAttribute("aria-label", fullName || key);
      } else {
        el.setAttribute(
          "aria-label",
          key && fullName ? key + ": " + fullName : key || fullName
        );
      }
    });
  }

  applyTermsMode(localStorage.getItem(TERMS_KEY) === "1");

  if (termsToggle) {
    termsToggle.addEventListener("change", function () {
      var full = !!termsToggle.checked;
      localStorage.setItem(TERMS_KEY, full ? "1" : "0");
      applyTermsMode(full);
    });
  }

  document.addEventListener("click", function (e) {
    if (document.body.classList.contains("terms-full")) return;
    var term = e.target.closest ? e.target.closest(".term") : null;
    document.querySelectorAll(".term.is-tip-open").forEach(function (el) {
      if (el === term) return;
      el.classList.remove("is-tip-open");
      var tip = el.querySelector(".term-tip");
      if (tip) tip.setAttribute("aria-hidden", "true");
    });
    if (!term) return;
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    // Touch: show tip without toggling the parent checkbox.
    if (e.target.closest && e.target.closest(".obj-list label")) {
      e.preventDefault();
    }
    var open = !term.classList.contains("is-tip-open");
    term.classList.toggle("is-tip-open", open);
    var tip = term.querySelector(".term-tip");
    if (tip) tip.setAttribute("aria-hidden", open ? "false" : "true");
  });
})();
