export function hslToRgb(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hueSegment = (((hue % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((hueSegment % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;
  if (hueSegment < 1) [red, green, blue] = [chroma, x, 0];
  else if (hueSegment < 2) [red, green, blue] = [x, chroma, 0];
  else if (hueSegment < 3) [red, green, blue] = [0, chroma, x];
  else if (hueSegment < 4) [red, green, blue] = [0, x, chroma];
  else if (hueSegment < 5) [red, green, blue] = [x, 0, chroma];
  else [red, green, blue] = [chroma, 0, x];
  const match = lightness - chroma / 2;
  return [
    Math.round((red + match) * 255),
    Math.round((green + match) * 255),
    Math.round((blue + match) * 255),
  ];
}
