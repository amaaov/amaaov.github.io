import { bernoulliTemporalLaw, sampleLawCurve } from "./formal_laws.js";
import { bernoulliObjectObservation } from "./formal_observations.js";
import { formalLawNumberFormatter } from "./formal_law_copy.js";
import {
  createLawCard,
  createMetricGrid,
  createObservation,
  createRangeControl,
} from "./formal_law_dom.js";
import { createLawPlot } from "./formal_law_plot.js";

export function createBernoulliLawCard(documentNode, copy) {
  const format = formalLawNumberFormatter(copy);
  const integer = formalLawNumberFormatter(copy, 0);
  const { card, controls } = createLawCard(documentNode, copy.bernoulliTitle, copy.bernoulliScope);
  const objects = createRangeControl(documentNode, {
    id: "formal-bernoulli-objects",
    label: copy.objects,
    minimum: 2,
    maximum: 20,
    step: 1,
    value: 5,
    format: integer,
  });
  const probability = createRangeControl(documentNode, {
    id: "formal-bernoulli-probability",
    label: copy.probability,
    minimum: 0,
    maximum: 1,
    step: 0.01,
    value: 0.5,
    format,
  });
  controls.append(objects.element, probability.element);
  const metrics = createMetricGrid(documentNode, [
    { key: "alpha", label: copy.alphaShare },
    { key: "polymorphy", label: copy.polymorphyShare },
    { key: "kappa", label: copy.kappaShare },
  ]);
  const observation = createObservation(documentNode);
  const plot = createLawPlot(documentNode, {
    id: "formal-bernoulli-plot",
    copy,
    series: [
      { key: "alpha", label: copy.alphaShare },
      { key: "polymorphy", label: copy.polymorphyShare },
      { key: "kappa", label: copy.kappaShare },
    ],
  });
  card.append(metrics.element, observation.element, plot.element);

  const render = () => {
    objects.refresh();
    probability.refresh();
    const objectCount = Number(objects.input.value);
    const retentionProbability = Number(probability.input.value);
    const current = bernoulliTemporalLaw({ objectCount, retentionProbability });
    const concentration = bernoulliObjectObservation({
      objectCount,
      retentionProbability,
    });
    const makeCurve = (key) => sampleLawCurve(
      (candidate) => bernoulliTemporalLaw({
        objectCount,
        retentionProbability: candidate,
      })[key],
      { minimum: 0, maximum: 1, steps: 100 },
    );
    const values = {
      objects: integer(objectCount),
      probability: format(retentionProbability),
      alpha: format(current.pAlpha),
      polymorphy: format(current.pPolymorphy),
      kappa: format(current.pKappa),
    };
    metrics.update(values);
    const polymorphyChange = concentration.polymorphyPercentagePointChange;
    observation.update(copy.bernoulliObservation({
      objects: integer(objectCount),
      polymorphyChange: `${polymorphyChange >= 0 ? "+" : ""}${format(polymorphyChange)}`,
      previousHomogeneous: format(concentration.previousHomogeneous * 100),
      homogeneous: format(concentration.homogeneous * 100),
    }));
    plot.update({
      titleText: copy.bernoulliTitle,
      descriptionText: copy.bernoulliDescription(values),
      lines: [
        { key: "alpha", points: makeCurve("pAlpha") },
        { key: "polymorphy", points: makeCurve("pPolymorphy") },
        { key: "kappa", points: makeCurve("pKappa") },
      ],
      currentX: retentionProbability,
      currentValues: [
        { key: "alpha", value: current.pAlpha },
        { key: "polymorphy", value: current.pPolymorphy },
        { key: "kappa", value: current.pKappa },
      ],
      minimumX: 0,
      maximumX: 1,
      maximumY: 1,
      horizontalLabel: "ρ",
      verticalLabel: copy.share,
      format,
    });
  };
  objects.input.addEventListener("input", render);
  probability.input.addEventListener("input", render);
  render();
  return card;
}
