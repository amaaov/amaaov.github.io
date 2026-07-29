import assert from "node:assert/strict";
import { textToMorse } from "./morse/encode.js";
import { morseToText } from "./morse/decode.js";
import {
  compressMorseText,
  decompressMorseText,
} from "./morse/compress.js";
import { buildTextMorseMap, textMatchesMorse } from "./morse/timeline.js";
import { applyCipher, generatePad } from "./cipher/index.js";
import { morbitKeyFromKeyword } from "./cipher/morbit.js";
import { encodeWav, renderCwSamples } from "./synth/wav.js";
import {
  morseDurationSeconds,
  renderTailSeconds,
  tokenizeMorseAudio,
} from "./synth/wav-render.js";
import {
  ENGINES,
  createAmazonAtmosphere,
  defaultEngineParams,
  paramsForEngine,
  startAmazonVoice,
} from "./synth/engines.js";
import { isOfflineContext } from "./synth/engines/shared.js";
import { MOD_DEFAULTS, lfoShapeName } from "./synth/mod-params.js";
import { recognizeMorseFromImageData } from "./morse/image.js";
import {
  decodeQrPayloadFromImageData,
  matrixToImageData,
} from "./morse/image-matrix.js";
import { payloadToInput } from "./morse/image-read.js";
import { encodeQrMatrix } from "./viz/qr-matrix.js";
import { decodeQrMatrix } from "./viz/qr-decode.js";
import { matrixToAscii } from "./viz/ascii.js";
import { decodeAsciiQrPayload } from "./viz/ascii-parse.js";
import {
  drawGoBoard,
  drawQrLand,
  drawQrPetri,
  drawQrRug,
} from "./viz/draw.js";
import {
  goBoardToSvg,
  landToSvg,
  petriToSvg,
  qrMatrixToSvg,
  qrRugToSvg,
} from "./viz/svg.js";
import {
  MAX_CLOCK_BEATS,
  MIN_SOLO_CLOCK_WEIGHT,
  beatsFromPattern,
  clockViewAt,
  idleClockWindow,
  letterMotionPlan,
  letterSpansFromMorse,
  motionPlanForPatterns,
  patternUnitWeight,
} from "./viz/clock-pattern.js";
import {
  clockBeatMarks,
  clockMarkInk,
  drawBeatClock,
  inkWithAlpha,
} from "./viz/clock.js";
import { createClockAnimator } from "./viz/clock-animate.js";
import { drawBeatLadder } from "./viz/ladder.js";
import {
  plasmaColor,
  plasmaParams,
  plasmaSample,
} from "./viz/plasma-math.js";
import {
  cheapNoise,
  coloredNoise,
  fbmNoise,
  layeredNoise,
  mixNoiseRgb,
  valueNoise,
} from "./viz/plasma-noise.js";
import {
  PLASMA_TYPES,
  normalizePlasmaType,
  plasmaTypeLabel,
} from "./viz/plasma-types.js";
import {
  PLASMA_MAX_BUFFER,
  PLASMA_QUALITIES,
  clampPlasmaBuffer,
  normalizePlasmaQuality,
  plasmaQuality,
  plasmaQualityLabel,
} from "./viz/plasma-quality.js";
import { ladderLayout, throwCurve } from "./viz/ladder-geometry.js";
import {
  isValidSiteswap,
  siteswapStepsFromPatterns,
} from "./viz/ladder-siteswap.js";
import { encodeAnimatedGif } from "./viz/gif-encode.js";
import {
  EXPORT_CLOCK_SIDE,
  EXPORT_PAINT_MS,
  EXPORT_VIDEO_FPS,
  clockMediaFilename,
  exportTailMs,
  extensionForMime,
  pickRecorderMimeType,
  pickWebmMimeType,
  videoBitsForSide,
  videoExportSupported,
} from "./viz/clock-record.js";
import { createHistoryStore } from "./history/store.js";
import { CIPHER_GUIDES } from "./cipher/guides.js";
import { createPlayHighlighter } from "./ui/play-highlight.js";
import { createMorseVoice, unitMsForWpm } from "./synth/voice.js";
import { createEnsemble, MAX_ENSEMBLE_TRACKS } from "./synth/ensemble.js";
import { createCompositionStore } from "./ensemble/compositions.js";
import { buildMidiEvents, formatMidiText } from "./midi/score.js";
import { createMidiPort } from "./midi/port.js";
import { createEnsembleMidiOut } from "./midi/ensemble-out.js";

function fakeCanvas(size = 200) {
  const noop = () => {};
  const gradient = { addColorStop: noop };
  const fillTexts = [];
  return {
    width: size,
    height: size,
    fillTexts,
    getContext() {
      return {
        clearRect: noop,
        fillRect: noop,
        strokeRect: noop,
        beginPath: noop,
        closePath: noop,
        moveTo: noop,
        lineTo: noop,
        arc: noop,
        quadraticCurveTo: noop,
        bezierCurveTo: noop,
        ellipse: noop,
        fill: noop,
        stroke: noop,
        fillText(text, ...rest) {
          fillTexts.push({ text, args: rest });
        },
        save: noop,
        restore: noop,
        clip: noop,
        rect: noop,
        translate: noop,
        rotate: noop,
        scale: noop,
        createLinearGradient: () => gradient,
        createRadialGradient: () => gradient,
        fillStyle: null,
        strokeStyle: null,
        lineWidth: 1,
        lineCap: "butt",
        lineJoin: "miter",
        font: "",
        textAlign: "start",
        textBaseline: "alphabetic",
        globalAlpha: 1,
      };
    },
  };
}

assert.ok(CIPHER_GUIDES.caesar.includes("shift"));
assert.ok(CIPHER_GUIDES.otp.includes("pad"));

const engineIds = new Set(ENGINES.map((engine) => engine.id));
for (const id of [
  "neon",
  "keygen",
  "pulse-chip",
  "crystal",
  "soft-canvas",
  "rain-grid",
  "scene-arp",
  "chord",
  "organism",
  "techno",
  "rhythm",
  "ground",
  "flux",
  "noise",
  "drum",
  "didgeridoo",
  "tribal",
  "amazon",
  "sampler",
]) {
  assert.ok(engineIds.has(id), `missing engine ${id}`);
}
assert.ok(paramsForEngine("neon").some((param) => param.id === "heat"));
assert.ok(paramsForEngine("keygen").some((param) => param.id === "crush"));
assert.ok(paramsForEngine("pulse-chip").some((param) => param.id === "duty"));
assert.ok(paramsForEngine("crystal").some((param) => param.id === "glass"));
assert.ok(paramsForEngine("soft-canvas").some((param) => param.id === "patch"));
assert.ok(paramsForEngine("rain-grid").some((param) => param.id === "tube"));
assert.ok(paramsForEngine("scene-arp").some((param) => param.id === "arpDepth"));
assert.ok(paramsForEngine("noise").some((param) => param.id === "noiseColor"));
assert.ok(paramsForEngine("chord").some((param) => param.id === "voicing"));
assert.ok(paramsForEngine("organism").some((param) => param.id === "chaos"));
assert.ok(paramsForEngine("drum").some((param) => param.id === "kickTone"));
assert.ok(paramsForEngine("didgeridoo").some((param) => param.id === "circular"));
assert.ok(paramsForEngine("tribal").some((param) => param.id === "slap"));
assert.ok(paramsForEngine("amazon").some((param) => param.id === "birds"));
assert.ok(paramsForEngine("amazon").some((param) => param.id === "bugs"));
assert.ok(paramsForEngine("amazon").some((param) => param.id === "fauna"));
assert.ok(paramsForEngine("amazon").some((param) => param.id === "mist"));
assert.ok(paramsForEngine("amazon").some((param) => param.id === "drift"));
assert.ok(paramsForEngine("amazon").some((param) => param.id === "swell"));
assert.equal(typeof createAmazonAtmosphere, "function");
assert.equal(typeof startAmazonVoice, "function");
assert.ok(defaultEngineParams("amazon").birds >= 0.7);
assert.ok(defaultEngineParams("amazon").bugs >= 0.5);
assert.ok(defaultEngineParams("amazon").fauna >= 0.55);
assert.equal(isOfflineContext({ startRendering() {} }), true);
assert.equal(isOfflineContext({}), false);
assert.ok(paramsForEngine("sampler").some((param) => param.id === "grain"));
assert.equal(typeof defaultEngineParams().modIndex, "number");
assert.equal(typeof defaultEngineParams().detune, "number");
assert.equal(typeof MOD_DEFAULTS.lfo1Rate, "number");
assert.equal(typeof MOD_DEFAULTS.envToFilter, "number");
assert.equal(lfoShapeName(0), "sine");
assert.equal(lfoShapeName(2), "square");
assert.equal(lfoShapeName(3), "sawtooth");
assert.equal(
  ENGINES.some((engine) => /lyra|soma|erica|pulsar/i.test(engine.name)),
  false,
);

const sample = "SOS HELP";
const morse = textToMorse(sample);
assert.equal(morse, "... --- ... / .... . .-.. .--.");
assert.equal(morseToText(morse), "SOS HELP");
const timeline = buildTextMorseMap(sample);
assert.equal(timeline.morse, morse);
assert.equal(timeline.letterAtMorse.length, morse.length);
assert.equal(timeline.letterAtMorse[0]?.textFrom, 0);
assert.equal(textMatchesMorse(sample, morse), true);

const roundtrips = [
  ["atbash", {}],
  ["caesar", { shift: 7 }],
  ["affine", { a: 5, b: 8 }],
  ["substitution", { keyword: "SECRET" }],
  ["vigenere", { keyword: "SIGNAL" }],
  ["beaufort", { keyword: "RADIO" }],
  ["autokey", { keyword: "KEY" }],
  ["railfence", { rails: 3 }],
  ["columnar", { keyword: "CARGO" }],
];

for (const [id, options] of roundtrips) {
  const encrypted = await applyCipher(id, "encrypt", "ATTACK AT DAWN", options);
  const decrypted = await applyCipher(id, "decrypt", encrypted, options);
  assert.match(decrypted.toUpperCase().replace(/[^A-Z]/gu, ""), /ATTACK/);
}

assert.equal(compressMorseText(""), "");
assert.equal(decompressMorseText(""), "");
const packedHello = compressMorseText("HELLO WORLD");
assert.match(packedHello, /^[A-I]+$/u);
assert.equal(decompressMorseText(packedHello), "HELLO WORLD");
const packedDawn = compressMorseText("ATTACK AT DAWN");
const cipherAfterCompress = await applyCipher("caesar", "encrypt", packedDawn, {
  shift: 7,
});
const compressedAfterCipher = compressMorseText(cipherAfterCompress);
const decompressOuter = decompressMorseText(compressedAfterCipher);
const decryptMiddle = await applyCipher("caesar", "decrypt", decompressOuter, {
  shift: 7,
});
assert.equal(decompressMorseText(decryptMiddle), "ATTACK AT DAWN");

const pad = generatePad(32);
const otpCipher = await applyCipher("otp", "encrypt", "HELLO WORLD", { pad });
const otpPlain = await applyCipher("otp", "decrypt", otpCipher, { pad });
assert.equal(otpPlain.toUpperCase().replace(/[^A-Z ]/gu, "").trim(), "HELLO WORLD");

const morbitKey = morbitKeyFromKeyword("MORSECODE");
const morbitCipher = await applyCipher("morbit", "encrypt", "CIPHER", {
  morbitKey,
});
const morbitPlain = await applyCipher("morbit", "decrypt", morbitCipher, {
  morbitKey,
});
assert.equal(morbitPlain.replace(/[^A-Z]/gu, ""), "CIPHER");

const bacon = await applyCipher("bacon", "encrypt", "AB");
assert.equal(await applyCipher("bacon", "decrypt", bacon, {}), "AB");

const nihilistCipher = await applyCipher("nihilist", "encrypt", "THEREVOLUTION", {
  squareKey: "ZEBRAS",
  additiveKey: "RUSSIA",
});
assert.match(nihilistCipher, /^\d+( \d+)*$/u);
assert.equal(
  await applyCipher("nihilist", "decrypt", nihilistCipher, {
    squareKey: "ZEBRAS",
    additiveKey: "RUSSIA",
  }),
  "THEREVOLUTION",
);

const bifidCipher = await applyCipher("bifid", "encrypt", "DEFENDTHEEAST", {
  keyword: "CIPHER",
  period: 5,
});
assert.equal(
  await applyCipher("bifid", "decrypt", bifidCipher, {
    keyword: "CIPHER",
    period: 5,
  }),
  "DEFENDTHEEAST",
);

const { samples, sampleRate } = renderCwSamples("... --- ...", {
  frequency: 700,
  wpm: 18,
});
assert.ok(samples.length > sampleRate * 0.5);
const wav = new Uint8Array(encodeWav(samples, sampleRate));
assert.equal(String.fromCharCode(...wav.slice(0, 4)), "RIFF");
assert.equal(String.fromCharCode(...wav.slice(8, 12)), "WAVE");
assert.equal(wav.length, 44 + samples.length * 2);
assert.deepEqual(tokenizeMorseAudio("... ---"), [
  ".",
  ".",
  ".",
  " ",
  "-",
  "-",
  "-",
]);
assert.ok(morseDurationSeconds("...", 18) > 0.3);
assert.ok(morseDurationSeconds("---", 18) > morseDurationSeconds(".", 18));
assert.ok(renderTailSeconds({ delayMs: 200, feedback: 0.4 }) > 0.5);
assert.ok(renderTailSeconds({}) >= 0.25);

const width = 120;
const height = 40;
const pixels = new Uint8ClampedArray(width * height * 4);
for (let index = 0; index < pixels.length; index += 4) {
  pixels[index] = pixels[index + 1] = pixels[index + 2] = 255;
  pixels[index + 3] = 255;
}
function paintBar(x0, x1) {
  for (let y = 12; y < 28; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const index = (y * width + x) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = 0;
    }
  }
}
paintBar(10, 16);
paintBar(22, 28);
paintBar(34, 40);
paintBar(55, 75);
paintBar(85, 105);
paintBar(115, 119);
const recognized = recognizeMorseFromImageData(
  { width, height, data: pixels },
  { threshold: 140 },
);
assert.match(recognized, /\./u);
assert.match(recognized, /-/u);

const qrPayload = "... --- ...";
const qr = encodeQrMatrix(qrPayload);
assert.equal(qr.length, 21);
assert.equal(qr[0].length, 21);
assert.equal(qr[0][0], true);
assert.equal(qr[6][6], true);
assert.equal(qr[0][20], true);
assert.equal(qr[20][0], true);
assert.equal(qr.some((row) => row.some((cell) => cell)), true);
assert.equal(qr.some((row) => row.some((cell) => !cell)), true);
assert.equal(decodeQrMatrix(qr), qrPayload);
const qrImage = matrixToImageData(qr);
assert.equal(decodeQrPayloadFromImageData(qrImage), qrPayload);
const longPayload = textToMorse("MORSE CHANNEL QR ROUND TRIP");
const longQr = encodeQrMatrix(longPayload);
assert.equal(decodeQrMatrix(longQr), longPayload);
assert.equal(decodeQrPayloadFromImageData(matrixToImageData(longQr)), longPayload);
const qrAscii = matrixToAscii(qr, { kind: "qr" });
assert.match(qrAscii, /██/u);
assert.equal(qrAscii.split("\n").length, 21 + 8);
assert.equal(decodeAsciiQrPayload(qrAscii), qrPayload);
const hashAscii = qrAscii.replaceAll("██", "##");
assert.equal(decodeAsciiQrPayload(hashAscii), qrPayload);
const goAscii = matrixToAscii(qr, { kind: "go" });
assert.match(goAscii, /●/u);
assert.match(goAscii, /○/u);
assert.equal(goAscii.split("\n").length, 21);
assert.equal(decodeAsciiQrPayload(goAscii), qrPayload);
const rugAscii = matrixToAscii(qr, { kind: "rug" });
assert.match(rugAscii, /[◆◇·]/u);
assert.equal(rugAscii.includes("║"), false);
assert.equal(rugAscii.includes("┊"), false);
assert.equal(rugAscii.split("\n").length, 21);
assert.equal(rugAscii.split("\n")[0].length, 21);
assert.equal(decodeAsciiQrPayload("hello world"), null);
drawQrRug(fakeCanvas(), qr);
const rugSvg = qrRugToSvg(qr);
assert.match(rugSvg, /<svg[\s\S]*<\/svg>/u);
assert.match(rugSvg, /#070b0a/u);
assert.match(rugSvg, /#7a3a36/u);
assert.match(rugSvg, /#a8884a/u);
assert.match(rugSvg, /rug-pile/u);
assert.match(rugSvg, /C[\d.-]+ [\d.-]+/u);
assert.equal(rugSvg.includes('stroke="#d4af37"'), false);
const landAscii = matrixToAscii(qr, { kind: "land" });
assert.match(landAscii, /[▲◠↟◉⌢░·]/u);
assert.equal(landAscii.split("\n").length, 21);
drawQrLand(fakeCanvas(), qr);
const landSvg = landToSvg(qr);
assert.match(landSvg, /<svg[\s\S]*<\/svg>/u);
assert.match(landSvg, /land-sky/u);
assert.match(landSvg, /#1a2e28/u);
const petriAsciiText = matrixToAscii(qr, { kind: "petri" });
assert.match(petriAsciiText, /[●◉✧· ]/u);
assert.equal(petriAsciiText.split("\n").length, 21);
drawQrPetri(fakeCanvas(), qr);
const petriSvg = petriToSvg(qr);
assert.match(petriSvg, /<svg[\s\S]*<\/svg>/u);
assert.match(petriSvg, /petri-agar/u);
assert.match(petriSvg, /#d8c48a/u);
const fromQr = payloadToInput(qrPayload);
assert.equal(fromQr.kind, "qr-morse");
assert.equal(fromQr.text, "SOS");
const fromText = payloadToInput("HELLO");
assert.equal(fromText.kind, "qr-text");
assert.match(fromText.morse, /[.-]/u);
drawGoBoard(fakeCanvas(), qr);
const qrSvg = qrMatrixToSvg(qr);
assert.match(qrSvg, /<svg[\s\S]*<\/svg>/u);
assert.match(qrSvg, /<rect/u);
assert.match(qrSvg, /shape-rendering="crispEdges"/u);
const goSvg = goBoardToSvg(qr);
assert.match(goSvg, /<svg[\s\S]*<\/svg>/u);
assert.match(goSvg, /<circle/u);
assert.match(goSvg, /board-wood/u);

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

const historyStore = createHistoryStore({ storage: memoryStorage(), maxEntries: 3 });
assert.equal(historyStore.isEnabled(), true);
assert.equal(historyStore.push({ text: "A", morse: ".-" })?.text, "A");
assert.equal(historyStore.push({ text: "B", morse: "-..." })?.text, "B");
assert.equal(historyStore.push({ text: "C", morse: "-.-." })?.text, "C");
assert.equal(historyStore.push({ text: "D", morse: "-.." })?.text, "D");
assert.equal(historyStore.list().length, 3);
assert.equal(historyStore.list()[0].text, "D");
historyStore.setEnabled(false);
assert.equal(historyStore.push({ text: "E", morse: "." }), null);
assert.equal(historyStore.list().length, 3);
historyStore.clear();
assert.equal(historyStore.list().length, 0);
historyStore.setEnabled(true);
assert.equal(historyStore.push({ text: "F", morse: "..-." })?.text, "F");
assert.equal(historyStore.list().length, 1);

const sosSpans = letterSpansFromMorse("... --- ...");
assert.equal(sosSpans.length, 3);
assert.equal(sosSpans[0].pattern, "...");
assert.equal(sosSpans[1].pattern, "---");
assert.equal(sosSpans[2].pattern, "...");
assert.equal(MAX_CLOCK_BEATS, 16);
assert.equal(MIN_SOLO_CLOCK_WEIGHT, 9);
assert.equal(patternUnitWeight(beatsFromPattern("---")), MIN_SOLO_CLOCK_WEIGHT);
const idleSos = idleClockWindow("... --- ...");
assert.equal(idleSos.letterCount, 3);
assert.equal(idleSos.pattern, "...---...");
assert.equal(idleSos.beats.length, 9);
assert.ok(idleSos.beats.length <= MAX_CLOCK_BEATS);
const firstS = clockViewAt(0, "... --- ...", timeline.letterAtMorse, "SOS");
assert.equal(firstS.pattern, "...---...");
assert.equal(firstS.letterCount, 3);
assert.equal(firstS.label.toUpperCase(), "SOS");
assert.equal(firstS.beats.length, 9);
assert.equal(firstS.progressStart, 0);
assert.ok(firstS.progressEnd > firstS.progressStart);
assert.equal(firstS.durationUnits, firstS.toneUnits + firstS.gapUnits);
assert.ok(firstS.gapUnits > 0);
const midO = clockViewAt(
  sosSpans[1].start,
  "... --- ...",
  timeline.letterAtMorse,
  "SOS",
);
assert.equal(midO.pattern, "...---...");
assert.equal(midO.label.toUpperCase(), "SOS");
assert.equal(midO.activeBeatIndex, 3);
const secondS = clockViewAt(
  sosSpans[2].start,
  "... --- ...",
  timeline.letterAtMorse,
  "SOS",
);
assert.equal(secondS.pattern, "...---...");
assert.equal(secondS.letterCount, 3);
assert.equal(secondS.label.toUpperCase(), "SOS");
assert.ok(secondS.activeBeatIndex >= 6);
const planS = letterMotionPlan("...");
assert.equal(planS.segments.length, 3);
assert.equal(planS.segments[0].progressStart, 0);
assert.equal(planS.segments[2].progressEnd, 1);
assert.equal(planS.segments[0].gapUnits, 1);
assert.equal(planS.segments[2].gapUnits, 3);
const planE = letterMotionPlan(".");
assert.equal(planE.segments.length, 1);
assert.equal(planE.segments[0].weight, 1);
assert.equal(planE.segments[0].gapUnits, 3);
const planPair = motionPlanForPatterns(["...", "---"]);
assert.equal(planPair.segments.length, 6);
assert.equal(planPair.segments[2].gapUnits, 3);
assert.equal(planPair.segments[5].gapUnits, 0);
const theTimeline = buildTextMorseMap("THE");
const theMorse = textToMorse("THE");
const theSpans = letterSpansFromMorse(theMorse);
const packedE = clockViewAt(
  theSpans[theSpans.length - 1].start,
  theMorse,
  theTimeline.letterAtMorse,
  "THE",
);
assert.ok(packedE.letterCount >= 2);
assert.notEqual(packedE.label.toUpperCase(), "E");
assert.ok(packedE.label.toUpperCase().includes("E"));
const soloO = clockViewAt(0, "---", null, "O");
assert.equal(soloO.letterCount, 1);
assert.equal(soloO.pattern, "---");
assert.ok(patternUnitWeight(soloO.beats) >= MIN_SOLO_CLOCK_WEIGHT);
const longIdle = idleClockWindow(".".repeat(24));
assert.equal(longIdle.letterCount, 1);
assert.equal(longIdle.beats.length, MAX_CLOCK_BEATS);
const clockWithLetters = fakeCanvas(240);
drawBeatClock(clockWithLetters, {
  beats: idleSos.beats,
  progress: 0.25,
  label: "SOS",
  previousLabel: "SO",
  labelScroll: 0.4,
  activeBeatIndex: 0,
  showLetters: true,
});
assert.ok(clockWithLetters.fillTexts.some((entry) => entry.text === "SOS"));
const clockWithoutLetters = fakeCanvas(240);
drawBeatClock(clockWithoutLetters, {
  beats: idleSos.beats,
  progress: 0.25,
  label: "SOS",
  previousLabel: "SO",
  labelScroll: 0.4,
  activeBeatIndex: 0,
  showLetters: false,
});
assert.equal(
  clockWithoutLetters.fillTexts.some((entry) => entry.text === "SOS"),
  false,
);
const soBeats = beatsFromPattern("...---");
const faceMarks = clockBeatMarks(soBeats, 100);
assert.equal(faceMarks.length, 6);
assert.equal(faceMarks[0].kind, "dit");
assert.equal(faceMarks[3].kind, "dah");
assert.ok(faceMarks[0].dotRadius > 0);
assert.equal(faceMarks[0].ring, faceMarks[3].ring);
assert.ok(Math.abs(faceMarks[0].angle + Math.PI / 2) < 1e-9);
assert.ok(Math.abs(faceMarks[3].angle - faceMarks[0].angle - Math.PI / 2) < 1e-9);
assert.ok(Math.abs(faceMarks[3].arcLength - faceMarks[0].arcLength * 3) < 1e-9);
assert.ok(faceMarks[3].sweep > faceMarks[0].sweep);
assert.notEqual(faceMarks[0].ink, faceMarks[1].ink);
assert.notEqual(faceMarks[3].ink, faceMarks[4].ink);
assert.equal(faceMarks[0].ink, clockMarkInk(0));
assert.equal(faceMarks[1].ink, clockMarkInk(1));
assert.equal(clockMarkInk(0), "#7ADCF5");
assert.equal(clockMarkInk(1), "#C82070");
assert.equal(clockMarkInk(2), "#F2C200");
assert.equal(clockMarkInk(3), "#556677");
assert.equal(inkWithAlpha("#7ADCF5", 0.5), "rgba(122, 220, 245, 0.5)");
const plasmaA = plasmaParams(
  { frequency: 700, filterHz: 3200, drive: 0, wpm: 18, engine: "sine" },
  0.1,
  soBeats,
  0,
  1000,
);
const plasmaB = plasmaParams(
  { frequency: 1200, filterHz: 8000, drive: 0.8, wpm: 32, engine: "square" },
  0.8,
  soBeats,
  3,
  1000,
);
assert.ok(plasmaB.spatial > plasmaA.spatial);
assert.ok(plasmaB.contrast > plasmaA.contrast);
assert.notEqual(plasmaA.hueBase, plasmaB.hueBase);
assert.ok(plasmaB.pulse > plasmaA.pulse);
assert.ok("drift" in plasmaA && "codeWave" in plasmaA);
assert.equal("beats" in plasmaA, false);
const sampleIdle = plasmaSample(0.1, -0.2, plasmaA);
const sampleActive = plasmaSample(0.1, -0.2, plasmaB);
assert.notEqual(sampleIdle, sampleActive);
// Same field math at opposite angles: no pie-slice sector boost.
const left = plasmaSample(-0.3, 0.05, plasmaA);
const right = plasmaSample(0.3, 0.05, plasmaA);
assert.notEqual(left, right);
const rgb = plasmaColor(sampleIdle, plasmaA);
assert.equal(rgb.length, 3);
assert.ok(rgb.every((channel) => channel >= 0 && channel <= 255));
assert.ok(cheapNoise(0.2, -0.1, 1.2, 3) >= 0 && cheapNoise(0.2, -0.1, 1.2, 3) <= 1.2);
assert.ok(valueNoise(1.25, 2.5, 3) >= 0 && valueNoise(1.25, 2.5, 3) <= 1);
assert.ok(fbmNoise(0.2, -0.3, { octaves: 1, seed: 1 }) >= 0);
assert.ok(
  layeredNoise(0.1, 0.2, 1.5, [
    { scale: 4, speed: 0.2, seed: 1 },
    { scale: 9, speed: 0.5, weight: 0.4, seed: 2 },
  ]) >= 0,
);
const noiseRgb = coloredNoise(0.1, 0.2, 1, {
  red: [{ scale: 3, seed: 1 }],
  green: [{ scale: 4, seed: 2 }],
  blue: [{ scale: 5, seed: 3 }],
});
assert.equal(noiseRgb.length, 3);
assert.ok(noiseRgb.every((channel) => channel >= 0 && channel <= 1.2));
const noiseMix = mixNoiseRgb([10, 20, 30], [1, 0, 0.5], 0.5);
assert.equal(noiseMix.length, 3);
assert.ok(noiseMix.every((channel) => channel >= 0 && channel <= 255));

assert.equal(PLASMA_TYPES.length, 12);
assert.equal(normalizePlasmaType("oil-water"), "oil-water");
assert.equal(normalizePlasmaType("tsukuyomi"), "tsukuyomi");
assert.equal(normalizePlasmaType("amaterasu"), "amaterasu");
assert.equal(normalizePlasmaType("susanoo"), "susanoo");
assert.equal(normalizePlasmaType("kaleidoscope"), "kaleidoscope");
assert.equal(normalizePlasmaType("sand"), "sand");
assert.equal(normalizePlasmaType("nope"), "classic");
assert.equal(plasmaTypeLabel("campfire"), "CAMPFIRE");
assert.equal(plasmaTypeLabel("tsukuyomi"), "TSUKUYOMI");
assert.equal(plasmaTypeLabel("amaterasu"), "AMATERASU");
assert.equal(plasmaTypeLabel("susanoo"), "SUSANOO");
assert.equal(plasmaTypeLabel("kaleidoscope"), "KALEIDOSCOPE");
assert.equal(plasmaTypeLabel("sand"), "SAND DRAWING");
assert.equal(PLASMA_QUALITIES.length, 4);
assert.equal(normalizePlasmaQuality("4k"), "4k");
assert.equal(normalizePlasmaQuality("nope"), "live");
assert.equal(plasmaQualityLabel("4k"), "4K");
assert.equal(plasmaQuality("4k").exportSide, 2160);
assert.equal(plasmaQuality("4k").previewBuffer, 1620);
assert.equal(clampPlasmaBuffer(9000), PLASMA_MAX_BUFFER);
assert.equal(clampPlasmaBuffer(12), 48);
assert.ok(videoBitsForSide(2160) > videoBitsForSide(1080));
for (const entry of PLASMA_TYPES) {
  const typed = plasmaParams(
    { frequency: 700, filterHz: 3200, drive: 0.2, wpm: 18, engine: "sine" },
    0.4,
    soBeats,
    1,
    2000,
    {
      type: entry.id,
      letterMask: entry.id === "letter-burn" ? 0.8 : 0,
      letterDust: entry.id === "letter-burn" ? 0.5 : 0,
    },
  );
  assert.equal(typed.type, entry.id);
  const sample = plasmaSample(0.12, -0.15, typed);
  const color = plasmaColor(sample, typed);
  assert.ok(Number.isFinite(sample));
  assert.ok(color.every((channel) => channel >= 0 && channel <= 255));
}
const burnAsh = plasmaColor(
  0.6,
  plasmaParams(
    { frequency: 700, filterHz: 3200, drive: 0.2, wpm: 18, engine: "sine" },
    0.5,
    soBeats,
    1,
    3000,
    { type: "letter-burn", letterMask: 0.1, letterDust: 0.9 },
  ),
);
assert.ok(burnAsh.every((channel) => channel >= 0 && channel <= 255));
assert.ok(
  Math.abs(planPair.segments[3].progressStart * Math.PI * 2 - (faceMarks[3].angle + Math.PI / 2)) <
    1e-9,
);
const swapSo = siteswapStepsFromPatterns(["...", "---"]);
const swapSoThrows = swapSo.map((step) => step.throwValue);
assert.equal(isValidSiteswap(swapSoThrows), true);
assert.equal(isValidSiteswap([3, 1, 3, 1, 3, 0, 0, 0, 4, 1, 4, 1, 4]), false);
assert.equal(swapSo.filter((step) => step.kind === "dit").length, 3);
assert.equal(swapSo.filter((step) => step.kind === "dah").length, 3);
assert.equal(swapSo.filter((step) => step.kind === "zip").length, 4);
assert.equal(swapSo.filter((step) => step.kind === "rest").length, 3);
assert.equal(swapSo.find((step) => step.kind === "dah").units, 3);
assert.equal(swapSo[0].throwValue, 3);
assert.equal(swapSo[1].throwValue, 1);
const swapE = siteswapStepsFromPatterns(["."]);
assert.equal(isValidSiteswap(swapE.map((step) => step.throwValue)), true);
const swapS = siteswapStepsFromPatterns(["..."]);
assert.equal(isValidSiteswap(swapS.map((step) => step.throwValue)), true);
const swapSos = siteswapStepsFromPatterns(["...", "---", "..."]);
const swapSosThrows = swapSos.map((step) => step.throwValue);
assert.equal(isValidSiteswap(swapSosThrows), true);
const ladder = ladderLayout(240, 240, idleSos.beats, idleSos.patterns);
assert.equal(isValidSiteswap(ladder.nodes.map((node) => node.throwValue)), true);
assert.equal(ladder.siteswapText, swapSosThrows.join(""));
assert.equal(ladder.nodes[0].throwValue, 3);
assert.equal(ladder.nodes[1].throwValue, 1);
assert.ok(ladder.nodes.some((node) => node.kind === "dah"));
assert.equal(ladder.nodes[0].hand, 0);
const curve = throwCurve(
  ladder.nodes[0],
  ladder.nodes[1],
  ladder.top,
  ladder.span,
  ladder.nodes.length,
);
assert.ok(curve.peak < ladder.nodes[0].y);
const ladderWithLetters = fakeCanvas(240);
drawBeatLadder(ladderWithLetters, {
  beats: idleSos.beats,
  patterns: idleSos.patterns,
  progress: 0.4,
  label: "SOS",
  previousLabel: "SO",
  labelScroll: 0.5,
  activeBeatIndex: 1,
  showLetters: true,
});
assert.ok(ladderWithLetters.fillTexts.some((entry) => entry.text === "SOS"));
const ladderWithoutLetters = fakeCanvas(240);
drawBeatLadder(ladderWithoutLetters, {
  beats: idleSos.beats,
  patterns: idleSos.patterns,
  progress: 0.4,
  label: "SOS",
  previousLabel: "SO",
  labelScroll: 0.5,
  activeBeatIndex: 1,
  showLetters: false,
});
assert.equal(
  ladderWithoutLetters.fillTexts.some((entry) => entry.text === "SOS"),
  false,
);
assert.equal(EXPORT_CLOCK_SIDE, 1080);
assert.equal(EXPORT_VIDEO_FPS, 30);
assert.equal(EXPORT_PAINT_MS, Math.round(1000 / EXPORT_VIDEO_FPS));
assert.ok(exportTailMs({ delayMs: 120, delayMix: 0.5 }) > exportTailMs({}));
assert.equal(clockMediaFilename("SOS / test!", "webm"), "morse-clock-sos-test.webm");
assert.equal(clockMediaFilename("", "mp4"), "morse-clock-morse.mp4");
assert.equal(pickWebmMimeType(() => false), "");
assert.equal(
  pickWebmMimeType((mime) => mime === "video/webm"),
  "video/webm",
);
assert.equal(pickRecorderMimeType(() => false), "");
assert.equal(
  pickRecorderMimeType((mime) => mime === "video/mp4"),
  "video/mp4",
);
assert.equal(
  pickRecorderMimeType(
    (mime) =>
      mime === "video/webm;codecs=vp9,opus" ||
      mime === "video/webm;codecs=vp8,opus",
  ),
  "video/webm;codecs=vp8,opus",
);
assert.equal(extensionForMime("video/webm;codecs=vp8,opus"), "webm");
assert.equal(extensionForMime("video/mp4"), "mp4");
assert.equal(videoExportSupported(null, () => false, true), false);
assert.equal(
  videoExportSupported(
    { captureStream() {} },
    (mime) => mime === "video/webm",
    true,
  ),
  true,
);
assert.equal(
  videoExportSupported(
    { captureStream() {} },
    (mime) => mime === "video/webm",
    false,
  ),
  false,
);
const gifFrame = new Uint8ClampedArray(4 * 4 * 4);
for (let index = 0; index < gifFrame.length; index += 4) {
  gifFrame[index] = 5;
  gifFrame[index + 1] = 8;
  gifFrame[index + 2] = 7;
  gifFrame[index + 3] = 255;
}
const gifBytes = encodeAnimatedGif([gifFrame, gifFrame], {
  width: 4,
  height: 4,
  delayCs: 10,
});
assert.equal(String.fromCharCode(...gifBytes.slice(0, 4)), "GIF8");
assert.ok(gifBytes.length > 20);
const animator = createClockAnimator({
  canvas: fakeCanvas(120),
  getUnitMs: () => 80,
  draw() {},
});
animator.playBeat(firstS);
assert.equal(animator.getProgress(), 0);
animator.stop(null);

assert.equal(unitMsForWpm(20), 60);
assert.equal(unitMsForWpm(10), 120);
const silentTone = () => ({ stop() {} });
const voiceA = createMorseVoice({
  getDestination: async () => ({}),
  getSettings: () => ({ wpm: 20, engine: "sine", frequency: 700, master: 1 }),
  startTone: silentTone,
});
const voiceB = createMorseVoice({
  getDestination: async () => ({}),
  getSettings: () => ({ wpm: 10, engine: "square", frequency: 700, master: 1 }),
  startTone: silentTone,
});
assert.equal(voiceA.unitMs(), 60);
assert.equal(voiceB.unitMs(), 120);
void voiceA.playMorse(".", { loop: true });
await new Promise((resolve) => setTimeout(resolve, 8));
assert.equal(voiceA.playing, true);
void voiceB.playMorse("-", { loop: true });
await new Promise((resolve) => setTimeout(resolve, 8));
assert.equal(voiceA.playing, true);
assert.equal(voiceB.playing, true);
voiceB.stop();
assert.equal(voiceA.playing, true);
assert.equal(voiceB.playing, false);
voiceA.stop();
assert.equal(voiceA.playing, false);

const enginesHeard = [];
const stopsHeard = [];
let liveSettings = { wpm: 48, engine: "sine", frequency: 700 };
const switchVoice = createMorseVoice({
  getDestination: async () => ({}),
  getSettings: () => liveSettings,
  startTone: (_destination, params) => {
    enginesHeard.push(params.engine);
    return {
      stop() {
        stopsHeard.push(params.engine);
      },
    };
  },
});
void switchVoice.playMorse("....");
await new Promise((resolve) => setTimeout(resolve, 55));
liveSettings = { ...liveSettings, engine: "neon" };
await new Promise((resolve) => setTimeout(resolve, 200));
assert.ok(enginesHeard.includes("sine"), "starts on current engine");
assert.ok(enginesHeard.includes("neon"), "picks up engine change mid-play");
assert.ok(stopsHeard.length >= enginesHeard.length, "cuts prior voices cleanly");
assert.equal(switchVoice.playing, false);

assert.equal(MAX_ENSEMBLE_TRACKS, 4);
const progressEvents = [];
const ensemble = createEnsemble({
  onTrackProgress(id, event) {
    progressEvents.push({ id, event });
  },
  async createRuntime(_track, getSettings) {
    return {
      voice: createMorseVoice({
        getDestination: async () => ({}),
        getSettings,
        startTone: silentTone,
      }),
      gain: { gain: { value: 1 }, disconnect() {}, connect() {} },
    };
  },
});
const trackOne = ensemble.addTrack({ text: "A", wpm: 20, engine: "sine" });
const trackTwo = ensemble.addTrack({ text: "B", wpm: 10, engine: "square" });
assert.ok(trackOne?.morse);
assert.ok(trackTwo?.morse);
assert.equal(trackOne.midiChannel, 1);
assert.equal(trackTwo.midiChannel, 2);
assert.equal(trackOne.midiVelocity, 96);
assert.equal(trackOne.midiNote, 69);
assert.equal(trackOne.midiEnabled, true);
assert.equal(trackOne.midiProgram, -1);
const midiPatched = ensemble.updateTrack(trackOne.id, {
  midiChannel: 12,
  midiVelocity: 40,
  midiNote: 60,
  midiProgram: 5,
  midiEnabled: false,
});
assert.equal(midiPatched.midiChannel, 12);
assert.equal(midiPatched.midiVelocity, 40);
assert.equal(midiPatched.midiNote, 60);
assert.equal(midiPatched.midiProgram, 5);
assert.equal(midiPatched.midiEnabled, false);
assert.equal(ensemble.updateTrack(trackOne.id, { midiChannel: 99 }).midiChannel, 16);
assert.equal(ensemble.updateTrack(trackOne.id, { midiVelocity: 0 }).midiVelocity, 1);
assert.equal(ensemble.snapshot().tracks[0].midiProgram, 5);
ensemble.updateTrack(trackOne.id, {
  midiChannel: 1,
  midiVelocity: 96,
  midiNote: 69,
  midiProgram: -1,
  midiEnabled: true,
});
await ensemble.startAll();
await new Promise((resolve) => setTimeout(resolve, 8));
assert.equal(ensemble.trackPlaying(trackOne.id), true);
assert.equal(ensemble.trackPlaying(trackTwo.id), true);
assert.ok(progressEvents.some((entry) => entry.id === trackOne.id && entry.event?.token));
assert.ok(progressEvents.some((entry) => entry.id === trackTwo.id && entry.event?.token));
ensemble.stopAll();
assert.equal(ensemble.trackPlaying(trackOne.id), false);
assert.equal(ensemble.trackPlaying(trackTwo.id), false);
assert.ok(progressEvents.some((entry) => entry.id === trackOne.id && entry.event == null));
assert.equal(ensemble.addTrack({ text: "C" })?.id != null, true);
assert.equal(ensemble.addTrack({ text: "D" })?.id != null, true);
assert.equal(ensemble.addTrack({ text: "E" }), null);

const swapEnsemble = createEnsemble({
  async createRuntime(_track, getSettings) {
    return {
      voice: createMorseVoice({
        getDestination: async () => ({}),
        getSettings,
        startTone: silentTone,
      }),
      gain: { gain: { value: 1 }, disconnect() {}, connect() {} },
    };
  },
});
swapEnsemble.addTrack({ text: "HI", wpm: 18, engine: "sine" });
await swapEnsemble.startAll();
await new Promise((resolve) => setTimeout(resolve, 8));
assert.equal(swapEnsemble.anyPlaying(), true);
await swapEnsemble.replaceTracks([
  { text: "OK", wpm: 22, engine: "square" },
  { text: "CQ", wpm: 12, engine: "triangle" },
]);
await new Promise((resolve) => setTimeout(resolve, 8));
assert.equal(swapEnsemble.list().length, 2);
assert.equal(swapEnsemble.list()[0].text, "OK");
assert.equal(swapEnsemble.anyPlaying(), true);
assert.deepEqual(
  swapEnsemble.snapshot().tracks.map((track) => track.text),
  ["OK", "CQ"],
);
swapEnsemble.stopAll();
assert.equal(swapEnsemble.anyPlaying(), false);

const mixEnsemble = createEnsemble({
  async createRuntime(_track, getSettings) {
    return {
      voice: createMorseVoice({
        getDestination: async () => ({}),
        getSettings,
        startTone: silentTone,
      }),
      gain: { gain: { value: 1 }, disconnect() {}, connect() {} },
      pan: { pan: { value: 0 }, disconnect() {}, connect() {} },
    };
  },
});
const mixTrack = mixEnsemble.addTrack({
  text: "A",
  gain: 0.5,
  pan: -0.4,
  delayMix: 0.3,
  delayMs: 220,
  delayFeedback: 0.4,
});
assert.equal(mixTrack.gain, 0.5);
assert.equal(mixTrack.pan, -0.4);
assert.equal(mixTrack.delayMix, 0.3);
assert.equal(mixTrack.delayMs, 220);
const mixed = mixEnsemble.updateTrack(mixTrack.id, {
  gain: 0.8,
  pan: 0.6,
  delayMix: 0.5,
  delayMs: 90,
  delayFeedback: 0.7,
});
assert.equal(mixed.gain, 0.8);
assert.equal(mixed.pan, 0.6);
assert.equal(mixed.delayMix, 0.5);
assert.equal(mixed.delayMs, 90);
assert.equal(mixEnsemble.updateTrack(mixTrack.id, { gain: 2, pan: -3 }).gain, 1);
assert.equal(mixEnsemble.list()[0].pan, -1);
assert.equal(mixEnsemble.snapshot().tracks[0].pan, -1);
assert.equal(mixEnsemble.snapshot().tracks[0].delayFeedback, 0.7);
const master = mixEnsemble.setMaster({ reverb: 0.5, compression: 0.8 });
assert.equal(master.reverb, 0.5);
assert.equal(master.compression, 0.8);
assert.equal(mixEnsemble.setMaster({ reverb: 2 }).reverb, 1);
assert.equal(mixEnsemble.snapshot().master.compression, 0.8);

const compositionStore = createCompositionStore({ storage: memoryStorage() });
assert.equal(compositionStore.save({ tracks: [] }), null);
assert.equal(compositionStore.nextDefaultName(), "1");
const savedComposition = compositionStore.save({
  tracks: [
    {
      text: "SOS",
      wpm: 18,
      engine: "sine",
      delayMix: 0.25,
      delayMs: 300,
      delayFeedback: 0.5,
      midiChannel: 3,
      midiNote: 72,
      midiVelocity: 80,
      midiProgram: 12,
      midiEnabled: false,
    },
    { text: "CQ", wpm: 12, engine: "square" },
  ],
  master: { reverb: 0.4, compression: 0.6 },
});
assert.ok(savedComposition?.id);
assert.equal(savedComposition.name, "1");
assert.equal(savedComposition.tracks[0].delayMs, 300);
assert.equal(savedComposition.tracks[0].midiChannel, 3);
assert.equal(savedComposition.tracks[0].midiNote, 72);
assert.equal(savedComposition.tracks[0].midiVelocity, 80);
assert.equal(savedComposition.tracks[0].midiProgram, 12);
assert.equal(savedComposition.tracks[0].midiEnabled, false);
assert.equal(savedComposition.tracks[1].midiChannel, 1);
assert.equal(savedComposition.tracks[1].midiEnabled, true);
assert.equal(savedComposition.master.reverb, 0.4);
assert.equal(compositionStore.nextDefaultName(), "2");
const secondComposition = compositionStore.save({
  tracks: [{ text: "OK", wpm: 18, engine: "sine" }],
});
assert.equal(secondComposition.name, "2");
assert.equal(compositionStore.list().length, 2);
const updatedComposition = compositionStore.save({
  id: savedComposition.id,
  name: "Night set",
  tracks: [{ text: "TEST", wpm: 20, engine: "sine" }],
});
assert.equal(updatedComposition.id, savedComposition.id);
assert.equal(updatedComposition.name, "Night set");
assert.equal(compositionStore.get(savedComposition.id).tracks[0].text, "TEST");
compositionStore.remove(savedComposition.id);
compositionStore.remove(secondComposition.id);
assert.equal(compositionStore.list().length, 0);

const midiSos = buildMidiEvents("... --- ...", { wpm: 20, note: 69, channel: 0 });
assert.equal(midiSos.filter((event) => event.label === "ON").length, 9);
assert.equal(midiSos[0].status, 0x90);
assert.equal(midiSos[1].status, 0x80);
assert.equal(midiSos[0].note, 69);
assert.equal(midiSos[1].atMs - midiSos[0].atMs, 60);
const firstDah = midiSos.find((event) => event.token === "-" && event.label === "ON");
const firstDahOff = midiSos.find(
  (event) => event.token === "-" && event.label === "OFF" && event.atMs > firstDah.atMs,
);
assert.equal(firstDahOff.atMs - firstDah.atMs, 180);
const midiText = formatMidiText(midiSos, { wpm: 20, note: 69, channel: 0 });
assert.ok(midiText.includes("ch1 note69"));
assert.ok(midiText.includes("90 45 60"));
assert.equal(formatMidiText([], { wpm: 18, note: 60, channel: 1 }).includes("(empty)"), true);

const midiSent = [];
const fakeMidiAccess = {
  outputs: new Map([
    [
      "out-1",
      {
        id: "out-1",
        name: "Test Out",
        send(bytes) {
          midiSent.push([...bytes]);
        },
      },
    ],
  ]),
};
const midiPortUnderTest = createMidiPort();
assert.equal(midiPortUnderTest.supported(), typeof navigator !== "undefined" && Boolean(navigator.requestMIDIAccess));
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    ...(globalThis.navigator || {}),
    requestMIDIAccess: async () => fakeMidiAccess,
  },
});
const midiOutputs = await midiPortUnderTest.enable();
assert.equal(midiOutputs.length, 1);
assert.equal(midiPortUnderTest.ready, true);
assert.equal(midiPortUnderTest.keyOn("a", { channel: 0, note: 60, velocity: 100 }), true);
assert.equal(midiPortUnderTest.keyOn("b", { channel: 1, note: 64, velocity: 80 }), true);
assert.equal(midiPortUnderTest.activeKeys, 2);
assert.deepEqual(midiSent[0], [0x90, 60, 100]);
assert.deepEqual(midiSent[1], [0x91, 64, 80]);
midiPortUnderTest.keyOff("a");
assert.deepEqual(midiSent[2], [0x80, 60, 0]);
assert.equal(midiPortUnderTest.activeKeys, 1);
midiPortUnderTest.program(2, 12);
assert.deepEqual(midiSent[3], [0xc2, 12]);
midiPortUnderTest.stopAll();
assert.equal(midiPortUnderTest.activeKeys, 0);
assert.ok(midiSent.some((bytes) => bytes[0] === 0xb1 && bytes[1] === 123));

midiSent.length = 0;
const ensembleMidi = createEnsembleMidiOut(midiPortUnderTest);
ensembleMidi.onTrackProgress(
  {
    id: "t1",
    wpm: 20,
    midiChannel: 4,
    midiNote: 67,
    midiVelocity: 90,
    midiProgram: 3,
    midiEnabled: true,
  },
  { token: ".", offset: 0 },
);
assert.deepEqual(midiSent[0], [0xc3, 3]);
assert.deepEqual(midiSent[1], [0x93, 67, 90]);
ensembleMidi.onTrackProgress(
  { id: "t1", wpm: 20, midiChannel: 4, midiNote: 67, midiVelocity: 90, midiEnabled: false },
  { token: ".", offset: 1 },
);
assert.ok(midiSent.some((bytes) => bytes[0] === 0x83 && bytes[1] === 67));
ensembleMidi.stop();

function fakeDomField(value = "") {
  const field = {
    value,
    scrollTop: 0,
    scrollLeft: 0,
    parentElement: null,
    className: "",
    classList: {
      flags: new Set(),
      toggle(name, force) {
        if (force === true) this.flags.add(name);
        else if (force === false) this.flags.delete(name);
        else if (this.flags.has(name)) this.flags.delete(name);
        else this.flags.add(name);
        return this.flags.has(name);
      },
      contains(name) {
        return this.flags.has(name);
      },
    },
    closest(selector) {
      let node = this;
      while (node) {
        if (
          selector === ".mirror-shell" &&
          String(node.className).includes("mirror-shell")
        ) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    },
    addEventListener() {},
    setAttribute() {},
    append(...nodes) {
      for (const node of nodes) {
        node.parentElement = this;
        this._kids.push(node);
      }
    },
    querySelector(selector) {
      if (selector === ".mirror-layer") {
        return this._kids.find((node) => node.className === "mirror-layer") || null;
      }
      return null;
    },
    insertBefore(node) {
      node.parentElement = this;
      this._kids.push(node);
    },
    _kids: [],
    textContent: "",
    innerHTML: "",
  };
  const parent = {
    _kids: [],
    insertBefore(node) {
      node.parentElement = this;
      this._kids.push(node);
    },
    querySelector() {
      return null;
    },
  };
  field.parentElement = parent;
  return field;
}

globalThis.document = {
  createElement(tag) {
    const node = fakeDomField("");
    node.tagName = String(tag).toUpperCase();
    return node;
  },
};

const highlightText = fakeDomField("SOS");
const highlightMorse = fakeDomField("... --- ...");
const highlightOutput = fakeDomField("SOS");
const highlighter = createPlayHighlighter({
  textInput: highlightText,
  morseInput: highlightMorse,
  output: highlightOutput,
});
const sosMap = buildTextMorseMap("SOS");
highlighter.begin({
  playedMorse: "... --- ...",
  outputText: "SOS",
  outputMorse: "... --- ...",
  outputMode: "text",
  inputText: "SOS",
  inputMorse: "... --- ...",
  inputMode: "text",
  letterAtMorse: sosMap.letterAtMorse,
  inputLetterAtMorse: sosMap.letterAtMorse,
});
highlighter.progress({ offset: 0, token: "." });
assert.equal(highlightText.closest(".mirror-shell").classList.contains("is-playing-highlight"), true);
highlightText.value = "SO";
highlighter.progress({ offset: 1, token: "." });
assert.equal(highlightText.closest(".mirror-shell").classList.contains("is-playing-highlight"), false);
highlighter.end();

const editVoice = createMorseVoice({
  getDestination: async () => ({}),
  getSettings: () => ({ wpm: 40, engine: "sine", frequency: 700 }),
  startTone: () => ({ stop() {} }),
});
void editVoice.playMorse("....");
assert.equal(editVoice.playing, true);
editVoice.stop();
assert.equal(editVoice.playing, false);

console.log("smoke ok");
