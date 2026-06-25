(function () {
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;
  var canvas = document.getElementById("plasma-canvas");
  var toggle = document.getElementById("audio-toggle");

  var BPM = 120;
  var SEC_PER_16 = 60 / BPM / 4;
  var plasmaTime = 0;
  var visualFrame = 0;

  var chroma = {
    sat: { value: 1, target: 1, lerp: 0.0012 },
    r: { value: 1, target: 1, lerp: 0.0014 },
    g: { value: 1, target: 1, lerp: 0.0014 },
    b: { value: 1, target: 1, lerp: 0.0014 },
    feedback: 0,
    surge: 0
  };
  var mist = {
    blur: 0.5,
    targetBlur: 0.65,
    bright: 1.03,
    targetBright: 1.05,
    contrast: 0.97,
    targetContrast: 0.95,
    scale: 1.004,
    targetScale: 1.006,
    haze: 0.16,
    targetHaze: 0.18,
    lerp: 0.0012
  };
  var chromaPaint = { r: 1, g: 1, b: 1, sat: 1, hue: 0 };
  var styleCache = {};
  var glyphs = [];

  var playing = false;
  var audioCtx = null;
  var audioTick = 0;
  var audioNextTime = 0;
  var audioTimer = null;
  var barIndex = 0;
  var tabHidden = document.hidden;
  var resizeRaf = 0;
  var rafId = null;

  var drumBus, bassBus, melodyBus, master, dry, send, wet, melodyNodes;
  var delayA, delayB, delayFbA, delayFbB, masterWarm, masterDark;
  var feedbackBase = { a: 0.38, b: 0.26 };

  var scales = [
    [41.2, 55, 61.74, 65.41, 73.42, 82.41, 87.31, 98, 110, 130.81],
    [38.89, 46.25, 51.91, 58.27, 69.3, 77.78, 92.5, 103.83],
    [43.65, 49, 55, 61.74, 69.3, 73.42, 82.41, 98],
    [36.71, 41.2, 49, 55, 61.74, 73.42, 82.41, 98, 116.54],
    [34.65, 41.2, 46.25, 55, 65.41, 73.42, 87.31]
  ];

  var timbre = {
    scaleId: 0,
    kickStyle: 0,
    bassStyle: 0,
    melStyle: 0,
    dubStyle: 0,
    hatStyle: 0,
    snareStyle: 0,
    cycles: { k: 16, s: 16, h: 16, b: 12, d: 10, m: 14 },
    density: { kick: 1, snare: 1, hat: 1, bass: 1, dub: 1, mel: 1 },
    swing: 0.2,
    melOctave: 2
  };

  var breathe = {
    phase: "play",
    exhaleEndTime: 0,
    voidEndTime: 0,
    inhaleEndTime: 0,
    inhaleNotesTime: 0,
    voidSec: 1,
    inhaleSec: 1,
    afterVoid: "mutate",
    nextBreakAtBar: 14 + Math.floor(Math.random() * 8)
  };

  function clonePattern(arr) {
    return arr.map(function (x) {
      return x === null ? null : typeof x === "object" ? { d: x.d, v: x.v } : x;
    });
  }

  function rotatePattern(arr, steps) {
    var out = clonePattern(arr);
    var n = out.length;
    steps = ((steps % n) + n) % n;
    return out.slice(steps).concat(out.slice(0, steps));
  }

  function reversePattern(arr) {
    return clonePattern(arr).reverse();
  }

  function invertHits(arr) {
    return arr.map(function (x) {
      if (x === 0) return 1;
      if (x === 1) return 0;
      return x;
    });
  }

  function sparsePattern(arr, keep) {
    return arr.map(function (x) {
      if (x === null || x === 0) return x;
      return Math.random() < keep ? x : (typeof x === "object" ? null : 0);
    });
  }

  function shufflePattern(arr) {
    var out = clonePattern(arr);
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = out[i];
      out[i] = out[j];
      out[j] = t;
    }
    return out;
  }

  function pickCycles() {
    var pools = [9, 10, 11, 12, 13, 14, 15, 16];
    timbre.cycles.k = pools[Math.floor(astroUnit(1.2) * pools.length)];
    timbre.cycles.s = pools[Math.floor(astroUnit(2.4) * pools.length)];
    timbre.cycles.h = pools[Math.floor(astroUnit(3.6) * pools.length)];
    timbre.cycles.b = pools[Math.floor(astroUnit(4.8) * pools.length)];
    timbre.cycles.d = pools[Math.floor(astroUnit(5.5) * pools.length)];
    timbre.cycles.m = pools[Math.floor(astroUnit(6.7) * pools.length)];
  }

  function pickTimbre() {
    timbre.scaleId = Math.floor(astroUnit(8.1) * scales.length) % scales.length;
    timbre.kickStyle = Math.floor(astroUnit(9.2) * 4);
    timbre.bassStyle = Math.floor(astroUnit(10.3) * 5);
    timbre.melStyle = Math.floor(astroUnit(11.4) * 5);
    timbre.dubStyle = Math.floor(astroUnit(12.5) * 4);
    timbre.hatStyle = Math.floor(astroUnit(13.6) * 3);
    timbre.snareStyle = Math.floor(astroUnit(14.7) * 3);
    timbre.swing = 0.08 + astroUnit(15.8) * 0.55;
    timbre.melOctave = astroUnit(16.9) > 0.72 ? 2.5 : astroUnit(16.9) < 0.28 ? 1.5 : 2;
    timbre.density.kick = 0.55 + astroUnit(17.1) * 0.45;
    timbre.density.snare = 0.35 + astroUnit(18.2) * 0.55;
    timbre.density.hat = 0.4 + astroUnit(19.3) * 0.55;
    timbre.density.bass = 0.5 + astroUnit(20.4) * 0.48;
    timbre.density.dub = 0.3 + astroUnit(21.5) * 0.6;
    timbre.density.mel = 0.35 + astroUnit(22.6) * 0.58;
    pickCycles();
  }

  function radicalizePatterns(comp) {
    var r = astroUnit(barIndex * 0.31);
    if (r > 0.82) {
      comp.kick16 = shufflePattern(comp.kick16);
      comp.hat16 = invertHits(comp.hat16);
    } else if (r > 0.58) {
      comp.kick16 = rotatePattern(comp.kick16, 3 + Math.floor(Math.random() * 9));
      comp.bass12 = reversePattern(comp.bass12);
      comp.melody14 = sparsePattern(comp.melody14, 0.45 + Math.random() * 0.35);
    } else {
      comp.dub10 = rotatePattern(comp.dub10, Math.floor(Math.random() * 7));
      comp.snare16 = sparsePattern(comp.snare16, 0.5 + Math.random() * 0.4);
      comp.bass12b = rotatePattern(comp.bass12b, 2 + Math.floor(Math.random() * 5));
    }
    if (Math.random() < 0.35) comp.melody14b = shufflePattern(comp.melody14b);
    if (Math.random() < 0.4) comp.hat16 = rotatePattern(comp.hat16, Math.floor(Math.random() * comp.hat16.length));
  }

  function applyBpmDrift() {
    var drift = Math.round((astroUnit(5.5) - 0.5) * 18);
    BPM = currentComp.bpm + drift;
    BPM = Math.max(98, Math.min(134, BPM));
    SEC_PER_16 = 60 / BPM / 4;
    updateDelayTimes();
  }

  function restoreFeedback(when) {
    if (!delayFbA || !delayFbB) return;
    delayFbA.gain.cancelScheduledValues(when);
    delayFbA.gain.setValueAtTime(delayFbA.gain.value, when);
    delayFbA.gain.linearRampToValueAtTime(feedbackBase.a, when + 0.35);
    delayFbB.gain.cancelScheduledValues(when);
    delayFbB.gain.setValueAtTime(delayFbB.gain.value, when);
    delayFbB.gain.linearRampToValueAtTime(feedbackBase.b, when + 0.45);
  }

  function surgeFeedback(when) {
    if (!delayFbA || !delayFbB) return;
    var dur = astroDuration(1.8, 6.5, 13.7);
    var peakA = 0.58 + astroUnit(23.8) * 0.26;
    var peakB = 0.46 + astroUnit(24.9) * 0.24;
    delayFbA.gain.cancelScheduledValues(when);
    delayFbA.gain.setValueAtTime(delayFbA.gain.value, when);
    delayFbA.gain.linearRampToValueAtTime(peakA, when + 0.06);
    delayFbA.gain.linearRampToValueAtTime(feedbackBase.a, when + dur);
    delayFbB.gain.cancelScheduledValues(when);
    delayFbB.gain.setValueAtTime(delayFbB.gain.value, when);
    delayFbB.gain.linearRampToValueAtTime(peakB, when + 0.1);
    delayFbB.gain.linearRampToValueAtTime(feedbackBase.b, when + dur + 0.25);
    nudgeChromaFromSignal(0.04 + astroUnit(23.8) * 0.06, 23.8);
    if (melodyNodes && melodyNodes.padGain) {
      melodyNodes.padGain.gain.cancelScheduledValues(when);
      melodyNodes.padGain.gain.setValueAtTime(melodyNodes.padGain.gain.value, when);
      melodyNodes.padGain.gain.linearRampToValueAtTime(0.09, when + 0.2);
      melodyNodes.padGain.gain.linearRampToValueAtTime(0.055, when + dur);
    }
  }

  function maybeBarRadicalize(when) {
    if (Math.random() < 0.22 + astroUnit(barIndex * 0.41) * 0.2) {
      radicalizePatterns(currentComp);
      pickTimbre();
      applyBpmDrift();
    }
    if (Math.random() < 0.14 + astroUnit(barIndex * 0.53) * 0.18) {
      surgeFeedback(when);
    }
  }

  function compPreset(id, bpm, root, kick, snare, hat, bassA, bassB, dub, melA, melB, pad) {
    return {
      id: id,
      bpm: bpm,
      root: root,
      kick16: clonePattern(kick),
      snare16: clonePattern(snare),
      hat16: clonePattern(hat),
      bass12: clonePattern(bassA),
      bass12b: clonePattern(bassB),
      dub10: clonePattern(dub),
      melody14: clonePattern(melA),
      melody14b: clonePattern(melB),
      pad: pad || [110, 130.81, 164.81]
    };
  }

  var kickDeep = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
  var clapGhost = [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  var hatDark = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0];
  var bassDeep1 = [
    { d: 3, v: 1 }, null, { d: 3, v: 0.55 }, null,
    { d: 5, v: 0.82 }, null, { d: 4, v: 0.74 }, null,
    { d: 3, v: 0.9 }, null, { d: 2, v: 0.68 }, null
  ];
  var bassDeep2 = [
    { d: 3, v: 1 }, null, { d: 5, v: 0.78 }, null,
    { d: 4, v: 0.85 }, null, { d: 3, v: 0.62 }, null,
    { d: 2, v: 0.8 }, null, { d: 3, v: 0.95 }, { d: 5, v: 0.7 }
  ];
  var dubWarm = [0, 0, 1, 0, 0, 0, 0, 1, 0, 0];
  var melMyst1 = [5, null, 4, null, 3, null, 6, null, 5, null, 4, null, 3, 2];
  var melMyst2 = [6, null, 5, null, 4, null, 3, null, 4, null, 5, null, 6, 5];

  var compositions = [
    compPreset("smoke120", 120, 0, kickDeep, clapGhost, hatDark, bassDeep1, bassDeep2, dubWarm, melMyst1, melMyst2, [110, 130.81, 164.81]),
    compPreset("deep116", 116, 1, kickDeep, [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], hatDark,
      [
        { d: 2, v: 1 }, null, { d: 3, v: 0.6 }, null,
        { d: 5, v: 0.8 }, null, { d: 4, v: 0.72 }, null,
        { d: 3, v: 0.88 }, null, { d: 2, v: 0.65 }, null
      ],
      bassDeep1,
      [0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
      [4, null, 5, null, 6, null, 5, null, 4, null, 3, null, 2, 3],
      [5, null, 6, null, 5, null, 4, null, 3, null, 4, null, 5, 4],
      [103.83, 123.47, 155.56]
    ),
    compPreset("dub122", 122, -1, [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
      clapGhost, [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
      [
        { d: 3, v: 1 }, { d: 3, v: 0.45 }, null, { d: 5, v: 0.76 },
        null, { d: 4, v: 0.84 }, null, { d: 3, v: 0.7 },
        null, { d: 2, v: 0.78 }, { d: 3, v: 0.92 }, null
      ],
      bassDeep2,
      [0, 1, 0, 0, 0, 0, 1, 0, 0, 1],
      melMyst1, melMyst2, [98, 116.54, 146.83]
    )
  ];

  var currentComp = compositions[0];

  function computeAlign(m) {
    var hits = 0;
    if (m % 16 === 0) hits++;
    if (m % 12 === 0) hits++;
    if (m % 10 === 0) hits++;
    if (m % 14 === 0) hits++;
    if (m % 5 === 0) hits++;
    if (m % 3 === 0) hits++;
    return hits / 6;
  }

  function plasmaField(nx, ny, t) {
    var dx = nx - 0.5;
    var dy = ny - 0.5;
    return (
      Math.sin(nx * 12.4 + t * 1.2) +
      Math.sin(ny * 10.8 - t * 0.95) +
      Math.sin((nx + ny) * 9.2 + t * 0.6) +
      Math.sin((dx * dx + dy * dy) * 36 - t * 1.4) +
      Math.sin(nx * 9 + ny * 11 - t * 0.55) * 0.55
    );
  }

  function plasmaColor(nx, ny, t, cr, cg, cb, sat) {
    var v = plasmaField(nx, ny, t);
    var pt = v * 1.35 + t * 2.1;
    var ripple = Math.sin(nx * 0.018 + pt * 1.1) * Math.cos(ny * 0.016 - pt * 0.85);
    var hue = (pt * 0.42 + ripple * 2.8 + nx * 2.4 + ny * 1.7) % 6.283185307179586;
    var r = Math.sin(hue) * 118 + 118;
    var g = Math.sin(hue + 2.094) * 105 + 105;
    var b = Math.sin(hue + 4.188) * 128 + 118;
    if (ripple > 0.25) {
      r = r + 35 > 255 ? 255 : r + 35;
      g = g + 18 > 255 ? 255 : g + 18;
    }
    if (ripple < -0.35) {
      b = b + 42 > 255 ? 255 : b + 42;
      r += 12;
    }
    r *= cr;
    g *= cg;
    b *= cb;
    var gray = r * 0.299 + g * 0.587 + b * 0.114;
    r = gray + (r - gray) * sat;
    g = gray + (g - gray) * sat;
    b = gray + (b - gray) * sat;
    return (
      (r < 0 ? 0 : r > 255 ? 255 : r | 0) |
      ((g < 0 ? 0 : g > 255 ? 255 : g | 0) << 8) |
      ((b < 0 ? 0 : b > 255 ? 255 : b | 0) << 16)
    );
  }

  function acidPalette(t, x, y) {
    var ripple = Math.sin(x * 0.018 + t * 1.1) * Math.cos(y * 0.016 - t * 0.85);
    var hue = (t * 0.42 + ripple * 2.8 + x * 2.4 + y * 1.7) % 6.283;
    var r = Math.sin(hue) * 118 + 118;
    var g = Math.sin(hue + 2.094) * 105 + 105;
    var b = Math.sin(hue + 4.188) * 128 + 118;
    if (ripple > 0.25) {
      r = Math.min(255, r + 35);
      g = Math.min(255, g + 18);
    }
    if (ripple < -0.35) {
      b = Math.min(255, b + 42);
      r += 12;
    }
    return [r | 0, g | 0, b | 0];
  }

  function fitOracle() {
    var oracle = document.querySelector(".oracle");
    var wrap = document.querySelector(".oracle-wrap");
    if (!oracle || !wrap) return;
    root.style.setProperty("--oracle-fit", "1");
    var limit = wrap.clientHeight * 0.94;
    var needed = oracle.scrollHeight;
    if (needed > limit && needed > 0) {
      root.style.setProperty("--oracle-fit", Math.max(0.5, limit / needed).toFixed(4));
    }
  }

  function initGlyphs() {
    document.querySelectorAll(".oracle-line").forEach(function (line) {
      var text = line.textContent.trim();
      line.textContent = "";
      line.classList.remove("oracle-rainbow");
      var words = text.split(/\s+/);
      for (var w = 0; w < words.length; w++) {
        if (w > 0) line.appendChild(document.createTextNode(" "));
        var span = document.createElement("span");
        span.className = "oracle-word oracle-rainbow";
        span.textContent = words[w];
        var gi = glyphs.length;
        var nx = 0.5 + (gi % 14) * 0.028 - 0.18;
        var ny = 0.44 + Math.floor(gi / 14) * 0.055;
        line.appendChild(span);
        glyphs.push({ el: span, index: gi, nx: nx, ny: ny });
      }
    });
  }

  function pullChromaVoid(depth) {
    var d = depth || 0.55;
    chroma.sat.target = Math.min(chroma.sat.target, 0.03 + astroUnit(44.3) * 0.14 * d);
    chroma.sat.lerp = Math.max(chroma.sat.lerp, 0.0035 + d * 0.004);
    chroma.r.target += (1 - chroma.r.target) * 0.35 * d;
    chroma.g.target += (1 - chroma.g.target) * 0.35 * d;
    chroma.b.target += (1 - chroma.b.target) * 0.35 * d;
  }

  function nudgeChromaFromSignal(strength, salt) {
    var s = strength * (0.55 + astroUnit(salt || plasmaTime) * 0.9);
    chroma.feedback += s;
    chroma.surge += s * 0.65;
    chroma.r.target += s * 0.22;
    chroma.g.target -= s * 0.11;
    chroma.b.target += s * 0.15;
    chroma.sat.target += s * 0.35;
  }

  function setStyleProp(name, value, eps) {
    var n = parseFloat(value);
    var prev = styleCache[name];
    if (prev !== undefined && Math.abs(prev - n) < eps) return;
    styleCache[name] = n;
    root.style.setProperty(name, value);
  }

  function pickChromaTargets() {
    var a = astroChrono();
    var fast = astroUnit(plasmaTime * 0.41 + 31.2) > 0.72;
    var moonBias = Math.sin(a.moon * 6.2831853 + plasmaTime * 0.18) * 0.12;
    var zodiacBias = Math.cos(a.zodiac * 0.523 + a.hour * 0.09) * 0.1;
    var faint = (astroUnit(plasmaTime * 0.53 + 42.7) - 0.5) * 0.08;
    chroma.feedback += faint + moonBias * 0.04 + zodiacBias * 0.03;
    chroma.feedback *= 0.992;

    if (Math.abs(chroma.feedback) > 0.055 && Math.random() < 0.18 + astroUnit(33.4) * 0.22) {
      chroma.surge = chroma.feedback * (1.6 + astroUnit(34.5) * 1.4);
      chroma.feedback *= 0.35;
    }
    chroma.surge *= 0.978;

    var surge = chroma.surge;
    var astroSat = astroUnit(35.6 + plasmaTime * 0.07);
    var voidGate = astroUnit(43.2 + plasmaTime * 0.13);

    if (voidGate < 0.2) {
      chroma.sat.target = 0.02 + voidGate * 0.42 + Math.max(0, surge) * 0.06;
      chroma.sat.lerp = 0.0025 + Math.random() * 0.007;
    } else if (voidGate < 0.38) {
      chroma.sat.target = 0.1 + astroSat * 0.42 + surge * 0.22;
      chroma.sat.lerp = fast ? 0.005 + Math.random() * 0.01 : 0.0014 + Math.random() * 0.0035;
    } else {
      chroma.sat.target = 0.22 + astroSat * 1.68 + surge * 0.48;
      chroma.sat.lerp = fast ? 0.006 + Math.random() * 0.014 : 0.0008 + Math.random() * 0.0028;
    }
    chroma.sat.target = Math.max(0, Math.min(2.2, chroma.sat.target));

    var channelSpread = 0.04 + astroUnit(36.7) * 0.07 + Math.abs(surge) * 0.12;
    if (chroma.sat.target < 0.34) {
      var dust = 0.01 + astroUnit(37.8) * 0.03;
      chroma.r.target = 1 - dust;
      chroma.g.target = 1;
      chroma.b.target = 1 + dust;
    } else {
      chroma.r.target = 1 + (astroUnit(37.8) - 0.5) * channelSpread + surge * 0.55;
      chroma.g.target = 1 + (astroUnit(38.9) - 0.5) * channelSpread - surge * 0.28;
      chroma.b.target = 1 + (astroUnit(39.1) - 0.5) * channelSpread + surge * 0.38;
    }
    var channelLerp = fast ? 0.005 + Math.random() * 0.012 : 0.001 + Math.random() * 0.0035;
    chroma.r.lerp = channelLerp;
    chroma.g.lerp = channelLerp * (0.88 + astroUnit(40.2) * 0.24);
    chroma.b.lerp = channelLerp * (0.88 + astroUnit(41.3) * 0.24);
  }

  function pickMistTarget() {
    var fast = Math.random() < 0.1;
    mist.targetBlur = 0.32 + Math.random() * 0.9;
    mist.targetBright = 0.92 + Math.random() * 0.16;
    mist.targetContrast = 0.86 + Math.random() * 0.16;
    mist.targetScale = 1.002 + Math.random() * 0.012;
    mist.targetHaze = 0.1 + Math.random() * 0.22;
    mist.lerp = fast ? 0.004 + Math.random() * 0.008 : 0.001 + Math.random() * 0.003;
  }

  function lerpChannel(ch, astroWobble) {
    var wobble = astroWobble * 0.018;
    ch.value += (ch.target + wobble - ch.value) * ch.lerp;
    return ch.value;
  }

  function tickChroma() {
    var astro = frameAstro || astroChrono();
    var astroWobble =
      Math.sin(plasmaTime * 0.31 + astro.moon * 6.28) * 0.5 +
      Math.cos(plasmaTime * 0.47 + astro.zodiac * 0.52) * 0.35;

    var satDelta = chroma.sat.target - chroma.sat.value;
    var satLerp = chroma.sat.lerp * (Math.abs(satDelta) > 0.4 ? 3.2 : Math.abs(satDelta) > 0.15 ? 1.8 : 1);
    chroma.sat.value += satDelta * satLerp;
    chroma.sat.value = Math.max(0, Math.min(2.2, chroma.sat.value));
    var r = lerpChannel(chroma.r, astroWobble);
    var g = lerpChannel(chroma.g, -astroWobble * 0.7);
    var b = lerpChannel(chroma.b, astroWobble * 0.55);
    var voidMix = chroma.sat.value < 0.36 ? 1 - chroma.sat.value / 0.36 : 0;

    chromaPaint.r = Math.max(0.78, Math.min(1.22, r * (1 - voidMix) + voidMix));
    chromaPaint.g = Math.max(0.78, Math.min(1.22, g * (1 - voidMix) + voidMix));
    chromaPaint.b = Math.max(0.78, Math.min(1.22, b * (1 - voidMix) + voidMix));
    chromaPaint.sat = chroma.sat.value;
    chromaPaint.hue = voidMix > 0.5 ? 0 : (chromaPaint.r - chromaPaint.b) * 14 + (chromaPaint.g - 1) * 6;
    setStyleProp("--page-sat", chroma.sat.value.toFixed(3), chroma.sat.value < 0.25 ? 0.003 : 0.007);
    setStyleProp("--chroma-hue", chromaPaint.hue.toFixed(2) + "deg", 0.18);
  }

  function tickMist() {
    var swell = Math.sin(plasmaTime * 0.62) * 0.14 + Math.sin(plasmaTime * 1.37) * 0.06;
    mist.blur += (mist.targetBlur + swell * 0.35 - mist.blur) * mist.lerp;
    mist.bright += (mist.targetBright + swell * 0.02 - mist.bright) * mist.lerp;
    mist.contrast += (mist.targetContrast - mist.contrast) * mist.lerp;
    mist.scale += (mist.targetScale + swell * 0.0015 - mist.scale) * mist.lerp;
    mist.haze += (mist.targetHaze + swell * 0.04 - mist.haze) * mist.lerp;
    if (Math.abs(mist.targetBlur - mist.blur) < 0.03) {
      pickMistTarget();
    }
  }

  function pushMistStyles() {
    setStyleProp("--wet-blur", mist.blur.toFixed(2) + "px", 0.05);
    setStyleProp("--wet-scale", mist.scale.toFixed(4), 0.0006);
    setStyleProp("--wet-haze", mist.haze.toFixed(3), 0.008);
  }

  function syncAtmosphereStyles() {
    var satEps = Math.max(0.016, Math.min(0.045, chroma.sat.target * 0.22 + 0.014));
    var satNear = Math.abs(chroma.sat.target - chroma.sat.value) < satEps;
    var rgbNear =
      Math.abs(chroma.r.target - chroma.r.value) < 0.012 &&
      Math.abs(chroma.g.target - chroma.g.value) < 0.012 &&
      Math.abs(chroma.b.target - chroma.b.value) < 0.012;
    if (satNear && rgbNear) {
      pickChromaTargets();
    } else if (satNear && Math.random() < 0.04) {
      pickChromaTargets();
    }
    pushMistStyles();
  }

  function updateAtmosphere() {
    tickChroma();
    tickMist();
    syncAtmosphereStyles();
  }

  function updateGlyphs() {
    var t = plasmaTime;
    var glow = 0.35 + Math.sin(t * 0.7) * 0.12;
    setStyleProp("--plasma-glow", glow.toFixed(3), 0.02);
    setStyleProp("--oracle-pulse", (Math.sin(t * 1.4) * 0.04).toFixed(3), 0.006);
    var i = 0;
    var g;
    while (i < glyphs.length) {
      g = glyphs[i++];
      var field = plasmaField(g.nx, g.ny, t);
      var fi = field * 1.4 + g.index * 0.4;
      g.el.style.transform =
        "translate3d(" +
        (Math.sin(fi) * 2.4).toFixed(1) + "px," +
        (Math.cos(field * 1.1 + g.index * 0.22) * 1.6).toFixed(1) + "px,0) rotate(" +
        (Math.sin(field + g.index * 0.15) * 0.4).toFixed(2) +
        "deg)";
    }
  }

  var atmosphereFrame = 0;
  var frameAstro = null;

  function updateAtmosphereThrottled() {
    atmosphereFrame++;
    if (atmosphereFrame % 24 === 0) frameAstro = astroChrono();
    tickChroma();
    tickMist();
    if (atmosphereFrame % 8 === 0) syncAtmosphereStyles();
  }

  var gl, plasmaProgram, plasmaAttribs, plasmaUniforms, plasmaBuffer, plasmaReady = false;
  var pCtx, pW, pH, pImage, pData;
  var PLASMA_TARGET_PIXELS = 700000;

  var PLASMA_VS =
    "attribute vec2 a_pos;" +
    "varying vec2 v_uv;" +
    "void main(){v_uv=a_pos*0.5+0.5;gl_Position=vec4(a_pos,0.0,1.0);}";

  var PLASMA_FS =
    "precision mediump float;" +
    "varying vec2 v_uv;" +
    "uniform float u_time;" +
    "uniform vec3 u_chroma;" +
    "uniform float u_sat;" +
    "uniform float u_bright;" +
    "uniform float u_contrast;" +
    "float plasmaField(vec2 uv,float t){" +
    "vec2 d=uv-0.5;" +
    "return sin(uv.x*12.4+t*1.2)+" +
    "sin(uv.y*10.8-t*0.95)+" +
    "sin((uv.x+uv.y)*9.2+t*0.6)+" +
    "sin(dot(d,d)*36.0-t*1.4)+" +
    "sin(uv.x*9.0+uv.y*11.0-t*0.55)*0.55;}" +
    "void main(){" +
    "float t=u_time;" +
    "vec2 uv=v_uv;" +
    "float v=plasmaField(uv,t);" +
    "float pt=v*1.35+t*2.1;" +
    "float ripple=sin(uv.x*0.018+pt*1.1)*cos(uv.y*0.016-pt*0.85);" +
    "float hue=mod(pt*0.42+ripple*2.8+uv.x*2.4+uv.y*1.7,6.2831853);" +
    "vec3 c=vec3(" +
    "sin(hue)*118.0+118.0," +
    "sin(hue+2.094)*105.0+105.0," +
    "sin(hue+4.188)*128.0+118.0);" +
    "if(ripple>0.25){c.r=min(255.0,c.r+35.0);c.g=min(255.0,c.g+18.0);}" +
    "if(ripple<-0.35){c.b=min(255.0,c.b+42.0);c.r+=12.0;}" +
    "c*=u_chroma;" +
    "float gray=dot(c,vec3(0.299,0.587,0.114));" +
    "c=mix(vec3(gray),c,u_sat);" +
    "c=(c-127.5)*u_contrast+127.5;" +
    "c*=u_bright;" +
    "gl_FragColor=vec4(clamp(c/255.0,0.0,1.0),0.92);}";

  function compilePlasmaShader(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function initPlasmaGL() {
    gl =
      canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, preserveDrawingBuffer: true }) ||
      canvas.getContext("experimental-webgl", { alpha: true, antialias: false, depth: false, preserveDrawingBuffer: true });
    if (!gl) return false;

    var vs = compilePlasmaShader(gl.VERTEX_SHADER, PLASMA_VS);
    var fs = compilePlasmaShader(gl.FRAGMENT_SHADER, PLASMA_FS);
    if (!vs || !fs) return false;

    plasmaProgram = gl.createProgram();
    gl.attachShader(plasmaProgram, vs);
    gl.attachShader(plasmaProgram, fs);
    gl.linkProgram(plasmaProgram);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(plasmaProgram, gl.LINK_STATUS)) return false;

    plasmaAttribs = { pos: gl.getAttribLocation(plasmaProgram, "a_pos") };
    plasmaUniforms = {
      time: gl.getUniformLocation(plasmaProgram, "u_time"),
      chroma: gl.getUniformLocation(plasmaProgram, "u_chroma"),
      sat: gl.getUniformLocation(plasmaProgram, "u_sat"),
      bright: gl.getUniformLocation(plasmaProgram, "u_bright"),
      contrast: gl.getUniformLocation(plasmaProgram, "u_contrast")
    };

    plasmaBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, plasmaBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    plasmaReady = true;
    return true;
  }

  function computePlasmaDims() {
    var cssW = window.innerWidth;
    var cssH = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var area = cssW * cssH * dpr * dpr;
    var scale = Math.max(1, Math.sqrt(area / PLASMA_TARGET_PIXELS));
    return {
      w: Math.max(1, Math.floor((cssW * dpr) / scale)),
      h: Math.max(1, Math.floor((cssH * dpr) / scale))
    };
  }

  function onViewportResize() {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(function () {
      resizeRaf = 0;
      resizePlasma();
      fitOracle();
    });
  }

  function resizePlasma() {
    if (!canvas) return;
    var dims = computePlasmaDims();
    var nextW = dims.w;
    var nextH = dims.h;
    if (nextW === pW && nextH === pH) return;
    pW = nextW;
    pH = nextH;
    canvas.width = pW;
    canvas.height = pH;
    if (gl && plasmaReady) {
      gl.viewport(0, 0, pW, pH);
    } else if (pCtx) {
      pImage = pCtx.createImageData(pW, pH);
      pData = pImage.data;
    }
    drawPlasma();
  }

  function drawPlasma2D() {
    if (!canvas || !pCtx || !pData) return;
    var t = plasmaTime;
    var cr = chromaPaint.r;
    var cg = chromaPaint.g;
    var cb = chromaPaint.b;
    var sat = chromaPaint.sat;
    var bright = mist.bright;
    var contrast = mist.contrast;
    var invW = 1 / pW;
    var invH = 1 / pH;
    var i = 0;
    for (var y = 0; y < pH; y++) {
      var ny = (y + 0.5) * invH;
      for (var x = 0; x < pW; x++) {
        var nx = (x + 0.5) * invW;
        var px = plasmaColor(nx, ny, t, cr, cg, cb, sat);
        var r = px & 255;
        var g = (px >> 8) & 255;
        var b = (px >> 16) & 255;
        r = (r - 127.5) * contrast + 127.5;
        g = (g - 127.5) * contrast + 127.5;
        b = (b - 127.5) * contrast + 127.5;
        r *= bright;
        g *= bright;
        b *= bright;
        pData[i++] = r < 0 ? 0 : r > 255 ? 255 : r | 0;
        pData[i++] = g < 0 ? 0 : g > 255 ? 255 : g | 0;
        pData[i++] = b < 0 ? 0 : b > 255 ? 255 : b | 0;
        pData[i++] = 235;
      }
    }
    pCtx.putImageData(pImage, 0, 0);
  }

  function drawPlasmaGL() {
    if (!gl || !plasmaReady) return;
    gl.viewport(0, 0, pW, pH);
    gl.useProgram(plasmaProgram);
    gl.uniform1f(plasmaUniforms.time, plasmaTime);
    gl.uniform3f(plasmaUniforms.chroma, chromaPaint.r, chromaPaint.g, chromaPaint.b);
    gl.uniform1f(plasmaUniforms.sat, chromaPaint.sat);
    gl.uniform1f(plasmaUniforms.bright, mist.bright);
    gl.uniform1f(plasmaUniforms.contrast, mist.contrast);
    gl.bindBuffer(gl.ARRAY_BUFFER, plasmaBuffer);
    gl.enableVertexAttribArray(plasmaAttribs.pos);
    gl.vertexAttribPointer(plasmaAttribs.pos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function drawPlasma() {
    if (gl && plasmaReady) drawPlasmaGL();
    else drawPlasma2D();
  }

  function frame() {
    if (!tabHidden) {
      visualFrame++;
      drawPlasma();
      plasmaTime += 0.038;
      if (visualFrame % 12 === 0) updateGlyphs();
      updateAtmosphereThrottled();
    }
    rafId = requestAnimationFrame(frame);
  }

  function makeReverbIR(ctx, seconds, decay) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buffer = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var data = buffer.getChannelData(ch);
      for (var n = 0; n < len; n++) {
        data[n] = (Math.random() * 2 - 1) * Math.pow(1 - n / len, decay);
      }
    }
    return buffer;
  }

  function makeDriveCurve(drive) {
    var curve = new Float32Array(512);
    for (var i = 0; i < 512; i++) {
      var x = (i * 2) / 511 - 1;
      curve[i] = Math.tanh(drive * x) / Math.tanh(drive);
    }
    return curve;
  }

  function makeDriveNode(ctx, amount, mix) {
    var input = ctx.createGain();
    var shaper = ctx.createWaveShaper();
    shaper.curve = makeDriveCurve(amount);
    shaper.oversample = "4x";
    var dryGain = ctx.createGain();
    var wetGain = ctx.createGain();
    dryGain.gain.value = 1 - mix;
    wetGain.gain.value = mix;
    var output = ctx.createGain();
    input.connect(dryGain);
    input.connect(shaper);
    shaper.connect(wetGain);
    dryGain.connect(output);
    wetGain.connect(output);
    return { input: input, output: output };
  }

  function connectFx(ctx) {
    master = ctx.createGain();
    master.gain.value = 0.48;
    dry = ctx.createGain();
    dry.gain.value = 0.72;
    send = ctx.createGain();
    send.gain.value = 1;
    wet = ctx.createGain();
    wet.gain.value = 0.34;
    melodyBus = ctx.createGain();
    melodyBus.gain.value = 0.78;

    var drumDrive = makeDriveNode(ctx, 3.2, 0.52);
    var bassDrive = makeDriveNode(ctx, 4.8, 0.62);
    drumBus = drumDrive.input;
    bassBus = bassDrive.input;
    drumBus.gain.value = 0.95;
    bassBus.gain.value = 1.05;

    var drumComp = ctx.createDynamicsCompressor();
    drumComp.threshold.value = -22;
    drumComp.ratio.value = 4.5;
    drumComp.attack.value = 0.008;
    drumComp.release.value = 0.18;

    drumDrive.output.connect(drumComp);
    bassDrive.output.connect(dry);
    bassDrive.output.connect(send);
    drumComp.connect(dry);
    melodyBus.connect(dry);
    melodyBus.connect(send);

    var beat = 60 / BPM;
    delayA = ctx.createDelay(4);
    delayA.delayTime.value = beat * 0.75;
    delayB = ctx.createDelay(4);
    delayB.delayTime.value = beat * 1.25;
    delayFbA = ctx.createGain();
    delayFbA.gain.value = feedbackBase.a;
    delayFbB = ctx.createGain();
    delayFbB.gain.value = feedbackBase.b;
    var reverb = ctx.createConvolver();
    reverb.buffer = makeReverbIR(ctx, 4.2, 2.2);
    reverb.normalize = false;

    var wetDark = ctx.createBiquadFilter();
    wetDark.type = "lowpass";
    wetDark.frequency.value = 5200;
    wetDark.Q.value = 0.5;

    send.connect(delayA);
    delayA.connect(delayFbA);
    delayFbA.connect(delayA);
    delayA.connect(delayB);
    delayB.connect(delayFbB);
    delayFbB.connect(delayB);
    delayB.connect(reverb);
    reverb.connect(wetDark);
    wetDark.connect(wet);
    wet.connect(master);
    dry.connect(master);

    masterWarm = ctx.createBiquadFilter();
    masterWarm.type = "lowshelf";
    masterWarm.frequency.value = 105;
    masterWarm.gain.value = 4.2;
    masterDark = ctx.createBiquadFilter();
    masterDark.type = "lowpass";
    masterDark.frequency.value = 6800;
    masterDark.Q.value = 0.55;
    master.connect(masterWarm);
    masterWarm.connect(masterDark);
    masterDark.connect(ctx.destination);
  }

  function startMelodyLayer(ctx) {
    var filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 380;
    filter.Q.value = 0.75;
    var wobble = ctx.createOscillator();
    wobble.type = "sine";
    wobble.frequency.value = 0.06;
    var wobbleAmt = ctx.createGain();
    wobbleAmt.gain.value = 220;
    wobble.connect(wobbleAmt);
    wobbleAmt.connect(filter.frequency);
    var driftA = ctx.createOscillator();
    driftA.type = "sine";
    driftA.frequency.value = 110;
    var driftB = ctx.createOscillator();
    driftB.type = "triangle";
    driftB.frequency.value = 130.81;
    var driftC = ctx.createOscillator();
    driftC.type = "sine";
    driftC.frequency.value = 164.81;
    var driftMix = ctx.createGain();
    driftMix.gain.value = 0.038;
    driftA.connect(driftMix);
    driftB.connect(driftMix);
    driftC.connect(driftMix);
    driftMix.connect(filter);
    var padGain = ctx.createGain();
    padGain.gain.value = 0.055;
    filter.connect(padGain);
    padGain.connect(melodyBus);
    var padWet = ctx.createGain();
    padWet.gain.value = 0.32;
    padGain.connect(padWet);
    padWet.connect(send);
    driftA.start();
    driftB.start();
    driftC.start();
    wobble.start();
    melodyNodes = { filter: filter, padGain: padGain, driftA: driftA, driftB: driftB, driftC: driftC };
  }

  function noteFreq(degree) {
    var scale = scales[timbre.scaleId % scales.length];
    var idx = ((degree + currentComp.root) % scale.length + scale.length) % scale.length;
    return scale[idx];
  }

  function oscTypes() {
    return ["sine", "triangle", "square", "sawtooth", "sine"];
  }

  function updateDelayTimes() {
    if (!delayA || !delayB) return;
    var beat = 60 / BPM;
    var multA = 0.65 + astroUnit(BPM * 0.01) * 0.35;
    var multB = 1.05 + astroUnit(BPM * 0.02) * 0.45;
    delayA.delayTime.setValueAtTime(beat * multA, audioCtx.currentTime);
    delayB.delayTime.setValueAtTime(beat * multB, audioCtx.currentTime);
  }

  function radicalizeAll() {
    pickTimbre();
    radicalizePatterns(currentComp);
    applyBpmDrift();
    currentComp.root += Math.floor((astroUnit(7.7) - 0.5) * 4);
    if (melodyNodes) {
      var types = oscTypes();
      var drift = 0.88 + astroUnit(6.6) * 0.28;
      melodyNodes.driftA.frequency.setValueAtTime(currentComp.pad[0] * drift, audioCtx.currentTime);
      melodyNodes.driftB.frequency.setValueAtTime(currentComp.pad[1] * drift, audioCtx.currentTime);
      melodyNodes.driftC.frequency.setValueAtTime(currentComp.pad[2] * drift, audioCtx.currentTime);
      melodyNodes.filter.type = astroUnit(4.4) > 0.66 ? "lowpass" : "bandpass";
      melodyNodes.filter.frequency.setValueAtTime(260 + astroUnit(5.5) * 620, audioCtx.currentTime);
    }
  }

  function mutateCurrentComp() {
    radicalizePatterns(currentComp);
    pickTimbre();
    applyBpmDrift();
    currentComp.root += Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? 1 : -1);
    if (melodyNodes) {
      var drift = 0.85 + astroUnit(3.3) * 0.32;
      melodyNodes.driftA.frequency.setValueAtTime(currentComp.pad[0] * drift, audioCtx.currentTime);
      melodyNodes.driftB.frequency.setValueAtTime(currentComp.pad[1] * drift, audioCtx.currentTime);
      melodyNodes.driftC.frequency.setValueAtTime(currentComp.pad[2] * drift, audioCtx.currentTime);
    }
    updateDelayTimes();
  }

  function switchComposition() {
    var next = compositions[Math.floor(Math.random() * compositions.length)];
    while (compositions.length > 1 && next.id === currentComp.id) {
      next = compositions[Math.floor(Math.random() * compositions.length)];
    }
    currentComp = compPreset(
      next.id,
      next.bpm + Math.round((Math.random() - 0.5) * 2),
      next.root + (Math.random() < 0.5 ? 1 : 0),
      next.kick16, next.snare16, next.hat16,
      next.bass12, next.bass12b, next.dub10, next.melody14, next.melody14b,
      next.pad
    );
    currentComp.pad = next.pad.slice();
    radicalizeAll();
    if (astroUnit(2.2) > 0.7) surgeFeedback(audioCtx.currentTime);
  }

  function astroChrono() {
    var d = new Date();
    var year = d.getUTCFullYear();
    var month = d.getUTCMonth();
    var day = d.getUTCDate();
    var hour = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
    var doy = Math.floor((Date.UTC(year, month, day) - Date.UTC(year, 0, 1)) / 86400000) + 1;
    var moon = ((year - 2000) * 12.3685 + month + day / 30.6) % 1;
    if (moon < 0) moon += 1;
    var zodiac = Math.floor((doy / 365.25) * 12 + month * 0.27) % 12;
    return { hour: hour, day: day, month: month, moon: moon, zodiac: zodiac, doy: doy };
  }

  function astroUnit(salt) {
    var a = astroChrono();
    var v =
      Math.sin(a.hour * 0.618 + salt) * 0.27 +
      Math.cos(a.day * 0.271 + a.month * 0.513 + salt * 1.7) * 0.25 +
      Math.sin(a.moon * 6.2831853 + salt * 0.9) * 0.24 +
      Math.cos(a.zodiac * 0.523 + a.doy * 0.041 + salt) * 0.21 +
      Math.sin(audioTick * 0.017 + salt * 2.1) * 0.12 +
      Math.random() * 0.06;
    return Math.max(0, Math.min(1, 0.5 + v));
  }

  function astroDuration(minSec, maxSec, salt) {
    return minSec + astroUnit(salt || 0) * (maxSec - minSec);
  }

  function beginExhale(when) {
    breathe.phase = "exhale";
    var exhaleSec = astroDuration(0.35, 1.4, 1.1);
    var voidSec = Math.min(5, Math.max(0.5, astroDuration(0.5, 5, 4.2)));
    var inhaleSec = astroDuration(0.4, 2, 7.3);
    breathe.voidSec = voidSec;
    breathe.inhaleSec = inhaleSec;
    breathe.exhaleEndTime = when + exhaleSec;
    breathe.voidEndTime = breathe.exhaleEndTime + voidSec;
    breathe.inhaleEndTime = breathe.voidEndTime + inhaleSec;
    breathe.inhaleNotesTime = breathe.voidEndTime + inhaleSec * 0.38;
    breathe.afterVoid = astroUnit(9.6) > 0.58 ? "new" : "mutate";
    pullChromaVoid(0.35);

    dry.gain.cancelScheduledValues(when);
    dry.gain.setValueAtTime(dry.gain.value, when);
    dry.gain.linearRampToValueAtTime(0.0001, when + exhaleSec);

    if (melodyNodes && melodyNodes.padGain) {
      melodyNodes.padGain.gain.cancelScheduledValues(when);
      melodyNodes.padGain.gain.setValueAtTime(melodyNodes.padGain.gain.value, when);
      melodyNodes.padGain.gain.linearRampToValueAtTime(0.0001, when + exhaleSec * 0.88);
    }
  }

  function beginVoid(when) {
    if (breathe.phase === "void") return;
    breathe.phase = "void";
    var voidLen = Math.max(0.5, Math.min(5, breathe.voidEndTime - when));
    var ghostTail = astroUnit(voidLen * 3.1) > 0.68;
    pullChromaVoid(ghostTail ? 0.55 : 1);

    send.gain.cancelScheduledValues(when);
    send.gain.setValueAtTime(Math.max(send.gain.value, 0.05), when);
    send.gain.linearRampToValueAtTime(ghostTail ? 0.42 : 0.0001, when + voidLen * 0.92);

    delayFbA.gain.cancelScheduledValues(when);
    delayFbA.gain.setValueAtTime(delayFbA.gain.value, when);
    if (ghostTail) {
      delayFbA.gain.linearRampToValueAtTime(0.62 + astroUnit(25.1) * 0.18, when + voidLen * 0.35);
      delayFbA.gain.linearRampToValueAtTime(feedbackBase.a, when + voidLen);
    } else {
      delayFbA.gain.linearRampToValueAtTime(0.06, when + voidLen * 0.78);
    }

    delayFbB.gain.cancelScheduledValues(when);
    delayFbB.gain.setValueAtTime(delayFbB.gain.value, when);
    if (ghostTail) {
      delayFbB.gain.linearRampToValueAtTime(0.52 + astroUnit(26.2) * 0.16, when + voidLen * 0.4);
      delayFbB.gain.linearRampToValueAtTime(feedbackBase.b, when + voidLen + 0.15);
    } else {
      delayFbB.gain.linearRampToValueAtTime(0.04, when + voidLen * 0.82);
    }
  }

  function beginInhale(when) {
    if (breathe.phase === "inhale") return;
    breathe.phase = "inhale";
    if (breathe.afterVoid === "new") switchComposition();
    else {
      mutateCurrentComp();
      if (astroUnit(8.8) > 0.62) surgeFeedback(when);
    }
    nudgeChromaFromSignal(0.03 + astroUnit(8.8) * 0.05, 8.8);

    var inhaleSec = breathe.inhaleSec;

    delayFbA.gain.cancelScheduledValues(when);
    delayFbA.gain.setValueAtTime(delayFbA.gain.value, when);
    delayFbA.gain.linearRampToValueAtTime(feedbackBase.a + 0.12, when + inhaleSec * 0.45);
    delayFbA.gain.linearRampToValueAtTime(feedbackBase.a, when + inhaleSec * 0.95);

    delayFbB.gain.cancelScheduledValues(when);
    delayFbB.gain.setValueAtTime(delayFbB.gain.value, when);
    delayFbB.gain.linearRampToValueAtTime(feedbackBase.b + 0.1, when + inhaleSec * 0.5);
    delayFbB.gain.linearRampToValueAtTime(feedbackBase.b, when + inhaleSec);

    send.gain.cancelScheduledValues(when);
    send.gain.setValueAtTime(send.gain.value, when);
    send.gain.linearRampToValueAtTime(1, when + inhaleSec * 0.62);

    dry.gain.cancelScheduledValues(when);
    dry.gain.setValueAtTime(dry.gain.value, when);
    dry.gain.linearRampToValueAtTime(0.72, when + inhaleSec * 0.9);

    if (melodyNodes && melodyNodes.padGain) {
      melodyNodes.padGain.gain.cancelScheduledValues(when);
      melodyNodes.padGain.gain.setValueAtTime(0.0001, when);
      melodyNodes.padGain.gain.linearRampToValueAtTime(0.055, when + inhaleSec * 1.05);
    }
  }

  function finishInhale() {
    if (breathe.phase === "play") return;
    breathe.phase = "play";
    breathe.nextBreakAtBar = barIndex + 6 + Math.floor(astroDuration(0, 1, 2.8) * 14);
  }

  function manageBreathe(when) {
    if (!playing || !audioCtx) return;
    var gate = 0.8 + astroUnit(barIndex * 0.19) * 0.15;
    if (breathe.phase === "play" && barIndex >= breathe.nextBreakAtBar && Math.random() < gate) {
      beginExhale(when);
    }
  }

  function advanceBreathePhases(when) {
    if (!playing || !audioCtx) return;
    if (breathe.phase === "exhale" && when >= breathe.exhaleEndTime) beginVoid(when);
    if (breathe.phase === "void" && when >= breathe.voidEndTime) beginInhale(when);
    if (breathe.phase === "inhale" && when >= breathe.inhaleEndTime) finishInhale();
  }

  function envHit(node, peak, attack, release, when, bus, wetAmt) {
    var g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + release);
    node.connect(g);
    g.connect(bus || drumBus);
    if (wetAmt) {
      var wetSend = audioCtx.createGain();
      wetSend.gain.value = wetAmt;
      g.connect(wetSend);
      wetSend.connect(send);
    }
  }

  function playKick(when, accent) {
    var style = timbre.kickStyle % 4;
    var body = audioCtx.createOscillator();
    body.type = style === 2 ? "square" : "sine";
    var startF = style === 1 ? 95 : style === 3 ? 135 : accent ? 118 : 108;
    body.frequency.setValueAtTime(startF, when);
    body.frequency.exponentialRampToValueAtTime(style === 1 ? 32 : 42, when + (style === 3 ? 0.22 : 0.14));
    var mix = audioCtx.createGain();
    body.connect(mix);
    if (style === 2) {
      var mod = audioCtx.createOscillator();
      mod.type = "triangle";
      mod.frequency.value = 48;
      var modGain = audioCtx.createGain();
      modGain.gain.value = 22;
      mod.connect(modGain);
      modGain.connect(body.frequency);
      mod.start(when);
      mod.stop(when + 0.4);
    }
    if (style !== 1) {
      var sub = audioCtx.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(52, when);
      sub.frequency.exponentialRampToValueAtTime(38, when + 0.2);
      sub.connect(mix);
      sub.start(when);
      sub.stop(when + 0.55);
    }
    var lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = style === 3 ? 420 : 280;
    mix.connect(lp);
    envHit(lp, accent ? 1.08 : 0.94, 0.003, style === 1 ? 0.68 : 0.52, when, drumBus);
    body.start(when);
    body.stop(when + 0.58);
  }

  function playSnare(when) {
    var style = timbre.snareStyle % 3;
    var noise = audioCtx.createBufferSource();
    var len = Math.floor(audioCtx.sampleRate * (style === 2 ? 0.22 : 0.14));
    var buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buf;
    var filter = audioCtx.createBiquadFilter();
    filter.type = style === 1 ? "lowpass" : "bandpass";
    filter.frequency.value = style === 1 ? 640 : style === 2 ? 1200 : 920;
    filter.Q.value = style === 2 ? 1.4 : 0.65;
    var tone = audioCtx.createOscillator();
    tone.type = style === 2 ? "square" : "sine";
    tone.frequency.setValueAtTime(style === 2 ? 240 : 180, when);
    tone.frequency.exponentialRampToValueAtTime(120, when + 0.08);
    var mix = audioCtx.createGain();
    noise.connect(filter);
    filter.connect(mix);
    if (style !== 1) tone.connect(mix);
    envHit(mix, style === 2 ? 0.44 : 0.36, 0.004, style === 2 ? 0.28 : 0.22, when, drumBus);
    noise.start(when);
    noise.stop(when + len / audioCtx.sampleRate + 0.02);
    tone.start(when);
    tone.stop(when + 0.12);
  }

  function playDubStab(when) {
    var style = timbre.dubStyle % 4;
    var types = oscTypes();
    var root = noteFreq(3 + style);
    var osc = audioCtx.createOscillator();
    osc.type = types[style % types.length];
    osc.frequency.value = root * (style === 3 ? 2 : 1);
    var osc2 = audioCtx.createOscillator();
    osc2.type = style === 1 ? "square" : "sine";
    osc2.frequency.value = root * (style === 2 ? 1.618 : 1.5);
    var filter = audioCtx.createBiquadFilter();
    filter.type = style === 0 ? "bandpass" : "lowpass";
    filter.frequency.value = style === 3 ? 1100 : 520 + style * 140;
    filter.Q.value = style === 0 ? 1.2 : 0.8;
    var mix = audioCtx.createGain();
    osc.connect(mix);
    osc2.connect(mix);
    mix.connect(filter);
    envHit(filter, 0.28 + style * 0.04, 0.008, 0.14 + style * 0.04, when, melodyBus, 0.32 + style * 0.08);
    osc.start(when);
    osc.stop(when + 0.24);
    osc2.start(when);
    osc2.stop(when + 0.24);
  }

  function playHat(when) {
    var style = timbre.hatStyle % 3;
    var noise = audioCtx.createBufferSource();
    var len = Math.floor(audioCtx.sampleRate * (style === 2 ? 0.045 : 0.028));
    var buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buf;
    var filter = audioCtx.createBiquadFilter();
    filter.type = style === 1 ? "highpass" : "bandpass";
    filter.frequency.value = style === 0 ? 6800 : style === 1 ? 9200 : 4200;
    filter.Q.value = style === 2 ? 2.2 : 0.8;
    noise.connect(filter);
    envHit(filter, style === 2 ? 0.09 : 0.06, 0.002, style === 2 ? 0.07 : 0.04, when, drumBus);
    noise.start(when);
    noise.stop(when + 0.05);
  }

  function playBassNote(when, freq, velocity) {
    var style = timbre.bassStyle % 5;
    var types = oscTypes();
    var sub = audioCtx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = freq * (style === 4 ? 0.5 : 1);
    var growl = audioCtx.createOscillator();
    growl.type = types[(style + 2) % types.length];
    growl.frequency.value = freq * (1 + style * 0.002);
    var growlGain = audioCtx.createGain();
    growlGain.gain.value = style === 3 ? 0.32 : style === 1 ? 0.08 : 0.16;
    var lp = audioCtx.createBiquadFilter();
    lp.type = style === 2 ? "bandpass" : "lowpass";
    lp.frequency.setValueAtTime(style === 3 ? 680 : 420, when);
    lp.frequency.exponentialRampToValueAtTime(style === 4 ? 90 : 160, when + 0.42);
    lp.Q.value = style === 2 ? 2.4 : 1.2;
    if (style === 2 || style === 4) {
      var dubLfo = audioCtx.createOscillator();
      dubLfo.type = "sine";
      dubLfo.frequency.value = 0.25 + style * 0.12;
      var dubAmt = audioCtx.createGain();
      dubAmt.gain.value = style === 4 ? 140 : 95;
      dubLfo.connect(dubAmt);
      dubAmt.connect(lp.frequency);
      dubLfo.start(when);
      dubLfo.stop(when + 0.55);
    }
    var mix = audioCtx.createGain();
    sub.connect(mix);
    growl.connect(growlGain);
    growlGain.connect(mix);
    mix.connect(lp);
    envHit(lp, 0.82 * velocity + style * 0.03, 0.012, style === 4 ? 0.62 : 0.48, when, bassBus, style > 2 ? 0.28 : 0.15);
    sub.start(when);
    sub.stop(when + 0.55);
    growl.start(when);
    growl.stop(when + 0.55);
  }

  function playMelodyNote(when, freq, dur) {
    var style = timbre.melStyle % 5;
    var types = oscTypes();
    var osc = audioCtx.createOscillator();
    osc.type = types[style % types.length];
    osc.frequency.value = freq;
    var osc2 = audioCtx.createOscillator();
    osc2.type = types[(style + 2) % types.length];
    osc2.frequency.value = freq * (style === 3 ? 2.01 : style === 4 ? 1.333 : 1.505);
    var dark = audioCtx.createBiquadFilter();
    dark.type = style === 1 ? "bandpass" : "lowpass";
    dark.frequency.value = style === 4 ? 2200 : style === 1 ? 880 : 1200;
    dark.Q.value = style === 1 ? 1.8 : 0.7;
    var mix = audioCtx.createGain();
    osc.connect(mix);
    if (style !== 2) osc2.connect(mix);
    mix.connect(dark);
    var peak = style === 4 ? 0.32 : style === 0 ? 0.22 : 0.26;
    var g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.035);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur * (style === 3 ? 1.35 : 1));
    dark.connect(g);
    g.connect(melodyBus);
    var wetSend = audioCtx.createGain();
    wetSend.gain.value = 0.22 + style * 0.06;
    g.connect(wetSend);
    wetSend.connect(send);
    osc.start(when);
    osc.stop(when + dur + 0.05);
    if (style !== 2) {
      osc2.start(when);
      osc2.stop(when + dur + 0.05);
    }
  }

  function swingGate(tick) {
    if (timbre.swing < 0.25) return true;
    var phase = tick % 6;
    if (phase === 2 || phase === 5) return Math.random() > timbre.swing * 0.55;
    return true;
  }

  function scheduleAudioStep(tick, when) {
    var c = timbre.cycles;
    var pK = tick % c.k;
    var pS = tick % c.s;
    var pH = tick % c.h;
    var pB = tick % c.b;
    var pD = tick % c.d;
    var pM = tick % c.m;

    if (tick % 16 === 0 && tick > 0) {
      barIndex++;
      manageBreathe(when);
      maybeBarRadicalize(when);
      if (timbre.density.mel < 0.48 && timbre.density.dub < 0.42 && Math.random() < 0.28) {
        surgeFeedback(when);
      }
    }

    advanceBreathePhases(when);

    if (breathe.phase === "void") return;
    if (breathe.phase === "inhale" && when < breathe.inhaleNotesTime) return;
    if (breathe.phase === "exhale" && when >= breathe.exhaleEndTime) return;
    if (!swingGate(tick)) return;

    var align = computeAlign(tick);
    var bassLine = barIndex % 2 === 0 ? currentComp.bass12 : currentComp.bass12b;
    var melodyLine = barIndex % 2 === 0 ? currentComp.melody14 : currentComp.melody14b;
    var fullAlign = align >= 0.99;
    var den = timbre.density;

    if (currentComp.kick16[pK % currentComp.kick16.length] && Math.random() < den.kick) {
      playKick(when, fullAlign);
    }
    if (currentComp.snare16[pS % currentComp.snare16.length] && Math.random() < den.snare) {
      playSnare(when);
    }
    if (currentComp.hat16[pH % currentComp.hat16.length] && Math.random() < den.hat) {
      playHat(when);
    }
    if (currentComp.dub10[pD % currentComp.dub10.length] && Math.random() < den.dub) {
      playDubStab(when);
    }

    var bassHit = bassLine[pB % bassLine.length];
    if (bassHit && Math.random() < den.bass) {
      playBassNote(when, noteFreq(bassHit.d), bassHit.v * (0.85 + align * 0.2));
    }

    var deg = melodyLine[pM % melodyLine.length];
    if (deg !== null && deg !== undefined && Math.random() < den.mel) {
      playMelodyNote(when, noteFreq(deg) * timbre.melOctave, SEC_PER_16 * (1.8 + timbre.melStyle * 0.12));
    }

    if (fullAlign && melodyNodes && melodyNodes.padGain && breathe.phase === "play") {
      melodyNodes.padGain.gain.setValueAtTime(0.055 + align * 0.04, when);
      melodyNodes.padGain.gain.exponentialRampToValueAtTime(0.055, when + 0.5);
    }
  }

  function audioScheduler() {
    if (!playing || !audioCtx) return;
    var now = audioCtx.currentTime;
    var horizon = tabHidden ? 10 : 0.45;
    var maxSteps = tabHidden ? 640 : 48;
    var steps = 0;
    while (audioNextTime < now + horizon && steps < maxSteps) {
      scheduleAudioStep(audioTick, audioNextTime);
      audioNextTime += SEC_PER_16;
      audioTick++;
      steps++;
    }
    audioTimer = window.setTimeout(audioScheduler, tabHidden ? 400 : 30);
  }

  function syncAudioAfterTabReturn() {
    if (!playing || !audioCtx) return;
    if (audioCtx.state === "suspended") audioCtx.resume();
    var now = audioCtx.currentTime;
    if (audioNextTime < now) {
      audioNextTime = now + 0.02;
    }
    if (audioTimer) window.clearTimeout(audioTimer);
    audioScheduler();
  }

  function startAudio() {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioCtx) {
      audioCtx = new AudioCtx();
      connectFx(audioCtx);
      startMelodyLayer(audioCtx);
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    audioTick = 0;
    barIndex = 0;
    audioNextTime = audioCtx.currentTime + 0.06;
    master.gain.cancelScheduledValues(audioCtx.currentTime);
    master.gain.setValueAtTime(master.gain.value, audioCtx.currentTime);
    master.gain.linearRampToValueAtTime(0.48, audioCtx.currentTime + 0.35);
    playing = true;
    breathe.phase = "play";
    breathe.nextBreakAtBar = 6 + Math.floor(astroDuration(0, 1, 3.1) * 12);
    pickTimbre();
    audioScheduler();
    if (toggle) {
      toggle.setAttribute("aria-pressed", "true");
      toggle.setAttribute("aria-label", "Stop smoked deep dub soundscape");
      toggle.querySelector(".audio-toggle-label").textContent = "mute";
    }
  }

  function stopAudio() {
    playing = false;
    breathe.phase = "play";
    if (audioTimer) {
      window.clearTimeout(audioTimer);
      audioTimer = null;
    }
    if (audioCtx && master) {
      master.gain.cancelScheduledValues(audioCtx.currentTime);
      master.gain.setValueAtTime(master.gain.value, audioCtx.currentTime);
      master.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);
      if (dry) {
        dry.gain.cancelScheduledValues(audioCtx.currentTime);
        dry.gain.setValueAtTime(0.72, audioCtx.currentTime);
      }
      if (send) {
        send.gain.cancelScheduledValues(audioCtx.currentTime);
        send.gain.setValueAtTime(1, audioCtx.currentTime);
      }
      if (delayFbA) {
        delayFbA.gain.cancelScheduledValues(audioCtx.currentTime);
        delayFbA.gain.setValueAtTime(feedbackBase.a, audioCtx.currentTime);
      }
      if (delayFbB) {
        delayFbB.gain.cancelScheduledValues(audioCtx.currentTime);
        delayFbB.gain.setValueAtTime(feedbackBase.b, audioCtx.currentTime);
      }
      if (melodyNodes && melodyNodes.padGain) {
        melodyNodes.padGain.gain.cancelScheduledValues(audioCtx.currentTime);
        melodyNodes.padGain.gain.setValueAtTime(0.055, audioCtx.currentTime);
      }
      window.setTimeout(function () {
        if (!playing && audioCtx && audioCtx.state === "running") audioCtx.suspend();
      }, 450);
    }
    if (toggle) {
      toggle.setAttribute("aria-pressed", "false");
      toggle.setAttribute("aria-label", "Start smoked deep dub soundscape");
      toggle.querySelector(".audio-toggle-label").textContent = "sound";
    }
  }

  if (reduced) {
    if (toggle) {
      toggle.disabled = true;
      toggle.setAttribute("aria-label", "Soundscape disabled when reduced motion is on");
    }
    initGlyphs();
    fitOracle();
    window.addEventListener("resize", fitOracle);
    return;
  }

  if (canvas) {
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    if (!initPlasmaGL()) {
      pCtx = canvas.getContext("2d", { alpha: true });
    }
    resizePlasma();
    window.addEventListener("resize", onViewportResize);
  } else {
    window.addEventListener("resize", fitOracle);
  }

  document.addEventListener("visibilitychange", function () {
    tabHidden = document.hidden;
    if (document.hidden) {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      return;
    }
    syncAudioAfterTabReturn();
    if (!rafId) rafId = requestAnimationFrame(frame);
  });

  initGlyphs();
  fitOracle();
  pickChromaTargets();
  pickMistTarget();
  updateAtmosphere();
  pushMistStyles();

  if (toggle) {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) toggle.disabled = true;
    toggle.addEventListener("click", function () {
      if (playing) stopAudio();
      else startAudio();
    });
  }

  rafId = requestAnimationFrame(frame);
})();
