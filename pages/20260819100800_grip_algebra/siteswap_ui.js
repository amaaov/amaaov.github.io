import { completeSiteswapMask, createGenerationMask, seededRandom } from "./siteswap_generator.js";
import {
  HYPOTHESIS_SPECS,
  analyzeSiteswaps,
  correlationCoefficient,
  hypothesisContrastPair,
  scatterLayout,
} from "./hypothesis_explorer.js";
import { siteswapIsValid } from "./siteswap.js";
import { rememberSoundAudition } from "./court_sound_fx.js";
import { retuneCosmologyBase } from "./court_cosmology_sound.js";
import { writeSoundDisplays } from "./court_sound_synth.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export function beatSecondsFromBeatsPerMinute(beatsPerMinute) {
  if (!Number.isFinite(beatsPerMinute) || beatsPerMinute <= 0) {
    throw new Error("beats per minute must be a positive finite tempo");
  }
  return 60 / beatsPerMinute;
}

const COPY = {
  en: {
    searching: "Searching legal completions…",
    found: (count, seed, visited, outcome) =>
      `${count} legal matches. Seed ${seed}; ${visited} search states inspected; ${outcome}.`,
    noMatches: (seed, visited, outcome) =>
      `No legal completion found. Seed ${seed}; ${visited} search states inspected; ${outcome}.`,
    searchOutcome: {
      complete: "search complete",
      "limit-reached": "24-result display cap reached",
      "budget-exhausted": "250,000-state search budget reached",
      unsatisfiable: "bounded search complete",
    },
    searchError: "Search stopped. Check the mask and declared bounds.",
    syncPeriodError: "A synchronous random mask needs an even period.",
    analysisError: "The displayed comparison could not be calculated.",
    matches: (count) => `Matches (${count})`,
    play: "Play",
    pause: "Pause",
    state: (state, held, airborne) => `${state}: ${held} tained, ${airborne} leased.`,
    displayedCorrelation: "Descriptive correlation in the displayed set",
    constantAxis: "The displayed set has no variation on one axis.",
    sampleExamples: "curated examples",
    sampleMatches: "current mask matches",
    unavailablePhysicalMetrics: (count) =>
      `${count} pattern${count === 1 ? "" : "s"} lack exact physical retention metrics: this dwell implies negative flight for a non-hold throw.`,
    activeInfeasible:
      "The current pattern has no exact retention metrics at this dwell; the court still draws a short visual pass.",
    activeHybridSearch:
      "Random-hybrid filter applied: positive actions occur in both rhythm families.",
    contrastInstruction: "Measurements use the current dwell, BPM, and hold convention.",
    hypothesisQuestions: {
      "release-concentration": "When releases cluster in one beat, is more time spent in α?",
      "zero-packets": "When more beats throw nothing, is more time spent in α?",
      "empty-run": "When empty beats run longer, does the longest α bout grow?",
      fragmentation: "Can two patterns share the same α time with different entry rates?",
      "pair-exposure": "When more objects stay airborne, do pairwise meetings rise?",
      "height-dispersion": "When throw heights spread, does mixed retention grow?",
      "switching-density": "When rhythm family switches, do α entries rise?",
      "identity-cycle": "Can a short written period hide a longer prop-and-hand cycle?",
      "microstate-turnover": "When mixed retention grows, do object roles change faster?",
    },
  },
  ru: {
    searching: "Ищем корректные подстановки…",
    found: (count, seed, visited, outcome) =>
      `Найдено вариантов: ${count}. Зерно ${seed}; просмотрено состояний поиска: ${visited}; ${outcome}.`,
    noMatches: (seed, visited, outcome) =>
      `Корректная подстановка не найдена. Зерно ${seed}; просмотрено состояний поиска: ${visited}; ${outcome}.`,
    searchOutcome: {
      complete: "поиск завершён",
      "limit-reached": "достигнут предел показа в 24 результата",
      "budget-exhausted": "исчерпан бюджет в 250 000 состояний поиска",
      unsatisfiable: "ограниченный поиск завершён",
    },
    searchError: "Поиск остановлен. Проверьте маску и заданные границы.",
    syncPeriodError: "Для случайной синхронной маски нужен чётный период.",
    analysisError: "Показанное сравнение не удалось вычислить.",
    matches: (count) => `Варианты (${count})`,
    play: "Пуск",
    pause: "Пауза",
    state: (state, held, airborne) => `${state}: удерживается ${held}, в лизе ${airborne}.`,
    displayedCorrelation: "Описательная корреляция в показанном наборе",
    constantAxis: "В показанном наборе одна из осей постоянна.",
    sampleExamples: "отобранные примеры",
    sampleMatches: "текущие варианты по маске",
    unavailablePhysicalMetrics: (count) =>
      `Без точных физических метрик удержания: ${count}. При этой выдержке время полёта одного из бросков отрицательно.`,
    activeInfeasible:
      "Для текущего рисунка при этой выдержке нет точных метрик удержания; корт всё равно рисует короткий наглядный пас.",
    activeHybridSearch:
      "Для случайного гибрида применён фильтр: положительные действия есть в обоих семействах ритма.",
    contrastInstruction: "Измерения следуют текущим выдержке, BPM и прочтению двойки.",
    hypothesisQuestions: {
      "release-concentration": "Когда освобождения собираются в одну долю, больше ли времени в α?",
      "zero-packets": "Когда больше долей без броска, больше ли времени в α?",
      "empty-run": "Когда пустые доли идут подряд дольше, растёт ли самый длинный эпизод α?",
      fragmentation: "Могут ли два рисунка делить одно время в α при разной частоте заходов?",
      "pair-exposure": "Когда больше предметов в полёте, растёт ли число пар?",
      "height-dispersion": "Когда высоты бросков разъезжаются, растёт ли смешанное удержание?",
      "switching-density": "Когда меняется семейство ритма, чаще ли заходы в α?",
      "identity-cycle": "Может ли короткий период записи скрывать длинный цикл предметов и рук?",
      "microstate-turnover": "Когда смешанное удержание растёт, быстрее ли меняются роли предметов?",
    },
  },
};

const AXIS_LABELS = {
  en: {
    releaseConcentration: "release concentration",
    zeroPacketShare: "empty-packet share",
    maximumEmptyPacketRun: "longest circular empty-packet run",
    pAlpha: "P(α)",
    alphaEntryRateHz: "α entries / second",
    alphaMaximumBoutSeconds: "longest α bout / seconds",
    meanAirborneCount: "mean airborne objects",
    airbornePairExposure: "airborne-pair exposure",
    throwHeightVariance: "positive siteswap-value variance",
    pPolymorphy: "P(ακ)",
    switchingDensity: "async/sync switches / beat",
    notationPeriodBeats: "notation period / beats",
    routingCycleBeats: "prop-and-hand routing cycle / beats",
    microstateChangeRateHz: "object grip changes / second",
  },
  ru: {
    releaseConcentration: "концентрация освобождений",
    zeroPacketShare: "доля пустых пакетов",
    maximumEmptyPacketRun: "самая длинная серия пустых пакетов",
    pAlpha: "P(α)",
    alphaEntryRateHz: "заходы в α / секунду",
    alphaMaximumBoutSeconds: "самый длинный эпизод α / секунды",
    meanAirborneCount: "среднее число в полёте",
    airbornePairExposure: "экспозиция пар в полёте",
    throwHeightVariance: "дисперсия положительных значений",
    pPolymorphy: "P(ακ)",
    switchingDensity: "переключения ритма / долю",
    notationPeriodBeats: "период записи / доли",
    routingCycleBeats: "цикл предметов и рук / доли",
    microstateChangeRateHz: "смены удержания предмета / секунду",
  },
};

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NAMESPACE, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

function numericValue(form, name) {
  return Number(form.elements.namedItem(name).value);
}

function formatMetric(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }
  if (Math.abs(value) >= 10) {
    return value.toFixed(1);
  }
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export function initializeSiteswapInterface(form, callbacks = {}) {
  const locale = document.documentElement.lang === "ru" ? "ru" : "en";
  const copy = COPY[locale];
  const axisLabels = AXIS_LABELS[locale];
  const sourceInput = form.elements.namedItem("source");
  const holdTwosInput = form.elements.namedItem("holdTwos");
  const reverseInput = form.elements.namedItem("patternReverse");
  const cosmologyInput = form.elements.namedItem("patternCosmology");
  const dwellInput = form.elements.namedItem("dwell");
  const tempoInput = form.elements.namedItem("tempo");
  const patternStatus = document.getElementById("pattern-status");
  const generatorStatus = document.getElementById("generator-status");
  const suggestionsDetails = document.getElementById("suggestions-details");
  const suggestionsSummary = document.getElementById("suggestions-summary");
  const suggestionsList = document.getElementById("suggestions-list");
  const hypothesisPlot = document.getElementById("hypothesis-plot");
  const hypothesisSelect = document.getElementById("hypothesis-select");
  const hypothesisDemonstration = document.getElementById("hypothesis-demonstration");
  const hypothesisStatus = document.getElementById("hypothesis-status");
  const generatorDrawer = form.querySelector(".generator-drawer");
  const accessibleState = document.getElementById("accessible-state");
  const playButton = document.getElementById("play-pattern");
  const curatedSources = [...form.querySelectorAll("[data-pattern-source]")].map(
    (button) => button.dataset.patternSource,
  );
  let activeSource = sourceInput.value;
  let suggestions = [];
  let activeHypothesis = HYPOTHESIS_SPECS.find(
    (hypothesis) => hypothesis.id === hypothesisSelect?.value,
  ) ?? HYPOTHESIS_SPECS[0];
  let playing = callbacks.initialPlaying ?? false;
  let pendingAnalysis = 0;

  function currentRequest() {
    return {
      source: activeSource,
      holdTwos: holdTwosInput.checked,
      reverse: reverseInput?.checked === true,
      cosmology: cosmologyInput?.checked === true,
      dwellRatio: Number(dwellInput.value),
      beatSeconds: beatSecondsFromBeatsPerMinute(Number(tempoInput.value)),
    };
  }

  function setStatus(element, message, kind = "ready") {
    element.textContent = message;
    element.dataset.status = kind;
  }

  function updateControlReadouts() {
    document.getElementById("dwell-readout").textContent = Number(dwellInput.value).toFixed(2);
    document.getElementById("tempo-readout").textContent = String(Math.round(Number(tempoInput.value)));
    writeSoundDisplays(form.querySelector(".sound-controls") ?? form);
  }

  function updateMetricReadout(row) {
    const values = {
      "metric-pattern": row.source,
      "metric-objects": String(row.objectCount),
      "metric-period": formatMetric(row.notationPeriodBeats),
      "metric-state-cycle": formatMetric(row.routingCycleBeats),
      "metric-alpha": formatMetric(row.pAlpha),
      "metric-polymorphy": formatMetric(row.pPolymorphy),
      "metric-kappa": formatMetric(row.pKappa),
      "metric-alpha-rate": formatMetric(row.alphaEntryRateHz),
      "metric-alpha-bout": formatMetric(row.alphaMaximumBoutSeconds),
      "metric-pair-exposure": formatMetric(row.airbornePairExposure),
      "metric-packet": formatMetric(row.maximumReleasePacket),
      "metric-turnover": formatMetric(row.microstateChangeRateHz),
    };
    for (const [id, value] of Object.entries(values)) {
      document.getElementById(id).textContent = value;
    }
  }

  function renderHypothesisDemonstration(rows) {
    const pair = hypothesisContrastPair(
      rows,
      activeHypothesis.horizontal,
      activeHypothesis.vertical,
    );
    hypothesisDemonstration.replaceChildren();
    if (!pair) {
      return;
    }
    const heading = document.createElement("p");
    heading.className = "hypothesis-demonstration__title";
    heading.textContent = copy.hypothesisQuestions[activeHypothesis.id];
    const instruction = document.createElement("p");
    instruction.className = "hypothesis-demonstration__instruction";
    instruction.textContent = copy.contrastInstruction;
    const choices = document.createElement("div");
    choices.className = "hypothesis-demonstration__choices";
    for (const row of pair) {
      const button = document.createElement("button");
      const notation = document.createElement("code");
      const measurements = document.createElement("span");
      button.type = "button";
      button.dataset.patternSource = row.source;
      button.setAttribute("aria-pressed", String(row.source === activeSource));
      notation.textContent = row.source;
      measurements.textContent = [
        `${axisLabels[activeHypothesis.horizontal]} ${formatMetric(row[activeHypothesis.horizontal])}`,
        `${axisLabels[activeHypothesis.vertical]} ${formatMetric(row[activeHypothesis.vertical])}`,
      ].join(" · ");
      button.append(notation, measurements);
      choices.append(button);
    }
    hypothesisDemonstration.append(heading, instruction, choices);
  }

  function renderPlot() {
    pendingAnalysis = 0;
    const sources = suggestions.length > 0 ? suggestions : curatedSources;
    const request = {
      dwellRatio: Number(dwellInput.value),
      beatSeconds: beatSecondsFromBeatsPerMinute(Number(tempoInput.value)),
      holdTwos: holdTwosInput.checked,
    };
    let rows;
    try {
      rows = analyzeSiteswaps({
        sources,
        ...request,
      });
    } catch (error) {
      setStatus(hypothesisStatus, copy.analysisError, "error");
      return;
    }
    const activeRow = siteswapIsValid(activeSource)
      ? rows.find((row) => row.source === activeSource) ?? analyzeSiteswaps({
        sources: [activeSource],
        ...request,
      })[0]
      : {
        source: activeSource || "—",
        objectCount: null,
        notationPeriodBeats: null,
        routingCycleBeats: null,
        pAlpha: null,
        pPolymorphy: null,
        pKappa: null,
        alphaEntryRateHz: null,
        alphaMaximumBoutSeconds: null,
        airbornePairExposure: null,
        maximumReleasePacket: null,
        microstateChangeRateHz: null,
        physicalMetricsFeasible: true,
      };
    updateMetricReadout(activeRow);
    renderHypothesisDemonstration(rows);
    const width = 360;
    const height = 220;
    const inset = 34;
    const points = scatterLayout(
      rows,
      activeHypothesis.horizontal,
      activeHypothesis.vertical,
      width,
      height,
      inset,
    );
    const horizontalAxis = svgElement("line", {
      x1: inset,
      y1: height - inset,
      x2: width - inset,
      y2: height - inset,
      class: "plot-axis",
    });
    const verticalAxis = svgElement("line", {
      x1: inset,
      y1: inset,
      x2: inset,
      y2: height - inset,
      class: "plot-axis",
    });
    hypothesisPlot.replaceChildren(horizontalAxis, verticalAxis);
    for (const point of points) {
      const horizontalLabel =
        `${axisLabels[activeHypothesis.horizontal]} ${formatMetric(point[activeHypothesis.horizontal])}`;
      const verticalLabel =
        `${axisLabels[activeHypothesis.vertical]} ${formatMetric(point[activeHypothesis.vertical])}`;
      const pointLabel = `${point.source}; ${horizontalLabel}; ${verticalLabel}`;
      const circle = svgElement("circle", {
        cx: point.x,
        cy: point.y,
        r: point.source === activeSource ? 7 : 5,
        class: point.source === activeSource ? "plot-point is-active" : "plot-point",
        tabindex: "0",
        role: "button",
        "aria-label": pointLabel,
      });
      circle.dataset.patternSource = point.source;
      circle.append(svgElement("title"));
      circle.firstChild.textContent = pointLabel;
      hypothesisPlot.append(circle);
    }
    document.getElementById("hypothesis-x-label").textContent =
      axisLabels[activeHypothesis.horizontal];
    document.getElementById("hypothesis-y-label").textContent =
      axisLabels[activeHypothesis.vertical];
    const correlation = correlationCoefficient(
      rows,
      activeHypothesis.horizontal,
      activeHypothesis.vertical,
    );
    const sampleName = suggestions.length > 0 ? copy.sampleMatches : copy.sampleExamples;
    const excludedCount = rows.filter((row) => !row.physicalMetricsFeasible).length;
    const messages = [
      correlation === null
        ? `${copy.constantAxis} ${sampleName}.`
        : `${copy.displayedCorrelation}: r = ${correlation.toFixed(3)}; ${sampleName}.`,
    ];
    if (excludedCount > 0) {
      messages.push(copy.unavailablePhysicalMetrics(excludedCount));
    }
    if (!activeRow.physicalMetricsFeasible) {
      messages.push(copy.activeInfeasible);
    }
    setStatus(
      hypothesisStatus,
      messages.join(" "),
    );
  }

  function schedulePlot() {
    if (pendingAnalysis) {
      cancelAnimationFrame(pendingAnalysis);
    }
    pendingAnalysis = requestAnimationFrame(renderPlot);
  }

  function applySource(source, { rewrite = false } = {}) {
    const candidate = String(source).replace(/\s+/g, "");
    if (rewrite) {
      sourceInput.value = candidate;
      sourceInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const changed = candidate !== activeSource;
    activeSource = candidate;
    setStatus(patternStatus, "");
    schedulePlot();
    if (changed) {
      callbacks.onPatternChange?.();
    }
    return siteswapIsValid(candidate);
  }

  function renderSuggestions(search, seed, notice = "") {
    const { patterns, status, visited } = search;
    suggestions = patterns;
    suggestionsList.replaceChildren();
    for (const source of patterns) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const notation = document.createElement("code");
      button.type = "button";
      button.dataset.patternSource = source;
      notation.dir = "ltr";
      notation.textContent = source;
      button.append(notation);
      item.append(button);
      suggestionsList.append(item);
    }
    suggestionsSummary.textContent = copy.matches(patterns.length);
    suggestionsDetails.hidden = false;
    suggestionsDetails.open = true;
    if (generatorDrawer) {
      generatorDrawer.open = true;
    }
    const resultMessage = patterns.length > 0
      ? copy.found(patterns.length, seed, visited, copy.searchOutcome[status])
      : copy.noMatches(seed, visited, copy.searchOutcome[status]);
    setStatus(
      generatorStatus,
      notice ? `${resultMessage} ${notice}` : resultMessage,
      patterns.length > 0 ? "ready" : "error",
    );
    schedulePlot();
  }

  function clearSuggestions() {
    suggestions = [];
    suggestionsList.replaceChildren();
    suggestionsSummary.textContent = copy.matches(0);
    suggestionsDetails.hidden = true;
    suggestionsDetails.open = false;
    schedulePlot();
  }

  function runSearch(mask, seed, selectFirst, requireActiveRhythms = false) {
    setStatus(generatorStatus, copy.searching);
    const search = completeSiteswapMask({
      mask,
      objectCount: numericValue(form, "objectCount"),
      maximumThrow: numericValue(form, "maximumThrow"),
      limit: 24,
      searchBudget: 250_000,
      random: seededRandom(seed),
      requireActiveRhythms,
    });
    if (search.patterns.length === 0 && !["unsatisfiable", "budget-exhausted"].includes(search.status)) {
      clearSuggestions();
      setStatus(generatorStatus, copy.searchError, "error");
      return;
    }
    renderSuggestions(search, seed, requireActiveRhythms ? copy.activeHybridSearch : "");
    if (selectFirst && search.patterns[0]) {
      applySource(search.patterns[0], { rewrite: true });
    }
  }

  function updatePlayback() {
    playButton.textContent = playing ? copy.pause : copy.play;
    playButton.setAttribute("aria-pressed", String(playing));
    callbacks.onPlaybackChange?.(playing);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    applySource(sourceInput.value, { rewrite: true });
  });
  sourceInput.addEventListener("input", () => {
    applySource(sourceInput.value);
  });
  for (const button of form.querySelectorAll("[data-pattern-source]")) {
    button.addEventListener("click", () => {
      applySource(button.dataset.patternSource, { rewrite: true });
    });
  }
  suggestionsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-pattern-source]");
    if (button) {
      applySource(button.dataset.patternSource, { rewrite: true });
    }
  });
  document.getElementById("random-pattern").addEventListener("click", () => {
    const seedInput = form.elements.namedItem("seed");
    const seed = Number(seedInput.value) >>> 0;
    const timing = form.elements.namedItem("timing").value;
    if (timing === "sync" && numericValue(form, "periodBeats") % 2 !== 0) {
      clearSuggestions();
      setStatus(generatorStatus, copy.syncPeriodError, "error");
      return;
    }
    try {
      const mask = createGenerationMask({
        timing,
        periodBeats: numericValue(form, "periodBeats"),
        random: seededRandom(seed),
      });
      form.elements.namedItem("mask").value = mask;
      runSearch(mask, seed, true, timing === "hybrid");
      seedInput.value = String((seed + 1) >>> 0);
    } catch (error) {
      clearSuggestions();
      setStatus(generatorStatus, copy.searchError, "error");
    }
  });
  document.getElementById("search-mask").addEventListener("click", () => {
    runSearch(
      form.elements.namedItem("mask").value,
      Number(form.elements.namedItem("seed").value) >>> 0,
      false,
    );
  });
  for (const input of [dwellInput, tempoInput]) {
    input.addEventListener("input", () => {
      updateControlReadouts();
      schedulePlot();
      callbacks.onParametersChange?.();
    });
  }
  holdTwosInput.addEventListener("change", () => {
    schedulePlot();
    callbacks.onParametersChange?.();
  });
  reverseInput?.addEventListener("change", () => {
    callbacks.onParametersChange?.();
  });
  cosmologyInput?.addEventListener("change", () => {
    callbacks.onParametersChange?.();
  });
  const soundInput = form.elements.namedItem("courtSound");
  const soundPanel = form.querySelector(".sound-controls");
  if (soundPanel && soundInput) {
    soundPanel.hidden = !soundInput.checked;
  }
  soundInput?.addEventListener("change", () => {
    if (soundPanel) {
      soundPanel.hidden = !soundInput.checked;
    }
    callbacks.onSoundChange?.();
  });
  soundPanel?.addEventListener("input", (event) => {
    retuneCosmologyBase(event.target);
    rememberSoundAudition(form, event.target?.name);
    updateControlReadouts();
    callbacks.onSoundChange?.();
  });
  soundPanel?.addEventListener("change", () => {
    callbacks.onSoundChange?.();
  });
  playButton.addEventListener("click", () => {
    playing = !playing;
    updatePlayback();
  });
  document.getElementById("step-pattern").addEventListener("click", () => {
    playing = false;
    updatePlayback();
    callbacks.onStep?.();
  });
  document.getElementById("restart-pattern").addEventListener("click", () => {
    playing = false;
    updatePlayback();
    callbacks.onRestart?.();
  });
  hypothesisSelect?.addEventListener("change", () => {
    activeHypothesis = HYPOTHESIS_SPECS.find(
      (hypothesis) => hypothesis.id === hypothesisSelect.value,
    ) ?? HYPOTHESIS_SPECS[0];
    schedulePlot();
  });
  hypothesisPlot.addEventListener("click", (event) => {
    if (event.target.dataset.patternSource) {
      applySource(event.target.dataset.patternSource, { rewrite: true });
    }
  });
  hypothesisPlot.addEventListener("keydown", (event) => {
    if (event.target.dataset.patternSource && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      applySource(event.target.dataset.patternSource, { rewrite: true });
    }
  });
  hypothesisDemonstration.addEventListener("click", (event) => {
    const button = event.target.closest("[data-pattern-source]");
    if (button) {
      applySource(button.dataset.patternSource, { rewrite: true });
    }
  });

  updateControlReadouts();
  updatePlayback();
  applySource(activeSource);

  return {
    currentRequest,
    isPlaying: () => playing,
    setPlaying(nextPlaying) {
      playing = Boolean(nextPlaying);
      updatePlayback();
    },
    updateState({ state, held, airborne }) {
      accessibleState.textContent = copy.state(state, held, airborne);
    },
  };
}
