import assert from "node:assert/strict";
import test from "node:test";

import { FORMAL_LAW_COPY } from "../formal_law_copy.js";
import {
  HANDS_PER_PERSON,
  occupancyDomain,
} from "../occupancy_domain.js";

test("two sites on one person; five held objects are a multiplex hold", () => {
  const domain = occupancyDomain({ jugglers: 1, objects: 8, held: 5 });

  assert.equal(HANDS_PER_PERSON, 2);
  assert.equal(domain.hands, 2);
  assert.equal(domain.heldPerPerson, 5);
  assert.equal(domain.objectsPerPerson, 8);
  assert.equal(domain.multiplexHold, true);
  assert.equal(domain.passing, false);
});

test("several people spread occupancy as a passing group's held count", () => {
  const domain = occupancyDomain({ jugglers: 4, objects: 8, held: 5 });

  assert.equal(domain.hands, 8);
  assert.equal(domain.heldPerPerson, 1.25);
  assert.equal(domain.objectsPerPerson, 2);
  assert.equal(domain.multiplexHold, false);
  assert.equal(domain.passing, true);
});

test("one person holding two objects fills both hands without a multiplex", () => {
  const domain = occupancyDomain({ jugglers: 1, objects: 3, held: 2 });

  assert.equal(domain.hands, 2);
  assert.equal(domain.multiplexHold, false);
  assert.equal(domain.passing, false);
});

test("occupancy domain rejects a body without people", () => {
  assert.throws(
    () => occupancyDomain({ jugglers: 0, objects: 3, held: 1 }),
    /positive integer/,
  );
});

test("first-passage occupancy copy names passing load and a multiplex hold", () => {
  const passing = occupancyDomain({ jugglers: 4, objects: 8, held: 5 });
  const multiplex = occupancyDomain({ jugglers: 1, objects: 8, held: 5 });
  const english = FORMAL_LAW_COPY.en.passageOccupancy(passing);
  const russian = FORMAL_LAW_COPY.ru.passageOccupancy(passing);

  assert.match(english, /passing group's occupancy/);
  assert.match(russian, /пассинг/);
  assert.match(FORMAL_LAW_COPY.en.passageOccupancy(multiplex), /multiplex/);
  assert.match(FORMAL_LAW_COPY.ru.passageOccupancy(multiplex), /мультиплекс/);
  assert.match(
    FORMAL_LAW_COPY.en.passageObservation({
      objects: "8",
      held: "4",
      previousExpectation: "12",
      expectation: "20",
      percentageIncrease: "+67",
      firstThousandObjects: "11",
      crossedThousand: false,
      occupancy: english,
    }),
    /^4 jugglers give 8 hands/,
  );
});
