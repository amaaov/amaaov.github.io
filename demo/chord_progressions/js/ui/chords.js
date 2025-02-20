import {
  getCurrentRoot,
  getCurrentScale,
  getSoundControls,
} from "./controls.js";
import { generateChordPositions, generateChords } from "../patterns/chords.js";
import { addChordEventHandlers } from "../events.js";
import { CHORD_POSITIONS, PROGRESSION_PATTERNS } from "../constants/ui.js";
import { NOTES } from "../constants/audio.js";
import { randomInRange } from "../utils/math.js";

let isUpdating = false;
let updateTimeout = null;
let chordContainer = null;

// Initialize chord display
function initChordDisplay() {
  console.log("Initializing chord display...");

  // Try multiple selectors to find the chord container
  const selectors = [".chord-container", "#chord-container"];
  for (const selector of selectors) {
    chordContainer = document.querySelector(selector);
    if (chordContainer) {
      console.log(`Chord container found using selector: ${selector}`);
      break;
    }
  }

  if (!chordContainer) {
    console.error("Failed to find chord container by any selector");
    // Try to create the container if it doesn't exist
    const chordDisplay = document.querySelector(".chord-display");
    if (chordDisplay) {
      console.log("Found chord-display, creating chord container");
      chordContainer = document.createElement("div");
      chordContainer.id = "chord-container";
      chordContainer.className = "chord-container";
      chordDisplay.appendChild(chordContainer);
    } else {
      console.error("Could not find chord-display element");
      return false;
    }
  }

  // Ensure the container has the correct styles
  chordContainer.style.position = "relative";
  chordContainer.style.zIndex = "2";
  chordContainer.style.width = "100%";
  chordContainer.style.height = "100vh";
  chordContainer.style.minHeight = "500px";
  chordContainer.style.display = "flex";
  chordContainer.style.justifyContent = "center";
  chordContainer.style.alignItems = "center";

  console.log("Chord container initialized with dimensions:", {
    width: chordContainer.clientWidth,
    height: chordContainer.clientHeight,
    offsetWidth: chordContainer.offsetWidth,
    offsetHeight: chordContainer.offsetHeight,
  });

  return true;
}

// Create and position chord elements in hexagon
export function createChordHexagon(chords) {
  if (!chordContainer && !initChordDisplay()) {
    console.error("Failed to initialize chord display");
    return;
  }

  if (!chords || !Array.isArray(chords) || chords.length === 0) {
    console.error("Invalid chords array:", chords);
    return;
  }

  console.log("Creating chord hexagon with", chords.length, "chords");
  chordContainer.dataset.updating = "true";

  try {
    // Clean up old elements
    while (chordContainer.firstChild) {
      chordContainer.removeChild(chordContainer.firstChild);
    }

    // Calculate container dimensions and radius
    const containerWidth = chordContainer.clientWidth || window.innerWidth;
    const containerHeight = chordContainer.clientHeight || window.innerHeight;
    const minDimension = Math.min(containerWidth, containerHeight);
    const radius = minDimension * 0.25;

    console.log("Container dimensions:", {
      width: containerWidth,
      height: containerHeight,
      radius: radius,
    });

    // Create SVG container for connections
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "connections");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.style.position = "absolute";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.pointerEvents = "none";
    chordContainer.appendChild(svg);

    // Add root note display in center
    const rootNote = getCurrentRoot();
    const rootNoteDisplay = document.createElement("div");
    rootNoteDisplay.className = "root-note";
    rootNoteDisplay.textContent = rootNote;
    chordContainer.appendChild(rootNoteDisplay);

    // Calculate positions for each chord
    const angleStep = (2 * Math.PI) / chords.length;
    const positions = chords.map((_, index) => {
      const angle = index * angleStep - Math.PI / 2; // Start from top
      return {
        x: Math.cos(angle) * radius + containerWidth / 2,
        y: Math.sin(angle) * radius + containerHeight / 2,
        angle: angle * (180 / Math.PI),
      };
    });

    // Create and position chord elements
    const chordElements = chords.map((chord, index) => {
      const position = positions[index];
      const element = createChordElement(chord, position);
      if (element) {
        chordContainer.appendChild(element);
      }
      return element;
    }).filter(Boolean);

    // Draw connections between chords
    if (chordElements.length > 0) {
      drawConnections(positions, svg);
    }

    // Reset updating flag
    chordContainer.dataset.updating = "false";
    console.log(
      "Chord hexagon created successfully with",
      chordElements.length,
      "chords",
    );
  } catch (error) {
    console.error("Error creating chord hexagon:", error);
    chordContainer.dataset.updating = "false";
  }
}

// Function to create a chord element
function createChordElement(chord, position) {
  const chordElement = document.createElement("div");
  chordElement.className = `chord ${getProgressionClass(chord)}`;
  chordElement.dataset.type = chord.type;

  // Position the chord element
  chordElement.style.position = "absolute";
  chordElement.style.left = `${position.x}px`;
  chordElement.style.top = `${position.y}px`;
  chordElement.style.transform = "translate(-50%, -50%)";

  // Create note display
  const nameElement = document.createElement("div");
  nameElement.className = "name";
  nameElement.textContent = chord.root; // Just the root note

  // Create chord modifier display
  const typeElement = document.createElement("div");
  typeElement.className = "type";
  typeElement.textContent = formatChordType(chord.type); // Format the chord type

  // Add elements to chord
  chordElement.appendChild(nameElement);
  chordElement.appendChild(typeElement);

  // Store frequencies in the chord element
  const frequencies = [chord.root, ...chord.intervals]
    .map(note => getNoteFrequency(note))
    .filter(freq => freq !== null); // Filter out invalid frequencies

  if (frequencies.length === 0) {
    console.warn("No valid frequencies for chord:", chord);
    return null;
  }

  chordElement.dataset.frequencies = frequencies.join(",");

  // Add event handlers
  addChordEventHandlers(chordElement, chord);

  return chordElement;
}

// Helper function to get progression class
function getProgressionClass(chord) {
  // Determine chord quality
  const type = chord.type.toLowerCase();
  if (type.includes("maj") || type === "") {
    return "progression-positive";
  } else if (type.includes("min") || type.includes("m7")) {
    return "progression-sad";
  } else if (
    type.includes("dim") || type.includes("aug") || type.includes("alt")
  ) {
    return "progression-dark";
  }
  return "progression-positive"; // default
}

// Helper function to format chord type
function formatChordType(type) {
  // Remove common prefixes and format nicely
  return type
    .replace("maj", "")
    .replace("min", "m")
    .replace("dim", "°")
    .replace("aug", "+")
    .trim();
}

// Function to draw connections between chords
function drawConnections(positions, svg) {
  if (!positions || positions.length < 2) return;

  // Create path for connections
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "connection-path");

  // Build path data starting from the first position
  let pathData = `M ${positions[0].x} ${positions[0].y}`;

  // Add lines to each subsequent position
  for (let i = 1; i < positions.length; i++) {
    pathData += ` L ${positions[i].x} ${positions[i].y}`;
  }

  // Close the path back to the first position
  pathData += ` L ${positions[0].x} ${positions[0].y}`;

  path.setAttribute("d", pathData);
  svg.appendChild(path);
}

// Function to get frequency for a note
function getNoteFrequency(note) {
  // If note is already a number (frequency), return it
  if (typeof note === "number") {
    // Validate the frequency
    if (!Number.isFinite(note) || note <= 0) {
      console.warn("Invalid frequency value:", note);
      return null;
    }
    return note;
  }

  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const baseFreq = 261.63; // Middle C

  // Handle both string notes and objects with root property
  const noteStr = typeof note === "string" ? note : note.root;
  if (!noteStr) {
    console.warn("Invalid note object:", note);
    return null;
  }

  const noteIndex = notes.indexOf(noteStr.replace(/\d+/, "")); // Remove octave number
  if (noteIndex === -1) {
    console.warn("Invalid note:", noteStr);
    return null;
  }

  // Get octave shift from controls
  const soundControls = getSoundControls();
  const octaveShift = soundControls?.oscillator?.octave?.value || 0;
  const octaveFactor = Math.pow(2, parseFloat(octaveShift));

  // Calculate frequency with octave shift and validate
  const freq = baseFreq * Math.pow(2, noteIndex / 12) * octaveFactor;
  if (!Number.isFinite(freq) || freq <= 0) {
    console.warn("Invalid calculated frequency for note:", noteStr, freq);
    return null;
  }

  return freq;
}

// Update chords based on current settings
export function updateChords() {
  console.log("updateChords called");

  if (isUpdating) {
    console.log("Update already in progress, skipping...");
    return;
  }
  isUpdating = true;

  try {
    console.log("Getting current root and scale...");
    const root = getCurrentRoot();
    const scale = getCurrentScale();
    console.log("Current root:", root, "scale:", scale);

    if (!root || !scale) {
      throw new Error(`Invalid root (${root}) or scale (${scale})`);
    }

    // Generate chords based on current settings
    console.log("Generating chords...");
    const chords = generateChords(root, scale);
    console.log("Generated chords:", chords);

    if (!chords || chords.length === 0) {
      throw new Error("No chords generated");
    }

    // Create chord hexagon
    console.log("Creating chord hexagon...");
    createChordHexagon(chords);

    // Wait for DOM to update
    return new Promise((resolve, reject) => {
      requestAnimationFrame(() => {
        try {
          // Add event handlers to new chord elements
          const chordElements = document.querySelectorAll(".chord");
          console.log("Found chord elements:", chordElements.length);

          chordElements.forEach((element, index) => {
            if (element && chords[index]) {
              addChordEventHandlers(element, chords[index]);
            }
          });

          console.log("Chord display updated successfully");
          resolve();
        } catch (error) {
          console.error("Error adding chord event handlers:", error);
          reject(error);
        } finally {
          isUpdating = false;
        }
      });
    });
  } catch (error) {
    console.error("Error updating chords:", error);
    isUpdating = false;
    throw error;
  }
}

// Show upcoming sequence in FUN mode
export function showUpcomingSequence(sequence) {
  // Clear all upcoming indicators
  document.querySelectorAll(".chord").forEach((chord) => {
    chord.classList.remove("upcoming");
    chord.removeAttribute("data-sequence");
  });

  // Show the upcoming sequence without moving chords
  const chords = document.querySelectorAll(".chord");
  sequence.forEach((index, sequenceNumber) => {
    const chord = chords[index];
    if (chord && !chord.classList.contains("playing")) {
      chord.classList.add("upcoming");
      chord.setAttribute("data-sequence", sequenceNumber + 1);
    }
  });
}
