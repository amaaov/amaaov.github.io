import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["controls", "content"]

  midiAccess
  microphoneStream

  inputSource
  trainerMode
  trainerActive = false
  trainerTimer

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  oscillator = this.audioContext.createOscillator();
  gainNode = this.audioContext.createGain();
  feedbackGainNode = this.audioContext.createGain();
  delayNode = this.audioContext.createDelay();

  allNotes = ["C", "Db", "D", "Eb", "E", "F", "Eb", "G", "Ab", "A", "Bb", "B"]
  noteFrequency = {
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
  }
  sharpNoteAlias = {
    Db: "C#",
    Eb: "D#",
    Gb: "F#",
    Ab: "G#",
    Bb: "A#",
  }

  rootKeys = ["C", "G", "D", "A", "E", "B", "Gb", "Db", "Ab", "Eb", "Bb", "F"]
  fifthsKeys = {
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
  }
  fourthsKeys = {
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
  }
  tritoneKeys = {
    C: "F#",
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
  }

  minorKeys = {
    C: "Em",
    G: "Bm",
    D: "F#m",
    A: "C#m",
    E: "G#m",
    B: "D#m",
    Gb: "Bbm",
    Db: "Fm",
    Ab: "Cm",
    Eb: "Gm",
    Bb: "Dm",
    F: "Am",
  }
  dimKeys = {
    C: "Bdim",
    G: "F#dim",
    D: "C#dim",
    A: "G#dim",
    E: "D#dim",
    B: "A#dim",
    Gb: "E#dim",
    Db: "Cdim",
    Ab: "Gdim",
    Eb: "Ddim",
    Bb: "Adim",
    F: "Edim",
  }

  scaleDegrees = ["I", "II", "III", "IV", "V", "VI", "VII"]
  scaleDegreeHeading = [
    "Tonic",
    "Supertonic",
    "Mediant",
    "Subdominant",
    "Dominant",
    "Submediant",
    "Leading Tone",
  ]
  scaleDegreeMeaning = [
    "Root",
    "Major Second",
    "Major Third",
    "Perfect Fourth",
    "Perfect Fifth",
    "Major Sixth",
    "Major Seventh",
  ]
  scaleDegreeFooter = [
    "Major",
    "Minor",
    "Minor",
    "Major",
    "Major",
    "Minor",
    "Diminished",
  ]

  clockNoteIndex = 0
  clockTimer

  connect() {
    this.element.style.display = "flex"
    this.element.style.flexDirection = "column"
    this.element.style.justifyContent = "center"
    this.element.style.alignItems = "center"

    this.delayNode.connect(this.feedbackGainNode);
    this.feedbackGainNode.connect(this.delayNode);

    this.oscillator.connect(this.gainNode);
    this.gainNode.connect(this.delayNode);
    this.delayNode.connect(this.audioContext.destination);

    this.renderCircleOfFifths()
    this.renderTrainerControls()
    this.playCircleClock()
  }

  connectMidi() {
    if (navigator.requestMIDIAccess) {
      try {
        navigator.requestMIDIAccess().then((midiAccess) => {
          this.midiAccess = midiAccess
          console.log("MIDI Access", midiAccess)
          this.inputSource = "MIDI"
        })
      } catch (error) {
        console.error("Failed to access MIDI devices.", error)
      }
    } else {
      console.error("Web MIDI API is not supported in this browser.")
    }
  }

  connectMicrophone() {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        this.microphoneStream = stream
        console.log("Microphone Stream", stream)
        this.inputSource = "Microphone"

        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)()
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 2048
        const microphone = audioContext.createMediaStreamSource(stream)
        microphone.connect(analyser)
        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        const detectPitch = () => {
          analyser.getByteTimeDomainData(dataArray)
          console.log("Data Array", dataArray)
          requestAnimationFrame(detectPitch)
        }
        detectPitch()
      })
      .catch((error) => {
        console.error("Failed to access microphone.", error)
      })
  }

  renderTrainerControls() {
    const controls = document.createElement("div")
    controls.classList.add("trainer-controls")
    const inputSelect = document.createElement("select")
    inputSelect.classList.add("input-select")
    inputSelect.addEventListener("change", (event) =>
      this.onInputSourceChange(event)
    )
    const inputs = ["-", "MIDI", "Microphone"]
    inputs.forEach((input) => {
      const option = document.createElement("option")
      option.value = input
      option.innerHTML = input
      inputSelect.appendChild(option)
    })
    controls.appendChild(inputSelect)
    const noteDisplay = document.createElement("div")
    noteDisplay.classList.add("note-display")
    noteDisplay.innerHTML = "Nono"
    controls.appendChild(noteDisplay)
    const modeSelect = document.createElement("select")
    modeSelect.classList.add("mode-select")
    modeSelect.addEventListener("change", (event) => this.onModeChange(event))
    const modes = ["Fifths", "Fourths", "Thirds", "Tritones", "Random"]
    modes.forEach((mode) => {
      const option = document.createElement("option")
      option.value = mode
      option.innerHTML = mode
      modeSelect.appendChild(option)
    })
    controls.appendChild(modeSelect)
    const playStop = document.createElement("button")
    playStop.classList.add("play-stop")
    playStop.innerHTML = "Play"
    playStop.addEventListener("click", (event) => this.onPlayStopClick(event))
    controls.appendChild(playStop)
    const scoreDisplay = document.createElement("div")
    scoreDisplay.classList.add("score-display")
    scoreDisplay.innerHTML = "+0"
    controls.appendChild(scoreDisplay)
    this.controlsTarget.appendChild(controls)
  }

  onInputSourceChange(event) {
    console.log("Input source changed", event.target.value)
    this.inputSource = null
    this.midiAccess = null
    this.microphoneStream = null
    if (event.target.value === "MIDI") {
      this.connectMidi()
    } else if (event.target.value === "Microphone") {
      this.connectMicrophone()
    }
  }

  onModeChange(event) {
    console.log("Mode changed", event.target.value)
  }

  onPlayStopClick(event) {
    console.log("Play/Stop clicked", event.target.innerHTML)
    if (event.target.innerHTML === "Play") {
      event.target.innerHTML = "Stop"
      this.oscillator.connect(this.audioContext.destination);
      this.oscillator.start();
      this.clockTimer = setInterval(() => {
        this.clockNoteIndex = (this.clockNoteIndex + 1) % 12
        this.playCircleClock()
      }, 1000)
    } else {
      this.oscillator.stop(this.audioContext.currentTime);
      if (this.trainerTimer) {
        clearInterval(this.trainerTimer)
        this.trainerTimer = null
      }
      if (this.clockTimer) {
        clearInterval(this.clockTimer)
        this.clockTimer = null
      }
      event.target.innerHTML = "Play"
    }
  }

  renderCurrentNote(circle) {
    let currentNote = circle.querySelector(".current-note")
    if (!currentNote) {
      currentNote = document.createElement("div")
      circle.appendChild(currentNote)
    }
    currentNote.className = ""
    currentNote.classList.add("current-note")
    currentNote.classList.add("note")
    currentNote.classList.add(`note-${this.rootKeys[this.clockNoteIndex]}`)
    currentNote.innerHTML = this.rootKeys[this.clockNoteIndex]
    return currentNote
  }

  renderCircleOfFifths() {
    const circle = document.createElement("div")
    circle.classList.add("circle-of-fifths")
    const box = document.createElement("div")
    box.classList.add("major-key-circle")
    circle.appendChild(box)
    this.contentTarget.appendChild(circle)
    const currentNote = this.renderCurrentNote(box)
    const noteWidth = currentNote.offsetWidth
    currentNote.style.position = "absolute"
    currentNote.style.top = `${
      box.offsetHeight / 2 - currentNote.offsetHeight
    }px`
    currentNote.style.left = `${
      box.offsetWidth / 2 - currentNote.offsetWidth
    }px`
    const radius = box.offsetWidth / 2
    this.rootKeys.forEach((key, index) => {
      const note = document.createElement("div")
      note.classList.add(`note`)
      note.classList.add(`note-${key}`)
      note.innerHTML = key
      const sector = document.createElement("div")
      sector.classList.add(`major-key`)
      sector.style.transform = `rotate(${
        index * (360 / this.rootKeys.length)
      }deg)`
      let angle = ((index * (360 / this.rootKeys.length) - 90) * Math.PI) / 180
      const radiusWithMargin = radius - noteWidth
      sector.style.top = `${
        radiusWithMargin * Math.sin(angle) + radiusWithMargin
      }px`
      sector.style.left = `${
        radiusWithMargin * Math.cos(angle) + radiusWithMargin
      }px`
      sector.appendChild(note)
      box.appendChild(sector)
    })
  }

  playCircleClock() {
    const circle = this.contentTarget.querySelector(".major-key-circle")
    const currentNote = this.renderCurrentNote(circle)
    const noteWidth = currentNote.offsetWidth
    let lineBox = circle.querySelector(".clock-line")
    if (!lineBox) {
      lineBox = document.createElement("div")
      lineBox.classList.add("clock-line")
      circle.appendChild(lineBox)
    }
    lineBox.style.position = "absolute"
    lineBox.style.top = `0`
    lineBox.style.left = `0`
    lineBox.style.width = `${circle.offsetWidth - noteWidth}px`
    lineBox.style.height = `${circle.offsetHeight - noteWidth}px`
    let line = lineBox.querySelector(".line-segment")
    if (!line) {
      line = document.createElement("div")
      line.classList.add("line-segment")
      lineBox.appendChild(line)
    }
    line.style.position = "absolute"
    line.style.top = `${circle.offsetHeight / 2 - noteWidth / 2}px`
    line.style.left = `${circle.offsetWidth / 2 - noteWidth / 2 + 21}px`
    line.style.width = `${circle.offsetWidth / 2 - noteWidth / 2 - 64}px`
    line.style.height = `1px`
    line.style.backgroundColor = "rgba(0, 0, 0, 0.5)"
    let angle = (this.clockNoteIndex % 12) * 30 - 90
    lineBox.style.transform = `rotate(${angle}deg)`


    const frequency = this.noteFrequency[this.rootKeys[this.clockNoteIndex]];
    console.log("Playing note", this.rootKeys[this.clockNoteIndex], frequency);
    const duration = 0.5;
    // this.oscillator.stop(this.audioContext.currentTime + duration);
    const now = this.audioContext.currentTime;
    this.oscillator.type = "sine";
    this.oscillator.frequency.setValueAtTime(frequency, now);
    this.gainNode.gain.setValueAtTime(0, now);
    const adsr = {
      attack: 0.2,
      decay: 0.1,
      sustain: 0.1,
      release: 0.1,
    };
    const { attack, decay, sustain, release } = adsr;
    this.gainNode.gain.linearRampToValueAtTime(1, now + attack);
    this.gainNode.gain.linearRampToValueAtTime(sustain, now + attack + decay);
    this.gainNode.gain.setValueAtTime(sustain, now + duration - release);
    this.gainNode.gain.linearRampToValueAtTime(0, now + duration);
    this.delayNode.delayTime.setValueAtTime(0.3, now);
    this.feedbackGainNode.gain.setValueAtTime(0.5, now);
  }
}
