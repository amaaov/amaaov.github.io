/**
 * Smooth hand motion timed to Morse units, plus Casio-style letter scroll.
 * Hand uses constant angular speed along the beat-mark circle (no jumps).
 */
export function createClockAnimator({ canvas, draw, getUnitMs }) {
  let frame = 0;
  let displayProgress = 0;
  let view = null;
  let previousLabel = "";
  let labelScroll = 1;
  let labelStartedAt = 0;
  let labelDurationMs = 160;
  let sweep = null;
  let running = false;

  const scheduleFrame =
    typeof requestAnimationFrame === "function"
      ? (callback) => requestAnimationFrame(callback)
      : (callback) => setTimeout(() => callback(nowMs()), 16);
  const cancelFrame =
    typeof cancelAnimationFrame === "function"
      ? (id) => cancelAnimationFrame(id)
      : (id) => clearTimeout(id);

  function nowMs() {
    return typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  }

  function easeInOut(value) {
    const clamped = Math.min(1, Math.max(0, value));
    return clamped * clamped * (3 - 2 * clamped);
  }

  function paint() {
    if (!view?.beats?.length) {
      draw(canvas, null);
      return;
    }
    draw(canvas, {
      ...view,
      progress: displayProgress,
      previousLabel,
      labelScroll,
      activeBeatIndex: view.activeBeatIndex,
    });
  }

  function finish() {
    running = false;
    if (frame) cancelFrame(frame);
    frame = 0;
  }

  function tick(timestamp) {
    const unitMs = Math.max(20, getUnitMs?.() || 80);

    if (labelScroll < 1) {
      const labelElapsed = timestamp - labelStartedAt;
      labelScroll = easeInOut(labelElapsed / labelDurationMs);
      if (labelScroll >= 1) {
        labelScroll = 1;
        previousLabel = "";
      }
    }

    if (sweep) {
      const duration = Math.max(16, sweep.units * unitMs);
      const amount = Math.min(1, (timestamp - sweep.startedAt) / duration);
      // Linear: constant circling speed between marks
      displayProgress = sweep.from + (sweep.to - sweep.from) * amount;
      if (amount >= 1) {
        displayProgress = sweep.to;
        sweep = null;
      }
    }

    paint();

    if (labelScroll < 1 || sweep) {
      frame = scheduleFrame(tick);
    } else {
      finish();
    }
  }

  function startLoop() {
    if (running) return;
    running = true;
    frame = scheduleFrame(tick);
  }

  function setLabel(nextLabel) {
    const label = (nextLabel || "").trim().toUpperCase();
    const current = (view?.label || "").trim().toUpperCase();
    if (!label || label === current) {
      if (view) view = { ...view, label: nextLabel || view.label };
      return;
    }
    previousLabel = current || previousLabel;
    labelScroll = previousLabel ? 0 : 1;
    labelStartedAt = nowMs();
    view = { ...view, label: nextLabel };
  }

  return {
    show(nextView) {
      sweep = null;
      view = nextView;
      displayProgress = nextView?.progress ?? 0;
      previousLabel = "";
      labelScroll = 1;
      paint();
      finish();
    },

    scrub(nextView) {
      sweep = null;
      view = nextView;
      displayProgress = nextView?.progress ?? 0;
      paint();
      finish();
    },

    playBeat(nextView) {
      if (!nextView) return;
      const start = nextView.progressStart ?? 0;
      const end = nextView.progressEnd ?? start;
      const newRevolution = !view || start + 0.001 < displayProgress;

      if (newRevolution) {
        displayProgress = start;
        const outgoing = (view?.label || "").trim().toUpperCase();
        const incoming = (nextView.label || "").trim().toUpperCase();
        previousLabel = outgoing;
        labelScroll = outgoing && incoming ? 0 : 1;
        labelStartedAt = nowMs();
      } else {
        setLabel(nextView.label);
        // Stay continuous: never snap backward within the same revolution
        if (displayProgress < start) displayProgress = start;
      }

      view = { ...nextView, label: nextView.label };

      const units =
        nextView.durationUnits ||
        (nextView.toneUnits || 1) + (nextView.gapUnits || 0);

      sweep = {
        from: displayProgress,
        to: Math.max(end, displayProgress),
        units: Math.max(0.25, units),
        startedAt: nowMs(),
      };
      startLoop();
    },

    stop(idleView) {
      sweep = null;
      view = idleView;
      displayProgress = idleView?.progress ?? 0;
      previousLabel = "";
      labelScroll = 1;
      paint();
      finish();
    },

    getProgress() {
      return displayProgress;
    },

    getView() {
      return view
        ? {
            ...view,
            progress: displayProgress,
            previousLabel,
            labelScroll,
          }
        : null;
    },
  };
}
