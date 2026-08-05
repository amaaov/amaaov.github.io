/*
 * © Andrei Makarov / amaaov
 * Licensed under CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
 * SPDX-License-Identifier: CC-BY-4.0
 */

(() => {
  const canvas = document.getElementById("era-canvas");
  const body = document.body;
  const blocks = Array.from(document.querySelectorAll(".era-block[data-era]"));
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  const eras = {
    film: {
      bg: "#16110e",
      ink: "#ebe0d0",
      soft: "#c9b8a0",
      mute: "#9a8770",
      accent: "#c9a66b",
      focus: "#d4b07a",
      veil:
        "radial-gradient(120% 80% at 20% 10%, rgba(180,140,90,0.16), transparent 55%), repeating-linear-gradient(90deg, rgba(0,0,0,0.18) 0 10px, transparent 10px 42px)",
      veilOpacity: 0.7,
    },
    radio: {
      bg: "#10141c",
      ink: "#f0e8d6",
      soft: "#cfc3a8",
      mute: "#8f8a78",
      accent: "#e0a84a",
      focus: "#f0b85a",
      veil:
        "radial-gradient(70% 55% at 50% 40%, rgba(224,168,74,0.22), transparent 62%), radial-gradient(90% 70% at 80% 10%, rgba(90,120,180,0.12), transparent 50%)",
      veilOpacity: 0.75,
    },
    telecom: {
      bg: "#071014",
      ink: "#d9efe9",
      soft: "#9fc4bc",
      mute: "#6a8f88",
      accent: "#5ec4b0",
      focus: "#7ad4c2",
      veil:
        "repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 3px), radial-gradient(80% 60% at 50% 0%, rgba(94,196,176,0.18), transparent 55%)",
      veilOpacity: 0.8,
    },
    net: {
      bg: "#05060a",
      ink: "#f2f4f7",
      soft: "#b8c0cc",
      mute: "#7a8494",
      accent: "#5b9fff",
      focus: "#7ab0ff",
      veil:
        "linear-gradient(160deg, rgba(91,159,255,0.14), transparent 42%), radial-gradient(50% 40% at 70% 20%, rgba(255,255,255,0.08), transparent 60%)",
      veilOpacity: 0.7,
    },
  };

  const order = ["film", "radio", "telecom", "net"];

  function applyEra(name) {
    const e = eras[name];
    if (!e) return;
    body.dataset.era = name;
    body.style.setProperty("--bg", e.bg);
    body.style.setProperty("--ink", e.ink);
    body.style.setProperty("--ink-soft", e.soft);
    body.style.setProperty("--ink-mute", e.mute);
    body.style.setProperty("--accent", e.accent);
    body.style.setProperty("--focus", e.focus);
    body.style.setProperty("--veil", e.veil);
    body.style.setProperty("--veil-opacity", String(e.veilOpacity));
  }

  function activeEraFromScroll() {
    if (!blocks.length) return "film";
    const mid = window.innerHeight * 0.42;
    let best = blocks[0].dataset.era;
    let bestDist = Infinity;
    for (const block of blocks) {
      const r = block.getBoundingClientRect();
      const center = r.top + r.height * 0.28;
      const dist = Math.abs(center - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = block.dataset.era;
      }
    }
    return best || "film";
  }

  let current = "film";
  function syncEra() {
    const next = activeEraFromScroll();
    if (next !== current) {
      current = next;
      applyEra(current);
    }
  }

  applyEra("film");
  syncEra();
  window.addEventListener("scroll", syncEra, { passive: true });
  window.addEventListener("resize", syncEra);

  if (!canvas || reduce.matches) return;

  const ctx = canvas.getContext("2d");
  let t = 0;
  let raf = 0;
  let progress = 0;

  function resize() {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function scrollProgress() {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    return Math.min(1, Math.max(0, window.scrollY / max));
  }

  function mix(a, b, u) {
    return a + (b - a) * u;
  }

  function drawFilm(w, h, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const pitch = 46;
    for (let y = ((t * 18) % pitch) - pitch; y < h + pitch; y += pitch) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, y, 18, 22);
      ctx.fillRect(w - 18, y, 18, 22);
      ctx.fillStyle = "rgba(235,224,208,0.08)";
      ctx.fillRect(4, y + 5, 10, 12);
      ctx.fillRect(w - 14, y + 5, 10, 12);
    }
    for (let i = 0; i < 40; i++) {
      const x = (Math.sin(t * 0.7 + i * 1.7) * 0.5 + 0.5) * w;
      const y = (Math.cos(t * 0.5 + i * 2.1) * 0.5 + 0.5) * h;
      ctx.fillStyle = `rgba(255,240,210,${0.03 + (i % 5) * 0.01})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }
    ctx.restore();
  }

  function drawRadio(w, h, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const cx = w * 0.5;
    const cy = h * 0.42;
    for (let i = 0; i < 7; i++) {
      const r = 40 + i * 48 + Math.sin(t + i) * 6;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(224,168,74,${0.18 - i * 0.02})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const y = h * 0.72 + Math.sin(x * 0.02 + t * 2.2) * 18 + Math.sin(x * 0.05 + t) * 8;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(224,168,74,0.28)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }

  function drawTelecom(w, h, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const tvW = Math.min(420, w * 0.55);
    const tvH = tvW * 0.62;
    const x = (w - tvW) / 2;
    const y = h * 0.18;
    ctx.fillStyle = "rgba(94,196,176,0.05)";
    ctx.fillRect(x, y, tvW, tvH);
    for (let i = 0; i < tvH; i += 3) {
      ctx.fillStyle = `rgba(180,255,240,${0.015 + (Math.sin(t * 3 + i) * 0.5 + 0.5) * 0.02})`;
      ctx.fillRect(x, y + i, tvW, 1);
    }
    // dial phone silhouette suggestion
    ctx.beginPath();
    ctx.ellipse(w * 0.18, h * 0.72, 34, 18, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(94,196,176,0.25)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w * 0.18, h * 0.72, 10, 0, Math.PI * 2);
    ctx.stroke();
    // soft beam
    ctx.beginPath();
    ctx.moveTo(w * 0.82, h * 0.2);
    ctx.lineTo(w * 0.95, h * 0.55);
    ctx.strokeStyle = "rgba(94,196,176,0.12)";
    ctx.stroke();
    ctx.restore();
  }

  function drawNet(w, h, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const pw = Math.min(220, w * 0.28);
    const ph = pw * 2.05;
    const x = w * 0.72 - pw / 2;
    const y = h * 0.2;
    ctx.fillStyle = "rgba(91,159,255,0.08)";
    ctx.beginPath();
    const r = 28;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + pw, y, x + pw, y + ph, r);
    ctx.arcTo(x + pw, y + ph, x, y + ph, r);
    ctx.arcTo(x, y + ph, x, y, r);
    ctx.arcTo(x, y, x + pw, y, r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(242,244,247,0.06)";
    ctx.fillRect(x + 12, y + 28, pw - 24, ph - 56);
    // status dots
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x + 22 + i * 14, y + 16, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(91,159,255,0.45)";
      ctx.fill();
    }
    // floating notification cards without borders — soft slabs
    for (let i = 0; i < 4; i++) {
      const nx = w * 0.12 + i * 18;
      const ny = h * 0.55 + Math.sin(t + i) * 10 + i * 28;
      ctx.fillStyle = `rgba(91,159,255,${0.05 + i * 0.02})`;
      ctx.fillRect(nx, ny, 120, 36);
    }
    ctx.restore();
  }

  function draw() {
    t += 0.008;
    progress = scrollProgress();
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    // Smooth weights across the four eras along scroll
    const p = progress * (order.length - 1);
    const weights = order.map((_, i) => {
      const d = Math.abs(p - i);
      return Math.max(0, 1 - d);
    });
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    const norm = weights.map((v) => v / sum);

    drawFilm(w, h, mix(0.15, 1, norm[0]));
    drawRadio(w, h, mix(0.05, 1, norm[1]));
    drawTelecom(w, h, mix(0.05, 1, norm[2]));
    drawNet(w, h, mix(0.05, 1, norm[3]));

    raf = requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener("resize", resize);
  reduce.addEventListener("change", () => {
    if (reduce.matches) {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    } else {
      draw();
    }
  });
})();
