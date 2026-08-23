import { sampleLawCurve, twoObjectPhaseLaw } from "./formal_laws.js";
import { phaseStepObservation } from "./formal_observations.js";
import { formalLawNumberFormatter } from "./formal_law_copy.js";
import {
  createLawCard,
  createMetricGrid,
  createObservation,
  createRangeControl,
} from "./formal_law_dom.js";
import { createLawPlot } from "./formal_law_plot.js";

export function createPhaseLawCard(documentNode, copy) {
  const format = formalLawNumberFormatter(copy);
  const integer = formalLawNumberFormatter(copy, 0);
  const { card, controls } = createLawCard(documentNode, copy.phaseTitle, copy.phaseScope);
  const duty = createRangeControl(documentNode, {
    id: "formal-phase-duty",
    label: copy.duty,
    minimum: 0.05,
    maximum: 0.95,
    step: 0.01,
    value: 0.4,
    format,
  });
  const phase = createRangeControl(documentNode, {
    id: "formal-phase-offset",
    label: copy.phase,
    minimum: 0,
    maximum: 0.5,
    step: 0.01,
    value: 0.4,
    format,
  });
  controls.append(duty.element, phase.element);
  const metrics = createMetricGrid(documentNode, [
    { key: "alpha", label: copy.alphaShare },
    { key: "amphoteron", label: copy.amphoteronShare },
    { key: "kappa", label: copy.kappaShare },
    { key: "bouts", label: copy.alphaBouts },
  ]);
  const observation = createObservation(documentNode);
  const plot = createLawPlot(documentNode, {
    id: "formal-phase-plot",
    copy,
    series: [
      { key: "alpha", label: copy.alphaShare },
      { key: "amphoteron", label: copy.amphoteronShare },
      { key: "kappa", label: copy.kappaShare },
    ],
  });
  card.append(metrics.element, observation.element, plot.element);

  const render = () => {
    duty.refresh();
    phase.refresh();
    const retentionDuty = Number(duty.input.value);
    const phaseOffset = Number(phase.input.value);
    const current = twoObjectPhaseLaw({ retentionDuty, phaseOffset });
    const step = phaseStepObservation({
      retentionDuty,
      phaseOffset,
      step: Number(phase.input.step),
    });
    const makeCurve = (key) => sampleLawCurve(
      (candidate) => twoObjectPhaseLaw({ retentionDuty, phaseOffset: candidate })[key],
      { minimum: 0, maximum: 0.5, steps: 100 },
    );
    const values = {
      duty: format(retentionDuty),
      phase: format(phaseOffset),
      alpha: format(current.pAlpha),
      amphoteron: format(current.pAmphoteron),
      kappa: format(current.pKappa),
      bouts: integer(current.alphaBoutCount),
    };
    metrics.update(values);
    const signed = (value) => `${value >= 0 ? "+" : ""}${format(value)}`;
    observation.update(copy.phaseObservation({
      nextPhase: format(step.nextPhaseOffset),
      alphaChange: signed(step.sharePercentagePointChanges.alpha),
      amphoteronChange: signed(step.sharePercentagePointChanges.amphoteron),
      kappaChange: signed(step.sharePercentagePointChanges.kappa),
      sharePlateau: step.sharePlateau,
      boutCountChanged: step.boutCountChanged,
      bouts: integer(step.alphaBoutCount),
      nextBouts: integer(step.nextAlphaBoutCount),
    }));
    plot.update({
      titleText: copy.phaseTitle,
      descriptionText: copy.phaseDescription(values),
      lines: [
        { key: "alpha", points: makeCurve("pAlpha") },
        { key: "amphoteron", points: makeCurve("pAmphoteron") },
        { key: "kappa", points: makeCurve("pKappa") },
      ],
      currentX: phaseOffset,
      currentValues: [
        { key: "alpha", value: current.pAlpha },
        { key: "amphoteron", value: current.pAmphoteron },
        { key: "kappa", value: current.pKappa },
      ],
      minimumX: 0,
      maximumX: 0.5,
      maximumY: 1,
      horizontalLabel: "φ",
      verticalLabel: copy.share,
      format,
    });
  };
  duty.input.addEventListener("input", render);
  phase.input.addEventListener("input", render);
  render();
  return card;
}
