(function () {
  const article = document.querySelector("[data-readable]");
  const articleBody = document.querySelector(".article-body");
  const hero = document.querySelector(".hero");
  const heroPhoto = document.querySelector(".hero-photo");
  const heroImage = document.querySelector(".hero-photo img");
  const readButton = document.querySelector("[data-read]");
  const saveButton = document.querySelector("[data-save-postcard]");
  const status = document.querySelector("[data-status]");
  const palette = getComputedStyle(document.documentElement);
  const articleImageValue = palette.getPropertyValue("--article-image").trim();
  const articleImageUrlMatch = articleImageValue.match(/^url\((['"]?)(.+)\1\)$/);
  const articleImageUrl = articleImageUrlMatch ? articleImageUrlMatch[2] : "";
  const preloadedImage = new Image();
  let preloadedImageReady = false;
  let ambience = null;
  let ambienceTick = null;
  let overlayEl = null;
  let unisonIndex = 0;
  let sentenceSpans = [];
  let readingState = { active: false, cursor: 0 };
  let pointerY = 0.5;
  let releaseAfterSpeech = null;
  let ambientProfile = null;
  let photoPosX = 50;
  let photoPosY = 50;
  let dragState = { active: false, startX: 0, startY: 0, baseX: 50, baseY: 50 };
  let detailTick = null;
  const mood = (new URLSearchParams(window.location.search).get("mood") || "natural").toLowerCase();
  const isCinematic = mood === "cinematic";

  if (articleImageUrl) {
    preloadedImage.onload = function () {
      preloadedImageReady = true;
    };
    preloadedImage.src = articleImageUrl;
    if (preloadedImage.complete && preloadedImage.naturalWidth > 0) {
      preloadedImageReady = true;
    }
  }

  function announce(message) {
    if (status) status.textContent = message;
  }

  function splitIntoSentences(text) {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) return [];
    return normalized.match(/[^.!?。！？…]+[.!?。！？…]*|\S+/g) || [];
  }

  function splitSentenceIntoChunks(sentence) {
    const text = (sentence || "").replace(/\s+/g, " ").trim();
    if (!text) return [];

    // Split semantically on punctuation, keeping punctuation attached.
    const phraseUnits = text.match(/[^,.;:!?—–…，。！？；：]+[,.;:!?—–…，。！？；：]*/g) || [];
    return phraseUnits.map(function (unit) { return unit.trim(); }).filter(Boolean);
  }

  function pauseMsForChunk(text) {
    const t = (text || "").trim();
    if (!t) return 80;
    if (/[.?!…。！？]$/.test(t)) return 560;
    if (/[,:;，；：]$/.test(t)) return 170;
    if (/[—–-]$/.test(t)) return 190;
    if (/[…]/.test(t)) return 340;
    return 120;
  }

  function rebuildReadableSentences() {
    if (!article) return;
    sentenceSpans = [];
    const blocks = Array.from(article.querySelectorAll("p"));
    let idx = 0;

    blocks.forEach(function (block) {
      const raw = block.textContent || "";
      const sentences = splitIntoSentences(raw);
      if (!sentences.length) return;
      block.textContent = "";
      sentences.forEach(function (sentence, sentenceIndex) {
        const chunks = splitSentenceIntoChunks(sentence);
        chunks.forEach(function (chunk, chunkIndex) {
          const span = document.createElement("span");
          span.className = "tts-sentence";
          span.dataset.ttsIndex = String(idx);
          span.textContent = chunk.trim();
          block.appendChild(span);
          block.appendChild(document.createTextNode(" "));
          sentenceSpans.push(span);
          idx += 1;
          if (sentenceIndex === sentences.length - 1 && chunkIndex === chunks.length - 1) {
            // Trim trailing space for last chunk in the block.
            if (block.lastChild && block.lastChild.nodeType === Node.TEXT_NODE) {
              block.removeChild(block.lastChild);
            }
          }
        });
      });
    });
  }

  function articleText() {
    if (!sentenceSpans.length) return article ? article.innerText.replace(/\s+\n/g, "\n").trim() : "";
    return sentenceSpans.map(function (span) { return span.textContent; }).join(" ").trim();
  }

  function clearSentenceHighlight() {
    sentenceSpans.forEach(function (span) { span.classList.remove("is-reading"); });
  }

  function highlightSentence(index) {
    clearSentenceHighlight();
    const span = sentenceSpans[index];
    if (!span) return;
    span.classList.add("is-reading");
    span.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function preferredLocaleForLang(lang) {
    const normalized = (lang || "").toLowerCase();
    const base = normalized.split("-")[0];
    const map = {
      ru: "ru-RU",
      uk: "uk-UA",
      fi: "fi-FI",
      sv: "sv-SE",
      fr: "fr-FR",
      ja: "ja-JP",
      pl: "pl-PL",
      en: "en-US"
    };
    return map[base] || lang || "en-US";
  }

  function pickVoiceForLocale(locale) {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const lowerLocale = locale.toLowerCase();
    const base = lowerLocale.split("-")[0];

    let voice = voices.find((v) => v.lang && v.lang.toLowerCase() === lowerLocale);
    if (voice) return voice;

    voice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(base + "-"));
    if (voice) return voice;

    voice = voices.find((v) => v.default);
    return voice || null;
  }

  function buildUtterance(text) {
    const pageLang = document.documentElement.lang || "en";
    const locale = preferredLocaleForLang(pageLang);
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoiceForLocale(locale);

    utterance.lang = locale;
    if (voice) utterance.voice = voice;
    utterance.rate = locale.startsWith("ja") ? 0.84 : 0.86;
    utterance.pitch = 1;

    return { utterance: utterance, locale: locale, hasVoice: !!voice };
  }

  function toggleReading() {
    if (!("speechSynthesis" in window)) {
      announce("Synthetic voice is not available in this browser.");
      return;
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (releaseAfterSpeech) {
        window.clearTimeout(releaseAfterSpeech);
        releaseAfterSpeech = null;
      }
      readingState.active = false;
      readingState.cursor = 0;
      clearSentenceHighlight();
      stopAmbientBed();
      readButton.innerHTML = "<span aria-hidden=\"true\">&#9658;</span>";
      readButton.setAttribute("aria-label", readButton.dataset.labelRead);
      readButton.setAttribute("title", readButton.dataset.labelRead);
      readButton.setAttribute("aria-pressed", "false");
      announce("Reading stopped.");
      return;
    }

    if (!sentenceSpans.length) rebuildReadableSentences();
    if (!sentenceSpans.length) {
      announce("No readable sentences found.");
      return;
    }

    readingState.active = true;
    readingState.cursor = 0;
    const built = buildUtterance("");
    startAmbientBed().catch(function () {
      announce("Reading started (ambient audio unavailable).");
    });

    function finishReading(message) {
      readingState.active = false;
      readingState.cursor = 0;
      clearSentenceHighlight();
      stopAmbientBed();
      readButton.innerHTML = "<span aria-hidden=\"true\">&#9658;</span>";
      readButton.setAttribute("aria-label", readButton.dataset.labelRead);
      readButton.setAttribute("title", readButton.dataset.labelRead);
      readButton.setAttribute("aria-pressed", "false");
      announce(message);
    }

    function speakNextSentence() {
      if (!readingState.active) return;
      if (readingState.cursor >= sentenceSpans.length) {
        finishReading("Reading finished.");
        return;
      }
      highlightSentence(readingState.cursor);
      const text = sentenceSpans[readingState.cursor].textContent || "";
      const nextBuilt = buildUtterance(text);
      const utterance = nextBuilt.utterance;
      duckAmbientForSpeech(true);
      utterance.onend = function () {
        duckAmbientForSpeech(false);
        if (!readingState.active) return;
        readingState.cursor += 1;
        const pause = pauseMsForChunk(text);
        window.setTimeout(function () {
          if (!readingState.active) return;
          speakNextSentence();
        }, pause);
      };
      utterance.onerror = function () {
        duckAmbientForSpeech(false);
        finishReading("Reading failed for locale " + nextBuilt.locale + ".");
      };
      window.speechSynthesis.speak(utterance);
    }

    readButton.innerHTML = "<span aria-hidden=\"true\">&#9632;</span>";
    readButton.setAttribute("aria-label", readButton.dataset.labelStop || "Stop");
    readButton.setAttribute("title", readButton.dataset.labelStop || "Stop");
    readButton.setAttribute("aria-pressed", "true");
    if (!built.hasVoice) {
      announce("Using fallback voice. Install a system voice for " + built.locale + " for better pronunciation.");
    } else {
      announce("Reading started.");
    }
    speakNextSentence();
  }

  function coverImage(ctx, img, x, y, width, height) {
    const sourceRatio = img.naturalWidth / img.naturalHeight;
    const targetRatio = width / height;
    let sourceWidth = img.naturalWidth;
    let sourceHeight = img.naturalHeight;
    let sourceX = 0;
    let sourceY = 0;

    if (sourceRatio > targetRatio) {
      sourceWidth = sourceHeight * targetRatio;
      sourceX = (img.naturalWidth - sourceWidth) / 2;
    } else {
      sourceHeight = sourceWidth / targetRatio;
      sourceY = (img.naturalHeight - sourceHeight) / 2;
    }

    ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  }

  function wrapText(ctx, text, maxWidth) {
    const hasSpaces = /\s/.test(text);
    const tokens = hasSpaces ? text.split(/\s+/) : [...text];
    const lines = [];
    let line = "";

    tokens.forEach((token) => {
      const next = hasSpaces ? (line ? `${line} ${token}` : token) : `${line}${token}`;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = token;
      } else {
        line = next;
      }
    });

    if (line) lines.push(line);
    return lines;
  }

  function drawTextBlock(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const paragraphs = text.split(/\n+/).filter(Boolean);
    let currentY = y;
    let linesUsed = 0;

    for (const paragraph of paragraphs) {
      const lines = wrapText(ctx, paragraph, maxWidth);
      for (const line of lines) {
        if (linesUsed >= maxLines) {
          ctx.fillText("...", x, currentY);
          return;
        }
        ctx.fillText(line, x, currentY);
        currentY += lineHeight;
        linesUsed += 1;
      }
      currentY += lineHeight * 0.45;
    }
  }

  function postcardImageSource() {
    if (preloadedImageReady && preloadedImage.naturalWidth > 0) return preloadedImage;
    return null;
  }

  function setupCompactButtons() {
    if (readButton) {
      const readLabel = readButton.dataset.labelRead || readButton.textContent.trim() || "Read";
      readButton.dataset.labelRead = readLabel;
      readButton.innerHTML = "<span aria-hidden=\"true\">&#9658;</span>";
      readButton.setAttribute("aria-label", readLabel);
      readButton.setAttribute("title", readLabel);
      readButton.classList.add("icon-button");
    }

    if (saveButton) {
      const saveLabel = saveButton.textContent.trim() || "Save postcard";
      saveButton.innerHTML = "<span aria-hidden=\"true\">&#8681;</span>";
      saveButton.setAttribute("aria-label", saveLabel);
      saveButton.setAttribute("title", saveLabel);
      saveButton.classList.add("icon-button");
    }
  }

  function ensurePhotoOverlay() {
    if (!heroPhoto || overlayEl) return;
    overlayEl = document.createElement("div");
    overlayEl.className = "hero-photo-overlay";
    heroPhoto.appendChild(overlayEl);
  }

  function applyPhotoShadingFromSound(shape) {
    if (!heroPhoto || !overlayEl) return;
    const energy = Math.max(0, Math.min(1, shape.energy));
    const shade = Math.max(0, Math.min(1, shape.shade));
    const hueA = Math.round(28 + energy * 26);
    const hueB = Math.round(246 - shade * 54);
    const satA = Math.round(74 + energy * 20);
    const satB = Math.round(46 + shade * 22);
    const lightA = Math.round(68 - shade * 14);
    const lightB = Math.round(44 - energy * 10);
    const darkAlpha = isCinematic ? (0.18 + shade * 0.34).toFixed(3) : (0.08 + shade * 0.11).toFixed(3);
    const warmAlpha = isCinematic ? (0.09 + energy * 0.2).toFixed(3) : (0.04 + energy * 0.06).toFixed(3);
    const coolAlpha = isCinematic ? (0.08 + shade * 0.16).toFixed(3) : (0.03 + shade * 0.05).toFixed(3);
    const overlayOpacity = isCinematic ? (0.32 + energy * 0.56).toFixed(3) : (0.14 + energy * 0.2).toFixed(3);
    const contrast = (isCinematic ? (1 + energy * 0.16) : (1 + energy * 0.035)).toFixed(3);
    const saturate = (isCinematic ? (1 + energy * 0.36) : (1 + energy * 0.07)).toFixed(3);
    const brightness = (isCinematic ? (0.98 - shade * 0.12 + energy * 0.05) : (1 - shade * 0.035 + energy * 0.015)).toFixed(3);

    overlayEl.style.opacity = overlayOpacity;
    overlayEl.style.background =
      "linear-gradient(140deg, " +
      "hsla(" + hueA + ", " + satA + "%, " + lightA + "%, " + warmAlpha + "), " +
      "hsla(" + hueB + ", " + satB + "%, " + lightB + "%, " + coolAlpha + ") 52%, " +
      "rgba(24, 14, 10, " + darkAlpha + "))";
    heroPhoto.style.filter =
      "contrast(" + contrast + ") " +
      "saturate(" + saturate + ") " +
      "brightness(" + brightness + ")";
    heroPhoto.style.boxShadow =
      "inset 0 0 " +
      Math.round((isCinematic ? 44 : 20) + shade * (isCinematic ? 72 : 28)) +
      "px rgba(22, 14, 10, " +
      (isCinematic ? (0.1 + shade * 0.16) : (0.04 + shade * 0.06)).toFixed(3) +
      ")";
  }

  function syncPhotoBackgroundMode() {
    const passedHero = window.scrollY > 8;
    document.body.classList.toggle("photo-as-background", passedHero);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function applyPhotoPosition() {
    if (heroImage) {
      heroImage.style.objectPosition = photoPosX.toFixed(2) + "% " + photoPosY.toFixed(2) + "%";
    }
  }

  function onPhotoDragStart(event) {
    if (!heroPhoto) return;
    dragState.active = true;
    dragState.startX = event.clientX;
    dragState.startY = event.clientY;
    dragState.baseX = photoPosX;
    dragState.baseY = photoPosY;
    heroPhoto.classList.add("is-dragging");
  }

  function onPhotoDragMove(event) {
    if (!dragState.active) return;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    photoPosX = clamp(dragState.baseX - dx * 0.06, 0, 100);
    photoPosY = clamp(dragState.baseY - dy * 0.08, 0, 100);
    applyPhotoPosition();
    syncPhotoBackgroundMode();
  }

  function onPhotoDragEnd() {
    if (!dragState.active) return;
    dragState.active = false;
    if (heroPhoto) heroPhoto.classList.remove("is-dragging");
  }

  function createReverbImpulse(context, seconds, decay) {
    const sampleRate = context.sampleRate;
    const length = Math.floor(sampleRate * seconds);
    const impulse = context.createBuffer(2, length, sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return impulse;
  }

  function createAmbientProfile() {
    const minorDegrees = [0, 2, 3, 5, 7, 8, 10];
    const rootPool = [123.47, 130.81, 138.59, 146.83, 155.56, 164.81];
    const root = rootPool[Math.floor(Math.random() * rootPool.length)];
    const degreeOffset = Math.floor(Math.random() * minorDegrees.length);
    const centerSeries = [0, 5, 3, 7].map(function (step, i) {
      const degree = minorDegrees[(degreeOffset + step + i) % minorDegrees.length];
      return root * Math.pow(2, degree / 12);
    });

    return {
      centers: centerSeries,
      airRatio: 1.45 + Math.random() * 0.12,
      panAmount: 0.12 + Math.random() * 0.14,
      feedbackBase: 0.7 + Math.random() * 0.12,
      feedbackRange: 0.12 + Math.random() * 0.14,
      delayBase: 0.3 + Math.random() * 0.12,
      delayRange: 0.18 + Math.random() * 0.24
    };
  }

  function duckAmbientForSpeech(active) {
    if (!ambience) return;
    const now = ambience.ctx.currentTime;
    ambience.master.gain.cancelScheduledValues(now);
    if (active) {
      ambience.master.gain.setValueAtTime(ambience.master.gain.value, now);
      ambience.master.gain.linearRampToValueAtTime(0.18, now + 0.08);
      if (releaseAfterSpeech) {
        window.clearTimeout(releaseAfterSpeech);
        releaseAfterSpeech = null;
      }
    } else {
      if (releaseAfterSpeech) window.clearTimeout(releaseAfterSpeech);
      releaseAfterSpeech = window.setTimeout(function () {
        if (!ambience) return;
        const t = ambience.ctx.currentTime;
        ambience.master.gain.cancelScheduledValues(t);
        ambience.master.gain.setValueAtTime(ambience.master.gain.value, t);
        ambience.master.gain.linearRampToValueAtTime(0.44, t + 0.32);
      }, 90);
    }
  }

  async function initAmbientBed() {
    if (ambience) return ambience;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) throw new Error("Web Audio not supported.");

    const ctx = new AudioCtx();
    const master = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const delay = ctx.createDelay(1.2);
    const delayFeedback = ctx.createGain();
    const convolver = ctx.createConvolver();
    const panner = ctx.createStereoPanner();
    const lowpass = ctx.createBiquadFilter();
    const highshelf = ctx.createBiquadFilter();
    const ambientGain = ctx.createGain();
    const preDrive = ctx.createWaveShaper();
    const postDrive = ctx.createWaveShaper();
    const gateGain = ctx.createGain();
    const gateLfo = ctx.createOscillator();
    const gateDepth = ctx.createGain();
    const detailGain = ctx.createGain();
    const detailHighpass = ctx.createBiquadFilter();

    function makeSoftCurve(amount) {
      const n = 2048;
      const curve = new Float32Array(n);
      const k = Math.max(1, amount);
      for (let i = 0; i < n; i += 1) {
        const x = (i * 2) / n - 1;
        curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
      }
      return curve;
    }

    lowpass.type = "lowpass";
    lowpass.frequency.value = 1650;
    lowpass.Q.value = 0.8;
    highshelf.type = "highshelf";
    highshelf.frequency.value = 3400;
    highshelf.gain.value = -6.5;
    delay.delayTime.value = 0.38;
    delayFeedback.gain.value = 0.78;
    convolver.buffer = createReverbImpulse(ctx, 2.8, 2.4);
    wet.gain.value = 0.62;
    dry.gain.value = 0.86;
    master.gain.value = 0.0001;
    ambientGain.gain.value = 0.62;
    panner.pan.value = 0;
    gateGain.gain.value = 0.64;
    gateLfo.type = "triangle";
    gateLfo.frequency.value = 0.38;
    gateDepth.gain.value = 0.08;
    detailGain.gain.value = 0.0001;
    detailHighpass.type = "highpass";
    detailHighpass.frequency.value = 1300;
    preDrive.curve = makeSoftCurve(1.8);
    preDrive.oversample = "4x";
    postDrive.curve = makeSoftCurve(1.35);
    postDrive.oversample = "4x";

    ambientGain.connect(preDrive);
    preDrive.connect(gateGain);
    gateGain.connect(lowpass);
    lowpass.connect(highshelf);
    highshelf.connect(postDrive);
    postDrive.connect(dry);
    postDrive.connect(delay);
    postDrive.connect(convolver);
    detailGain.connect(detailHighpass);
    detailHighpass.connect(delay);

    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(wet);
    convolver.connect(wet);

    dry.connect(panner);
    wet.connect(panner);
    panner.connect(master);
    master.connect(ctx.destination);
    gateLfo.connect(gateDepth);
    gateDepth.connect(gateGain.gain);
    gateLfo.start();

    const oscillators = [
      { osc: ctx.createOscillator(), gain: ctx.createGain(), base: 164.81, type: "triangle", role: "leadA" },
      { osc: ctx.createOscillator(), gain: ctx.createGain(), base: 164.81, type: "sine", role: "leadB" },
      { osc: ctx.createOscillator(), gain: ctx.createGain(), base: 246.94, type: "sine", role: "air" }
    ];

    oscillators.forEach(function (item, i) {
      item.osc.type = item.type;
      item.osc.frequency.value = item.base;
      item.gain.gain.value = i === 2 ? 0.046 : 0.088;
      item.osc.connect(item.gain);
      item.gain.connect(ambientGain);
      item.osc.start();
    });

    ambience = {
      ctx: ctx,
      master: master,
      panner: panner,
      lowpass: lowpass,
      wet: wet,
      delay: delay,
      delayFeedback: delayFeedback,
      gateGain: gateGain,
      gateDepth: gateDepth,
      detailGain: detailGain,
      oscillators: oscillators
    };
    return ambience;
  }

  function fireDetailPulse() {
    if (!ambience) return;
    const ctx = ambience.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const isTri = Math.random() > 0.5;
    osc.type = isTri ? "triangle" : "sine";
    osc.frequency.value = 1220 + Math.random() * 1380;

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.028 + Math.random() * 0.022, now + 0.01); // fast attack
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.18 + Math.random() * 0.22); // short release

    osc.connect(env);
    env.connect(ambience.detailGain);
    osc.start(now);
    osc.stop(now + 0.35);
    osc.onended = function () {
      try {
        osc.disconnect();
        env.disconnect();
      } catch (error) {}
    };
  }

  async function startAmbientBed() {
    const bus = await initAmbientBed();
    if (bus.ctx.state === "suspended") await bus.ctx.resume();
    const now = bus.ctx.currentTime;
    if (bus.ctx.state !== "running") {
      announce("Ambient audio blocked by browser audio policy.");
      return;
    }
    bus.master.gain.cancelScheduledValues(now);
    bus.master.gain.setValueAtTime(bus.master.gain.value, now);
    bus.master.gain.linearRampToValueAtTime(0.56, now + 0.9);
    bus.gateDepth.gain.cancelScheduledValues(now);
    bus.gateGain.gain.cancelScheduledValues(now);
    bus.gateDepth.gain.setValueAtTime(0.1, now);
    bus.gateGain.gain.setValueAtTime(0.62, now);
    // Start with slight rhythmic gating, then open gradually.
    bus.gateDepth.gain.linearRampToValueAtTime(0.01, now + 34);
    bus.gateGain.gain.linearRampToValueAtTime(0.82, now + 34);

    // Quick audible ramp so user can perceive ambience immediately.
    bus.ambientPulse = bus.ctx.createGain();
    bus.ambientPulse.gain.value = 0;
    bus.oscillators[0].osc.connect(bus.ambientPulse);
    bus.ambientPulse.connect(bus.master);
    bus.ambientPulse.gain.setValueAtTime(0, now);
    bus.ambientPulse.gain.linearRampToValueAtTime(0.02, now + 0.14);
    bus.ambientPulse.gain.linearRampToValueAtTime(0, now + 0.58);

    ambientProfile = createAmbientProfile();
    unisonIndex = 0;
    if (ambienceTick) window.clearInterval(ambienceTick);
    if (detailTick) window.clearTimeout(detailTick);
    applyPhotoShadingFromSound({ energy: 0.4, shade: 0.36 });
    ambienceTick = window.setInterval(function () {
      if (!ambience) return;
      const t = ambience.ctx.currentTime;
      const drift = isCinematic ? (2.8 + Math.random() * 1.9) : (3.9 + Math.random() * 2.8);
      const energy = Math.random();
      const shade = Math.random();
      const scrollRatio = Math.max(0, Math.min(1, window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight)));
      const cursorInfluence = (pointerY * 0.72) + (scrollRatio * 0.28);
      const cycle = (ambientProfile && ambientProfile.centers) ? ambientProfile.centers : [164.81, 130.81, 196.0, 146.83];
      const center = cycle[unisonIndex % cycle.length];
      const shouldReUnison = unisonIndex % 4 === 0;
      const detuneCents = shouldReUnison
        ? 0
        : (isCinematic ? (4 + Math.random() * 8) : (2 + Math.random() * 4));
      const detuneSign = unisonIndex % 2 === 0 ? 1 : -1;
      const leftFreq = center * Math.pow(2, (-detuneCents * detuneSign) / 1200);
      const rightFreq = center * Math.pow(2, (detuneCents * detuneSign) / 1200);
      const airBase = center * ((ambientProfile && ambientProfile.airRatio) ? ambientProfile.airRatio : 1.4983);

      ambience.oscillators.forEach(function (item) {
        if (item.role === "leadA") {
          item.osc.frequency.linearRampToValueAtTime(leftFreq, t + drift);
        } else if (item.role === "leadB") {
          item.osc.frequency.linearRampToValueAtTime(rightFreq, t + drift);
        } else {
          const airWobble = 1 + (Math.random() * 2 - 1) * 0.012;
          item.osc.frequency.linearRampToValueAtTime(airBase * airWobble, t + drift);
        }
      });
      ambience.delay.delayTime.linearRampToValueAtTime(
        ((ambientProfile && ambientProfile.delayBase) ? ambientProfile.delayBase : 0.35) +
          Math.random() * ((ambientProfile && ambientProfile.delayRange) ? ambientProfile.delayRange : 0.24) +
          cursorInfluence * 0.22,
        t + drift
      );
      ambience.delayFeedback.gain.linearRampToValueAtTime(
        Math.min(
          0.92,
          ((ambientProfile && ambientProfile.feedbackBase) ? ambientProfile.feedbackBase : 0.78) +
          Math.random() * ((ambientProfile && ambientProfile.feedbackRange) ? ambientProfile.feedbackRange : 0.2)
        ),
        t + drift
      );
      ambience.wet.gain.linearRampToValueAtTime(
        0.56 + Math.random() * 0.22,
        t + drift
      );
      ambience.lowpass.frequency.linearRampToValueAtTime(
        900 + Math.random() * 560,
        t + drift
      );
      ambience.panner.pan.linearRampToValueAtTime(
        (Math.random() * 2 - 1) * ((ambientProfile && ambientProfile.panAmount) ? ambientProfile.panAmount : 0.16),
        t + drift * 1.3
      );
      applyPhotoShadingFromSound({ energy: energy, shade: shade });
      unisonIndex += 1;
    }, isCinematic ? 4200 : 6200);

    function scheduleDetailPulse() {
      if (!readingState.active || !ambience) return;
      const delayMs = 1400 + Math.random() * 5600; // sparse random detail
      detailTick = window.setTimeout(function () {
        if (!readingState.active || !ambience) return;
        if (Math.random() > 0.44) fireDetailPulse();
        scheduleDetailPulse();
      }, delayMs);
    }
    scheduleDetailPulse();
  }

  function stopAmbientBed() {
    if (!ambience) return;
    const now = ambience.ctx.currentTime;
    ambience.master.gain.cancelScheduledValues(now);
    ambience.master.gain.setValueAtTime(ambience.master.gain.value, now);
    ambience.master.gain.linearRampToValueAtTime(0.0001, now + 0.55);
    if (ambienceTick) {
      window.clearInterval(ambienceTick);
      ambienceTick = null;
    }
    if (detailTick) {
      window.clearTimeout(detailTick);
      detailTick = null;
    }
    if (ambience.ambientPulse) {
      try {
        ambience.ambientPulse.disconnect();
      } catch (error) {}
      ambience.ambientPulse = null;
    }
    ambientProfile = null;
    applyPhotoShadingFromSound({ energy: 0.08, shade: 0.14 });
  }

  function downloadPostcard() {
    const postcardImage = postcardImageSource();
    if (!postcardImage) {
      announce("Image is not ready yet.");
      return;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const width = 1600;
    const height = 2200;
    const margin = 118;
    const title = document.querySelector("h1")?.innerText || document.title;
    const text = articleText();
    const bg = palette.getPropertyValue("--paper-strong").trim() || "#fff8ef";
    const ink = palette.getPropertyValue("--ink").trim() || "#17130f";
    const accent = palette.getPropertyValue("--accent").trim() || "#a2522e";

    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    coverImage(ctx, postcardImage, 0, 0, width, 980);
    const gradient = ctx.createLinearGradient(0, 620, 0, 1130);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, bg);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 620, width, 520);

    ctx.fillStyle = accent;
    ctx.fillRect(margin, 1030, 12, 790);

    ctx.fillStyle = ink;
    ctx.font = "900 126px Georgia, serif";
    drawTextBlock(ctx, title, margin + 42, 1128, width - margin * 2, 128, 3);

    ctx.font = "400 45px Georgia, serif";
    drawTextBlock(ctx, text, margin + 42, 1510, width - margin * 2 - 42, 67, 8);

    ctx.fillStyle = accent;
    ctx.font = "800 31px system-ui, sans-serif";
    ctx.fillText(document.documentElement.dataset.postcardCredit || "amaaov.github.io", margin, height - 108);

    const link = document.createElement("a");
    link.download = `${document.documentElement.dataset.slug || "juggling"}-postcard.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    announce("Postcard image saved.");
  }

  setupCompactButtons();
  rebuildReadableSentences();
  ensurePhotoOverlay();
  applyPhotoPosition();
  applyPhotoShadingFromSound({ energy: 0.08, shade: 0.14 });
  syncPhotoBackgroundMode();
  window.addEventListener("pointermove", function (event) {
    const h = Math.max(1, window.innerHeight);
    pointerY = Math.max(0, Math.min(1, event.clientY / h));
  }, { passive: true });
  window.addEventListener("scroll", syncPhotoBackgroundMode, { passive: true });
  window.addEventListener("resize", syncPhotoBackgroundMode);
  if (heroPhoto) {
    heroPhoto.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      onPhotoDragStart(event);
    });
    window.addEventListener("pointermove", onPhotoDragMove, { passive: true });
    window.addEventListener("pointerup", onPhotoDragEnd);
    window.addEventListener("pointercancel", onPhotoDragEnd);
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = function () {
      // Ensures voice list is loaded before user clicks Read.
      window.speechSynthesis.getVoices();
    };
    window.speechSynthesis.getVoices();
  }
  readButton?.addEventListener("click", toggleReading);
  saveButton?.addEventListener("click", downloadPostcard);
  window.addEventListener("beforeunload", function () {
    stopAmbientBed();
    if (releaseAfterSpeech) {
      window.clearTimeout(releaseAfterSpeech);
      releaseAfterSpeech = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  });
}());
