(function () {
  const canvas = document.getElementById("orbit-canvas");
  if (!canvas) return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) return;

  const ctx = canvas.getContext("2d");
  let width = 0;
  let height = 0;
  let frame = 0;

  const orbits = [
    { radius: 0.14, speed: 0.0032, phase: 0.2, size: 2.2, color: "rgba(201, 165, 122, 0.55)" },
    { radius: 0.22, speed: -0.0021, phase: 1.4, size: 1.6, color: "rgba(139, 94, 52, 0.42)" },
    { radius: 0.31, speed: 0.0014, phase: 2.7, size: 1.1, color: "rgba(232, 223, 210, 0.28)" }
  ];

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  }

  function draw() {
    frame += 1;
    ctx.clearRect(0, 0, width, height);

    const cx = width * 0.5;
    const cy = height * 0.46;
    const base = Math.min(width, height);

    orbits.forEach(function (orbit) {
      const angle = frame * orbit.speed + orbit.phase;
      const r = base * orbit.radius;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle * 0.92) * r * 0.72;

      ctx.beginPath();
      ctx.fillStyle = orbit.color;
      ctx.arc(x, y, orbit.size, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  resize();
  draw();
})();
