// Two sites on one person is the workbench convention. Extra
// independent sites come from passing.
export const HANDS_PER_PERSON = 2;

export function occupancyDomain({ jugglers, objects, held }) {
  if (!Number.isInteger(jugglers) || jugglers < 1) {
    throw new Error("jugglers must be a positive integer");
  }
  if (!Number.isInteger(objects) || objects < 0) {
    throw new Error("objects must be a nonnegative integer");
  }
  if (!Number.isInteger(held) || held < 0 || held > objects) {
    throw new Error("held must be an integer between 0 and objects");
  }
  return {
    jugglers,
    objects,
    held,
    hands: HANDS_PER_PERSON * jugglers,
    objectsPerPerson: objects / jugglers,
    heldPerPerson: held / jugglers,
    multiplexHold: jugglers === 1 && held > HANDS_PER_PERSON,
    passing: jugglers > 1,
  };
}
