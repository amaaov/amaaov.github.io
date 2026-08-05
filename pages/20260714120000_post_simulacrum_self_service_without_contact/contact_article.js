/*
 * © Andrei Makarov / amaaov
 * Licensed under CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
 * SPDX-License-Identifier: CC-BY-4.0
 */

(function () {
  "use strict";

  function initCanvas() {
    var canvas = document.getElementById("parcel-canvas");
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var ctx = canvas.getContext("2d");
    var w = 0;
    var h = 0;
    var t = 0;

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      var scrollMax = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      var scroll = window.scrollY / scrollMax;

      for (var y = 0; y < h; y += 3) {
        var alpha = 0.015 + scroll * 0.02;
        ctx.fillStyle = "rgba(94, 184, 201, " + alpha + ")";
        ctx.fillRect(0, y, w, 1);
      }

      for (var i = 0; i < 4; i += 1) {
        var baseY = h * (0.2 + i * 0.22) + Math.sin(t * 0.006 + i * 1.7) * 8;
        ctx.beginPath();
        ctx.moveTo(0, baseY);
        for (var x = 0; x <= w; x += 24) {
          ctx.lineTo(x, baseY + Math.sin(x * 0.012 + t * 0.01 + i) * (4 + scroll * 6));
        }
        ctx.strokeStyle = "rgba(232, 93, 59, " + (0.06 + scroll * 0.05) + ")";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      t += 1;
      requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCanvas);
  } else {
    initCanvas();
  }
})();
