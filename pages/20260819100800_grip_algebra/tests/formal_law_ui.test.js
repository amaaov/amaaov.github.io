import assert from "node:assert/strict";
import test from "node:test";

import {
  formalLawLocale,
  polylineCoordinates,
} from "../formal_law_ui.js";

test("formal-law locale follows the document language", () => {
  assert.equal(formalLawLocale("ru"), "ru");
  assert.equal(formalLawLocale("ru-RU"), "ru");
  assert.equal(formalLawLocale("en"), "en");
  assert.equal(formalLawLocale(""), "en");
});

test("polyline coordinates preserve curve endpoints and invert the vertical axis", () => {
  const coordinates = polylineCoordinates([
    { x: 0, y: 0 },
    { x: 0.5, y: 0.5 },
    { x: 1, y: 1 },
  ], {
    minimumX: 0,
    maximumX: 1,
    minimumY: 0,
    maximumY: 1,
    width: 100,
    height: 60,
    padding: 10,
  });

  assert.equal(coordinates, "10,50 50,30 90,10");
});

test("polyline coordinates reject a collapsed plotting domain", () => {
  assert.throws(() => polylineCoordinates([], {
    minimumX: 1,
    maximumX: 1,
    minimumY: 0,
    maximumY: 1,
    width: 100,
    height: 60,
    padding: 10,
  }), /ordered plotting domain/);
});
