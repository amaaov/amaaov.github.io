import { oneBitFirstPassage } from "./formal_laws.js";
import { firstPassageGrowthObservation } from "./formal_observations.js";
import { formalLawNumberFormatter } from "./formal_law_copy.js";
import { occupancyDomain } from "./occupancy_domain.js";
import {
  createLawCard,
  createMetricGrid,
  createObservation,
  createRangeControl,
} from "./formal_law_dom.js";
import { createLawPlot } from "./formal_law_plot.js";

export function createPassageLawCard(documentNode, copy) {
  const format = formalLawNumberFormatter(copy);
  const integer = formalLawNumberFormatter(copy, 0);
  const { card, controls } = createLawCard(documentNode, copy.passageTitle, copy.passageScope);
  const jugglers = createRangeControl(documentNode, {
    id: "formal-passage-jugglers",
    label: copy.jugglers,
    minimum: 1,
    maximum: 8,
    step: 1,
    value: 4,
    format: integer,
  });
  const objects = createRangeControl(documentNode, {
    id: "formal-passage-objects",
    label: copy.objects,
    minimum: 2,
    maximum: 16,
    step: 1,
    value: 8,
    format: integer,
  });
  const held = createRangeControl(documentNode, {
    id: "formal-passage-held",
    label: copy.held,
    minimum: 0,
    maximum: 8,
    step: 1,
    value: 4,
    format: integer,
  });
  controls.append(jugglers.element, objects.element, held.element);
  const metrics = createMetricGrid(documentNode, [
    { key: "hands", label: copy.hands },
    { key: "heldPerPerson", label: copy.heldPerPerson },
    { key: "expectation", label: copy.expectedEvents },
  ]);
  const observation = createObservation(documentNode);
  const plot = createLawPlot(documentNode, {
    id: "formal-passage-plot",
    copy,
    series: [{ key: "passage", label: "E_q" }],
  });
  card.append(metrics.element, observation.element, plot.element);

  const render = () => {
    jugglers.refresh();
    objects.refresh();
    const jugglerCount = Number(jugglers.input.value);
    const objectCount = Number(objects.input.value);
    held.input.max = String(objectCount);
    if (Number(held.input.value) > objectCount) held.input.value = String(objectCount);
    held.refresh();
    const heldCount = Number(held.input.value);
    const domain = occupancyDomain({
      jugglers: jugglerCount,
      objects: objectCount,
      held: heldCount,
    });
    const expectations = oneBitFirstPassage(objectCount);
    const maximumExpectation = Math.max(...expectations);
    const expectation = expectations[heldCount];
    const growth = firstPassageGrowthObservation(objectCount);
    const values = {
      objects: integer(objectCount),
      held: integer(heldCount),
      hands: integer(domain.hands),
      heldPerPerson: format(domain.heldPerPerson),
      expectation: format(expectation),
    };
    metrics.update(values);
    observation.update(copy.passageObservation({
      objects: integer(objectCount),
      held: integer(growth.centralHeldCount),
      previousExpectation: growth.previousExpectation === null
        ? null
        : format(growth.previousExpectation),
      expectation: format(growth.expectation),
      percentageIncrease: growth.percentageIncrease === null
        ? null
        : `+${format(growth.percentageIncrease)}`,
      firstThousandObjects: integer(growth.firstThousandObjectCount),
      crossedThousand: growth.crossedThousand,
      occupancy: copy.passageOccupancy({
        jugglers: integer(domain.jugglers),
        hands: integer(domain.hands),
        multiplexHold: domain.multiplexHold,
        passing: domain.passing,
      }),
    }));
    plot.update({
      titleText: copy.passageTitle,
      descriptionText: copy.passageDescription(values),
      lines: [{
        key: "passage",
        points: expectations.map((value, index) => ({ x: index, y: value })),
      }],
      currentX: heldCount,
      currentValues: [{ key: "passage", value: expectation }],
      minimumX: 0,
      maximumX: objectCount,
      maximumY: maximumExpectation,
      horizontalLabel: "q",
      verticalLabel: copy.events,
      format,
    });
  };
  jugglers.input.addEventListener("input", render);
  objects.input.addEventListener("input", render);
  held.input.addEventListener("input", render);
  render();
  return card;
}
