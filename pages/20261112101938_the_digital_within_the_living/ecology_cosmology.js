export function createCosmology() {
  // These bounded art parameters interpret cosmology; they do not simulate a physical universe.
  return {
    expansion: 1 + Math.random() * .3,
    matterDensity: .15 + Math.random() * .75,
    primordialVariation: .15 + Math.random() * .75,
  };
}
