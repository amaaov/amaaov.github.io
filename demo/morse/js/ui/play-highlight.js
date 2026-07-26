export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function wrapMirror(field) {
  if (!field || field.closest(".mirror-shell")) {
    return {
      textarea: field,
      mirror: field?.parentElement?.querySelector(".mirror-layer"),
      shell: field?.closest(".mirror-shell"),
    };
  }
  const shell = document.createElement("div");
  shell.className = "mirror-shell";
  const mirror = document.createElement("pre");
  mirror.className = "mirror-layer";
  mirror.setAttribute("aria-hidden", "true");
  field.parentElement.insertBefore(shell, field);
  shell.append(mirror, field);
  field.addEventListener("scroll", () => {
    mirror.scrollTop = field.scrollTop;
    mirror.scrollLeft = field.scrollLeft;
  });
  return { textarea: field, mirror, shell };
}

export function paintMirror(target, value, from, to) {
  if (!target?.mirror || !target.textarea) return;
  const text = String(value ?? "");
  const start = Math.max(0, Math.min(text.length, from ?? -1));
  const end = Math.max(start, Math.min(text.length, to ?? -1));
  const active = start >= 0 && end > start;
  target.shell?.classList.toggle("is-playing-highlight", active);
  if (!active) {
    target.mirror.textContent = "";
    return;
  }
  target.mirror.innerHTML =
    escapeHtml(text.slice(0, start)) +
    `<mark>${escapeHtml(text.slice(start, end))}</mark>` +
    escapeHtml(text.slice(end));
  target.mirror.scrollTop = target.textarea.scrollTop;
  target.mirror.scrollLeft = target.textarea.scrollLeft;
}

/** Paint a highlighted span into a plain pre/code element. */
export function paintSpan(element, value, from, to) {
  if (!element) return;
  const text = String(value ?? "");
  const start = Math.max(0, Math.min(text.length, from ?? -1));
  const end = Math.max(start, Math.min(text.length, to ?? -1));
  const active = start >= 0 && end > start;
  element.classList.toggle("is-playing-highlight", active);
  if (!active) {
    element.textContent = text;
    return;
  }
  element.innerHTML =
    escapeHtml(text.slice(0, start)) +
    `<mark>${escapeHtml(text.slice(start, end))}</mark>` +
    escapeHtml(text.slice(end));
}

/**
 * Highlights the playing Morse / letter span in input and output textareas.
 */
export function createPlayHighlighter({ textInput, morseInput, output }) {
  const targets = {
    text: wrapMirror(textInput),
    morse: wrapMirror(morseInput),
    output: wrapMirror(output),
  };

  let session = null;

  return {
    begin({
      playedMorse,
      outputText,
      outputMorse,
      outputMode,
      inputText,
      inputMorse,
      inputMode,
      letterAtMorse,
      inputLetterAtMorse,
    }) {
      session = {
        playedMorse,
        outputText,
        outputMorse,
        outputMode,
        inputText,
        inputMorse,
        inputMode,
        letterAtMorse,
        inputLetterAtMorse,
      };
    },
    progress({ offset, token } = {}) {
      if (!session) return;
      const tone = token === "." || token === "-";
      if (!tone || offset == null || offset < 0) {
        this.clearPaint();
        return;
      }

      // Live edits leave the snapshot stale; drop overlays so the field stays readable.
      const liveText = targets.text.textarea?.value ?? "";
      const liveMorse = targets.morse.textarea?.value ?? "";
      const textStillMatches = liveText === (session.inputText ?? "");
      const morseStillMatches = liveMorse === (session.inputMorse ?? "");
      if (
        (session.inputMode === "text" && !textStillMatches) ||
        (session.inputMode === "morse" && !morseStillMatches)
      ) {
        this.clearPaint();
        return;
      }

      const letter = session.letterAtMorse?.[offset];
      if (session.outputMode === "text" && letter) {
        paintMirror(targets.output, session.outputText, letter.textFrom, letter.textTo);
      } else if (session.outputMode === "morse") {
        paintMirror(targets.output, session.outputMorse, offset, offset + 1);
      } else {
        paintMirror(targets.output, "", -1, -1);
      }

      if (session.inputMode === "text") {
        const inputLetter = session.inputLetterAtMorse?.[offset] || letter;
        if (inputLetter) {
          paintMirror(
            targets.text,
            session.inputText,
            inputLetter.textFrom,
            inputLetter.textTo,
          );
        } else {
          paintMirror(targets.text, "", -1, -1);
        }
        paintMirror(targets.morse, "", -1, -1);
      } else if (session.inputMode === "morse") {
        paintMirror(targets.morse, session.inputMorse, offset, offset + 1);
        paintMirror(targets.text, "", -1, -1);
      } else {
        paintMirror(targets.text, "", -1, -1);
        paintMirror(targets.morse, "", -1, -1);
      }
    },
    clearPaint() {
      paintMirror(targets.text, "", -1, -1);
      paintMirror(targets.morse, "", -1, -1);
      paintMirror(targets.output, "", -1, -1);
    },
    end() {
      this.clearPaint();
      session = null;
    },
  };
}
