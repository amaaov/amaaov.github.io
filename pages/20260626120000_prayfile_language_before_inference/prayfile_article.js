(function () {
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var mistCanvas = document.getElementById("mist-canvas");
  var feedbackCanvas = document.getElementById("feedback-canvas");
  var w = 0;
  var h = 0;
  var scrollGain = 0;
  var pointerGain = 0;
  var echoes = [];
  var mistBands = [];

  function resize() {
    if (!mistCanvas || !feedbackCanvas) return;
    w = mistCanvas.width = feedbackCanvas.width = window.innerWidth;
    h = mistCanvas.height = feedbackCanvas.height = window.innerHeight;
    mistBands = [];
    for (var i = 0; i < 6; i++) {
      mistBands.push({
        y: (h / 6) * i,
        amp: 18 + Math.random() * 32,
        freq: 0.0012 + Math.random() * 0.002,
        phase: Math.random() * Math.PI * 2,
        drift: 0.08 + Math.random() * 0.15
      });
    }
  }

  function pushEcho(x, y, strength) {
    echoes.push({ x: x, y: y, r: 12 + strength * 80, life: 1, strength: strength });
    if (echoes.length > 24) echoes.shift();
  }

  if (!reducedMotion && mistCanvas && feedbackCanvas) {
    var mistCtx = mistCanvas.getContext("2d");
    var fbCtx = feedbackCanvas.getContext("2d");

    function drawMist(t) {
      mistCtx.clearRect(0, 0, w, h);
      var time = t * 0.001;
      var gain = 0.35 + scrollGain * 0.65 + pointerGain * 0.4;

      for (var i = 0; i < mistBands.length; i++) {
        var band = mistBands[i];
        mistCtx.beginPath();
        mistCtx.moveTo(0, band.y);
        for (var x = 0; x <= w; x += 12) {
          var y = band.y +
            Math.sin(x * band.freq + time * band.drift + band.phase) * band.amp * gain +
            Math.sin(x * band.freq * 2.3 + time * 0.07) * band.amp * 0.25 * gain;
          mistCtx.lineTo(x, y);
        }
        mistCtx.lineTo(w, h);
        mistCtx.lineTo(0, h);
        mistCtx.closePath();
        var alpha = 0.025 + gain * 0.04;
        mistCtx.fillStyle = "rgba(210, 220, 235, " + alpha + ")";
        mistCtx.fill();
      }

      scrollGain *= 0.985;
      pointerGain *= 0.94;
    }

    function drawFeedback(t) {
      fbCtx.clearRect(0, 0, w, h);
      var time = t * 0.001;

      for (var i = echoes.length - 1; i >= 0; i--) {
        var e = echoes[i];
        e.life -= 0.008;
        e.r += 1.2 + e.strength * 2;
        if (e.life <= 0) {
          echoes.splice(i, 1);
          continue;
        }
        var a = e.life * e.life * 0.18 * e.strength;
        fbCtx.beginPath();
        fbCtx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        fbCtx.strokeStyle = "rgba(201, 168, 124, " + a + ")";
        fbCtx.lineWidth = 1.5 + e.strength * 3;
        fbCtx.stroke();

        fbCtx.beginPath();
        fbCtx.arc(e.x, e.y, e.r * 0.55, 0, Math.PI * 2);
        fbCtx.strokeStyle = "rgba(236, 228, 218, " + (a * 0.35) + ")";
        fbCtx.lineWidth = 0.8;
        fbCtx.stroke();
      }

      var rings = 3 + Math.floor(scrollGain * 4);
      for (var r = 0; r < rings; r++) {
        var radius = 40 + r * 55 + Math.sin(time * 0.4 + r) * 12;
        var cx = w * 0.5 + Math.sin(time * 0.15 + r * 1.7) * w * 0.08;
        var cy = h * 0.42 + Math.cos(time * 0.12 + r) * h * 0.06;
        fbCtx.beginPath();
        fbCtx.arc(cx, cy, radius * (1 + scrollGain * 0.5), 0, Math.PI * 2);
        fbCtx.strokeStyle = "rgba(201, 168, 124, " + (0.03 + scrollGain * 0.05) + ")";
        fbCtx.lineWidth = 1;
        fbCtx.stroke();
      }
    }

    function frame(t) {
      drawMist(t);
      drawFeedback(t);
      requestAnimationFrame(frame);
    }

    resize();
    requestAnimationFrame(frame);
    window.addEventListener("resize", resize);
  }

  if (reducedMotion) return;

  var ring = document.getElementById("sharpen-ring");
  var morseHint = document.getElementById("touch-hint-label");
  var hintLabel = morseHint;
  if (!ring) return;

  var pointers = new Map();
  var root = document.documentElement;
  var edgeScrollRaf = 0;
  var edgeScrollLastTime = 0;
  var morseRevealed = false;
  var fogScrollLockEnabled = !reducedMotion &&
    !window.matchMedia("(prefers-contrast: high)").matches;

  var MOVE_THRESH = 14;
  var DOT_MIN_MS = 120;
  var DOT_MAX_CAP_MS = 420;
  var LETTER_GAP_MIN_MS = 520;
  var LETTER_GAP_MAX_MS = 1500;
  var LETTER_GAP_RATIO = 2.6;
  var SEQUENCE_IDLE_MIN_MS = 3800;
  var SEQUENCE_IDLE_MAX_MS = 11000;
  var SEQUENCE_IDLE_RATIO = 5.5;
  var RHYTHM_BLEND = 0.38;
  var MORSE_WRONG_RESET_MS = 2200;
  var WAKE_TAP_COUNT = 5;
  var WAKE_TAP_MAX_MS = 300;
  var WAKE_SEQUENCE_MS = 1300;
  var MORSE_ARM_COOLDOWN_MS = 1000;
  var HINT_LABEL_DEFAULT = "touch to sharpen";
  // · tap   − hold
  // pray    .--. .-. .- -.--
  // reveal  .-. . ...- . .-..
  var MORSE_SECRETS = ["PRAY", "REVEAL"];

  var MORSE_TABLE = {
    A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.",
    G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..",
    M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.",
    S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
    Y: "-.--", Z: "--.."
  };

  var MORSE_DECODE = {};
  Object.keys(MORSE_TABLE).forEach(function (letter) {
    MORSE_DECODE[MORSE_TABLE[letter]] = letter;
  });

  var morseLetterBuf = "";
  var morseDecoded = "";
  var morseRaw = "";
  var morseAttempt = false;
  var morseMode = false;
  var morseAccepting = false;
  var morseArmTimer = 0;
  var letterTimer = 0;
  var sequenceTimer = 0;
  var lastMorseTapAt = 0;
  var morseRhythmMs = 720;
  var dotUnitMs = 210;
  var wakeTapCount = 0;
  var lastWakeTapAt = 0;

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function dotThresholdMs() {
    return Math.round(clamp(dotUnitMs * 2.15, DOT_MIN_MS, DOT_MAX_CAP_MS));
  }

  function letterGapMs() {
    return Math.round(clamp(morseRhythmMs * LETTER_GAP_RATIO, LETTER_GAP_MIN_MS, LETTER_GAP_MAX_MS));
  }

  function sequenceIdleMs() {
    return Math.round(clamp(morseRhythmMs * SEQUENCE_IDLE_RATIO, SEQUENCE_IDLE_MIN_MS, SEQUENCE_IDLE_MAX_MS));
  }

  function absorbTapRhythm(gapMs) {
    if (gapMs <= 0) return;
    if (gapMs < letterGapMs() * 1.15) {
      morseRhythmMs += (gapMs - morseRhythmMs) * RHYTHM_BLEND;
    }
  }

  function maxScrollY() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function fogScrollLocked() {
    return document.documentElement.classList.contains("fog-scroll-lock");
  }

  function setFogScrollLock(locked) {
    document.documentElement.classList.toggle("fog-scroll-lock", locked);
  }

  function fogScrollBy(delta) {
    if (!delta) return;
    var y = window.scrollY || window.pageYOffset || 0;
    var next = clamp(y + delta, 0, maxScrollY());
    if (next !== y) window.scrollTo(0, next);
  }

  function blockNativeScroll(ev) {
    if (!fogScrollLocked()) return;
    if (isChrome(ev.target)) return;
    ev.preventDefault();
  }

  function blockScrollKeys(ev) {
    if (!fogScrollLocked()) return;
    if (ev.key === " " || ev.key === "PageUp" || ev.key === "PageDown" ||
        ev.key === "ArrowUp" || ev.key === "ArrowDown" || ev.key === "Home" || ev.key === "End") {
      ev.preventDefault();
    }
  }

  function spotRadius() {
    return Math.min(180, Math.max(100, window.innerWidth * 0.24));
  }

  function primaryPointer() {
    var found = null;
    pointers.forEach(function (p) {
      if (p.sharpen) found = p;
    });
    return found;
  }

  function sharpenCount() {
    var n = 0;
    pointers.forEach(function (p) {
      if (p.sharpen) n += 1;
    });
    return n;
  }

  function edgeScrollSpeed(y, dt) {
    var r = spotRadius();
    var vh = window.innerHeight;
    var band = Math.max(96, vh * 0.14);
    var maxPxPerMs = 0.11;
    var scroll = 0;

    var topInset = y - r;
    if (topInset < band) {
      var up = 1 - Math.max(0, topInset) / band;
      scroll -= maxPxPerMs * dt * up * up;
    }

    var bottomInset = vh - (y + r);
    if (bottomInset < band) {
      var down = 1 - Math.max(0, bottomInset) / band;
      scroll += maxPxPerMs * dt * down * down;
    }

    return scroll;
  }

  function edgeScrollLoop(t) {
    if (sharpenCount() === 0) {
      edgeScrollRaf = 0;
      edgeScrollLastTime = 0;
      return;
    }

    var dt = edgeScrollLastTime ? Math.min(40, t - edgeScrollLastTime) : 16;
    edgeScrollLastTime = t;

    var p = primaryPointer();
    if (p) {
      var scroll = edgeScrollSpeed(p.y, dt);
      if (scroll !== 0) {
        var y = window.scrollY || window.pageYOffset || 0;
        var maxY = maxScrollY();
        if ((scroll < 0 && y > 0) || (scroll > 0 && y < maxY)) {
          fogScrollBy(scroll);
        }
      }
    }

    edgeScrollRaf = requestAnimationFrame(edgeScrollLoop);
  }

  function startEdgeScroll() {
    if (edgeScrollRaf) return;
    edgeScrollRaf = requestAnimationFrame(edgeScrollLoop);
  }

  function stopEdgeScroll() {
    if (!edgeScrollRaf) return;
    cancelAnimationFrame(edgeScrollRaf);
    edgeScrollRaf = 0;
    edgeScrollLastTime = 0;
  }

  function setSpot(x, y, active) {
    root.style.setProperty("--spot-x", x + "px");
    root.style.setProperty("--spot-y", y + "px");
    root.style.setProperty("--spot-r", spotRadius() + "px");
    ring.style.left = x + "px";
    ring.style.top = y + "px";
    if (active && !morseRevealed) document.body.classList.add("sharpen-active");
    else document.body.classList.remove("sharpen-active");
  }

  function isChrome(el) {
    return el && el.closest && el.closest(".site-top");
  }

  function clearSelection() {
    var sel = window.getSelection();
    if (!sel) return;
    if (sel.removeAllRanges) sel.removeAllRanges();
    else if (sel.empty) sel.empty();
  }

  function morsePattern(word) {
    return word.split("").map(function (ch) {
      return MORSE_TABLE[ch] || "";
    }).join(" ");
  }

  function matchesSecretPrefix(decoded) {
    for (var i = 0; i < MORSE_SECRETS.length; i++) {
      if (MORSE_SECRETS[i].indexOf(decoded) === 0) return true;
    }
    return false;
  }

  function matchingSecret(decoded) {
    for (var i = 0; i < MORSE_SECRETS.length; i++) {
      if (MORSE_SECRETS[i] === decoded) return MORSE_SECRETS[i];
    }
    return null;
  }

  function setMorseAttemptActive(active) {
    if (active) document.body.classList.add("morse-attempt");
    else document.body.classList.remove("morse-attempt");
  }

  function clearMorseArm() {
    if (morseArmTimer) {
      clearTimeout(morseArmTimer);
      morseArmTimer = 0;
    }
    morseAccepting = false;
    document.body.classList.remove("morse-arming");
  }

  function enterMorseMode() {
    if (morseRevealed || morseMode) return;
    morseMode = true;
    morseLetterBuf = "";
    morseDecoded = "";
    morseRaw = "";
    lastMorseTapAt = 0;
    wakeTapCount = 0;
    clearMorseArm();
    setMorseAttemptActive(true);
    document.body.classList.add("morse-arming");
    if (hintLabel) {
      hintLabel.classList.add("touch-hint-label--morse");
      hintLabel.textContent = "…";
    }
    morseArmTimer = setTimeout(function () {
      morseArmTimer = 0;
      morseAccepting = true;
      document.body.classList.remove("morse-arming");
    }, MORSE_ARM_COOLDOWN_MS);
  }

  function registerWakeTap(durationMs) {
    var now = Date.now();
    if (wakeTapCount > 0 && now - lastWakeTapAt > WAKE_SEQUENCE_MS) {
      wakeTapCount = 0;
    }
    if (durationMs > WAKE_TAP_MAX_MS) {
      wakeTapCount = 0;
      return;
    }
    wakeTapCount += 1;
    lastWakeTapAt = now;
    if (wakeTapCount >= WAKE_TAP_COUNT) {
      enterMorseMode();
    }
  }

  function restoreHintLabel() {
    if (!hintLabel) return;
    hintLabel.textContent = HINT_LABEL_DEFAULT;
    hintLabel.classList.remove("touch-hint-label--morse");
  }

  function updateMorseHint() {
    if (!hintLabel) return;
    var live = morseRaw + morseLetterBuf;
    if (!live && !morseDecoded) {
      restoreHintLabel();
      return;
    }
    hintLabel.classList.add("touch-hint-label--morse");
    hintLabel.textContent = live + (morseDecoded ? "  ·  " + morseDecoded : "");
  }

  function resetMorseAttempt() {
    if (morseRevealed) return;
    if (letterTimer) {
      clearTimeout(letterTimer);
      letterTimer = 0;
    }
    if (sequenceTimer) {
      clearTimeout(sequenceTimer);
      sequenceTimer = 0;
    }

    if (morseLetterBuf) {
      var pattern = morseLetterBuf;
      var letter = MORSE_DECODE[pattern];
      morseRaw += (morseRaw ? " " : "") + pattern;
      morseLetterBuf = "";
      morseDecoded += letter || "?";
      updateMorseHint();
    }

    var matched = matchingSecret(morseDecoded);
    if (matched) {
      revealByMorse(matched);
      return;
    }

    morseLetterBuf = "";
    morseDecoded = "";
    morseRaw = "";
    morseAttempt = false;
    morseMode = false;
    lastMorseTapAt = 0;
    wakeTapCount = 0;
    clearMorseArm();
    setMorseAttemptActive(false);
    restoreHintLabel();
  }

  function scheduleSequenceReset() {
    if (sequenceTimer) clearTimeout(sequenceTimer);
    sequenceTimer = setTimeout(resetMorseAttempt, sequenceIdleMs());
  }

  function commitMorseLetter() {
    if (letterTimer) {
      clearTimeout(letterTimer);
      letterTimer = 0;
    }
    if (!morseLetterBuf) return;

    var pattern = morseLetterBuf;
    var letter = MORSE_DECODE[pattern];
    morseRaw += (morseRaw ? " " : "") + pattern;
    morseLetterBuf = "";
    morseDecoded += letter || "?";
    updateMorseHint();

    var matched = matchingSecret(morseDecoded);
    if (matched) {
      revealByMorse(matched);
      return;
    }

    if (letter && matchesSecretPrefix(morseDecoded)) {
      scheduleSequenceReset();
      return;
    }

    setTimeout(resetMorseAttempt, MORSE_WRONG_RESET_MS);
  }

  function morseTap(durationMs) {
    if (morseRevealed || !morseMode || !morseAccepting) return;

    var now = Date.now();
    if (lastMorseTapAt) absorbTapRhythm(now - lastMorseTapAt);
    lastMorseTapAt = now;

    morseAttempt = true;
    setMorseAttemptActive(true);
    var symbol = durationMs < dotThresholdMs() ? "." : "-";
    if (symbol === ".") {
      dotUnitMs += (durationMs - dotUnitMs) * RHYTHM_BLEND;
    }
    morseLetterBuf += symbol;
    updateMorseHint();

    if (letterTimer) clearTimeout(letterTimer);
    letterTimer = setTimeout(commitMorseLetter, letterGapMs());
    scheduleSequenceReset();
  }

  function revealByMorse(word) {
    morseRevealed = true;
    morseMode = false;
    clearMorseArm();
    setMorseAttemptActive(false);
    document.body.classList.add("morse-revealed");
    setFogScrollLock(false);
    setSpot(0, 0, false);
    stopEdgeScroll();
    pointers.clear();

    if (letterTimer) clearTimeout(letterTimer);
    if (sequenceTimer) clearTimeout(sequenceTimer);

    if (hintLabel) {
      hintLabel.classList.add("touch-hint-label--morse");
      hintLabel.textContent = morsePattern(word) + "  ·  " + word;
    }
  }

  function pointerTravel(p, x, y) {
    return Math.hypot(x - p.startX, y - p.startY);
  }

  function enterSharpen(id, p) {
    if (morseRevealed || p.sharpen) return;
    p.sharpen = true;
    setSpot(p.x, p.y, true);
    startEdgeScroll();
    pushEcho(p.x, p.y, 0.55);
    pointerGain = Math.min(1, pointerGain + 0.2);
  }

  function exitSharpenIfNeeded() {
    if (sharpenCount() > 0) return;
    setSpot(0, 0, false);
    stopEdgeScroll();
  }

  function blockSelection(ev) {
    if (isChrome(ev.target)) return;
    ev.preventDefault();
  }

  document.addEventListener("pointerdown", function (ev) {
    if (isChrome(ev.target)) return;
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    if (morseRevealed) return;

    document.body.classList.add("tap-hold");
    clearSelection();
    var p = {
      startX: ev.clientX,
      startY: ev.clientY,
      x: ev.clientX,
      y: ev.clientY,
      downAt: Date.now(),
      sharpen: false
    };
    pointers.set(ev.pointerId, p);
    if (!morseMode) {
      enterSharpen(ev.pointerId, p);
    }
  }, { passive: true });

  document.addEventListener("pointermove", function (ev) {
    var p = pointers.get(ev.pointerId);
    if (!p || morseRevealed) return;

    p.x = ev.clientX;
    p.y = ev.clientY;

    if (!p.sharpen && pointerTravel(p, ev.clientX, ev.clientY) > MOVE_THRESH) {
      if (ev.pointerType === "mouse") ev.preventDefault();
      enterSharpen(ev.pointerId, p);
    }

    if (p.sharpen) {
      setSpot(ev.clientX, ev.clientY, true);
      clearSelection();
    }
  }, { passive: false });

  function endPointer(ev) {
    var p = pointers.get(ev.pointerId);
    if (!p) return;

    var wasSharpen = p.sharpen;
    var duration = Date.now() - p.downAt;
    var travel = pointerTravel(p, ev.clientX, ev.clientY);

    pointers.delete(ev.pointerId);

    if (pointers.size === 0) {
      document.body.classList.remove("tap-hold");
    }

    if (wasSharpen) {
      exitSharpenIfNeeded();
    }

    if (!morseRevealed && travel <= MOVE_THRESH) {
      if (morseMode) morseTap(duration);
      else registerWakeTap(duration);
    } else if (!morseMode) {
      wakeTapCount = 0;
    }

    clearSelection();
  }

  document.addEventListener("pointerup", endPointer, { passive: true });
  document.addEventListener("pointercancel", endPointer, { passive: true });

  document.addEventListener("selectstart", blockSelection);
  document.addEventListener("contextmenu", blockSelection);
  document.addEventListener("dragstart", blockSelection);
  document.addEventListener("wheel", blockNativeScroll, { passive: false });
  document.addEventListener("touchmove", blockNativeScroll, { passive: false });
  document.addEventListener("keydown", blockScrollKeys);

  if (fogScrollLockEnabled) {
    function armFogScrollLock() {
      if (!morseRevealed) setFogScrollLock(true);
    }
    if (document.readyState === "complete") armFogScrollLock();
    else window.addEventListener("load", armFogScrollLock, { once: true });
  }

  root.style.setProperty("--spot-r", spotRadius() + "px");
  window.addEventListener("resize", function () {
    root.style.setProperty("--spot-r", spotRadius() + "px");
  });
})();
