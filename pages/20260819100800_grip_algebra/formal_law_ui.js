import { FORMAL_LAW_COPY, formalLawLocale } from "./formal_law_copy.js";
import { htmlElement } from "./formal_law_dom.js";
import { createBernoulliLawCard } from "./formal_law_bernoulli_card.js";
import { createPassageLawCard } from "./formal_law_passage_card.js";
import { createPhaseLawCard } from "./formal_law_phase_card.js";

export { formalLawLocale } from "./formal_law_copy.js";
export { polylineCoordinates } from "./formal_law_plot.js";

export function initializeFormalLawWorkbench(root = document) {
  const workbench = root.matches?.("#formal-law-lab")
    ? root
    : root.querySelector?.("#formal-law-lab");
  if (!workbench || workbench.dataset.formalLawEnhanced === "true") {
    return workbench ?? null;
  }

  const documentNode = workbench.ownerDocument;
  const declaredLanguage = workbench.dataset.language || documentNode.documentElement.lang;
  const copy = FORMAL_LAW_COPY[formalLawLocale(declaredLanguage)];
  const heading = htmlElement(documentNode, "h3", "formal-law-workbench__title", copy.title);
  heading.id = "formal-law-workbench-title";
  const intro = htmlElement(documentNode, "p", "formal-law-workbench__intro", copy.intro);
  const cards = htmlElement(documentNode, "div", "formal-law-cards");
  cards.append(
    createPhaseLawCard(documentNode, copy),
    createBernoulliLawCard(documentNode, copy),
    createPassageLawCard(documentNode, copy),
  );
  workbench.replaceChildren(heading, intro, cards);
  workbench.setAttribute("aria-labelledby", heading.id);
  workbench.dataset.formalLawEnhanced = "true";
  return workbench;
}
