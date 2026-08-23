export function htmlElement(documentNode, tagName, className, text) {
  const element = documentNode.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function createRangeControl(documentNode, {
  id,
  label,
  minimum,
  maximum,
  step,
  value,
  format,
}) {
  const control = htmlElement(documentNode, "label", "formal-law-control");
  control.htmlFor = id;
  const heading = htmlElement(documentNode, "span", "formal-law-control__heading");
  const name = htmlElement(documentNode, "span", "formal-law-control__label", label);
  const output = htmlElement(documentNode, "output", "formal-law-control__value");
  output.setAttribute("for", id);
  const input = htmlElement(documentNode, "input", "formal-law-control__input");
  input.id = id;
  input.type = "range";
  input.min = String(minimum);
  input.max = String(maximum);
  input.step = String(step);
  input.value = String(value);
  heading.append(name, output);
  control.append(heading, input);

  const refresh = () => {
    const rendered = format(Number(input.value));
    output.value = rendered;
    output.textContent = rendered;
    input.setAttribute("aria-valuetext", rendered);
  };
  refresh();
  return { element: control, input, refresh };
}

export function createMetricGrid(documentNode, definitions) {
  const list = htmlElement(documentNode, "dl", "formal-law-metrics");
  list.setAttribute("aria-live", "polite");
  const values = new Map();
  for (const { key, label } of definitions) {
    const item = htmlElement(documentNode, "div");
    const term = htmlElement(documentNode, "dt", "formal-law-metrics__label", label);
    const value = htmlElement(documentNode, "dd", "formal-law-metrics__value");
    item.append(term, value);
    list.append(item);
    values.set(key, value);
  }
  return {
    element: list,
    update(nextValues) {
      for (const [key, value] of Object.entries(nextValues)) {
        const target = values.get(key);
        if (target) target.textContent = value;
      }
    },
  };
}

export function createObservation(documentNode) {
  const element = htmlElement(documentNode, "p", "formal-law-observation");
  element.setAttribute("aria-live", "polite");
  return {
    element,
    update(text) {
      element.textContent = text;
    },
  };
}

export function createLawCard(documentNode, title, scope) {
  const card = htmlElement(documentNode, "article", "formal-law-card");
  const heading = htmlElement(documentNode, "h4", "formal-law-card__title", title);
  const description = htmlElement(documentNode, "p", "formal-law-card__scope", scope);
  const controls = htmlElement(documentNode, "div", "formal-law-controls");
  card.append(heading, description, controls);
  return { card, controls };
}
