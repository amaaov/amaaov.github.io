/**
 * Global shortcuts. Ignore when typing in inputs/textareas unless modifier chords.
 */
export function bindKeyboard(handlers) {
  function onKeyDown(event) {
    const target = event.target;
    const typing =
      target instanceof HTMLElement &&
      (target.matches("input, textarea, select") || target.isContentEditable);

    if (event.code === "Escape") {
      handlers.escape?.(event);
      return;
    }

    if (typing && !event.metaKey && !event.ctrlKey) {
      if (event.code === "Space" && target.id === "tap-pad") {
        event.preventDefault();
        handlers.tapDown?.(event);
      }
      return;
    }

    if (event.code === "Digit0" && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      handlers.outputMode?.(4);
      return;
    }

    const digit = event.code.match(/^Digit([1-9])$/u);
    if (digit && !event.metaKey && !event.ctrlKey) {
      const value = Number(digit[1]);
      event.preventDefault();
      if (value <= 5) handlers.mode?.(value - 1);
      else handlers.outputMode?.(value - 6);
      return;
    }

    switch (event.code) {
      case "Slash":
        event.preventDefault();
        handlers.focusInput?.(event);
        break;
      case "KeyP":
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          handlers.play?.(event);
        }
        break;
      case "KeyW":
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          handlers.wav?.(event);
        }
        break;
      case "KeyL":
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          handlers.loop?.(event);
        }
        break;
      case "KeyS":
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          handlers.synth?.(event);
        }
        break;
      case "KeyE":
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          handlers.ensemble?.(event);
        }
        break;
      case "KeyY":
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          handlers.history?.(event);
        }
        break;
      case "KeyH":
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          handlers.help?.(event);
        }
        break;
      case "Space":
        if (!typing && !event.repeat) {
          event.preventDefault();
          handlers.tapDown?.(event);
        }
        break;
      default:
        break;
    }
  }

  function onKeyUp(event) {
    if (event.code === "Space") handlers.tapUp?.(event);
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };
}
