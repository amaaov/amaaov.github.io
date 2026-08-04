/* Slow plasma field continuous through the document; fixed canvas shows the viewport slice. */
(function () {
  var canvas = document.getElementById("orbit-canvas");
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d", { alpha: false });
  var w = 0;
  var h = 0;
  var viewW = 0;
  var viewH = 0;
  var t0 = performance.now();
  var imageData = null;
  var pixels = null;
  var scrollY = 0;
  var docH = 1;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Palette: cool star / copper rim on indigo void
  var C0 = [14, 22, 42];
  var C1 = [90, 140, 210];
  var C2 = [184, 149, 106];

  function resize() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    w = Math.max(1, Math.floor(viewW / 2));
    h = Math.max(1, Math.floor(viewH / 2));
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = viewW + "px";
    canvas.style.height = viewH + "px";
    imageData = ctx.createImageData(w, h);
    pixels = imageData.data;
    docH = Math.max(document.documentElement.scrollHeight, viewH, 1);
  }

  function onScroll() {
    scrollY = window.scrollY || window.pageYOffset || 0;
    docH = Math.max(document.documentElement.scrollHeight, viewH, 1);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function mix3(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }

  function paint(now) {
    var t = reduce ? 0 : (now - t0) / 1000;
    // Document-space scale so the field continues past one viewport.
    var span = Math.max(docH, viewH, 1);
    var i = 0;
    for (var y = 0; y < h; y++) {
      var pageY = scrollY + (y / h) * viewH;
      var ny = pageY / span;
      for (var x = 0; x < w; x++) {
        var nx = x / w;
        // Slow vertical drift; light horizontal coupling. Uniform across the page.
        var wave =
          Math.sin(ny * 9.5 + t * 0.22) * 0.5 +
          Math.sin(ny * 4.2 - t * 0.14 + nx * 1.4) * 0.32 +
          Math.sin(ny * 16 + t * 0.09 + Math.sin(t * 0.05 + nx * 2)) * 0.18 +
          Math.sin((ny + nx * 0.1) * 6.4 - t * 0.17) * 0.16;
        var v = (wave + 1.2) / 2.4;
        v = Math.min(1, Math.max(0, v));
        var col =
          v < 0.45 ? mix3(C0, C1, v / 0.45) : mix3(C1, C2, (v - 0.45) / 0.55);
        pixels[i++] = col[0] | 0;
        pixels[i++] = col[1] | 0;
        pixels[i++] = col[2] | 0;
        pixels[i++] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function frame(now) {
    paint(now);
    if (!reduce) requestAnimationFrame(frame);
  }

  resize();
  onScroll();
  window.addEventListener("resize", function () {
    resize();
    if (reduce) paint(t0);
  });
  window.addEventListener(
    "scroll",
    function () {
      onScroll();
      if (reduce) paint(t0);
    },
    { passive: true }
  );
  requestAnimationFrame(frame);
})();
