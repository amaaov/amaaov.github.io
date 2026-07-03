(function () {
  "use strict";

  var canvas = document.getElementById("meter-canvas");
  if (!canvas) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ctx = canvas.getContext("2d");
  var width = 0;
  var height = 0;
  var scrollT = 0;
  var cosmicT = 0;
  var raf = 0;
  var sampleCount = reduced ? 64 : 160;
  var modes = [];

  var SPECTRAL_INDEX = 0.96;
  var SILK_K = 13;
  var ACOUSTIC_PEAKS = [
    { k: 3.8, bump: 0.42, width: 1.6 },
    { k: 8.5, bump: 0.22, width: 2.0 },
    { k: 12.5, bump: 0.1, width: 2.4 },
  ];

  function buildModes() {
    modes = [];
    var maxK = reduced ? 10 : 16;
    for (var k = 1; k <= maxK; k += 1) {
      modes.push({
        k: k,
        phase: k * 1.61803398875 + 0.31,
        omega: 0.00035 + k * 0.00008,
      });
    }
  }

  function acousticAmplitude(k, imprint) {
    var tilt = Math.pow(k, SPECTRAL_INDEX - 1);
    var silk = Math.exp(-Math.pow(k / SILK_K, 2.1));
    var peaks = 1;
    for (var i = 0; i < ACOUSTIC_PEAKS.length; i += 1) {
      var p = ACOUSTIC_PEAKS[i];
      peaks += p.bump * Math.exp(-Math.pow((k - p.k) / p.width, 2));
    }
    return (tilt * silk * peaks * imprint) / Math.sqrt(k);
  }

  function waveAt(xNorm, imprint, time) {
    var y = 0;
    for (var i = 0; i < modes.length; i += 1) {
      var m = modes[i];
      var amp = acousticAmplitude(m.k, imprint);
      y += amp * Math.sin(m.k * xNorm * Math.PI * 2 + m.phase + time * m.omega * 60);
    }
    return y;
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    buildModes();
  }

  function onScroll() {
    var doc = document.documentElement;
    var max = Math.max(1, doc.scrollHeight - doc.clientHeight);
    scrollT = doc.scrollTop / max;
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    var baseY = height * 0.5;
    var imprint = 0.04 + scrollT * 0.96;
    var scale = (reduced ? 5 : 9) + scrollT * (reduced ? 10 : 22);
    var time = reduced ? 0 : cosmicT;

    var samples = [];
    for (var s = 0; s < sampleCount; s += 1) {
      var xNorm = s / (sampleCount - 1);
      samples.push({
        x: xNorm * width,
        y: baseY + waveAt(xNorm, imprint, time) * scale,
      });
    }

    ctx.beginPath();
    for (var j = 0; j < samples.length; j += 1) {
      if (j === 0) ctx.moveTo(samples[j].x, samples[j].y);
      else ctx.lineTo(samples[j].x, samples[j].y);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    var fill = ctx.createLinearGradient(0, baseY - scale * 2, 0, height);
    fill.addColorStop(0, "rgba(109, 95, 140, 0.07)");
    fill.addColorStop(1, "rgba(11, 10, 15, 0)");
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.beginPath();
    for (var n = 0; n < samples.length; n += 1) {
      if (n === 0) ctx.moveTo(samples[n].x, samples[n].y);
      else ctx.lineTo(samples[n].x, samples[n].y);
    }
    ctx.strokeStyle = "rgba(109, 95, 140, 0.5)";
    ctx.lineWidth = 1.15;
    ctx.stroke();

    if (imprint > 0.12) {
      ctx.beginPath();
      for (var h = 0; h < samples.length; h += 1) {
        var harmonicY = baseY + waveAt(samples[h].x / width, imprint * 0.55, time * 1.35) * scale * 0.28;
        if (h === 0) ctx.moveTo(samples[h].x, harmonicY);
        else ctx.lineTo(samples[h].x, harmonicY);
      }
      ctx.strokeStyle = "rgba(201, 162, 39, 0.22)";
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }

    if (scrollT > 0.05) {
      var horizonX = width * (0.06 + scrollT * 0.68);
      ctx.beginPath();
      ctx.moveTo(horizonX, baseY - scale * 1.4);
      ctx.lineTo(horizonX, baseY + scale * 1.4);
      ctx.strokeStyle = "rgba(201, 162, 39, " + (0.08 + scrollT * 0.18) + ")";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (!reduced) {
      cosmicT += 1;
      raf = requestAnimationFrame(draw);
    }
  }

  function init() {
    resize();
    onScroll();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  init();
})();
