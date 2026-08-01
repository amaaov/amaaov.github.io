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

    var r = Math.sin(t * 0.12 + paint * 1.1 + 0.6) * 18 + 14;
    var g = Math.sin(t * 0.15 + paint * 1.2 + 1.8) * 28 + 28;
    var b = Math.sin(t * 0.14 + paint * 1.5 + 3.4) * 55 + 72;

    if (paint > 0.35) {
      r += 8;
      g += 14;
      b += 28;
    }
    if (swirl < -0.2) {
      r += 4;
      g += 8;
      b += 22;
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
          Math.sin(x * 0.024 + time * 0.22) +
          Math.sin(y * 0.028 + time * 0.25) +
          Math.sin((x + y) * 0.02 - time * 0.16) +
          Math.sin(Math.sqrt(x * x + y * y) * 0.045 + time * 0.12) +
          Math.sin(nx * 12.0 + ny * 8.0 + time * 0.09) * 0.45;
        var c = fluidPalette(v * 1.55 + time * 0.4, nx, ny);
        data[i++] = c[0];
        data[i++] = c[1];
        data[i++] = c[2];
        data[i++] = 180;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    time += 0.005;
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(frame);
})();
