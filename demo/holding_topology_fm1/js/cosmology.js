/**
 * Bundled cosmology for the FM-1 simulator.
 * Re-exports Holding Topology weather / siteswap drift and decides when it appears.
 */
export {
  cosmologyWeather,
  cosmologySiteswap,
  cosmologyState,
  cosmologySoundPlan,
} from "../../../pages/20260819100800_grip_algebra/court_cosmology.js";

/** Roughly one patch in three, more often when wildness is high. */
export function cosmologyShouldAppear(seed, wildness = 0.5) {
  const roll = ((seed >>> 0) * 2654435761) >>> 0;
  const chance = 0.22 + wildness * 0.45;
  return (roll % 1000) / 1000 < chance;
}
