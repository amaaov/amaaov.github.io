(function () {
  "use strict";

  var canvas = document.getElementById("meter-canvas");
  if (!canvas) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ctx = canvas.getContext("2d");
  var width = 0;
  var height = 0;
  var scrollT = 0;
  var raf = 0;
  var points = [];
  var pointCount = reduced ? 48 : 120;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    points = [];
    for (var i = 0; i < pointCount; i += 1) {
      points.push({ x: (i / (pointCount - 1)) * width, y: height * 0.52, phase: Math.random() * Math.PI * 2 });
    }
  }

  function onScroll() {
    var doc = document.documentElement;
    var max = Math.max(1, doc.scrollHeight - doc.clientHeight);
    scrollT = doc.scrollTop / max;
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    var baseY = height * 0.52;
    var amp = reduced ? 6 : 14 + scrollT * 38;
    var ink = "rgba(109, 95, 140, 0.55)";
    var glow = "rgba(201, 162, 39, 0.35)";

    ctx.beginPath();
    for (var i = 0; i < points.length; i += 1) {
      var p = points[i];
      var t = scrollT;
      var wave =
        Math.sin(p.phase + i * 0.14 + t * 6) * amp * (0.25 + t * 0.75) +
        Math.sin(p.phase * 1.7 + t * 11) * amp * 0.18 * t;
      var y = baseY + wave;
      if (i === 0) ctx.moveTo(p.x, y);
      else ctx.lineTo(p.x, y);
    }
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    if (scrollT > 0.04) {
      ctx.beginPath();
      ctx.moveTo(width * 0.08, baseY);
      ctx.lineTo(width * (0.08 + scrollT * 0.72), baseY);
      ctx.strokeStyle = glow;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (!reduced) raf = requestAnimationFrame(draw);
  }

  function init() {
    resize();
    onScroll();
    draw();
    if (!reduced) {
      window.addEventListener("resize", function () {
        resize();
      });
      window.addEventListener("scroll", onScroll, { passive: true });
    }
  }

  init();
})();
