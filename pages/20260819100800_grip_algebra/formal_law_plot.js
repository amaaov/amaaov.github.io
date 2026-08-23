import { htmlElement } from "./formal_law_dom.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const WIDTH = 600;
const HEIGHT = 180;
const PADDING = 14;

function svgElement(documentNode, tagName, attributes = {}) {
  const element = documentNode.createElementNS(SVG_NAMESPACE, tagName);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
  return element;
}

function plotNumber(value) {
  return Number(value.toFixed(2));
}

export function polylineCoordinates(points, {
  minimumX,
  maximumX,
  minimumY,
  maximumY,
  width,
  height,
  padding,
}) {
  if (maximumX <= minimumX || maximumY <= minimumY) {
    throw new RangeError("curve needs an ordered plotting domain");
  }
  const innerWidth = width - 2 * padding;
  const innerHeight = height - 2 * padding;
  return points.map(({ x, y }) => {
    const horizontal = padding + ((x - minimumX) / (maximumX - minimumX)) * innerWidth;
    const vertical = height - padding - ((y - minimumY) / (maximumY - minimumY)) * innerHeight;
    return `${plotNumber(horizontal)},${plotNumber(vertical)}`;
  }).join(" ");
}

function appendGrid(documentNode, svg) {
  const grid = svgElement(documentNode, "g", {
    class: "formal-law-grid",
    "aria-hidden": "true",
  });
  [0, 0.5, 1].forEach((fraction) => {
    const vertical = PADDING + fraction * (HEIGHT - 2 * PADDING);
    grid.append(svgElement(documentNode, "line", {
      x1: PADDING,
      x2: WIDTH - PADDING,
      y1: vertical,
      y2: vertical,
    }));
  });
  svg.append(grid);
}

function createLegend(documentNode, copy, series) {
  const legend = htmlElement(documentNode, "ul", "formal-law-legend");
  legend.setAttribute("aria-label", copy.legend);
  series.forEach(({ key, label }) => {
    const item = htmlElement(documentNode, "li");
    const swatch = htmlElement(documentNode, "span", `formal-law-swatch formal-law-swatch--${key}`);
    swatch.setAttribute("aria-hidden", "true");
    item.append(swatch, documentNode.createTextNode(label));
    legend.append(item);
  });
  return legend;
}

function drawCurrentMarker(documentNode, curves, currentX, currentValues, domain) {
  const horizontal = PADDING
    + ((currentX - domain.minimumX) / (domain.maximumX - domain.minimumX))
      * (WIDTH - 2 * PADDING);
  curves.append(svgElement(documentNode, "line", {
    class: "formal-law-marker",
    x1: horizontal,
    x2: horizontal,
    y1: PADDING,
    y2: HEIGHT - PADDING,
  }));
  currentValues.forEach(({ key, value }) => {
    const vertical = HEIGHT - PADDING
      - (value / domain.maximumY) * (HEIGHT - 2 * PADDING);
    curves.append(svgElement(documentNode, "circle", {
      class: `formal-law-dot formal-law-dot--${key}`,
      cx: horizontal,
      cy: vertical,
      r: 5,
    }));
  });
}

export function createLawPlot(documentNode, { id, copy, series }) {
  const figure = htmlElement(documentNode, "figure", "formal-law-plot");
  const svg = svgElement(documentNode, "svg", {
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    role: "img",
    "aria-labelledby": `${id}-title ${id}-description`,
    focusable: "false",
  });
  const title = svgElement(documentNode, "title", { id: `${id}-title` });
  const description = svgElement(documentNode, "desc", { id: `${id}-description` });
  const curves = svgElement(documentNode, "g", { "aria-hidden": "true" });
  svg.append(title, description);
  appendGrid(documentNode, svg);
  svg.append(curves);

  const domain = htmlElement(documentNode, "figcaption", "formal-law-domain");
  const horizontalMinimum = htmlElement(documentNode, "span");
  const verticalDomain = htmlElement(documentNode, "span");
  const horizontalMaximum = htmlElement(documentNode, "span");
  domain.append(horizontalMinimum, verticalDomain, horizontalMaximum);
  figure.append(svg, domain, createLegend(documentNode, copy, series));

  return {
    element: figure,
    update({
      titleText,
      descriptionText,
      lines,
      currentX,
      currentValues,
      minimumX,
      maximumX,
      maximumY,
      horizontalLabel,
      verticalLabel,
      format,
    }) {
      title.textContent = titleText;
      description.textContent = descriptionText;
      curves.replaceChildren();
      const plotDomain = { minimumX, maximumX, maximumY };
      lines.forEach(({ key, points }) => {
        curves.append(svgElement(documentNode, "polyline", {
          class: `formal-law-line formal-law-line--${key}`,
          points: polylineCoordinates(points, {
            minimumX,
            maximumX,
            minimumY: 0,
            maximumY,
            width: WIDTH,
            height: HEIGHT,
            padding: PADDING,
          }),
        }));
      });
      drawCurrentMarker(documentNode, curves, currentX, currentValues, plotDomain);
      horizontalMinimum.textContent = `${horizontalLabel} ${format(minimumX)}`;
      verticalDomain.textContent = `${verticalLabel} 0–${format(maximumY)}`;
      horizontalMaximum.textContent = `${horizontalLabel} ${format(maximumX)}`;
    },
  };
}
