function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizedPointer(event, bounds) {
  return {
    x: clamp((event.clientX - bounds.left) / Math.max(bounds.width, 1)),
    y: clamp((event.clientY - bounds.top) / Math.max(bounds.height, 1)),
  };
}

export function viewportProgress(bounds, viewportHeight) {
  const center = bounds.top + bounds.height / 2;
  return clamp((viewportHeight - center) / Math.max(viewportHeight, 1));
}

export function courtPlaybackActive({ playing, courtVisible, soundEnabled }) {
  return Boolean(playing) && (Boolean(courtVisible) || Boolean(soundEnabled));
}

export function courtFrameShouldPaint({ courtVisible, needsPaint, soundEnabled, advancing }) {
  return Boolean(courtVisible) || Boolean(needsPaint) || (Boolean(soundEnabled) && Boolean(advancing));
}

export function createAnimationScheduler({
  onFrame,
  requestFrame = (callback) => requestAnimationFrame(callback),
  cancelFrame = (request) => cancelAnimationFrame(request),
}) {
  const activeReasons = new Set();
  let frameRequest = null;
  let documentVisible = true;
  let motionAllowed = true;
  let renderPending = false;
  let lastStamp = null;

  function shouldContinue() {
    return documentVisible && motionAllowed && activeReasons.size > 0;
  }

  function shouldSchedule() {
    return documentVisible && (renderPending || shouldContinue());
  }

  function schedule() {
    if (frameRequest === null && shouldSchedule()) {
      frameRequest = requestFrame(frame);
    }
  }

  function stop() {
    if (frameRequest !== null) {
      cancelFrame(frameRequest);
      frameRequest = null;
    }
    lastStamp = null;
  }

  function frame(stamp) {
    frameRequest = null;
    const deltaSeconds = lastStamp === null
      ? 0
      : Math.min((stamp - lastStamp) / 1000, 0.1);
    lastStamp = stamp;
    renderPending = false;
    onFrame({ stamp, deltaSeconds });
    if (shouldContinue()) {
      schedule();
    } else {
      lastStamp = null;
    }
  }

  return {
    isActive(reason) {
      return activeReasons.has(reason);
    },
    requestRender() {
      renderPending = true;
      schedule();
    },
    setActive(reason, active) {
      if (active) {
        activeReasons.add(reason);
      } else {
        activeReasons.delete(reason);
      }
      if (shouldSchedule()) {
        schedule();
      } else {
        stop();
      }
    },
    setDocumentVisible(visible) {
      documentVisible = visible;
      if (visible) {
        renderPending = true;
        schedule();
      } else {
        stop();
      }
    },
    setMotionAllowed(allowed) {
      motionAllowed = allowed;
      if (allowed) {
        schedule();
      } else {
        stop();
      }
    },
  };
}
