const SIZE = 240;

const RGB = {
  ground: [28, 26, 24],
  groundDay: [52, 48, 40],
  groundNight: [14, 16, 22],
  groundStorm: [30, 32, 34],
  hand: [198, 186, 168],
  handShade: [140, 128, 112],
  handLight: [230, 220, 204],
  held: [220, 96, 48],
  heldLight: [255, 180, 120],
  heldShade: [150, 50, 24],
  air: [64, 168, 196],
  airLight: [160, 220, 236],
  airShade: [28, 100, 124],
  abandoned: [96, 90, 84],
  shadow: [8, 8, 10],
  trailHeld: [140, 60, 30],
  trailAir: [40, 100, 120],
  echoHeld: [110, 70, 120],
  echoAir: [70, 130, 160],
  star: [230, 224, 210],
  sun: [236, 176, 72],
  moon: [210, 208, 200],
  rain: [160, 168, 176],
  ink: [210, 200, 180],
};

/** Palm + four fingers + thumb; drawn around (0,0). Mirrored for the right hand. */
const HAND_LEFT = [
  [0, -6], [2, -6], [4, -7], [6, -6],
  [-1, -4], [1, -4], [3, -4], [5, -4], [7, -4],
  [-2, -2], [0, -2], [2, -2], [4, -2], [6, -2], [8, -2],
  [-3, 0], [-1, 0], [1, 0], [3, 0], [5, 0], [7, 0],
  [-3, 2], [-1, 2], [1, 2], [3, 2], [5, 2],
  [-2, 4], [0, 4], [2, 4], [4, 4],
  [-5, -1], [-6, 0], [-5, 1],
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mixRgb(from, to, amount) {
  const t = clamp(amount, 0, 1);
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t),
  ];
}

function putPixel(data, x, y, rgb, alpha = 255) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) {
    return;
  }
  const index = (y * SIZE + x) * 4;
  if (alpha >= 255) {
    data[index] = rgb[0];
    data[index + 1] = rgb[1];
    data[index + 2] = rgb[2];
    data[index + 3] = 255;
    return;
  }
  const blend = alpha / 255;
  data[index] = Math.round(data[index] * (1 - blend) + rgb[0] * blend);
  data[index + 1] = Math.round(data[index + 1] * (1 - blend) + rgb[1] * blend);
  data[index + 2] = Math.round(data[index + 2] * (1 - blend) + rgb[2] * blend);
  data[index + 3] = 255;
}

function fillRect(data, x, y, width, height, rgb, alpha = 255) {
  const left = Math.max(0, x | 0);
  const top = Math.max(0, y | 0);
  const right = Math.min(SIZE, (x + width) | 0);
  const bottom = Math.min(SIZE, (y + height) | 0);
  for (let row = top; row < bottom; row += 1) {
    for (let col = left; col < right; col += 1) {
      putPixel(data, col, row, rgb, alpha);
    }
  }
}

function fillDisk(data, cx, cy, radius, rgb, alpha = 255) {
  const r = Math.max(1, radius | 0);
  const r2 = r * r;
  for (let y = -r; y <= r; y += 1) {
    for (let x = -r; x <= r; x += 1) {
      if (x * x + y * y <= r2) {
        putPixel(data, cx + x, cy + y, rgb, alpha);
      }
    }
  }
}

function fillEllipse(data, cx, cy, radiusX, radiusY, rgb, alpha = 255) {
  const rx = Math.max(1, radiusX | 0);
  const ry = Math.max(1, radiusY | 0);
  for (let y = -ry; y <= ry; y += 1) {
    for (let x = -rx; x <= rx; x += 1) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) {
        putPixel(data, cx + x, cy + y, rgb, alpha);
      }
    }
  }
}

function mapPoint(position) {
  return {
    x: Math.round(18 + position.x * 204),
    y: Math.round(18 + position.y * 204),
  };
}

function groundRgb(sky) {
  if (!sky) {
    return RGB.ground;
  }
  const night = 1 - sky.sun;
  return mixRgb(
    mixRgb(RGB.groundDay, RGB.groundNight, night),
    RGB.groundStorm,
    (sky.storm ?? 0) * 0.55,
  );
}

function paintCosmology(data, sky) {
  if (!sky) {
    return;
  }
  if (sky.stars > 0.22) {
    for (let index = 0; index < 18; index += 1) {
      const angle = (sky.sidereal + index * 0.137) * Math.PI * 2;
      const radius = 0.12 + ((index * 17) % 9) * 0.03;
      const x = Math.round(120 + Math.cos(angle) * radius * 90 + (index % 5) * 16);
      const y = Math.round(36 + ((index * 13) % 7) * 10);
      putPixel(data, x, y, RGB.star, Math.round(80 + sky.stars * 140));
      if (sky.stars > 0.55) {
        putPixel(data, x + 1, y, RGB.star, 70);
      }
    }
  }
  if (sky.sun > 0.12) {
    const cx = Math.round(48 + sky.sun * 18);
    const cy = Math.round(42 - sky.sun * 10);
    fillDisk(data, cx, cy, Math.round(3 + sky.sun * 4), RGB.sun, Math.round(120 + sky.sun * 100));
  }
  if (sky.moonHeight > 0.18 && sky.moon > 0.08) {
    const cx = Math.round(168 - sky.moonHeight * 12);
    const cy = Math.round(38 + (1 - sky.moonHeight) * 14);
    fillDisk(data, cx, cy, Math.round(2 + sky.moon * 3), RGB.moon, Math.round(100 + sky.moon * 120));
  }
  if (sky.storm > 0.55) {
    for (let index = 0; index < 14; index += 1) {
      const x = Math.round(((index * 17 + sky.sidereal * 40) % 200) + 20);
      for (let drop = 0; drop < 5; drop += 1) {
        putPixel(data, x - drop, 30 + drop * 18 + ((index * 3) % 7), RGB.rain, 90);
      }
    }
  }
}

function paintHand(data, cx, cy, handIndex) {
  fillEllipse(data, cx + 1, cy + 5, 7, 3, RGB.shadow, 90);
  const mirror = handIndex === 1 ? -1 : 1;
  for (const [dx, dy] of HAND_LEFT) {
    const x = cx + dx * mirror;
    const y = cy + dy;
    const shade = dy > 1 || dx * mirror < -3 ? RGB.handShade : dy < -4 ? RGB.handLight : RGB.hand;
    putPixel(data, x, y, shade);
    putPixel(data, x, y + 1, shade, 180);
  }
}

function paintBall(data, cx, cy, held, abandoned) {
  fillEllipse(data, cx + 2, cy + 5, 5, 2, RGB.shadow, 110);
  const shade = abandoned ? RGB.abandoned : held ? RGB.heldShade : RGB.airShade;
  const mid = abandoned ? RGB.abandoned : held ? RGB.held : RGB.air;
  const light = abandoned ? RGB.handLight : held ? RGB.heldLight : RGB.airLight;
  fillDisk(data, cx, cy, 5, shade);
  fillDisk(data, cx, cy, 4, mid);
  fillDisk(data, cx - 1, cy - 2, 2, light, 220);
  putPixel(data, cx - 2, cy - 3, light);
}

export function trailBudgetFromFx({ delay = 0.28, reverb = 0.3, wet = 0.55 } = {}) {
  const delayFrames = Math.round(4 + delay * 22);
  const reverbFrames = Math.round(2 + reverb * 14);
  const wetBoost = Math.round(wet * 6);
  return clamp(delayFrames + reverbFrames + wetBoost, 6, 36);
}

export function createPixelCourt(canvas) {
  const context = canvas.getContext("2d", { alpha: false });
  const image = context.createImageData(SIZE, SIZE);
  const trails = [];
  let trailLimit = 12;

  function clear(rgb) {
    const { data } = image;
    for (let index = 0; index < data.length; index += 4) {
      data[index] = rgb[0];
      data[index + 1] = rgb[1];
      data[index + 2] = rgb[2];
      data[index + 3] = 255;
    }
  }

  return {
    pushTrail(pictured) {
      trails.push({
        objects: (pictured.positions ?? []).map((position) => ({ ...position })),
        hands: (pictured.hands ?? []).map((hand) => ({ ...hand })),
      });
      if (trails.length > trailLimit) {
        trails.splice(0, trails.length - trailLimit);
      }
    },
    clearTrails() {
      trails.length = 0;
    },
    draw(
      pictured,
      sky = null,
      {
        showPattern = "",
        delay = 0.28,
        reverb = 0.3,
        wet = 0.55,
        echoOnly = false,
      } = {},
    ) {
      trailLimit = trailBudgetFromFx({ delay, reverb, wet });
      const { data } = image;
      clear(groundRgb(sky));
      paintCosmology(data, sky);

      fillRect(data, 14, 14, 212, 1, RGB.ink, 55);
      fillRect(data, 14, 225, 212, 1, RGB.ink, 55);
      fillRect(data, 14, 14, 1, 212, RGB.ink, 55);
      fillRect(data, 225, 14, 1, 212, RGB.ink, 55);

      // Motion smear (short) + delay/reverb echo ghosts (longer, cooler tint).
      const echoLag = Math.max(2, Math.round(delay * 18));
      for (let step = 0; step < trails.length; step += 1) {
        const age = trails.length - 1 - step;
        const frame = trails[step];
        const smearAlpha = Math.round(18 + (step / Math.max(1, trails.length)) * 55);
        const isEcho = age >= echoLag;
        const echoFade = isEcho
          ? Math.round((40 + reverb * 80 + wet * 40) * (1 - age / (trails.length + 2)))
          : 0;
        frame.objects.forEach((position) => {
          const point = mapPoint(position);
          if (!echoOnly) {
            putPixel(
              data,
              point.x,
              point.y,
              position.held ? RGB.trailHeld : RGB.trailAir,
              smearAlpha,
            );
          }
          if (isEcho && echoFade > 8) {
            fillDisk(
              data,
              point.x,
              point.y,
              age > echoLag + 4 ? 1 : 2,
              position.held ? RGB.echoHeld : RGB.echoAir,
              echoFade,
            );
          }
        });
      }

      if (!echoOnly) {
        (pictured.hands ?? []).forEach((hand, handIndex) => {
          const point = mapPoint(hand);
          paintHand(data, point.x, point.y, handIndex);
        });

        (pictured.positions ?? []).forEach((position) => {
          const point = mapPoint(position);
          paintBall(data, point.x, point.y, position.held, position.abandoned);
        });
      } else {
        (pictured.hands ?? []).forEach((hand, handIndex) => {
          const point = mapPoint(hand);
          paintHand(data, point.x, point.y, handIndex);
        });
      }

      if (showPattern) {
        const text = String(showPattern).slice(0, 14);
        for (let index = 0; index < text.length; index += 1) {
          const code = text.charCodeAt(index);
          fillRect(data, 18 + index * 5, 228, 3, 3, RGB.ink, 40 + (code % 80));
        }
      }

      if (sky) {
        fillRect(data, 220, 18, 4, 4, RGB.sun, Math.round(80 + sky.sun * 140));
      }

      context.putImageData(image, 0, 0);
    },
  };
}
