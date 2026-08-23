import { seededRandom } from "./siteswap_generator.js";
import { siteswapBallCount, siteswapIsValid } from "./siteswap.js";

const CLAY = { r: 196, g: 165, b: 106 };
const NIGHT = { r: 36, g: 42, b: 58 };
const STORM = { r: 88, g: 90, b: 86 };
const SYNODIC_DAYS = 29.530588;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const LATITUDE = 55 * (Math.PI / 180);

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function mixChannel(from, to, amount) {
  return Math.round(from + (to - from) * clamp(amount, 0, 1));
}

function unitNoise(value) {
  return (
    Math.sin(value * 1.7) * 0.5
    + Math.sin(value * 0.31 + 1.2) * 0.35
    + Math.sin(value * 4.1 + 0.4) * 0.15
  );
}

function dayOfYear(date) {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 0);
  return (Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) - start) / 86_400_000;
}

function sunAltitude(date) {
  const declination = 23.44 * Math.sin((2 * Math.PI * (dayOfYear(date) - 81)) / 365) * (Math.PI / 180);
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
  const hourAngle = (hour - 12) * 15 * (Math.PI / 180);
  const sine = Math.sin(LATITUDE) * Math.sin(declination)
    + Math.cos(LATITUDE) * Math.cos(declination) * Math.cos(hourAngle);
  return Math.asin(clamp(sine, -1, 1));
}

function moonPhase(date) {
  const age = (date.getTime() - KNOWN_NEW_MOON) / 86_400_000;
  return ((age / SYNODIC_DAYS) % 1 + 1) % 1;
}

function hashText(text) {
  let hash = 2166136261;
  for (const character of String(text)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function heightCharacter(height) {
  if (height < 10) {
    return String(height);
  }
  return String.fromCharCode(87 + height);
}

function mutateVanilla(source, random) {
  if (!/^[0-9a-z]+$/i.test(source)) {
    return null;
  }
  const slots = [...source].map((character, index) => (
    /[0-9a-z]/i.test(character) ? index : -1
  )).filter((index) => index >= 0);
  if (slots.length === 0) {
    return null;
  }
  const index = slots[Math.floor(random() * slots.length)];
  const height = source[index] <= "9"
    ? Number(source[index])
    : 10 + source[index].toLowerCase().charCodeAt(0) - 97;
  const next = height + (random() < 0.5 ? -1 : 1);
  if (next < 0 || next > 15) {
    return null;
  }
  const candidate = `${source.slice(0, index)}${heightCharacter(next)}${source.slice(index + 1)}`;
  if (!siteswapIsValid(candidate) || siteswapBallCount(candidate) !== siteswapBallCount(source)) {
    return null;
  }
  return candidate;
}

const NEARBY = {
  3: ["531", "441", "423", "522", "51"],
  531: ["3", "441", "522", "451"],
  441: ["3", "531", "522"],
  55500: ["3", "531"],
};

function nearbySiteswap(source, random) {
  const pool = (NEARBY[source] ?? []).filter((candidate) => (
    siteswapIsValid(candidate) && siteswapBallCount(candidate) === siteswapBallCount(source)
  ));
  if (pool.length === 0) {
    return null;
  }
  return pool[Math.floor(random() * pool.length)];
}

export function cosmologyWeather({ at = new Date(), elapsedSeconds = 0 } = {}) {
  const altitude = sunAltitude(at);
  const sun = clamp((altitude + 0.15) / (Math.PI / 2 + 0.15), 0, 1);
  const moon = 0.5 - 0.5 * Math.cos(2 * Math.PI * moonPhase(at));
  const sidereal = ((at.getTime() / 86_164_090) % 1 + 1) % 1;
  const moonHeight = clamp(0.5 + 0.5 * Math.sin((sidereal + moon) * 2 * Math.PI), 0, 1);
  const stars = clamp(1 - sun * 1.35, 0, 1);
  const swell = 0.5 + 0.5 * unitNoise(elapsedSeconds / 11 + sidereal * 6);
  const storm = clamp((1 - sun) * 0.35 + (1 - moonHeight) * 0.2 + swell * 0.55, 0, 1);
  const lowSignal = clamp(elapsedSeconds / 90 + storm * 0.28, 0, 1);
  return {
    sun,
    moon,
    moonHeight,
    stars,
    sidereal,
    storm,
    gravity: clamp(0.78 + sun * 0.42 - moon * 0.1 + storm * 0.16, 0.55, 1.55),
    windX: (unitNoise(elapsedSeconds / 7 + 0.4) * 0.04 + storm * 0.07) * (sidereal > 0.5 ? 1 : -1),
    windY: unitNoise(elapsedSeconds / 9 + 1.8) * 0.018 * storm,
    modulation: unitNoise(elapsedSeconds / 13) * 0.1 * (0.35 + storm),
    tempoBend: clamp(1 + unitNoise(elapsedSeconds / 17 + moon) * 0.08 * (0.4 + storm), 0.86, 1.16),
    feedback: clamp(storm * 0.55 + moon * 0.18 + lowSignal * 0.2, 0, 1),
    lowSignal,
    chaos: clamp(storm * 0.7 + stars * 0.2 + lowSignal * 0.25, 0, 1),
  };
}

export function cosmologySiteswap(source, epoch, chaos) {
  if (!siteswapIsValid(source) || chaos < 0.42) {
    return source;
  }
  const random = seededRandom((hashText(source) ^ (epoch >>> 0)) >>> 0);
  if (random() > chaos) {
    return source;
  }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const mutated = mutateVanilla(source, random);
    if (mutated && mutated !== source) {
      return mutated;
    }
  }
  return nearbySiteswap(source, random) ?? source;
}

export function cosmologyState({
  at = new Date(),
  elapsedSeconds = 0,
  source = "3",
  enabled = false,
} = {}) {
  if (!enabled) {
    return { active: false, source, weather: null };
  }
  const weather = cosmologyWeather({ at, elapsedSeconds });
  const epoch = Math.floor(elapsedSeconds / Math.max(1.6, 9 - weather.storm * 6));
  return {
    active: true,
    source: cosmologySiteswap(source, epoch, weather.chaos),
    weather,
  };
}

export function courtGroundFill(sky) {
  if (!sky) {
    return "#c4a56a";
  }
  const night = clamp(1 - sky.sun, 0, 1);
  const storm = sky.storm ?? 0;
  const r = mixChannel(mixChannel(CLAY.r, NIGHT.r, night), STORM.r, storm * 0.45);
  const g = mixChannel(mixChannel(CLAY.g, NIGHT.g, night), STORM.g, storm * 0.45);
  const b = mixChannel(mixChannel(CLAY.b, NIGHT.b, night), STORM.b, storm * 0.45);
  return `rgb(${r}, ${g}, ${b})`;
}

export function paintCourtSky(context, rect, sky, scale) {
  if (!sky) {
    return;
  }
  const inset = Math.max(8, 18 * scale);
  const left = rect.left + inset;
  const top = rect.top + inset;
  const width = rect.width - inset * 2;
  const height = rect.height - inset * 2;
  if (sky.stars > 0.22) {
    context.fillStyle = `rgba(247, 240, 228, ${0.18 + sky.stars * 0.45})`;
    for (let index = 0; index < 14; index += 1) {
      const angle = (sky.sidereal + index * 0.137) * Math.PI * 2;
      const radius = 0.12 + ((index * 17) % 9) * 0.03;
      const x = left + width * (0.5 + Math.cos(angle) * radius + (index % 5) * 0.08);
      const y = top + height * (0.16 + ((index * 13) % 7) * 0.05);
      context.fillRect(x, y, Math.max(1.1, 1.6 * scale), Math.max(1.1, 1.6 * scale));
    }
  }
  if (sky.sun > 0.12) {
    context.fillStyle = `rgba(236, 176, 72, ${0.25 + sky.sun * 0.55})`;
    context.beginPath();
    context.arc(
      left + width * (0.18 + sky.sun * 0.12),
      top + height * (0.22 - sky.sun * 0.08),
      Math.max(5, 11 * scale) * (0.7 + sky.sun * 0.5),
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  if (sky.moonHeight > 0.18 && sky.moon > 0.08) {
    context.fillStyle = `rgba(232, 226, 214, ${0.2 + sky.moon * 0.5})`;
    context.beginPath();
    context.arc(
      left + width * (0.78 - sky.moonHeight * 0.08),
      top + height * (0.2 + (1 - sky.moonHeight) * 0.1),
      Math.max(4, 9 * scale) * (0.55 + sky.moon * 0.45),
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  if (sky.storm > 0.55) {
    context.strokeStyle = `rgba(214, 208, 198, ${0.12 + sky.storm * 0.22})`;
    context.lineWidth = Math.max(1, 1.2 * scale);
    for (let index = 0; index < 10; index += 1) {
      const x = left + width * ((index * 0.11 + sky.sidereal) % 1);
      context.beginPath();
      context.moveTo(x, top + height * 0.08);
      context.lineTo(x - width * 0.06, top + height * 0.72);
      context.stroke();
    }
  }
}

export function cosmologySoundPlan(plan, weather) {
  if (!weather || plan.silent) {
    return plan;
  }
  const voices = (plan.voices ?? []).map((voice, index) => ({
    ...voice,
    frequency: voice.frequency * (1 - weather.lowSignal * 0.2),
    gain: voice.gain + (index === 0 ? weather.lowSignal * 0.1 : weather.storm * 0.03),
  }));
  return {
    ...plan,
    voices,
    feedback: clamp((plan.feedback ?? 0) + weather.feedback * 0.26, 0, 0.92),
    wet: clamp((plan.wet ?? 0) + weather.feedback * 0.1, 0, 0.86),
    scatterGain: clamp((plan.scatterGain ?? 0) + weather.storm * 0.22, 0, 1),
    lowpassFrequency: clamp((plan.lowpassFrequency ?? 800) - weather.storm * 180, 24, 6000),
    master: {
      ...plan.master,
      lowGain: (plan.master?.lowGain ?? 0) + weather.lowSignal * 7,
    },
  };
}
