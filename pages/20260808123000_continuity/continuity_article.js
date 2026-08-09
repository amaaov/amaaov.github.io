(() => {
  const root = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;

  const draw = (time) => {
    root.style.setProperty("--shift-a", `${-10 + (time / 9000) % 28}vh`);
    root.style.setProperty("--shift-b", `${-25 + (time / 13000) % 34}vh`);
    root.style.setProperty("--shift-c", `${-40 + (time / 18000) % 40}vh`);
    frame = requestAnimationFrame(draw);
  };

  const sync = () => {
    cancelAnimationFrame(frame);
    if (!document.hidden && !reduced.matches) frame = requestAnimationFrame(draw);
  };

  document.addEventListener("visibilitychange", sync);
  reduced.addEventListener?.("change", sync);
  sync();
})();
