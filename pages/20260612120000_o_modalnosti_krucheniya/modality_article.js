(function () {
  var canvas = document.getElementById("plasma-canvas");
  if (!canvas) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var ctx = canvas.getContext("2d", { alpha: true });
  var w = 0;
  var h = 0;
  var time = 0;
  var imageData;
  var data;

  function resize() {
    w = Math.floor(window.innerWidth / 2);
    h = Math.floor(window.innerHeight / 2);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    imageData = ctx.createImageData(w, h);
    data = imageData.data;
  }

  function fluidPalette(t, x, y) {
    var swirl = Math.sin(x * 0.011 + t * 0.9) * Math.cos(y * 0.013 - t * 0.7);
    var paint = Math.sin(t * 0.35 + swirl * 2.4);

    var r = Math.sin(t * 0.18 + paint * 1.6 + 0.4) * 88 + 42;
    var g = Math.sin(t * 0.22 + paint * 1.3 + 2.1) * 72 + 18;
    var b = Math.sin(t * 0.16 + paint * 1.9 + 4.0) * 95 + 58;

    if (paint > 0.35) {
      r += 40;
      g += 12;
      b -= 18;
    }
    if (swirl < -0.2) {
      r -= 10;
      g += 35;
      b += 28;
    }

    return [r | 0, g | 0, b | 0];
  }

  function frame() {
    var i = 0;
    for (var y = 0; y < h; y++) {
      var ny = y / h;
      for (var x = 0; x < w; x++) {
        var nx = x / w;
        var v =
          Math.sin(x * 0.024 + time) +
          Math.sin(y * 0.028 + time * 1.15) +
          Math.sin((x + y) * 0.02 - time * 0.75) +
          Math.sin(Math.sqrt(x * x + y * y) * 0.045 + time * 0.55) +
          Math.sin(nx * 12.0 + ny * 8.0 + time * 0.4) * 0.45;
        var c = fluidPalette(v * 1.55 + time * 1.8, nx, ny);
        data[i++] = c[0];
        data[i++] = c[1];
        data[i++] = c[2];
        data[i++] = 210;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    time += 0.038;
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(frame);
})();

(function () {
  var root = document.querySelector(".source-doc");
  if (!root) return;

  var sourceFile = root.getAttribute("data-source");
  if (!sourceFile) return;

  var blocks = root.querySelectorAll(".source-block[data-start][data-end]");
  if (!blocks.length) return;

  fetch(sourceFile)
    .then(function (response) {
      if (!response.ok) throw new Error("source fetch failed");
      return response.text();
    })
    .then(function (text) {
      var lines = text.split("\n");
      blocks.forEach(function (block) {
        var start = parseInt(block.getAttribute("data-start"), 10);
        var end = parseInt(block.getAttribute("data-end"), 10);
        var code = block.querySelector("code");
        if (!code || !start || !end) return;
        code.textContent = lines.slice(start - 1, end).join("\n");
      });
    })
    .catch(function () {
      blocks.forEach(function (block) {
        var code = block.querySelector("code");
        if (code && !code.textContent) {
          code.textContent = "/* source unavailable: open " + sourceFile + " */";
        }
      });
    });
})();
