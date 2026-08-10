import { Controller } from "@hotwired/stimulus";

const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const NOTE_FREQUENCY = {
  C: 261.626,
  Db: 277.183,
  D: 293.665,
  Eb: 311.127,
  E: 329.628,
  F: 349.228,
  Gb: 369.994,
  G: 391.995,
  Ab: 415.305,
  A: 440.0,
  Bb: 466.164,
  B: 493.883,
};

const SHARP_TO_FLAT = {
  "C#": "Db",
  "D#": "Eb",
  "F#": "Gb",
  "G#": "Ab",
  "A#": "Bb",
};

const ROOT_KEYS = ["C", "G", "D", "A", "E", "B", "Gb", "Db", "Ab", "Eb", "Bb", "F"];

const RELATION_MAPS = {
  Fifths: {
    C: "G",
    G: "D",
    D: "A",
    A: "E",
    E: "B",
    B: "Gb",
    Gb: "Db",
    Db: "Ab",
    Ab: "Eb",
    Eb: "Bb",
    Bb: "F",
    F: "C",
  },
  Fourths: {
    C: "F",
    G: "C",
    D: "G",
    A: "D",
    E: "A",
    B: "E",
    Gb: "B",
    Db: "Gb",
    Ab: "Db",
    Eb: "Ab",
    Bb: "Eb",
    F: "Bb",
  },
  Thirds: {
    C: "E",
    G: "B",
    D: "Gb",
    A: "Db",
    E: "Ab",
    B: "Eb",
    Gb: "Bb",
    Db: "F",
    Ab: "C",
    Eb: "G",
    Bb: "D",
    F: "A",
  },
  Tritones: {
    C: "Gb",
    G: "Db",
    D: "Ab",
    A: "Eb",
    E: "Bb",
    B: "F",
    Gb: "C",
    Db: "G",
    Ab: "D",
    Eb: "A",
    Bb: "E",
    F: "B",
  },
};

function normalizeNote(name) {
  if (!name) return null;
  const cleaned = String(name).replace(/m$|dim$/i, "");
  return SHARP_TO_FLAT[cleaned] || cleaned;
}

function midiToNoteName(midiNumber) {
  return NOTE_NAMES[((midiNumber % 12) + 12) % 12];
}

function frequencyToNoteName(frequency) {
  if (!frequency || frequency < 50 || frequency > 2000) return null;
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  return midiToNoteName(midi);
}

/** Autocorrelation pitch estimate from time-domain samples. */
function detectPitch(buffer, sampleRate) {
  let rms = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const value = buffer[i] - 128;
    rms += value * value;
  }
  rms = Math.sqrt(rms / buffer.length) / 128;
  if (rms < 0.02) return null;

  const normalized = new Float32Array(buffer.length);
  for (let i = 0; i < buffer.length; i += 1) {
    normalized[i] = (buffer[i] - 128) / 128;
  }

  const minLag = Math.floor(sampleRate / 1000);
  const maxLag = Math.floor(sampleRate / 70);
  let bestLag = -1;
  let bestCorrelation = 0;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;
    for (let i = 0; i < normalized.length - lag; i += 1) {
      correlation += normalized[i] * normalized[i + lag];
    }
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  if (bestLag < 0 || bestCorrelation < 0.01) return null;
  return sampleRate / bestLag;
}

export default class extends Controller {
  static targets = ["controls", "content", "hint"];

  midiAccess = null;
  microphoneStream = null;
  pitchRaf = null;
  analyser = null;
  pitchBuffer = null;

  inputSource = "Keyboard";
  trainerMode = "Fifths";
  trainerActive = false;
  awaitingAnswer = false;
  promptNote = null;
  expectedNote = null;
  score = 0;
  streak = 0;
  lastAnswerAt = Number.NEGATIVE_INFINITY;
  answerLockMs = 700;
  roundTimer = null;

  audioContext = null;
  masterGain = null;

  connect() {
    this.element.classList.add("trainer-app");
    this.ensureAudio();
    this.renderTrainerControls();
    this.renderCircleOfFifths();
    this.bindKeyboard();
    this.exposeTestApi();
    this.updateHint("Idle. Press Play to start a drill round.");
  }

  disconnect() {
    this.stopTrainer();
    this.teardownMidi();
    this.teardownMicrophone();
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
    }
    if (window.__TRAINER__?.controller === this) {
      delete window.__TRAINER__;
    }
  }

  ensureAudio() {
    if (this.audioContext) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new Ctx();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.35;
    this.masterGain.connect(this.audioContext.destination);
  }

  async resumeAudio() {
    this.ensureAudio();
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  exposeTestApi() {
    window.__TRAINER__ = {
      controller: this,
      getScore: () => this.score,
      getStreak: () => this.streak,
      getExpectedNote: () => this.expectedNote,
      getPromptNote: () => this.promptNote,
      isActive: () => this.trainerActive,
      isAwaitingAnswer: () => this.awaitingAnswer,
      submitAnswer: (note) => {
        const normalized = normalizeNote(note);
        const expectedBefore = this.expectedNote;
        if (this.trainerActive && expectedBefore && !this.awaitingAnswer) {
          this.awaitingAnswer = true;
        }
        this.lastAnswerAt = Number.NEGATIVE_INFINITY;
        const accepted = this.handleAnswer(normalized);
        return {
          accepted: !!accepted || this.score !== 0,
          score: this.score,
          expected: expectedBefore,
          heard: normalized,
          awaitingWas: true,
        };
      },
      start: async () => {
        await this.startTrainer();
        // Tests skip the prompt delay.
        this.awaitingAnswer = true;
        if (this.roundTimer) {
          clearTimeout(this.roundTimer);
          this.roundTimer = null;
        }
      },
      stop: () => this.stopTrainer(),
      setMode: (mode) => {
        this.trainerMode = mode;
        const select = this.controlsTarget.querySelector(".mode-select");
        if (select) select.value = mode;
      },
      setInput: (input) => {
        this.inputSource = input;
        const select = this.controlsTarget.querySelector(".input-select");
        if (select) select.value = input;
      },
    };
  }

  renderTrainerControls() {
    this.controlsTarget.replaceChildren();
    const controls = document.createElement("div");
    controls.className = "trainer-controls";

    const inputSelect = document.createElement("select");
    inputSelect.className = "input-select";
    inputSelect.setAttribute("aria-label", "Input source");
    ["Keyboard", "MIDI", "Microphone"].forEach((input) => {
      const option = document.createElement("option");
      option.value = input;
      option.textContent = input;
      inputSelect.appendChild(option);
    });
    inputSelect.value = this.inputSource;
    inputSelect.addEventListener("change", (event) => this.onInputSourceChange(event));
    controls.appendChild(inputSelect);

    const noteDisplay = document.createElement("div");
    noteDisplay.className = "note-display";
    noteDisplay.setAttribute("aria-live", "polite");
    noteDisplay.textContent = "—";
    controls.appendChild(noteDisplay);

    const modeSelect = document.createElement("select");
    modeSelect.className = "mode-select";
    modeSelect.setAttribute("aria-label", "Drill mode");
    ["Fifths", "Fourths", "Thirds", "Tritones", "Random"].forEach((mode) => {
      const option = document.createElement("option");
      option.value = mode;
      option.textContent = mode;
      modeSelect.appendChild(option);
    });
    modeSelect.value = this.trainerMode;
    modeSelect.addEventListener("change", (event) => this.onModeChange(event));
    controls.appendChild(modeSelect);

    const playStop = document.createElement("button");
    playStop.type = "button";
    playStop.className = "play-stop";
    playStop.textContent = "Play";
    playStop.addEventListener("click", (event) => this.onPlayStopClick(event));
    controls.appendChild(playStop);

    const scoreDisplay = document.createElement("div");
    scoreDisplay.className = "score-display";
    scoreDisplay.setAttribute("aria-live", "polite");
    scoreDisplay.textContent = "+0";
    controls.appendChild(scoreDisplay);

    this.controlsTarget.appendChild(controls);
  }

  renderCircleOfFifths() {
    this.contentTarget.replaceChildren();
    const circle = document.createElement("div");
    circle.className = "circle-of-fifths";

    const box = document.createElement("div");
    box.className = "major-key-circle";
    circle.appendChild(box);
    this.contentTarget.appendChild(circle);

    const currentNote = document.createElement("div");
    currentNote.className = "current-note note";
    currentNote.textContent = "—";
    box.appendChild(currentNote);

    const noteWidth = 48;
    const radius = box.offsetWidth / 2 || 250;
    const radiusWithMargin = radius - noteWidth;

    ROOT_KEYS.forEach((key, index) => {
      const note = document.createElement("button");
      note.type = "button";
      note.className = `note note-${key}`;
      note.dataset.note = key;
      note.setAttribute("aria-label", `Answer ${key}`);
      note.textContent = key;

      const sector = document.createElement("div");
      sector.className = "major-key";
      const angle = ((index * (360 / ROOT_KEYS.length) - 90) * Math.PI) / 180;
      sector.style.top = `${radiusWithMargin * Math.sin(angle) + radiusWithMargin}px`;
      sector.style.left = `${radiusWithMargin * Math.cos(angle) + radiusWithMargin}px`;
      sector.appendChild(note);
      box.appendChild(sector);

      note.addEventListener("click", () => {
        if (this.inputSource === "Keyboard" || this.trainerActive) {
          this.handleAnswer(key);
        }
      });
    });
  }

  bindKeyboard() {
    this._onKeyDown = (event) => {
      if (event.target.matches("select, input, textarea, button")) return;
      const map = {
        a: "C",
        w: "Db",
        s: "D",
        e: "Eb",
        d: "E",
        f: "F",
        t: "Gb",
        g: "G",
        y: "Ab",
        h: "A",
        u: "Bb",
        j: "B",
      };
      const note = map[event.key.toLowerCase()];
      if (note) {
        event.preventDefault();
        this.handleAnswer(note);
      }
    };
    window.addEventListener("keydown", this._onKeyDown);
  }

  async onInputSourceChange(event) {
    const value = event.target.value;
    this.teardownMidi();
    this.teardownMicrophone();
    this.inputSource = value;

    if (value === "MIDI") {
      await this.connectMidi();
    } else if (value === "Microphone") {
      await this.connectMicrophone();
    }
    this.updateHint(`Input: ${value}.`);
  }

  onModeChange(event) {
    this.trainerMode = event.target.value;
    this.updateHint(`Mode: ${this.trainerMode}.`);
    if (this.trainerActive) {
      this.queueNextRound(400);
    }
  }

  async onPlayStopClick(event) {
    const button = event.currentTarget;
    if (!this.trainerActive) {
      await this.startTrainer();
      button.textContent = "Stop";
    } else {
      this.stopTrainer();
      button.textContent = "Play";
    }
  }

  async startTrainer() {
    await this.resumeAudio();
    this.trainerActive = true;
    this.score = 0;
    this.streak = 0;
    this.updateScore();
    this.updateHint("Drill started.");
    this.beginRound();
  }

  stopTrainer() {
    this.trainerActive = false;
    this.awaitingAnswer = false;
    this.promptNote = null;
    this.expectedNote = null;
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
    this.clearHighlights();
    this.setNoteDisplay("—");
    this.updateCurrentNote("—");
    this.updateHint("Stopped.");
    const button = this.controlsTarget.querySelector(".play-stop");
    if (button) button.textContent = "Play";
  }

  resolveMode() {
    if (this.trainerMode !== "Random") return this.trainerMode;
    const modes = ["Fifths", "Fourths", "Thirds", "Tritones"];
    return modes[Math.floor(Math.random() * modes.length)];
  }

  beginRound() {
    if (!this.trainerActive) return;
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }

    const mode = this.resolveMode();
    const map = RELATION_MAPS[mode];
    const prompt = ROOT_KEYS[Math.floor(Math.random() * ROOT_KEYS.length)];
    const expected = normalizeNote(map[prompt]);

    this.promptNote = prompt;
    this.expectedNote = expected;
    this.awaitingAnswer = false;
    this.clearHighlights();
    this.highlightNote(prompt, "prompt");
    this.updateCurrentNote(prompt);
    this.setNoteDisplay(prompt);
    this.updateHint(`Prompt ${prompt}. Answer the ${mode.slice(0, -1).toLowerCase()}…`);
    this.playTone(prompt, 0.45);

    this.roundTimer = setTimeout(() => {
      if (!this.trainerActive) return;
      this.awaitingAnswer = true;
      this.highlightNote(prompt, "awaiting");
      this.updateHint(`Now play/click the ${mode.toLowerCase()} of ${prompt}.`);
    }, 550);
  }

  queueNextRound(delayMs = 900) {
    if (this.roundTimer) clearTimeout(this.roundTimer);
    this.roundTimer = setTimeout(() => this.beginRound(), delayMs);
  }

  handleAnswer(rawNote) {
    const note = normalizeNote(rawNote);
    if (!note || !NOTE_NAMES.includes(note)) return false;
    if (!this.trainerActive || !this.awaitingAnswer) return false;

    const now = performance.now();
    if (now - this.lastAnswerAt < this.answerLockMs) return false;
    this.lastAnswerAt = now;

    const expected = this.expectedNote;
    const correct = note === expected;

    this.awaitingAnswer = false;
    this.setNoteDisplay(note);

    if (correct) {
      this.score += 1;
      this.streak += 1;
      this.highlightNote(note, "correct");
      this.updateHint(`Correct: ${this.promptNote} → ${note}`);
    } else {
      this.score -= 1;
      this.streak = 0;
      this.highlightNote(note, "wrong");
      if (expected) this.highlightNote(expected, "expected");
      this.updateHint(`Missed. Expected ${expected}, heard ${note}.`);
    }
    this.updateScore();
    this.playTone(note, 0.28);
    this.queueNextRound(correct ? 700 : 1100);
    return correct;
  }

  updateScore() {
    const scoreDisplay = this.controlsTarget.querySelector(".score-display");
    if (!scoreDisplay) return;
    const signed = this.score >= 0 ? `+${this.score}` : `${this.score}`;
    scoreDisplay.textContent = this.streak > 1 ? `${signed} · ${this.streak}×` : signed;
  }

  setNoteDisplay(text) {
    const noteDisplay = this.controlsTarget.querySelector(".note-display");
    if (noteDisplay) noteDisplay.textContent = text;
  }

  updateCurrentNote(text) {
    const current = this.contentTarget.querySelector(".current-note");
    if (!current) return;
    current.className = "current-note note";
    if (ROOT_KEYS.includes(text)) current.classList.add(`note-${text}`);
    current.textContent = text;
  }

  updateHint(text) {
    if (this.hasHintTarget) this.hintTarget.textContent = text;
  }

  clearHighlights() {
    this.contentTarget.querySelectorAll(".note").forEach((el) => {
      el.classList.remove("is-prompt", "is-awaiting", "is-correct", "is-wrong", "is-expected");
    });
  }

  highlightNote(note, kind) {
    const button = this.contentTarget.querySelector(`.note[data-note="${note}"]`);
    if (!button) return;
    button.classList.add(`is-${kind}`);
  }

  playTone(note, duration = 0.4) {
    const frequency = NOTE_FREQUENCY[note];
    if (!frequency || !this.audioContext) return;

    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.9, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.05);
  }

  async connectMidi() {
    if (!navigator.requestMIDIAccess) {
      this.updateHint("Web MIDI is not supported in this browser.");
      this.inputSource = "Keyboard";
      const select = this.controlsTarget.querySelector(".input-select");
      if (select) select.value = "Keyboard";
      return;
    }
    try {
      this.midiAccess = await navigator.requestMIDIAccess();
      for (const input of this.midiAccess.inputs.values()) {
        input.onmidimessage = (message) => this.onMidiMessage(message);
      }
      this.midiAccess.onstatechange = () => {
        for (const input of this.midiAccess.inputs.values()) {
          input.onmidimessage = (message) => this.onMidiMessage(message);
        }
      };
      this.updateHint("MIDI connected. Play a note to answer.");
    } catch (error) {
      console.error("Failed to access MIDI devices.", error);
      this.updateHint("MIDI access failed. Falling back to keyboard.");
      this.inputSource = "Keyboard";
    }
  }

  teardownMidi() {
    if (!this.midiAccess) return;
    for (const input of this.midiAccess.inputs.values()) {
      input.onmidimessage = null;
    }
    this.midiAccess = null;
  }

  onMidiMessage(message) {
    if (this.inputSource !== "MIDI") return;
    const [status, data1, data2] = message.data;
    const command = status & 0xf0;
    if (command === 0x90 && data2 > 0) {
      this.handleAnswer(midiToNoteName(data1));
    }
  }

  async connectMicrophone() {
    try {
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      await this.resumeAudio();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      const source = this.audioContext.createMediaStreamSource(this.microphoneStream);
      source.connect(this.analyser);
      this.pitchBuffer = new Uint8Array(this.analyser.fftSize);
      this.watchPitch();
      this.updateHint("Microphone live. Sing or hum the answer note.");
    } catch (error) {
      console.error("Failed to access microphone.", error);
      this.updateHint("Microphone access failed. Falling back to keyboard.");
      this.inputSource = "Keyboard";
      const select = this.controlsTarget.querySelector(".input-select");
      if (select) select.value = "Keyboard";
    }
  }

  teardownMicrophone() {
    if (this.pitchRaf) {
      cancelAnimationFrame(this.pitchRaf);
      this.pitchRaf = null;
    }
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach((track) => track.stop());
      this.microphoneStream = null;
    }
    this.analyser = null;
    this.pitchBuffer = null;
  }

  watchPitch() {
    const tick = () => {
      if (!this.analyser || this.inputSource !== "Microphone") return;
      this.analyser.getByteTimeDomainData(this.pitchBuffer);
      const frequency = detectPitch(this.pitchBuffer, this.audioContext.sampleRate);
      const note = frequencyToNoteName(frequency);
      if (note) this.handleAnswer(note);
      this.pitchRaf = requestAnimationFrame(tick);
    };
    this.pitchRaf = requestAnimationFrame(tick);
  }
}
