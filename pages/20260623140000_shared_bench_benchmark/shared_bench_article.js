(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W = 56;
  var H = 36;
  var P = 120;
  var Q = 0.25;
  var MONTH_TICKS = 28;
  var DEFAULT_DEV_RATE = 120;
  var DEFAULT_CONSULTANT_RATE = 168;
  var OPERATIVE_PER_HEAD = 72;
  var STRATEGIC_RATES = { tight: 18, neutral: 38, loose: 62 };
  var MARKET_SKILL = { bull: 0.78, bear: 0.58, sideways: 0.66, volatile: 0.68 };
  var MARKET_WAGE = { bull: 1.22, bear: 0.92, sideways: 1, volatile: 1.05 };

  var PATTERNS = {
    cce: {
      label: "Collaborative Concurrent Extreme",
      manifesto: true,
      hyMult: 1.15,
      scopeMult: 1,
      participants: 1,
      color: "#2d6a4f"
    },
    nobody: { label: "Nobody", control: true, hyMult: 0, scopeMult: 0, participants: 0, color: "#4a5c64" },
    solo_serial: { label: "Solo serial", control: true, hyMult: 0.5, scopeMult: 1, participants: 1, color: "#6b8a9a" },
    round_robin: { label: "Round-robin", control: true, hyMult: 0.7, scopeMult: 1.1, participants: 1, color: "#5a8a7a" },
    least_loaded: { label: "Least-loaded", control: true, hyMult: 0.85, scopeMult: 1, participants: 1, color: "#3d8a8e" },
    work_stealing: { label: "Trail-gradient", control: true, hyMult: 1.2, scopeMult: 1, participants: 1, color: "#2a8a8e", uiLabel: "Work-stealing (trail)" },
    pair: { label: "Pair", control: true, hyMult: 1.4, scopeMult: 1.1, participants: 2, color: "#b87333" },
    swarm_blockers: { label: "Swarm", control: true, hyMult: 1.1, scopeMult: 1.2, participants: 4, color: "#c47a2c" },
    everybody: { label: "Everybody", control: true, tail: true, hyMult: 0.7, scopeMult: 1.8, participants: 6, color: "#8b3a3a" },
    set_based: { label: "Set-based", control: true, hyMult: 1, scopeMult: 1.3, participants: 3, color: "#7a6b9a" },
    cce_routing: { label: "Collaborative Concurrent Extreme", manifesto: true, hyMult: 1.15, scopeMult: 1, participants: 1, color: "#2d6a4f" }
  };

  function normalizePattern(p) {
    return p === "cce_routing" ? "cce" : p;
  }

  function idx(x, y) { return y * W + x; }

  var MARKETS = {
    bull: { label: "Bull", consumer: 1.25, lead: 1.35, roi: 1.2 },
    bear: { label: "Bear", consumer: 0.75, lead: 0.65, roi: 0.55 },
    sideways: { label: "Sideways", consumer: 1, lead: 1, roi: 1 },
    volatile: { label: "Volatile", consumer: 0.85, lead: 0.7, roi: 0.6 }
  };

  var INVESTMENTS = {
    tight: { label: "Tight runway", budget: 0.6 },
    neutral: { label: "Neutral", budget: 1 },
    loose: { label: "Loose capital", budget: 1.4 }
  };

  var EVENTS = [
    { id: "viral", label: "Viral spike — demand not in forecast", effects: { consumers: 4, feedback: 35 } },
    { id: "miss", label: "Pipeline miss — forecast leads did not convert", effects: { leads: -25, task: 20, debt: 5 } },
    { id: "comp", label: "Competitor launch — reactive work blooms", effects: { task: 30, debt: 15, feedback: 20 } },
    { id: "freeze", label: "Budget freeze — marketing paused", effects: { marketing: -0.4 } },
    { id: "churn", label: "Enterprise churn — usage shock", effects: { consumers: -3, debt: 25, feedback: 15 } },
    { id: "reg", label: "Regulatory surprise — compliance cluster", effects: { task: 25, debt: 20 } },
    { id: "macro", label: "Macro shock — market turns bear", effects: { market: "bear" } },
    { id: "conf", label: "Conference leads — random walk-ins", effects: { leads: 18, feedback: 22 } },
    { id: "sunshine", label: "Forecast sunshine — vanity leads, no fit", effects: { leads: 30, task: 15, feature: -5 } },
    { id: "sec", label: "Security incident — debt hotspot", effects: { debt: 40, task: 18 } },
    { id: "acqui", label: "Acquisition interest — runway optimism", effects: { investment: "loose", leads: 10, morale: 0.06 } },
    { id: "hire", label: "Hiring freeze — bench pressure", effects: { task: 12, psych: 0.15, morale: -0.05 } },
    { id: "train", label: "Training budget cut — skill gap widens", effects: { strategic: -0.3, morale: -0.04 } },
    { id: "plat", label: "Platform bet — in-house strategic spend", effects: { strategic: 0.25, experience: 0.03 } }
  ];

  var EVENT_MTTR = {
    sec: 22, reg: 18, macro: 16, churn: 14, miss: 12, comp: 13,
    viral: 10, freeze: 8, conf: 8, sunshine: 9, acqui: 6, hire: 10, train: 8, plat: 5
  };

  function marketLeadMult(market) {
    var m = MARKETS[market] || MARKETS.sideways;
    return market === "volatile" ? m.lead + Math.random() * 0.6 : m.lead;
  }

  function marketRoi(market) {
    var m = MARKETS[market] || MARKETS.sideways;
    return market === "volatile" ? m.roi + Math.random() * 0.8 : m.roi;
  }

  function leadConversionRate(market, investment) {
    if (market === "bull") return 0.08;
    if (market === "bear" && investment === "tight") return 0.02;
    if (market === "bear") return 0.035;
    if (market === "volatile") return 0.05 + Math.random() * 0.04;
    if (investment === "loose") return 0.07;
    return 0.05;
  }

  function monthlyRedLineFor(investment, usage) {
    if (investment === "tight") return 28000 + usage * 8000;
    if (investment === "loose") return 58000 + usage * 18000;
    return 38000 + usage * 12000;
  }

  var SCENARIOS = {
    default: { label: "Standard deal", devRate: 120, consultantRate: 168, monthlyRedLine: 45000, customerMood: 0.55, patronTier: "standard" },
    tight: { label: "Tight CFO", devRate: 140, consultantRate: 196, monthlyRedLine: 28000, customerMood: 0.48, patronTier: "strict", moodFloor: 0.05 },
    happy: { label: "Happy patron", devRate: 95, consultantRate: 133, monthlyRedLine: 72000, customerMood: 0.64, patronTier: "generous", moodFloor: 0.58 },
    shock: { label: "Consultant shock", devRate: 120, consultantRate: 240, monthlyRedLine: 45000, customerMood: 0.52, patronTier: "standard" },
    flat: { label: "Flat rate deal", devRate: 100, consultantRate: 100, monthlyRedLine: 55000, customerMood: 0.56, patronTier: "standard" }
  };

  function customerMoodLabel(mood) {
    if (mood >= 0.72) return "delighted";
    if (mood >= 0.58) return "pleased";
    if (mood >= 0.42) return "guarded";
    return "frustrated";
  }

  function Ecosystem(pattern, usage, climate, pricing) {
    climate = climate || {};
    pricing = pricing || {};
    this.pattern = normalizePattern(pattern);
    this.usage = usage;
    this.market = climate.market || "sideways";
    this.investment = climate.investment || "neutral";
    this.marketing = climate.marketing != null ? climate.marketing : 0.5;
    this.leads = 0;
    this.forecastLeads = 0;
    this.forecastConsumers = 0;
    this.marketingFrozen = 0;
    this.events = [];
    this.surpriseEvents = 0;
    this.changeAttempts = 0;
    this.recoveryTicksRemaining = 0;
    this.currentIncidentMttr = 0;
    this.recoveryTicksTotal = 0;
    this.incidentsResolved = 0;
    this.recoveryPenalty = 1;
    this.prevFeatureSum = 0;
    this.featureVelocity = 0;
    this.leadTime = 0;
    this.benchMonthHistory = [];
    this.iqOverOutsideSum = 0;
    this.iqOverOutsideScores = 0;
    this.iqOverOutsideAvg = 0;
    this.outsideViewErrorAvg = 0;
    this.collabEvents = 0;
    this.forecastMissPeak = 0;
    this.psychDrift = 0;
    this.operativeEur = 0;
    this.strategicEur = 0;
    this.strategicInHouse = 0;
    this.debtAccrued = 0;
    this.debtPaid = 0;
    this.debtWeightPeak = 0;
    this.devRate = pricing.devRate != null ? pricing.devRate : DEFAULT_DEV_RATE;
    this.consultantRate = pricing.consultantRate != null ? pricing.consultantRate : DEFAULT_CONSULTANT_RATE;
    this.monthlyRedLine = pricing.monthlyRedLine != null
      ? pricing.monthlyRedLine
      : monthlyRedLineFor(this.investment, usage);
    this.customerMood = 0.55;
    this.monthBenchSpend = 0;
    this.benchCostPrev = 0;
    this.monthsOverBudget = 0;
    this.monthsClosed = 0;
    this.monthSpendPeak = 0;
    this.customerMood = 0.55;
    this.patronTierOverride = null;
    this.moodFloor = null;
    this.moodCeiling = null;
    this.predLeads = 0;
    this.predConsumers = 0;
    this.predBenchMonth = 0;
    this.predMarket = "sideways";
    this.predictionIntelligence = 0.38;
    this.prevConsumers = 0;
    this.prevLeads = 0;
    this.prevBenchCost = 0;
    this.consumerVel = 0;
    this.leadVel = 0;
    this.benchVel = 0;
    this.intelligencePeak = 0;
    this.teamPredictionMissPeak = 0;
    this.predictionErrorPeak = 0;
    this.predictionErrorSum = 0;
    this.predictionScores = 0;
    this.predictionErrorAvg = 0;
    this.predHistory = [];
    this.tick = 0;
    this.feature = new Float32Array(W * H);
    this.task = new Float32Array(W * H);
    this.debt = new Float32Array(W * H);
    this.hyphae = new Float32Array(W * H);
    this.feedback = new Float32Array(W * H);
    this.agents = [];
    this.billable = 0;
    this.init();
  }

  Ecosystem.prototype.init = function () {
    var i, n = W * H;
    var mkt = MARKETS[this.market] || MARKETS.sideways;
    var consumerMult = this.market === "volatile" ? mkt.consumer + Math.random() * 0.5 : mkt.consumer;
    for (i = 0; i < n; i++) {
      this.feature[i] = 8 + Math.random() * 10;
      this.task[i] = Math.random() < 0.16 ? 20 + Math.random() * 40 : 0;
      this.debt[i] = 2;
      this.hyphae[i] = 0;
      this.feedback[i] = Math.random() < 0.07 ? 15 + Math.random() * 30 : 0;
    }
    this.agents = [];
    var d;
    for (d = 1; d <= 6; d++) {
      this.agents.push({
        id: d, kind: "dev", x: (d * 7) % W, y: (d * 5) % H,
        mate: d % 2 ? d + 1 : d - 1, bill: 0,
        experience: 0.42 + Math.random() * 0.12,
        morale: 0.52 + Math.random() * 0.12
      });
    }
    for (d = 1; d <= 2; d++) {
      this.agents.push({
        id: 90 + d, kind: "consultant", x: (d * 11) % W, y: (d * 3) % H, bill: 0,
        experience: 0.55 + Math.random() * 0.1,
        morale: 0.5 + Math.random() * 0.1
      });
    }
    var cc = Math.floor(4 + this.usage * 8 * consumerMult);
    this.forecastConsumers = cc * 1.15;
    this.forecastLeads = this.marketing * 40 * marketLeadMult(this.market) * (1 + this.usage);
    this.leads = this.forecastLeads * 0.85;
    for (d = 0; d < cc; d++) {
      var edge = d % 4;
      var x = edge === 2 ? 0 : edge === 3 ? W - 1 : Math.floor(Math.random() * W);
      var y = edge === 0 ? 0 : edge === 1 ? H - 1 : Math.floor(Math.random() * H);
      this.agents.push({ id: 200 + d, kind: "consumer", x: x, y: y, bill: 0 });
    }
    this.tick = 0;
    this.billable = 0;
    this.events = [];
    this.surpriseEvents = 0;
    this.changeAttempts = 0;
    this.recoveryTicksRemaining = 0;
    this.currentIncidentMttr = 0;
    this.recoveryTicksTotal = 0;
    this.incidentsResolved = 0;
    this.recoveryPenalty = 1;
    this.prevFeatureSum = 0;
    this.featureVelocity = 0;
    this.leadTime = 0;
    this.benchMonthHistory = [];
    this.iqOverOutsideSum = 0;
    this.iqOverOutsideScores = 0;
    this.iqOverOutsideAvg = 0;
    this.outsideViewErrorAvg = 0;
    this.collabEvents = 0;
    this.forecastMissPeak = 0;
    this.psychDrift = 0;
    this.operativeEur = 0;
    this.strategicEur = 0;
    this.strategicInHouse = 0;
    this.debtAccrued = 0;
    this.debtPaid = 0;
    this.debtWeightPeak = 0;
    this.customerMood = 0.55;
    this.monthBenchSpend = 0;
    this.benchCostPrev = 0;
    this.monthsOverBudget = 0;
    this.monthsClosed = 0;
    this.monthSpendPeak = 0;
    this.predLeads = this.forecastLeads;
    this.predConsumers = this.forecastConsumers;
    this.predBenchMonth = this.monthlyRedLine * 0.38;
    this.predMarket = this.market;
    this.predictionIntelligence = 0.38;
    this.prevConsumers = 0;
    this.prevLeads = this.leads;
    this.prevBenchCost = 0;
    this.consumerVel = 0;
    this.leadVel = 0;
    this.benchVel = 0;
    this.intelligencePeak = 0;
    this.teamPredictionMissPeak = 0;
    this.predictionErrorPeak = 0;
    this.predictionErrorSum = 0;
    this.predictionScores = 0;
    this.predictionErrorAvg = 0;
    this.predHistory = [];
    this.monthPredSnap = null;
    this.marketingFrozen = 0;
    this.benchMonthHistory = [];
    this.iqOverOutsideSum = 0;
    this.iqOverOutsideScores = 0;
    this.iqOverOutsideAvg = 0;
    this.outsideViewErrorAvg = 0;
    this.beginMonthPredictions();
  };

  Ecosystem.prototype.eventMttr = function (ev) {
    return EVENT_MTTR[ev.id] || 12;
  };

  Ecosystem.prototype.tickRecovery = function () {
    if (!this.recoveryTicksRemaining) {
      this.recoveryPenalty = 1;
      return;
    }
    this.recoveryTicksRemaining--;
    var mttr = this.currentIncidentMttr || 12;
    if (this.recoveryTicksRemaining <= 0) {
      this.recoveryTicksTotal += mttr;
      this.incidentsResolved++;
      this.recoveryTicksRemaining = 0;
      this.recoveryPenalty = 1;
      return;
    }
    this.recoveryPenalty = 0.55 + 0.45 * (this.recoveryTicksRemaining / Math.max(mttr, 1));
  };

  Ecosystem.prototype.featureMass = function () {
    var sum = 0, i;
    for (i = 0; i < W * H; i++) sum += this.feature[i];
    return sum;
  };

  Ecosystem.prototype.taskMass = function () {
    var sum = 0, i;
    for (i = 0; i < W * H; i++) sum += this.task[i];
    return sum;
  };

  Ecosystem.prototype.updateFlowMetrics = function () {
    var feat = this.featureMass();
    var delta = feat - (this.prevFeatureSum || feat);
    this.prevFeatureSum = feat;
    this.featureVelocity = (this.featureVelocity || 0) * 0.65 + Math.max(0, delta) * 0.35;
    this.leadTime = this.taskMass() / Math.max(this.featureVelocity, 0.5);
  };

  Ecosystem.prototype.complexityMedian = function () {
    var vals = [], i;
    for (i = 0; i < W * H; i++) vals.push(this.task[i] + this.debt[i]);
    vals.sort(function (a, b) { return a - b; });
    return vals[Math.floor(vals.length / 2)] || 0;
  };

  Ecosystem.prototype.pairComplexityBonus = function (x, y) {
    if (this.pattern !== "pair") return 1;
    var local = this.get(this.task, x, y) + this.get(this.debt, x, y);
    if (local > this.complexityMedian()) return 1.18;
    return 0.85;
  };

  Ecosystem.prototype.beginMonthPredictions = function () {
    this.monthPredSnap = {
      leads: this.predLeads,
      consumers: this.predConsumers,
      bench: this.predBenchMonth,
      market: this.predMarket
    };
  };

  Ecosystem.prototype.patronTier = function () {
    if (this.patronTierOverride) return this.patronTierOverride;
    if (this.monthlyRedLine >= 65000 && this.devRate <= 100) return "generous";
    if (this.monthlyRedLine <= 32000 || this.devRate >= 138) return "strict";
    return "standard";
  };

  Ecosystem.prototype.expectedConsumers = function () {
    var months = this.monthsClosed + (this.tick % MONTH_TICKS) / MONTH_TICKS;
    var mkt = (MARKETS[this.market] || MARKETS.sideways).consumer;
    return this.forecastConsumers * (1 + this.usage * 0.035 * Math.max(0.5, months) * mkt);
  };

  Ecosystem.prototype.monthPlanMiss = function () {
    var monthTick = this.tick % MONTH_TICKS || MONTH_TICKS;
    var consumers = this.consumerCount();
    var leadPlan = this.forecastLeads * (monthTick / MONTH_TICKS);
    var leadMiss = Math.abs(this.leads - leadPlan) / Math.max(this.forecastLeads, 1);
    var expected = this.expectedConsumers();
    var consumerMiss = Math.abs(consumers - expected) / Math.max(expected, 1);
    return Math.min(1.0, leadMiss * 0.55 + consumerMiss * 0.45);
  };

  Ecosystem.prototype.monthClosePredictionError = function (monthSpend) {
    var s = this.monthPredSnap;
    if (!s) return 0;
    var consumers = this.consumerCount();
    var leadMiss = Math.abs(this.leads - s.leads) / Math.max(s.leads, 1);
    var consumerMiss = Math.abs(consumers - s.consumers) / Math.max(s.consumers, 1);
    var benchMiss = Math.abs(monthSpend - s.bench) / Math.max(s.bench, 1);
    var marketMiss = s.market === this.market ? 0 : 1;
    return (leadMiss + consumerMiss + benchMiss) / 3 + marketMiss * 0.12;
  };

  Ecosystem.prototype.capture = function () {
    var self = this;
    return {
      tick: self.tick,
      pattern: self.pattern,
      usage: self.usage,
      market: self.market,
      investment: self.investment,
      marketing: self.marketing,
      leads: self.leads,
      forecastLeads: self.forecastLeads,
      forecastConsumers: self.forecastConsumers,
      marketingFrozen: self.marketingFrozen,
      events: self.events.slice(),
      surpriseEvents: self.surpriseEvents,
      changeAttempts: self.changeAttempts,
      recoveryTicksRemaining: self.recoveryTicksRemaining,
      currentIncidentMttr: self.currentIncidentMttr,
      recoveryTicksTotal: self.recoveryTicksTotal,
      incidentsResolved: self.incidentsResolved,
      recoveryPenalty: self.recoveryPenalty,
      prevFeatureSum: self.prevFeatureSum,
      featureVelocity: self.featureVelocity,
      leadTime: self.leadTime,
      benchMonthHistory: self.benchMonthHistory.slice(),
      iqOverOutsideAvg: self.iqOverOutsideAvg,
      iqOverOutsideSum: self.iqOverOutsideSum,
      iqOverOutsideScores: self.iqOverOutsideScores,
      outsideViewErrorAvg: self.outsideViewErrorAvg,
      collabEvents: self.collabEvents,
      forecastMissPeak: self.forecastMissPeak,
      psychDrift: self.psychDrift,
      operativeEur: self.operativeEur,
      strategicEur: self.strategicEur,
      strategicInHouse: self.strategicInHouse,
      debtAccrued: self.debtAccrued,
      debtPaid: self.debtPaid,
      debtWeightPeak: self.debtWeightPeak,
      devRate: self.devRate,
      consultantRate: self.consultantRate,
      monthlyRedLine: self.monthlyRedLine,
      customerMood: self.customerMood,
      patronTierOverride: self.patronTierOverride,
      moodFloor: self.moodFloor,
      moodCeiling: self.moodCeiling,
      monthBenchSpend: self.monthBenchSpend,
      benchCostPrev: self.benchCostPrev,
      monthsOverBudget: self.monthsOverBudget,
      monthsClosed: self.monthsClosed,
      monthSpendPeak: self.monthSpendPeak,
      predLeads: self.predLeads,
      predConsumers: self.predConsumers,
      predBenchMonth: self.predBenchMonth,
      predMarket: self.predMarket,
      predictionIntelligence: self.predictionIntelligence,
      prevConsumers: self.prevConsumers,
      prevLeads: self.prevLeads,
      prevBenchCost: self.prevBenchCost,
      consumerVel: self.consumerVel,
      leadVel: self.leadVel,
      benchVel: self.benchVel,
      intelligencePeak: self.intelligencePeak,
      teamPredictionMissPeak: self.teamPredictionMissPeak,
      predictionErrorPeak: self.predictionErrorPeak,
      predictionErrorSum: self.predictionErrorSum,
      predictionScores: self.predictionScores,
      predictionErrorAvg: self.predictionErrorAvg,
      predHistory: self.predHistory.slice(),
      monthPredSnap: self.monthPredSnap ? Object.assign({}, self.monthPredSnap) : null,
      billable: self.billable,
      feature: new Float32Array(self.feature),
      task: new Float32Array(self.task),
      debt: new Float32Array(self.debt),
      hyphae: new Float32Array(self.hyphae),
      feedback: new Float32Array(self.feedback),
      agents: self.agents.map(function (a) { return Object.assign({}, a); })
    };
  };

  Ecosystem.prototype.loadCapture = function (snap) {
    var k;
    this.tick = snap.tick;
    this.pattern = normalizePattern(snap.pattern);
    this.usage = snap.usage;
    this.market = snap.market;
    this.investment = snap.investment;
    this.marketing = snap.marketing;
    this.leads = snap.leads;
    this.forecastLeads = snap.forecastLeads;
    this.forecastConsumers = snap.forecastConsumers;
    this.marketingFrozen = snap.marketingFrozen;
    this.events = snap.events.slice();
    this.surpriseEvents = snap.surpriseEvents;
    this.changeAttempts = snap.changeAttempts || 0;
    this.recoveryTicksRemaining = snap.recoveryTicksRemaining || 0;
    this.currentIncidentMttr = snap.currentIncidentMttr || 0;
    this.recoveryTicksTotal = snap.recoveryTicksTotal || 0;
    this.incidentsResolved = snap.incidentsResolved || 0;
    this.recoveryPenalty = snap.recoveryPenalty != null ? snap.recoveryPenalty : 1;
    this.prevFeatureSum = snap.prevFeatureSum || 0;
    this.featureVelocity = snap.featureVelocity || 0;
    this.leadTime = snap.leadTime || 0;
    this.benchMonthHistory = snap.benchMonthHistory ? snap.benchMonthHistory.slice() : [];
    this.iqOverOutsideAvg = snap.iqOverOutsideAvg || 0;
    this.iqOverOutsideSum = snap.iqOverOutsideSum || 0;
    this.iqOverOutsideScores = snap.iqOverOutsideScores || 0;
    this.outsideViewErrorAvg = snap.outsideViewErrorAvg || 0;
    this.collabEvents = snap.collabEvents;
    this.forecastMissPeak = snap.forecastMissPeak;
    this.psychDrift = snap.psychDrift;
    this.operativeEur = snap.operativeEur;
    this.strategicEur = snap.strategicEur;
    this.strategicInHouse = snap.strategicInHouse;
    this.debtAccrued = snap.debtAccrued;
    this.debtPaid = snap.debtPaid;
    this.debtWeightPeak = snap.debtWeightPeak;
    this.devRate = snap.devRate;
    this.consultantRate = snap.consultantRate;
    this.monthlyRedLine = snap.monthlyRedLine;
    this.customerMood = snap.customerMood;
    this.patronTierOverride = snap.patronTierOverride;
    this.moodFloor = snap.moodFloor;
    this.moodCeiling = snap.moodCeiling;
    this.monthBenchSpend = snap.monthBenchSpend;
    this.benchCostPrev = snap.benchCostPrev;
    this.monthsOverBudget = snap.monthsOverBudget;
    this.monthsClosed = snap.monthsClosed;
    this.monthSpendPeak = snap.monthSpendPeak;
    this.predLeads = snap.predLeads;
    this.predConsumers = snap.predConsumers;
    this.predBenchMonth = snap.predBenchMonth;
    this.predMarket = snap.predMarket;
    this.predictionIntelligence = snap.predictionIntelligence;
    this.prevConsumers = snap.prevConsumers;
    this.prevLeads = snap.prevLeads;
    this.prevBenchCost = snap.prevBenchCost;
    this.consumerVel = snap.consumerVel;
    this.leadVel = snap.leadVel;
    this.benchVel = snap.benchVel;
    this.intelligencePeak = snap.intelligencePeak;
    this.teamPredictionMissPeak = snap.teamPredictionMissPeak;
    this.predictionErrorPeak = snap.predictionErrorPeak;
    this.predictionErrorSum = snap.predictionErrorSum;
    this.predictionScores = snap.predictionScores;
    this.predictionErrorAvg = snap.predictionErrorAvg;
    this.predHistory = snap.predHistory.slice();
    this.monthPredSnap = snap.monthPredSnap ? Object.assign({}, snap.monthPredSnap) : null;
    this.billable = snap.billable;
    this.feature.set(snap.feature);
    this.task.set(snap.task);
    this.debt.set(snap.debt);
    this.hyphae.set(snap.hyphae);
    this.feedback.set(snap.feedback);
    this.agents = snap.agents.map(function (a) { return Object.assign({}, a); });
  };

  Ecosystem.prototype.consumerCount = function () {
    var n = 0, k;
    for (k = 0; k < this.agents.length; k++) {
      if (this.agents[k].kind === "consumer") n++;
    }
    return n;
  };

  Ecosystem.prototype.outsideViewBenchMedian = function () {
    var h = this.benchMonthHistory;
    if (!h || !h.length) return this.monthlyRedLine * 0.38;
    var sorted = h.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  Ecosystem.prototype.benchOutsideViewError = function (monthSpend) {
    var baseline = this.outsideViewBenchMedian();
    return Math.abs(monthSpend - baseline) / Math.max(baseline, 1);
  };

  Ecosystem.prototype.workerHeadcount = function () {
    var n = 0, k;
    for (k = 0; k < this.agents.length; k++) {
      if (this.agents[k].kind === "dev" || this.agents[k].kind === "consultant") n++;
    }
    return n;
  };

  Ecosystem.prototype.brooksChannelStress = function () {
    var n = this.workerHeadcount();
    return n > 1 ? (n * (n - 1)) / (2 * 36) : 0;
  };

  Ecosystem.prototype.coordinationStress = function () {
    var self = this;
    var overlap = 0;
    this.agents.forEach(function (a) {
      if (a.kind !== "dev" && a.kind !== "consultant") return;
      self.agents.forEach(function (b) {
        if (b === a || (b.kind !== "dev" && b.kind !== "consultant")) return;
        if (Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1) overlap++;
      });
    });
    var heads = this.workerHeadcount();
    var base;
    if (this.pattern === "everybody") {
      base = this.brooksChannelStress() + 0.15;
    } else if (this.pattern === "swarm_blockers") base = 0.55;
    else if (this.pattern === "cce") base = 0.32;
    else if (this.pattern === "pair") base = 0.35;
    else if (this.pattern === "solo_serial") base = 0.1;
    else base = 0.25;
    return base + overlap / Math.max(heads, 1) * 0.15;
  };

  Ecosystem.prototype.psychStress = function () {
    return Math.min(1.5, this.coordinationStress() + (this.psychDrift || 0));
  };

  Ecosystem.prototype.littleLawStable = function () {
    return this.forecastMissCurrent() < 0.55 &&
      this.forecastMissPeak < 0.55 &&
      this.market !== "volatile" &&
      !(this.recoveryTicksRemaining > 0);
  };

  Ecosystem.prototype.predictionIntelligenceScore = function () {
    var exp = this.avgExperience();
    var mor = this.avgMorale();
    var hy = 0, i;
    for (i = 0; i < W * H; i++) hy += this.hyphae[i];
    hy = hy / (W * H * 45);
    var strat = Math.min(1, this.strategicInHouse / 70000);
    var collab = Math.min(1, (this.collabEvents || 0) / 350);
    var gap = Math.max(0, this.marketSkill() - exp) * 0.25;
    var base = Math.min(0.94, Math.max(0.12,
      0.34 * exp + 0.18 * mor + 0.2 * hy + 0.16 * strat + 0.12 * collab - gap
    ));
    var outsideGain = this.iqOverOutsideAvg || 0.5;
    return Math.min(0.94, Math.max(0.12, base * 0.65 + outsideGain * 0.35));
  };

  Ecosystem.prototype.teamPredictionMiss = function (predLeads, predConsumers, predBench, predMarket) {
    var consumers = this.consumerCount();
    var pl = predLeads != null ? predLeads : this.predLeads;
    var pc = predConsumers != null ? predConsumers : this.predConsumers;
    var pb = predBench != null ? predBench : this.predBenchMonth;
    var pm = predMarket != null ? predMarket : this.predMarket;
    var leadMiss = Math.abs(this.leads - pl) / Math.max(pl, 1);
    var consumerMiss = Math.abs(consumers - pc) / Math.max(pc, 1);
    var benchMiss = Math.abs(this.monthBenchSpend - pb) / Math.max(pb, 1);
    var marketMiss = pm === this.market ? 0 : 0.35;
    return (leadMiss + consumerMiss + benchMiss) / 3 + marketMiss * 0.15;
  };

  Ecosystem.prototype.updateVelocities = function (consumers, benchCost) {
    this.consumerVel = this.consumerVel * 0.65 + (consumers - this.prevConsumers) * 0.35;
    this.leadVel = this.leadVel * 0.65 + (this.leads - this.prevLeads) * 0.35;
    this.benchVel = this.benchVel * 0.65 + (benchCost - this.prevBenchCost) * 0.35;
    this.prevConsumers = consumers;
    this.prevLeads = this.leads;
    this.prevBenchCost = benchCost;
  };

  Ecosystem.prototype.signalConsumerForecast = function (consumers, horizon) {
    var mkt = MARKETS[this.market] || MARKETS.sideways;
    var conv = leadConversionRate(this.market, this.investment);
    var growth = this.usage * mkt.consumer * 0.06 * (0.55 + conv * 4 + (this.customerMood || 0.55) * 0.2);
    return consumers + growth * horizon;
  };

  Ecosystem.prototype.signalLeadForecast = function (horizon) {
    var eff = Math.max(0, this.marketing - (this.marketingFrozen > 0 ? 0.5 : 0));
    var inflow = eff * marketLeadMult(this.market) * (1.1 + Math.random() * 0.6);
    var outflow = this.leads * leadConversionRate(this.market, this.investment) * 0.85;
    return Math.max(0, this.leads + (inflow - outflow) * horizon / MONTH_TICKS);
  };

  Ecosystem.prototype.signalBenchForecast = function (horizon) {
    var heads = 0, k, pat = PATTERNS[this.pattern] || PATTERNS.work_stealing;
    for (k = 0; k < this.agents.length; k++) {
      if (this.agents[k].kind === "dev" || this.agents[k].kind === "consultant") heads++;
    }
    var stress = this.pattern === "everybody" ? 1.55 : this.pattern === "nobody" ? 0.15
      : this.pattern === "pair" ? 1.2 : this.pattern === "swarm_blockers" ? 1.15 : 1;
    var rate = heads * Q * (this.devRate * 0.75 + this.consultantRate * 0.25) * stress * this.usage;
    return this.monthBenchSpend + rate * horizon;
  };

  Ecosystem.prototype.predictMarket = function (iq) {
    var conv = leadConversionRate(this.market, this.investment);
    var miss = this.teamPredictionMiss();
    var guess = this.market;
    if (this.market === "volatile") guess = "volatile";
    else if (miss > 0.55 && conv < 0.04) guess = "bear";
    else if (this.marketing > 0.65 && conv > 0.06) guess = "bull";
    return (Math.random() < iq || guess === this.market) ? guess : this.market;
  };

  Ecosystem.prototype.tickPredictions = function () {
    var iq = this.predictionIntelligenceScore();
    var consumers = this.consumerCount();
    var benchCost = this.benchCost();
    this.updateVelocities(consumers, benchCost);
    var horizon = Math.max(MONTH_TICKS - (this.tick % MONTH_TICKS), 1);
    var naiveC = consumers + this.consumerVel * horizon;
    var naiveL = Math.max(0, this.leads + this.leadVel * horizon);
    var outsideBench = this.outsideViewBenchMedian();
    var naiveBench = (this.benchMonthHistory && this.benchMonthHistory.length >= 1)
      ? outsideBench * (1 + horizon / MONTH_TICKS * 0.08) + this.monthBenchSpend * 0.25
      : this.monthBenchSpend + this.benchVel * horizon;
    var signalC = this.signalConsumerForecast(consumers, horizon);
    var signalL = this.signalLeadForecast(horizon);
    var signalBench = this.signalBenchForecast(horizon);
    var noise = (1 - iq) * 0.12;
    var blend = function (n, s) { return n * (1 - iq) + s * iq; };
    this.predConsumers = Math.max(0, blend(naiveC, signalC) * (1 + (Math.random() - 0.5) * noise));
    this.predLeads = Math.max(0, blend(naiveL, signalL) * (1 + (Math.random() - 0.5) * noise));
    this.predBenchMonth = Math.max(0, blend(naiveBench, signalBench) * (1 + (Math.random() - 0.5) * noise));
    this.predMarket = this.predictMarket(iq);
    this.predictionIntelligence = iq;
    if (iq > this.intelligencePeak) this.intelligencePeak = iq;
    var miss = this.teamPredictionMiss(this.predLeads, this.predConsumers, this.predBenchMonth, this.predMarket);
    if (miss > this.teamPredictionMissPeak) this.teamPredictionMissPeak = miss;
  };

  Ecosystem.prototype.scoreMonthPredictions = function (monthSpend) {
    var consumers = this.consumerCount();
    var err = this.monthClosePredictionError(monthSpend);
    var outsideErr = this.benchOutsideViewError(monthSpend);
    var snap = this.monthPredSnap;
    var insideBenchErr = snap
      ? Math.abs(monthSpend - snap.bench) / Math.max(snap.bench, 1)
      : err;
    var iqGain = Math.max(0, Math.min(1, (outsideErr - insideBenchErr) / Math.max(outsideErr, 0.01)));
    this.iqOverOutsideScores++;
    this.iqOverOutsideSum += iqGain;
    this.iqOverOutsideAvg = this.iqOverOutsideSum / this.iqOverOutsideScores;
    this.outsideViewErrorAvg = this.outsideViewErrorAvg * 0.65 + outsideErr * 0.35;
    this.predictionScores++;
    this.predictionErrorSum += err;
    this.predictionErrorAvg = this.predictionErrorSum / this.predictionScores;
    if (err > this.predictionErrorPeak) this.predictionErrorPeak = err;
    this.predHistory.push({
      tick: this.tick,
      iq: this.predictionIntelligence,
      err: err,
      outsideErr: outsideErr,
      iqGain: iqGain,
      consumers: consumers,
      predConsumers: this.monthPredSnap ? this.monthPredSnap.consumers : this.predConsumers,
      leads: this.leads,
      predLeads: this.monthPredSnap ? this.monthPredSnap.leads : this.predLeads
    });
    if (this.predHistory.length > 40) this.predHistory.shift();
  };

  Ecosystem.prototype.benchCost = function () {
    var sum = 0, k, a, h;
    for (k = 0; k < this.agents.length; k++) {
      a = this.agents[k];
      h = a.bill || 0;
      if (a.kind === "consultant") sum += h * this.consultantRate;
      else if (a.kind === "dev") sum += h * this.devRate;
    }
    return sum;
  };

  Ecosystem.prototype.closeSimMonth = function (monthSpend) {
    var ratio = monthSpend / Math.max(this.monthlyRedLine, 1);
    var qual = this.totals().quality;
    var weight = this.debtWeight();
    var tier = this.patronTier();
    var qualCut = tier === "generous" && ratio < 0.8 ? 0.04 : 0;
    var moodDelta;

    if (ratio > 1.3) moodDelta = -0.16;
    else if (ratio > 1.08) moodDelta = -0.09;
    else if (ratio > 1.0) moodDelta = -0.04;
    else if (ratio < 0.5 && qual > 0.42 - qualCut) moodDelta = tier === "generous" ? 0.1 : 0.08;
    else if (ratio < 0.7 && qual > 0.4 - qualCut) moodDelta = tier === "generous" ? 0.07 : 0.05;
    else if (ratio < 0.95 && qual > 0.38 - qualCut) moodDelta = tier === "generous" ? 0.04 : 0.03;
    else moodDelta = ratio <= 1.0 ? 0.01 : 0;

    var planMiss = this.monthPlanMiss();
    var predErr = this.monthClosePredictionError(monthSpend);
    var trustScale = ratio <= 1.0
      ? (tier === "generous" ? 0.18 : tier === "standard" ? 0.4 : 0.7)
      : 1.0;

    moodDelta -= trustScale * (
      Math.min(0.35, weight) * 0.035 +
      Math.max(0, planMiss - 0.35) * 0.03 +
      Math.min(0.5, predErr) * 0.025
    );

    if (this.pattern === "everybody" && ratio > 0.92) moodDelta -= 0.07;
    if (ratio < 0.85 && qual > 0.48 - qualCut) moodDelta += 0.03;
    if (tier === "strict" && ratio > 1.0) moodDelta -= 0.03;

    this.customerMood = Math.min(1, Math.max(0.05, this.customerMood + moodDelta));

    if (tier === "generous" && ratio < 0.78 && this.moodFloor != null) {
      this.customerMood = Math.max(this.customerMood, this.moodFloor);
    }
    if (tier === "strict" && ratio > 1.12 && this.moodCeiling != null) {
      this.customerMood = Math.min(this.customerMood, this.moodCeiling);
    } else if (tier === "strict" && ratio > 1.05) {
      this.customerMood = Math.min(this.customerMood, 0.4);
    }

    var consumers = this.consumerCount();
    this.forecastConsumers = this.forecastConsumers * 0.6 + consumers * 0.4;

    this.monthsClosed++;
    if (ratio > 1) this.monthsOverBudget++;
    if (monthSpend > this.monthSpendPeak) this.monthSpendPeak = monthSpend;
    this.benchMonthHistory = this.benchMonthHistory || [];
    this.benchMonthHistory.push(monthSpend);
    if (this.benchMonthHistory.length > 3) this.benchMonthHistory.shift();
    this.scoreMonthPredictions(monthSpend);
    this.monthBenchSpend = 0;
    this.benchCostPrev = this.benchCost();
    this.beginMonthPredictions();
  };

  Ecosystem.prototype.recordTick = function () {
    this.recordForecast();
    var bench = this.benchCost();
    this.monthBenchSpend += Math.max(0, bench - this.benchCostPrev);
    this.tick++;
    if (this.tick > 0 && this.tick % MONTH_TICKS === 0) {
      this.closeSimMonth(this.monthBenchSpend);
    } else {
      this.benchCostPrev = bench;
    }
  };

  Ecosystem.prototype.forecastMissCurrent = function () {
    var consumers = 0, k;
    for (k = 0; k < this.agents.length; k++) {
      if (this.agents[k].kind === "consumer") consumers++;
    }
    return Math.abs(this.leads - this.forecastLeads * (this.tick / 280)) / Math.max(this.forecastLeads, 1) +
      Math.abs(consumers - this.forecastConsumers) / Math.max(this.forecastConsumers, 1);
  };

  Ecosystem.prototype.debtWeight = function () {
    var feat = 0, debt = 0, i;
    for (i = 0; i < W * H; i++) {
      feat += this.feature[i];
      debt += this.debt[i];
    }
    var grid = W * H;
    return Math.min(0.88, debt / (grid * 35) + debt / Math.max(feat, 1) / 100);
  };

  Ecosystem.prototype.debtFixPattern = function () {
    return this.pattern === "work_stealing" || this.pattern === "least_loaded" ||
      this.pattern === "cce" || this.pattern === "swarm_blockers" || this.pattern === "pair";
  };

  Ecosystem.prototype.avgExperience = function () {
    var sum = 0, n = 0, k;
    for (k = 0; k < this.agents.length; k++) {
      if (this.agents[k].kind === "dev" || this.agents[k].kind === "consultant") {
        sum += this.agents[k].experience || 0.5;
        n++;
      }
    }
    return n ? sum / n : 0.5;
  };

  Ecosystem.prototype.avgMorale = function () {
    var sum = 0, n = 0, k;
    for (k = 0; k < this.agents.length; k++) {
      if (this.agents[k].kind === "dev" || this.agents[k].kind === "consultant") {
        sum += this.agents[k].morale || 0.5;
        n++;
      }
    }
    return n ? sum / n : 0.5;
  };

  Ecosystem.prototype.marketSkill = function () {
    var base = MARKET_SKILL[this.market] || 0.66;
    return this.market === "volatile" ? base + Math.random() * 0.12 : base;
  };

  Ecosystem.prototype.peopleMult = function (a) {
    var exp = a.experience || 0.5;
    var mor = a.morale || 0.5;
    return (0.65 + 0.35 * exp) * (0.75 + 0.25 * mor);
  };

  Ecosystem.prototype.fruitingScore = function () {
    var feat = 0, hy = 0, i;
    for (i = 0; i < W * H; i++) { feat += this.feature[i]; hy += this.hyphae[i]; }
    return hy > 500 ? Math.min(0.08, feat / Math.max(hy, 1) * 0.0001) : 0;
  };

  Ecosystem.prototype.depositField = function (field, amount) {
    if (!amount) return;
    var n = Math.max(1, Math.floor(Math.abs(amount) / 15));
    var arr = this[field];
    var j, x, y, slice;
    for (j = 0; j < n; j++) {
      x = Math.floor(Math.random() * W);
      y = Math.floor(Math.random() * H);
      slice = amount / n;
      arr[idx(x, y)] = Math.max(0, Math.min(100, arr[idx(x, y)] + slice));
    }
  };

  Ecosystem.prototype.spawnConsumer = function () {
    var id = 200 + this.agents.filter(function (a) { return a.kind === "consumer"; }).length + 1;
    var edge = Math.floor(Math.random() * 4);
    var x = edge === 2 ? 0 : edge === 3 ? W - 1 : Math.floor(Math.random() * W);
    var y = edge === 0 ? 0 : edge === 1 ? H - 1 : Math.floor(Math.random() * H);
    this.agents.push({ id: id, kind: "consumer", x: x, y: y, bill: 0 });
  };

  Ecosystem.prototype.removeConsumers = function (n) {
    var consumers = [], rest = [], k;
    for (k = 0; k < this.agents.length; k++) {
      if (this.agents[k].kind === "consumer") consumers.push(this.agents[k]);
      else rest.push(this.agents[k]);
    }
    this.agents = rest.concat(consumers.slice(n));
  };

  Ecosystem.prototype.applyEvent = function (ev) {
    var self = this;
    var eff = ev.effects;
    this.events.unshift(ev.label);
    if (this.events.length > 6) this.events.length = 6;
    this.surpriseEvents++;
    var mttr = this.eventMttr(ev);
    if (mttr > (this.recoveryTicksRemaining || 0)) {
      this.recoveryTicksRemaining = mttr;
      this.currentIncidentMttr = mttr;
      this.recoveryPenalty = 0.55 + 0.45;
    }
    Object.keys(eff).forEach(function (key) {
      var val = eff[key];
      if (key === "leads") self.leads = Math.max(0, self.leads + val);
      else if (key === "marketing") {
        self.marketing = Math.max(0, Math.min(1, self.marketing + val));
        if (val < 0) self.marketingFrozen = Math.max(self.marketingFrozen, 25);
      } else if (key === "market") self.market = val;
      else if (key === "investment") self.investment = val;
      else if (key === "psych") self.psychDrift += val;
      else if (key === "morale") self.adjustMorale(val);
      else if (key === "experience") self.adjustExperience(val);
      else if (key === "strategic") {
        var extra = val * 40;
        self.strategicEur += extra;
        self.strategicInHouse += extra * 0.65;
      }
      else if (key === "consumers" && val > 0) { var c; for (c = 0; c < val; c++) self.spawnConsumer(); }
      else if (key === "consumers" && val < 0) self.removeConsumers(-val);
      else if (key === "feedback") self.depositField("feedback", val);
      else if (key === "task") self.depositField("task", val);
      else if (key === "debt") self.depositField("debt", val);
      else if (key === "feature") self.depositField("feature", val);
    });
  };

  Ecosystem.prototype.tickMarketDrift = function () {
    if (this.market === "volatile" && Math.random() < 0.04) {
      var keys = Object.keys(MARKETS);
      this.market = keys[Math.floor(Math.random() * keys.length)];
    } else if (this.market === "sideways" && Math.random() < 0.01) {
      this.market = ["bull", "bear", "sideways"][Math.floor(Math.random() * 3)];
    }
  };

  Ecosystem.prototype.tickMarketing = function () {
    if (this.marketingFrozen > 0) this.marketingFrozen--;
    var eff = Math.max(0, this.marketing - (this.marketingFrozen > 0 ? 0.5 : 0));
    var inv = INVESTMENTS[this.investment] || INVESTMENTS.neutral;
    var burst = eff * marketRoi(this.market) * inv.budget * (2.5 + this.usage);
    var x = Math.floor(Math.random() * W);
    var y = Math.floor(Math.random() * H);
    this.feedback[idx(x, y)] = Math.min(100, this.feedback[idx(x, y)] + burst * (0.6 + Math.random() * 0.4));
    this.leads += eff * marketLeadMult(this.market) * (1.2 + Math.random() * 0.8);
  };

  Ecosystem.prototype.adjustMorale = function (delta) {
    this.agents.forEach(function (a) {
      if (a.kind === "dev" || a.kind === "consultant") {
        a.morale = Math.min(1, Math.max(0.1, (a.morale || 0.5) + delta));
      }
    });
  };

  Ecosystem.prototype.adjustExperience = function (delta) {
    this.agents.forEach(function (a) {
      if (a.kind === "dev" || a.kind === "consultant") {
        a.experience = Math.min(1, Math.max(0.1, (a.experience || 0.5) + delta));
      }
    });
  };

  Ecosystem.prototype.tickLeadConversion = function () {
    var gap = Math.max(0, this.marketSkill() - this.avgExperience());
    var mood = this.customerMood || 0.55;
    var rate = leadConversionRate(this.market, this.investment)
      * Math.max(0.4, 1 - gap * 0.35)
      * (0.72 + mood * 0.35);
    var convert = Math.min(this.leads, this.leads * rate + Math.random() * 3);
    this.leads = Math.max(0, this.leads - convert);
    if (convert > 8 && Math.random() < 0.35) this.spawnConsumer();
    if (convert > 5) {
      var x = Math.floor(Math.random() * W);
      var y = Math.floor(Math.random() * H);
      this.feedback[idx(x, y)] = Math.min(100, this.feedback[idx(x, y)] + convert * 0.15);
    }
  };

  Ecosystem.prototype.tickRandomEvents = function () {
    var consumers = 0, k;
    for (k = 0; k < this.agents.length; k++) {
      if (this.agents[k].kind === "consumer") consumers++;
    }
    var forecastGap = Math.abs(this.leads - this.forecastLeads) / Math.max(this.forecastLeads, 1);
    var consumerGap = Math.abs(consumers - this.forecastConsumers) / Math.max(this.forecastConsumers, 1);
    var planGap = Math.abs(this.leads - this.forecastLeads * (this.tick / 280)) / Math.max(this.forecastLeads, 1)
      + consumerGap;
    var teamGap = this.teamPredictionMiss();
    var chance = 0.012 + planGap * 0.015 + teamGap * 0.025 + (this.market === "volatile" ? 0.02 : 0);
    if (Math.random() < chance) {
      this.applyEvent(EVENTS[Math.floor(Math.random() * EVENTS.length)]);
    }
  };

  Ecosystem.prototype.recordForecast = function () {
    var consumers = 0, k;
    for (k = 0; k < this.agents.length; k++) {
      if (this.agents[k].kind === "consumer") consumers++;
    }
    var miss = Math.abs(this.leads - this.forecastLeads * (this.tick / 280)) / Math.max(this.forecastLeads, 1) +
      Math.abs(consumers - this.forecastConsumers) / Math.max(this.forecastConsumers, 1);
    if (miss > this.forecastMissPeak) this.forecastMissPeak = miss;
  };

  Ecosystem.prototype.get = function (arr, x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return 0;
    return arr[idx(x, y)];
  };

  Ecosystem.prototype.set = function (arr, x, y, v) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    arr[idx(x, y)] = Math.max(0, Math.min(100, v));
  };

  Ecosystem.prototype.neighbors = function (x, y) {
    var out = [], dx, dy, nx, ny;
    for (dy = -1; dy <= 1; dy++) {
      for (dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        nx = x + dx; ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) out.push([nx, ny]);
      }
    }
    return out;
  };

  Ecosystem.prototype.debtRotTarget = function (a) {
    var peaks = [], i, x, y, d;
    for (i = 0; i < W * H; i++) {
      d = this.debt[i];
      if (d >= 20) {
        x = i % W; y = (i / W) | 0;
        peaks.push({ x: x, y: y, d: d });
      }
    }
    if (!peaks.length) return this.hotspot();
    peaks.sort(function (p, q) { return q.d - p.d; });
    var slot = Math.min(peaks.length, 8);
    var pick = peaks[(a.id + Math.floor(this.tick / 36)) % slot];
    return [pick.x, pick.y];
  };

  Ecosystem.prototype.debtPatrolActive = function () {
    return this.debtWeight() > 0.36 || this.usage >= 0.85;
  };

  Ecosystem.prototype.shouldPayDebt = function (a, tk, db) {
    if (!this.debtFixPattern()) return false;
    if (db < 16) return false;
    var w = this.debtWeight();
    if (db > 30 && tk < 20) return true;
    if (w > 0.42 && db > 20 && (tk < 24 || (a.id + this.tick) % 4 === 0)) return true;
    if (w > 0.5 && db > 18 && (a.id + this.tick) % 3 !== 1) return true;
    return false;
  };

  Ecosystem.prototype.scoreForage = function (a, opts) {
    opts = opts || {};
    var self = this;
    var patrol = opts.debtPatrol || this.debtPatrolActive();
    var w = this.debtWeight();
    if (patrol) {
      var rot = this.debtRotTarget(a);
      return function (x, y) {
        var debt = self.get(self.debt, x, y);
        var load = self.localWorkerLoad(x, y);
        return debt * 1.15 - load * 7 + self.get(self.task, x, y) * 0.2 +
          self.get(self.hyphae, x, y) * 0.08 -
          (Math.abs(x - rot[0]) + Math.abs(y - rot[1])) * 0.18;
      };
    }
    var hyW = w > 0.45 ? 0.38 : 0.6;
    return function (x, y) {
      return self.get(self.task, x, y) + self.get(self.hyphae, x, y) * hyW -
        self.get(self.debt, x, y) * 0.15;
    };
  };

  Ecosystem.prototype.stepToward = function (ax, ay, tx, ty, hops, scoreFn) {
    var x = ax, y = ay, h, step;
    hops = hops || 2;
    for (h = 0; h < hops; h++) {
      if (scoreFn) {
        step = this.bestStep(x, y, scoreFn);
      } else {
        step = this.bestStep(x, y, function (px, py) {
          return -(Math.abs(px - tx) + Math.abs(py - ty));
        });
      }
      if (step[0] === x && step[1] === y) break;
      x = step[0]; y = step[1];
    }
    return [x, y];
  };

  Ecosystem.prototype.debtPatrolStep = function (a) {
    var self = this;
    var rot = this.debtRotTarget(a);
    return this.stepToward(a.x, a.y, rot[0], rot[1], 3, this.scoreForage(a, { debtPatrol: true }));
  };

  Ecosystem.prototype.hotspot = function () {
    var best = -1, bx = 0, by = 0, i, x, y, s;
    for (i = 0; i < W * H; i++) {
      x = i % W; y = (i / W) | 0;
      s = this.task[i] + this.debt[i];
      if (s > best) { best = s; bx = x; by = y; }
    }
    return [bx, by];
  };

  Ecosystem.prototype.bestStep = function (ax, ay, scoreFn) {
    var cands = this.neighbors(ax, ay);
    cands.push([ax, ay]);
    var best = scoreFn(ax, ay) + (Math.random() - 0.5) * 2;
    var bx = ax, by = ay, j, cx, cy, s;
    for (j = 0; j < cands.length; j++) {
      cx = cands[j][0]; cy = cands[j][1];
      s = scoreFn(cx, cy) + (Math.random() - 0.5) * 2;
      if (s > best) { best = s; bx = cx; by = cy; }
    }
    return [bx, by];
  };

  Ecosystem.prototype.localWorkerLoad = function (x, y) {
    var n = 0, k, o;
    for (k = 0; k < this.agents.length; k++) {
      o = this.agents[k];
      if ((o.kind === "dev" || o.kind === "consultant") &&
          Math.abs(o.x - x) <= 2 && Math.abs(o.y - y) <= 2) n++;
    }
    return n;
  };

  Ecosystem.prototype.patchUncertainty = function (x, y) {
    var fb = this.get(this.feedback, x, y);
    var tk = this.get(this.task, x, y);
    var hy = this.get(this.hyphae, x, y);
    var miss = this.forecastMissCurrent();
    var raw = 1 + fb / 22 + tk / 35 + Math.max(0, 1 - hy / 45) * 2.2 + miss * 0.9;
    return Math.min(5, Math.max(1, raw));
  };

  Ecosystem.prototype.patchConflictRisk = function (x, y) {
    var db = this.get(this.debt, x, y);
    var load = this.localWorkerLoad(x, y);
    var recovery = (this.recoveryTicksRemaining || 0) > 0;
    var raw = 1 + db / 28 + load * 0.55 + (recovery ? 1.8 : 0) +
      (this.forecastMissCurrent() > 0.65 ? 0.8 : 0);
    return Math.min(5, Math.max(1, raw));
  };

  Ecosystem.prototype.unevenLocalLoad = function (x, y) {
    var loads = [], i, lx, ly, mine;
    for (i = 0; i < W * H; i++) {
      lx = i % W; ly = (i / W) | 0;
      loads.push(this.localWorkerLoad(lx, ly) + this.get(this.task, lx, ly) / 40);
    }
    mine = this.localWorkerLoad(x, y) + this.get(this.task, x, y) / 40;
    var sum = 0, minL = loads[0], maxL = loads[0], j;
    for (j = 0; j < loads.length; j++) {
      sum += loads[j];
      if (loads[j] < minL) minL = loads[j];
      if (loads[j] > maxL) maxL = loads[j];
    }
    return mine > (sum / loads.length) * 1.35 || (maxL - minL) > 2.5;
  };

  // Manifesto §12 — escalation routing for Collaborative Concurrent Extreme.
  Ecosystem.prototype.cceMode = function (a) {
    var x = a.x, y = a.y;
    var u = this.patchUncertainty(x, y);
    var c = this.patchConflictRisk(x, y);
    var db = this.get(this.debt, x, y);
    var tk = this.get(this.task, x, y);
    var hy = this.get(this.hyphae, x, y);
    var recovery = (this.recoveryTicksRemaining || 0) > 0;
    var routineSmall = tk < 18 && u < 2.4 && c < 2.5;
    var rotPressure = this.debtPatrolActive();

    if (rotPressure && (db < 28 || (a.id + this.tick) % 5 === 0)) return "debt_patrol";
    if (recovery || db > 45 || (db > 32 && tk < 18) || c >= 4.2) return "swarm_blockers";
    if (u >= 4 && tk > 22) return "set_based";
    if (u >= 2.8 || (hy < 22 && tk > 28)) return "pair";
    if (routineSmall && this.unevenLocalLoad(x, y)) return "least_loaded";
    if (this.unevenLocalLoad(x, y)) return "work_stealing";
    if (u <= 2 && c <= 2.2) return "solo_serial";
    return "least_loaded";
  };

  Ecosystem.prototype.cceHyMult = function (a) {
    var mode = this.cceMode(a);
    if (mode === "debt_patrol") return 0.65;
    if (mode === "solo_serial") return 0.5;
    if (mode === "least_loaded") return 0.85;
    if (mode === "work_stealing") return 1.2;
    if (mode === "pair") return 1.4;
    if (mode === "swarm_blockers") return 1.1;
    if (mode === "set_based") return 1;
    return 0.9;
  };

  Ecosystem.prototype.cceScopeMult = function (a) {
    var mode = this.cceMode(a);
    if (mode === "set_based") return 1.3;
    if (mode === "pair") return 1.1;
    if (mode === "swarm_blockers") return 1.2;
    return 1;
  };

  Ecosystem.prototype.cceParticipants = function (a) {
    var mode = this.cceMode(a);
    if (mode === "pair") return this.adjacentWorker(a) ? 2 : 1;
    if (mode === "swarm_blockers") {
      var n = 0, k, o;
      for (k = 0; k < this.agents.length; k++) {
        o = this.agents[k];
        if (o.kind === "dev" && Math.abs(o.x - a.x) <= 2) n++;
      }
      return Math.min(4, 1 + n * 0.5);
    }
    if (mode === "set_based") return 3;
    return 1;
  };

  Ecosystem.prototype.cceTargetFor = function (a) {
    var mode = this.cceMode(a);
    var self = this;
    if (mode === "debt_patrol") return this.debtPatrolStep(a);
    if (mode === "swarm_blockers") {
      var h = this.debtRotTarget(a);
      return this.stepToward(a.x, a.y, h[0], h[1], 2, function (x, y) {
        return self.get(self.debt, x, y) * 1.1 + self.get(self.task, x, y) * 0.35 -
          self.localWorkerLoad(x, y) * 5 - (Math.abs(x - h[0]) + Math.abs(y - h[1])) * 0.2;
      });
    }
    if (mode === "pair") {
      var mate = null, m2;
      for (m2 = 0; m2 < this.agents.length; m2++) {
        if (this.agents[m2].id === a.mate) { mate = this.agents[m2]; break; }
      }
      if (mate) {
        var mx2 = ((a.x + mate.x) / 2) | 0;
        var my2 = ((a.y + mate.y) / 2) | 0;
        return this.bestStep(a.x, a.y, function (x, y) {
          return self.get(self.task, x, y) + self.get(self.hyphae, x, y) * 0.4 -
            (Math.abs(x - mx2) + Math.abs(y - my2)) * 0.5;
        });
      }
    }
    if (mode === "set_based") {
      return this.bestStep(a.x, a.y, function (x, y) {
        return self.get(self.task, x, y) * 0.8 + self.get(self.feedback, x, y) * 0.5 +
          ((a.id + x + y) % 3 === 0 ? 8 : 0);
      });
    }
    if (mode === "least_loaded") {
      return this.bestStep(a.x, a.y, function (x, y) {
        var localLoad = self.localWorkerLoad(x, y);
        return self.get(self.task, x, y) - localLoad * 5 + self.get(self.feature, x, y) * 0.1;
      });
    }
    if (mode === "solo_serial") {
      return this.bestStep(a.x, a.y, function (x, y) {
        return self.get(self.task, x, y) - self.get(self.hyphae, x, y) * 0.3;
      });
    }
    return this.stepToward(a.x, a.y, null, null, 2, this.scoreForage(a));
  };

  Ecosystem.prototype.targetFor = function (a) {
    var pat = PATTERNS[this.pattern] || PATTERNS.cce;
    var self = this;
    if (this.pattern === "cce") return this.cceTargetFor(a);
    if (this.debtPatrolActive() && (a.id + this.tick) % 3 === 0) {
      return this.debtPatrolStep(a);
    }
    if (this.pattern === "nobody") return [a.x, a.y];
    if (this.pattern === "everybody") return this.hotspot();
    if (this.pattern === "solo_serial") {
      return this.stepToward(a.x, a.y, null, null, 2, this.scoreForage(a));
    }
    if (this.pattern === "round_robin") {
      return this.bestStep(a.x, a.y, function (x, y) {
        return self.get(self.task, x, y) + (self.debtPatrolActive() ? self.get(self.debt, x, y) * 0.4 : 0);
      });
    }
    if (this.pattern === "least_loaded") {
      return this.stepToward(a.x, a.y, null, null, 2, function (x, y) {
        var localLoad = self.localWorkerLoad(x, y);
        return self.get(self.task, x, y) - localLoad * 5 + self.get(self.feature, x, y) * 0.1 +
          self.get(self.debt, x, y) * (self.debtPatrolActive() ? 0.5 : 0);
      });
    }
    if (this.pattern === "set_based") {
      return this.bestStep(a.x, a.y, function (x, y) {
        return self.get(self.task, x, y) * 0.8 + self.get(self.feedback, x, y) * 0.5 +
          ((a.id + x + y) % 3 === 0 ? 8 : 0);
      });
    }
    if (this.pattern === "pair") {
      var mate = null, k;
      for (k = 0; k < this.agents.length; k++) {
        if (this.agents[k].id === a.mate) { mate = this.agents[k]; break; }
      }
      if (mate) {
        var mx = ((a.x + mate.x) / 2) | 0;
        var my = ((a.y + mate.y) / 2) | 0;
        return this.stepToward(a.x, a.y, mx, my, 2, function (x, y) {
          return self.get(self.task, x, y) + self.get(self.hyphae, x, y) * 0.4 -
            (Math.abs(x - mx) + Math.abs(y - my)) * 0.5 + self.get(self.debt, x, y) * 0.35;
        });
      }
    }
    if (this.pattern === "swarm_blockers") {
      var h2 = this.debtRotTarget(a);
      return this.stepToward(a.x, a.y, h2[0], h2[1], 2, function (x, y) {
        return self.get(self.debt, x, y) * 1.05 + self.get(self.task, x, y) * 0.4 -
          self.localWorkerLoad(x, y) * 4;
      });
    }
    return this.stepToward(a.x, a.y, null, null, 2, this.scoreForage(a));
  };

  Ecosystem.prototype.tickFeedback = function () {
    var i, fb, hy, tk, spawn;
    for (i = 0; i < W * H; i++) {
      fb = this.feedback[i];
      hy = this.hyphae[i];
      tk = this.task[i];
      if (fb > 25 && hy > 10) {
        spawn = Math.min(40, fb * 0.35);
        this.task[i] = Math.min(100, tk + spawn);
        this.feedback[i] = Math.max(0, fb - spawn * 0.5);
      } else if (fb > 40) {
        this.task[i] = Math.min(100, tk + 12);
        this.feedback[i] = Math.max(0, fb - 12);
      }
    }
  };

  Ecosystem.prototype.tickHyphaeLife = function () {
    var next = new Float32Array(W * H);
    var i, x, y, hy, nHy, featN, j, nx, ny;
    for (i = 0; i < W * H; i++) {
      x = i % W; y = (i / W) | 0;
      hy = this.hyphae[i];
      nHy = 0; featN = 0;
      var neigh = this.neighbors(x, y);
      for (j = 0; j < neigh.length; j++) {
        nx = neigh[j][0]; ny = neigh[j][1];
        nHy += this.get(this.hyphae, nx, ny);
        if (this.get(this.feature, nx, ny) >= 15) featN++;
      }
      if (hy > 0 && featN >= 2 && nHy >= 20) next[i] = Math.min(100, hy + 2);
      else if (hy > 0 && nHy < 10) next[i] = Math.max(0, hy - 3);
      else if (hy === 0 && nHy >= 30) next[i] = 8;
      else next[i] = Math.max(0, hy - 0.5);
    }
    this.hyphae = next;
  };

  Ecosystem.prototype.tickDebtEcology = function () {
    var miss = this.forecastMissCurrent();
    var inHouseRate = (STRATEGIC_RATES[this.investment] || 38) * 0.65;
    var stratRelief = inHouseRate / (W * H) * 0.12;
    var neglectMult = this.pattern === "nobody" ? 2.2 :
      this.pattern === "solo_serial" ? 1.35 :
      this.pattern === "round_robin" ? 1.2 :
      this.pattern === "everybody" ? 1.15 : 1;
    var investPressure = this.investment === "tight" ? 1.25 :
      this.investment === "loose" ? 0.88 : 1;
    var i, x, y, d, nDebt, j, unplanned, spread, relief, delta, newD, accruedTick = 0;

    if (miss > 0.9 && Math.random() < 0.18) {
      this.depositField("debt", miss * 14);
      this.debtAccrued += miss * 14;
    }

    for (i = 0; i < W * H; i++) {
      x = i % W; y = (i / W) | 0;
      d = this.debt[i];
      nDebt = 0;
      var neigh = this.neighbors(x, y);
      for (j = 0; j < neigh.length; j++) {
        if (this.get(this.debt, neigh[j][0], neigh[j][1]) >= 22) nDebt++;
      }
      unplanned = d >= 98 ? 0 :
        (0.035 * this.usage + miss * 0.03) * neglectMult * investPressure;
      if (this.get(this.feedback, x, y) > 35 && d < 25) unplanned += 0.12;
      spread = d >= 98 ? 0 :
        (nDebt >= 3 && this.usage >= 0.9) ? 1.8 * this.usage :
        (nDebt >= 2 && d > 12) ? 0.35 :
        (d > 40 && nDebt < 1) ? 0.06 : 0;
      relief = stratRelief +
        ((this.pattern === "swarm_blockers" || this.pattern === "cce") && d > 30 ? 0.04 : 0);
      delta = unplanned + spread - relief;
      newD = Math.min(100, Math.max(0, d + delta));
      if (delta > 0) accruedTick += delta;
      this.debt[i] = newD;
    }
    this.debtAccrued += accruedTick;
    var w = this.debtWeight();
    if (w > this.debtWeightPeak) this.debtWeightPeak = w;
  };

  Ecosystem.prototype.moveConsumers = function () {
    var self = this;
    this.agents.forEach(function (a) {
      if (a.kind !== "consumer") return;
      var step = self.bestStep(a.x, a.y, function (x, y) {
        return self.get(self.feature, x, y) * 1.2 + self.get(self.feedback, x, y) * 0.3 - self.get(self.debt, x, y) * 0.4;
      });
      a.x = step[0]; a.y = step[1];
      var feat = self.get(self.feature, a.x, a.y);
      var eaten = Math.min(18, feat);
      self.set(self.feature, a.x, a.y, feat - eaten);
      self.set(self.feedback, a.x, a.y, self.get(self.feedback, a.x, a.y) + eaten * 0.4);
      var eatenDebt = eaten * 0.25 * self.usage;
      self.set(self.debt, a.x, a.y, self.get(self.debt, a.x, a.y) + eatenDebt);
      self.debtAccrued += eatenDebt;
      if (Math.random() < (self.usage > 1 ? 0.04 : 0.015) * (self.market === "bull" ? 1.3 : self.market === "bear" ? 0.7 : 1)) {
        var nb = self.neighbors(a.x, a.y);
        var cell = nb[Math.floor(Math.random() * nb.length)] || [a.x, a.y];
        self.set(self.task, cell[0], cell[1], self.get(self.task, cell[0], cell[1]) + 15);
      }
    });
  };

  Ecosystem.prototype.moveWorkers = function () {
    if (this.pattern === "nobody") return;
    var self = this;
    var pat = PATTERNS[this.pattern] || PATTERNS.cce;
    this.agents.forEach(function (a) {
      if (a.kind !== "dev" && a.kind !== "consultant") return;
      var step = self.targetFor(a);
      a.x = step[0]; a.y = step[1];
      var tk = self.get(self.task, a.x, a.y);
      var db = self.get(self.debt, a.x, a.y);
      var mult = a.kind === "consultant" ? 0.65 : 1;
      var weight = self.debtWeight();
      var globalSlow = Math.max(0.25, 1 - weight) * (self.recoveryPenalty || 1);
      var pairMult = self.pairComplexityBonus(a.x, a.y);
      var hyMult = self.pattern === "cce" ? self.cceHyMult(a) : pat.hyMult;
      var scopeMult = self.pattern === "cce" ? self.cceScopeMult(a) : pat.scopeMult;
      var billMult = self.pattern === "cce" ? self.cceParticipants(a) : pat.participants;
      if (tk > 8 && !self.shouldPayDebt(a, tk, db)) {
        var yld = Math.min(22, tk * 0.35) * (1 - Math.min(0.55, db / 100)) * globalSlow * mult * self.peopleMult(a) * pairMult;
        self.set(self.task, a.x, a.y, tk - yld);
        self.set(self.feature, a.x, a.y, self.get(self.feature, a.x, a.y) + yld * 0.85);
        if (yld > 3) self.changeAttempts++;
        var hy = 6 * hyMult * (self.adjacentWorker(a) ? 1.6 : 1) * (pairMult > 1 ? 1.1 : 1);
        self.set(self.hyphae, a.x, a.y, self.get(self.hyphae, a.x, a.y) + hy);
        if (self.adjacentWorker(a)) self.collabEvents++;
        var scope = (a.kind === "consultant" ? 0.35 : 0.12) * scopeMult;
        if (Math.random() < scope) {
          var nb = self.neighbors(a.x, a.y);
          var cell = nb[Math.floor(Math.random() * nb.length)];
          var miss = self.forecastMissCurrent();
          if (Math.random() < 0.12 + miss * 0.08) {
            self.set(self.debt, cell[0], cell[1], self.get(self.debt, cell[0], cell[1]) + 12);
            self.debtAccrued += 12;
          } else {
            self.set(self.task, cell[0], cell[1], self.get(self.task, cell[0], cell[1]) + 12);
          }
        }
        a.bill += Math.max(Q, yld * 0.08) * billMult;
      } else if (db > 16 && self.shouldPayDebt(a, tk, db)) {
        var fix2 = Math.min(22, db * (self.debtPatrolActive() ? 0.28 : 0.22));
        self.set(self.debt, a.x, a.y, db - fix2);
        self.debtPaid += fix2;
        a.bill += Math.max(Q, fix2 * 0.04) * billMult;
      } else if (db > 28 && (self.pattern === "swarm_blockers" || self.pattern === "cce" || self.pattern === "pair")) {
        var fix = Math.min(15, db * 0.2);
        self.set(self.debt, a.x, a.y, db - fix);
        self.debtPaid += fix;
        a.bill += Math.max(Q, fix * 0.04) * billMult;
      }
    });
  };

  Ecosystem.prototype.adjacentWorker = function (a) {
    var k, o;
    for (k = 0; k < this.agents.length; k++) {
      o = this.agents[k];
      if (o === a || (o.kind !== "dev" && o.kind !== "consultant")) continue;
      if (Math.abs(o.x - a.x) <= 1 && Math.abs(o.y - a.y) <= 1) return true;
    }
    return false;
  };

  Ecosystem.prototype.tickPeople = function () {
    var self = this;
    var fruit = this.fruitingScore();
    this.agents.forEach(function (a) {
      if (a.kind !== "dev" && a.kind !== "consultant") return;
      var localHy = self.get(self.hyphae, a.x, a.y);
      var localDebt = self.get(self.debt, a.x, a.y);
      var collab = self.adjacentWorker(a) ? 1 : 0;
      var expGain = 0.002 * localHy / 50 * (1 + collab) + fruit * 0.001;
      var morDelta = 0;
      if (self.pattern === "nobody") morDelta = -0.004;
      else if (self.pattern === "everybody" && !collab) morDelta = -0.003;
      else if (localHy > 20 && collab) morDelta = 0.003;
      else if (localDebt > 40) morDelta = -0.002;
      else if (fruit > 0.02) morDelta = 0.002;
      else morDelta = -0.0005;
      var stratBoost = self.strategicInHouse / (280 * 200) * 0.5;
      a.experience = Math.min(1, Math.max(0.1, (a.experience || 0.5) + expGain + stratBoost * 0.01));
      a.morale = Math.min(1, Math.max(0.1, (a.morale || 0.5) + morDelta));
    });
  };

  Ecosystem.prototype.tickCosts = function () {
    var heads = 0, k;
    for (k = 0; k < this.agents.length; k++) {
      if (this.agents[k].kind === "dev" || this.agents[k].kind === "consultant") heads++;
    }
    var wage = MARKET_WAGE[this.market] || 1;
    if (this.market === "volatile") wage = 0.95 + Math.random() * 0.2;
    var world = 1 + this.usage * 0.12;
    this.operativeEur += heads * OPERATIVE_PER_HEAD * wage * world;
    var stratRate = STRATEGIC_RATES[this.investment] || 38;
    var marketSlice = stratRate * 0.35 * marketRoi(this.market);
    var inHouseSlice = stratRate * 0.65;
    var gap = Math.max(0, this.marketSkill() - this.avgExperience());
    var strategic = (marketSlice + inHouseSlice) * (1 + gap * 0.4);
    this.strategicEur += strategic;
    this.strategicInHouse += inHouseSlice;
  };

  Ecosystem.prototype.step = function () {
    this.tickRecovery();
    this.tickMarketDrift();
    this.tickMarketing();
    this.tickLeadConversion();
    this.tickRandomEvents();
    this.tickFeedback();
    this.moveConsumers();
    this.moveWorkers();
    this.tickPeople();
    this.tickCosts();
    this.tickHyphaeLife();
    this.tickDebtEcology();
    this.tickPredictions();
    this.updateFlowMetrics();
    this.recordTick();
    var bill = 0, k;
    for (k = 0; k < this.agents.length; k++) bill += this.agents[k].bill || 0;
    this.billable = bill;
  };

  Ecosystem.prototype.isTailScenario = function () {
    return this.pattern === "nobody" || this.pattern === "everybody" ||
      this.usage >= 1.05 || (this.market === "volatile" && this.forecastMissPeak > 0.7);
  };

  Ecosystem.prototype.isOperatingBand = function () {
    return this.usage >= 0.55 && this.usage <= 0.92 &&
      this.pattern !== "nobody" && this.pattern !== "everybody";
  };

  Ecosystem.prototype.flowStationarityFactor = function (t) {
    if (t.recoveryActive) return 0.5;
    if (t.littleLawStable) return 1;
    var miss = t.forecastMiss || 0;
    if (miss < 0.9) return 0.88;
    if (miss < 2.0) return 0.72;
    if (miss < 3.5) return 0.58;
    return 0.45;
  };

  Ecosystem.prototype.flowVelocityFactor = function (v, feature, tick) {
    if (tick > 40 && v < 0.004 && feature > 600) {
      v = Math.max(v, feature / tick * 0.1);
    }
    if (v >= 0.08) return 1;
    if (v >= 0.03) return 0.88;
    if (v >= 0.012) return 0.72;
    if (v >= 0.004) return 0.55;
    return 0.38;
  };

  Ecosystem.prototype.flowLeadFactor = function (t) {
    var throughput = Math.max(t.featureVelocity, 0.006);
    var wip = Math.max(t.task, 1);
    var drainTicks = wip / (throughput * 320);
    if (drainTicks < 2.5) return 1;
    if (drainTicks < 6) return 0.82;
    if (drainTicks < 12) return 0.62;
    return 0.4;
  };

  Ecosystem.prototype.productHealth = function (t) {
    t = t || this.totals();
    var burnRatio = t.monthBenchSpend / Math.max(t.monthlyRedLine, 1);
    var paidRatio = t.debtPaid / Math.max(t.debtAccrued, 1);

    var service = Math.min(1, Math.max(0,
      (t.customerMood >= 0.72 ? 1 : t.customerMood >= 0.58 ? 0.8 : t.customerMood >= 0.42 ? 0.5 : 0.15) *
      (burnRatio <= 0.78 ? 1 : burnRatio <= 1 ? 0.6 : 0.25) *
      (t.monthsOverBudget === 0 ? 1 : 0.65)
    ));

    var ecology = Math.min(1, Math.max(0,
      (t.quality >= 0.04 ? Math.min(1, t.quality * 11) : 0.12) *
      (1 - Math.min(0.78, t.debtWeight * 0.82)) *
      (paidRatio > 0.015 || t.debtWeight < 0.52 ? 1 : 0.72)
    ));

    var flow = Math.min(1, Math.max(0,
      this.flowStationarityFactor(t) *
      this.flowVelocityFactor(t.featureVelocity, t.feature, this.tick) *
      this.flowLeadFactor(t)
    ));

    var boundedConcurrency = this.pattern === "cce" || this.pattern === "pair" ||
      this.pattern === "work_stealing" || this.pattern === "swarm_blockers" ||
      this.pattern === "least_loaded" || this.pattern === "round_robin" ||
      this.pattern === "set_based" || this.pattern === "solo_serial";

    var team = Math.min(1, Math.max(0,
      (boundedConcurrency ? 0.92 : 0.12) *
      (1 - Math.min(1, t.psych / 1.25)) *
      (t.morale >= 0.52 ? 1 : t.morale >= 0.42 ? 0.78 : 0.5) *
      (t.hyphae > 120 ? 1 : t.hyphae > 40 ? 0.72 : 0.45) *
      (t.experience >= 0.42 ? 1 : t.experience >= 0.32 ? 0.75 : 0.55)
    ));

    var reliability = Math.min(1, Math.max(0,
      (1 - Math.min(1, t.syntheticCfr / 0.22)) *
      (t.mttrAvg <= 14 || t.events === 0 ? 1 : t.mttrAvg <= 22 ? 0.78 : 0.48) *
      (t.recoveryActive ? 0.5 : 1)
    ));

    var learning = Math.min(1, Math.max(0,
      (1 - Math.min(1, t.predictionErrorAvg / 0.82)) *
      (t.predictionIntelligence >= 0.52 ? 1 : t.predictionIntelligence >= 0.36 ? 0.78 : 0.55) *
      (t.iqOverOutside >= 0.25 || t.iqOverOutsideScores < 2 ? 1 : 0.72)
    ));

    var lanes = {
      service: service,
      ecology: ecology,
      flow: flow,
      team: team,
      reliability: reliability,
      learning: learning
    };

    var index = service * 0.22 + ecology * 0.2 + flow * 0.16 + team * 0.18 +
      reliability * 0.12 + learning * 0.12;
    var tail = this.isTailScenario();
    var operating = this.isOperatingBand();

    var label;
    if (tail) label = "tail — rare stress";
    else if (index >= 0.64 && service >= 0.5 && ecology >= 0.38 && flow >= 0.32) label = "healthy";
    else if (index >= 0.52) label = "guarded";
    else if (index >= 0.36) label = "stressed";
    else label = "critical";

    return {
      index: index,
      label: label,
      lanes: lanes,
      tail: tail,
      operating: operating,
      serviceFulfilled: service >= 0.5 && t.customerMood >= 0.42,
      concurrencyOk: team >= 0.48 && boundedConcurrency,
      contrastReady: t.hyphae > 120 && (this.pattern === "set_based" || t.experience >= 0.45)
    };
  };

  Ecosystem.prototype.totals = function () {
    var i, feat = 0, task = 0, debt = 0, hy = 0;
    for (i = 0; i < W * H; i++) {
      feat += this.feature[i];
      task += this.task[i];
      debt += this.debt[i];
      hy += this.hyphae[i];
    }
    var consumers = 0;
    this.agents.forEach(function (a) { if (a.kind === "consumer") consumers++; });
    var qual = feat / Math.max(feat + debt * 1.2, 1);
    var benchC = this.benchCost();
    var cfr = Math.min(1, this.surpriseEvents / Math.max(this.changeAttempts, 1));
    var mttrAvg = (this.recoveryTicksTotal || 0) / Math.max(this.incidentsResolved || 0, 1);
    var base = {
      feature: feat, task: task, debt: debt, hyphae: hy, consumers: consumers,
      quality: qual, cost: benchC,
      operative: this.operativeEur,
      strategic: this.strategicEur,
      totalCost: benchC + this.operativeEur + this.strategicEur,
      leads: this.leads,
      forecastMiss: this.forecastMissPeak,
      events: this.surpriseEvents,
      featureVelocity: this.featureVelocity,
      leadTime: this.leadTime,
      syntheticCfr: cfr,
      mttrAvg: mttrAvg,
      changeAttempts: this.changeAttempts,
      recoveryActive: (this.recoveryTicksRemaining || 0) > 0,
      littleLawStable: this.littleLawStable(),
      psych: this.psychStress(),
      iqOverOutside: this.iqOverOutsideAvg,
      iqOverOutsideScores: this.iqOverOutsideScores,
      outsideViewError: this.outsideViewErrorAvg,
      experience: this.avgExperience(),
      morale: this.avgMorale(),
      debtWeight: this.debtWeight(),
      debtAccrued: this.debtAccrued,
      debtPaid: this.debtPaid,
      customerMood: this.customerMood,
      customerMoodLabel: customerMoodLabel(this.customerMood),
      monthBenchSpend: this.monthBenchSpend,
      monthlyRedLine: this.monthlyRedLine,
      monthsOverBudget: this.monthsOverBudget,
      devRate: this.devRate,
      consultantRate: this.consultantRate,
      predictionIntelligence: this.predictionIntelligence,
      intelligencePeak: this.intelligencePeak,
      predLeads: this.predLeads,
      predConsumers: this.predConsumers,
      predBenchMonth: this.predBenchMonth,
      predMarket: this.predMarket,
      teamPredictionMiss: this.teamPredictionMissPeak,
      predictionErrorAvg: this.predictionErrorAvg
    };
    base.health = this.productHealth(base);
    return base;
  };

  function drawEcosystem(ctx, eco, cw, ch) {
    var cellW = cw / W;
    var cellH = ch / H;
    var i, x, y, f, t, d, h, r, g, b, a;

    ctx.fillStyle = "#0a1416";
    ctx.fillRect(0, 0, cw, ch);

    for (i = 0; i < W * H; i++) {
      x = i % W; y = (i / W) | 0;
      h = eco.hyphae[i] / 100;
      d = eco.debt[i] / 100;
      f = eco.feature[i] / 100;
      t = eco.task[i] / 100;
      if (h < 0.02 && d < 0.02 && f < 0.02 && t < 0.02) continue;
      r = Math.min(255, d * 180 + t * 80);
      g = Math.min(255, f * 140 + h * 90);
      b = Math.min(255, h * 160 + f * 40);
      a = 0.25 + Math.max(h, d, f, t) * 0.55;
      ctx.fillStyle = "rgba(" + (r | 0) + "," + (g | 0) + "," + (b | 0) + "," + a + ")";
      ctx.fillRect(x * cellW, y * cellH, cellW + 0.5, cellH + 0.5);
    }

    eco.agents.forEach(function (ag) {
      var px = (ag.x + 0.5) * cellW;
      var py = (ag.y + 0.5) * cellH;
      if (ag.kind === "consumer") {
        ctx.fillStyle = "rgba(255, 200, 80, 0.9)";
        ctx.beginPath();
        ctx.moveTo(px, py - 3);
        ctx.lineTo(px + 3, py + 2);
        ctx.lineTo(px - 3, py + 2);
        ctx.fill();
      } else if (ag.kind === "consultant") {
        ctx.fillStyle = "#b090d0";
        ctx.fillRect(px - 2, py - 2, 4, 4);
      } else {
        var mor = ag.morale || 0.5;
        var alpha = 0.55 + mor * 0.45;
        ctx.fillStyle = PATTERNS[eco.pattern].color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(px, py, 2 + mor, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });

    if (eco.pattern !== "nobody" && eco.pattern !== "solo_serial") {
      ctx.strokeStyle = "rgba(61, 138, 142, 0.15)";
      ctx.lineWidth = 1;
      eco.agents.forEach(function (a) {
        if (a.kind !== "dev") return;
        eco.agents.forEach(function (b) {
          if (b.kind !== "dev" || b.id <= a.id) return;
          if (Math.abs(a.x - b.x) <= 2 && Math.abs(a.y - b.y) <= 2) {
            ctx.beginPath();
            ctx.moveTo((a.x + 0.5) * cellW, (a.y + 0.5) * cellH);
            ctx.lineTo((b.x + 0.5) * cellW, (b.y + 0.5) * cellH);
            ctx.stroke();
          }
        });
      });
    }
  }

  function initCanvas() {
    var canvas = document.getElementById("bench-canvas");
    if (!canvas || REDUCED) return;
    var ctx = canvas.getContext("2d");
    var w, h, t = 0;
    function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
    resize();
    window.addEventListener("resize", resize);
    (function loop() {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(61, 138, 142, 0.06)";
      var sp = 40, off = (t * 0.1) % sp;
      var xi, yi;
      for (yi = off; yi < h; yi += sp) { ctx.beginPath(); ctx.moveTo(0, yi); ctx.lineTo(w, yi); ctx.stroke(); }
      for (xi = off; xi < w; xi += sp * 1.3) { ctx.beginPath(); ctx.moveTo(xi, 0); ctx.lineTo(xi, h); ctx.stroke(); }
      t++;
      requestAnimationFrame(loop);
    })();
  }

  function drawPredictionChart(canvas, eco) {
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var w = canvas.clientWidth || canvas.width;
    var h = canvas.clientHeight || canvas.height;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(12, 28, 30, 0.9)";
    ctx.fillRect(0, 0, w, h);

    var hist = eco.predHistory;
    if (!hist.length) {
      ctx.fillStyle = "#9ab4b8";
      ctx.font = "11px monospace";
      ctx.fillText("month closes score prediction vs actual — intelligence builds from experience · hyphae · strategic spend", 8, h / 2);
      return;
    }

    var n = hist.length;
    var i, x, y;
    var pad = 6;
    var mid = h * 0.5;

    ctx.strokeStyle = "rgba(196, 68, 68, 0.35)";
    ctx.beginPath();
    ctx.moveTo(pad, mid);
    ctx.lineTo(w - pad, mid);
    ctx.stroke();

    for (i = 0; i < n; i++) {
      x = pad + (w - pad * 2) * (i / Math.max(n - 1, 1));
      y = mid - hist[i].iq * (mid - pad);
      ctx.fillStyle = "#3d8a8e";
      if (i === 0) { ctx.beginPath(); ctx.moveTo(x, y); }
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "#3d8a8e";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    for (i = 0; i < n; i++) {
      x = pad + (w - pad * 2) * (i / Math.max(n - 1, 1));
      y = mid + Math.min(1, hist[i].err) * (mid - pad);
      ctx.fillStyle = "#e05050";
      if (i === 0) { ctx.beginPath(); ctx.moveTo(x, y); }
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "#e05050";
    ctx.lineWidth = 1;
    ctx.stroke();

    var last = hist[n - 1];
    var maxC = Math.max(last.consumers, last.predConsumers, 1);
    ctx.fillStyle = "#8fd4b0";
    ctx.fillRect(w - pad - 50, pad, 8, (last.consumers / maxC) * (h - pad * 2));
    ctx.fillStyle = "rgba(184, 115, 51, 0.85)";
    ctx.fillRect(w - pad - 36, pad, 8, (last.predConsumers / maxC) * (h - pad * 2));

    ctx.fillStyle = "#9ab4b8";
    ctx.font = "10px monospace";
    ctx.fillText("IQ", pad, 10);
    ctx.fillText("err", pad, h - 4);
    ctx.fillText("act pred", w - pad - 52, 10);
  }

  function initBench() {
    var stage = document.getElementById("bench-stage");
    if (!stage) return;
    var dpr = window.devicePixelRatio || 1;
    var cw = stage.clientWidth;
    var ch = stage.clientHeight;
    stage.width = cw * dpr;
    stage.height = ch * dpr;
    var ctx = stage.getContext("2d");
    ctx.scale(dpr, dpr);

    var patternSel = document.getElementById("pattern-select");
    var marketSel = document.getElementById("market-select");
    var investmentSel = document.getElementById("investment-select");
    var marketingSel = document.getElementById("marketing-select");
    var devRateInput = document.getElementById("dev-rate");
    var consultantRateInput = document.getElementById("consultant-rate");
    var redLineInput = document.getElementById("monthly-redline");
    var scenarioBtns = document.querySelectorAll("[data-scenario]");
    var usageBtns = document.querySelectorAll("[data-usage]");
    var playBtn = document.getElementById("bench-play");
    var resetBtn = document.getElementById("bench-reset");
    var stepBackBtn = document.getElementById("bench-step-back");
    var stepFwdBtn = document.getElementById("bench-step-fwd");
    var speedSel = document.getElementById("bench-speed");
    var eventFeed = document.getElementById("event-feed");
    var predChart = document.getElementById("prediction-chart");
    var usage = 0.7;
    var running = false;
    var stepsPerFrame = 2;
    var history = [];
    var historyPos = -1;
    var maxHistory = 320;
    var activeScenario = "default";

    function climate() {
      return {
        market: marketSel ? marketSel.value : "sideways",
        investment: investmentSel ? investmentSel.value : "neutral",
        marketing: marketingSel ? parseFloat(marketingSel.value) : 0.5
      };
    }

    function pricing() {
      return {
        devRate: devRateInput ? parseFloat(devRateInput.value) || DEFAULT_DEV_RATE : DEFAULT_DEV_RATE,
        consultantRate: consultantRateInput ? parseFloat(consultantRateInput.value) || DEFAULT_CONSULTANT_RATE : DEFAULT_CONSULTANT_RATE,
        monthlyRedLine: redLineInput ? parseFloat(redLineInput.value) || 45000 : 45000
      };
    }

    var eco = new Ecosystem(patternSel ? normalizePattern(patternSel.value) : "cce", usage, climate(), pricing());
    function syncSpeed() {
      stepsPerFrame = speedSel ? Math.max(1, parseInt(speedSel.value, 10) || 2) : (REDUCED ? 1 : 2);
    }

    function seedHistory() {
      history = [eco.capture()];
      historyPos = 0;
    }

    function pushHistory() {
      if (historyPos < history.length - 1) history.length = historyPos + 1;
      history.push(eco.capture());
      historyPos = history.length - 1;
      if (history.length > maxHistory) {
        history.shift();
        historyPos--;
      }
    }

    function stepForward(n) {
      var i;
      n = n || 1;
      for (i = 0; i < n; i++) {
        eco.step();
        pushHistory();
      }
      render();
    }

    function stepBackward(n) {
      var i;
      n = n || 1;
      for (i = 0; i < n; i++) {
        if (historyPos <= 0) break;
        historyPos--;
        eco.loadCapture(history[historyPos]);
      }
      render();
    }

    function setPlaying(on) {
      running = on;
      if (playBtn) playBtn.textContent = running ? "Pause" : "Play";
      if (running) requestAnimationFrame(loop);
    }

    function applyCustomerMoodFromScenario() {
      var s = SCENARIOS[activeScenario];
      if (!s) return;
      if (s.customerMood != null) eco.customerMood = s.customerMood;
      eco.patronTierOverride = s.patronTier || null;
      eco.moodFloor = s.moodFloor != null ? s.moodFloor : null;
      eco.moodCeiling = s.moodCeiling != null ? s.moodCeiling : null;
    }

    syncSpeed();
    seedHistory();
    applyCustomerMoodFromScenario();

    var els = {
      feature: document.getElementById("m-feature"),
      task: document.getElementById("m-task"),
      debt: document.getElementById("m-debt"),
      debtWeight: document.getElementById("m-debt-weight"),
      leadTime: document.getElementById("m-lead-time"),
      cfr: document.getElementById("m-cfr"),
      mttr: document.getElementById("m-mttr"),
      hyphae: document.getElementById("m-hyphae"),
      consumers: document.getElementById("m-consumers"),
      leads: document.getElementById("m-leads"),
      forecast: document.getElementById("m-forecast"),
      events: document.getElementById("m-events"),
      cost: document.getElementById("m-cost"),
      opex: document.getElementById("m-opex"),
      strategic: document.getElementById("m-strategic"),
      total: document.getElementById("m-total"),
      experience: document.getElementById("m-experience"),
      morale: document.getElementById("m-morale"),
      qual: document.getElementById("m-qual"),
      customerMood: document.getElementById("m-customer-mood"),
      redline: document.getElementById("m-redline-readout"),
      redlineFill: document.getElementById("redline-fill"),
      devRate: document.getElementById("m-dev-rate"),
      consultantRate: document.getElementById("m-consultant-rate"),
      intelligence: document.getElementById("m-intelligence"),
      predError: document.getElementById("m-pred-error"),
      predReadout: document.getElementById("prediction-readout"),
      littleLawBanner: document.getElementById("little-law-banner"),
      tailBanner: document.getElementById("tail-scenario-banner"),
      healthLabel: document.getElementById("m-health-label"),
      healthIndex: document.getElementById("m-health-index"),
      healthLanes: document.getElementById("health-lanes"),
      triple: document.getElementById("triple-readout"),
      tick: document.getElementById("m-tick")
    };

    function updateMetrics() {
      var t = eco.totals();
      var q = t.quality >= 0.55 ? "high" : t.quality >= 0.35 ? "medium" : "low";
      if (els.feature) els.feature.textContent = Math.round(t.feature);
      if (els.task) els.task.textContent = Math.round(t.task);
      if (els.debt) els.debt.textContent = Math.round(t.debt);
      if (els.debtWeight) els.debtWeight.textContent = t.debtWeight.toFixed(2);
      if (els.leadTime) {
        els.leadTime.textContent = Math.round(t.leadTime) + (t.littleLawStable ? "" : " †");
        els.leadTime.parentElement.className = "metric-cell" + (t.littleLawStable ? "" : " danger");
      }
      if (els.littleLawBanner) {
        els.littleLawBanner.hidden = t.littleLawStable;
      }
      if (els.tailBanner) {
        els.tailBanner.hidden = !t.health.tail;
      }
      if (els.healthLabel) {
        els.healthLabel.textContent = t.health.label;
        els.healthLabel.parentElement.className = "metric-cell health-head " + (
          t.health.label === "healthy" ? "ok" :
          t.health.label.indexOf("tail") >= 0 ? "danger" :
          t.health.label === "critical" || t.health.label === "stressed" ? "danger" : ""
        );
      }
      if (els.healthIndex) {
        els.healthIndex.textContent = (t.health.index * 100).toFixed(0) + "%";
      }
      if (els.healthLanes) {
        var laneNames = ["service", "ecology", "flow", "team", "reliability", "learning"];
        var laneHtml = laneNames.map(function (name) {
          var v = t.health.lanes[name] || 0;
          return "<span class=\"health-lane\" title=\"" + name + "\"><i style=\"width:" +
            (v * 100).toFixed(0) + "%\"></i></span>";
        }).join("");
        els.healthLanes.innerHTML = laneHtml;
      }
      if (els.cfr) els.cfr.textContent = (t.syntheticCfr * 100).toFixed(0) + "%";
      if (els.mttr) els.mttr.textContent = t.mttrAvg.toFixed(1) + (t.recoveryActive ? " ↻" : "");
      if (els.hyphae) els.hyphae.textContent = Math.round(t.hyphae);
      if (els.consumers) els.consumers.textContent = t.consumers;
      if (els.leads) els.leads.textContent = Math.round(t.leads);
      if (els.forecast) els.forecast.textContent = t.forecastMiss.toFixed(2);
      if (els.events) els.events.textContent = t.events;
      if (els.cost) els.cost.textContent = "€" + Math.round(t.cost);
      if (els.opex) els.opex.textContent = "€" + Math.round(t.operative);
      if (els.strategic) els.strategic.textContent = "€" + Math.round(t.strategic);
      if (els.total) els.total.textContent = "€" + Math.round(t.totalCost);
      if (els.experience) els.experience.textContent = t.experience.toFixed(2);
      if (els.morale) els.morale.textContent = t.morale.toFixed(2);
      if (els.qual) els.qual.textContent = q;
      if (els.customerMood) {
        els.customerMood.textContent = t.customerMoodLabel + " (" + t.customerMood.toFixed(2) + ")";
        els.customerMood.parentElement.className = "metric-cell " + (
          t.customerMood >= 0.58 ? "ok" : t.customerMood < 0.42 ? "danger" : ""
        );
      }
      if (els.devRate) els.devRate.textContent = "€" + Math.round(t.devRate) + "/h";
      if (els.consultantRate) els.consultantRate.textContent = "€" + Math.round(t.consultantRate) + "/h";
      if (els.redline) {
        var pct = Math.round(t.monthBenchSpend / Math.max(t.monthlyRedLine, 1) * 100);
        els.redline.textContent = "€" + Math.round(t.monthBenchSpend) + " / €" + Math.round(t.monthlyRedLine) + " (" + pct + "%)";
      }
      if (els.redlineFill) {
        var fillPct = Math.min(150, t.monthBenchSpend / Math.max(t.monthlyRedLine, 1) * 100);
        els.redlineFill.style.width = fillPct + "%";
        els.redlineFill.classList.toggle("over-budget", fillPct > 100);
      }
      if (els.intelligence) {
        els.intelligence.textContent = t.predictionIntelligence.toFixed(2);
        els.intelligence.title = "65% signal model + 35% beat outside-view median (3-mo bench)";
        els.intelligence.parentElement.className = "metric-cell " + (
          t.predictionIntelligence >= 0.65 ? "ok" : t.predictionIntelligence < 0.4 ? "danger" : ""
        );
      }
      if (els.predError) els.predError.textContent = t.predictionErrorAvg.toFixed(2);
      if (els.predReadout) {
        els.predReadout.textContent =
          "pred month-end: " + Math.round(t.predConsumers) + " consumers (now " + t.consumers + ") · "
          + Math.round(t.predLeads) + " leads (now " + Math.round(t.leads) + ") · "
          + "€" + Math.round(t.predBenchMonth) + " bench (outside-view med €" + Math.round(eco.outsideViewBenchMedian()) + ") · "
          + "market → " + t.predMarket + " (live " + eco.market + ")"
          + (t.iqOverOutside ? " · IQ+outside " + t.iqOverOutside.toFixed(2) : "");
      }
      if (els.tick) els.tick.textContent = eco.tick;
      if (els.triple) {
        els.triple.textContent = "<gen " + eco.tick + ", €" + Math.round(t.cost) + " bench, " + t.customerMoodLabel + ", " + q + ">";
      }
      if (eventFeed) {
        eventFeed.innerHTML = eco.events.length
          ? eco.events.map(function (e) { return "<span class=\"event-chip\">" + e + "</span>"; }).join("")
          : "<span class=\"event-chip muted\">forecast holding — no surprises yet</span>";
      }
    }

    function render() {
      drawEcosystem(ctx, eco, cw, ch);
      drawPredictionChart(predChart, eco);
      updateMetrics();
    }

    function loop() {
      if (!running) return;
      var s;
      for (s = 0; s < stepsPerFrame; s++) {
        eco.step();
        pushHistory();
      }
      render();
      requestAnimationFrame(loop);
    }

    function apply() {
      setPlaying(false);
      eco = new Ecosystem(normalizePattern(patternSel.value), usage, climate(), pricing());
      applyCustomerMoodFromScenario();
      seedHistory();
      render();
    }

    function applyScenario(key) {
      var s = SCENARIOS[key];
      if (!s) return;
      activeScenario = key;
      if (devRateInput) devRateInput.value = s.devRate;
      if (consultantRateInput) consultantRateInput.value = s.consultantRate;
      if (redLineInput) redLineInput.value = s.monthlyRedLine;
      apply();
    }

    if (patternSel) patternSel.addEventListener("change", apply);
    if (marketSel) marketSel.addEventListener("change", apply);
    if (investmentSel) investmentSel.addEventListener("change", apply);
    if (marketingSel) marketingSel.addEventListener("change", apply);
    if (devRateInput) devRateInput.addEventListener("change", apply);
    if (consultantRateInput) consultantRateInput.addEventListener("change", apply);
    if (redLineInput) redLineInput.addEventListener("change", apply);
    scenarioBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        scenarioBtns.forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
        btn.setAttribute("aria-pressed", "true");
        applyScenario(btn.getAttribute("data-scenario"));
      });
    });
    usageBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        usageBtns.forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
        btn.setAttribute("aria-pressed", "true");
        usage = parseFloat(btn.getAttribute("data-usage"));
        apply();
      });
    });
    if (playBtn) {
      playBtn.addEventListener("click", function () {
        setPlaying(!running);
      });
    }
    if (stepFwdBtn) {
      stepFwdBtn.addEventListener("click", function () {
        setPlaying(false);
        stepForward(1);
      });
    }
    if (stepBackBtn) {
      stepBackBtn.addEventListener("click", function () {
        setPlaying(false);
        stepBackward(1);
      });
    }
    if (speedSel) {
      speedSel.addEventListener("change", function () {
        syncSpeed();
      });
    }
    if (resetBtn) resetBtn.addEventListener("click", apply);

    render();
    if (!REDUCED) setPlaying(true);
  }

  initCanvas();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initBench);
  else initBench();

  if (typeof globalThis !== "undefined") {
    globalThis.__BenchEcosystem = Ecosystem;
    globalThis.__BenchSCENARIOS = SCENARIOS;
  }
})();
