import { siteswapIsValid, soloLabRejectReason } from "./siteswap.js";

/** True when source is Solo Lab core (no pass/bounce) and schedules cleanly. */
export function soloLabAccepts(source) {
  if (soloLabRejectReason(source)) {
    return false;
  }
  return siteswapIsValid(source);
}

export function filterSoloLabCorpus(sources) {
  const accepted = [];
  const rejected = [];
  for (const source of sources) {
    const text = String(source).trim();
    if (!text) {
      continue;
    }
    const reason = soloLabRejectReason(text);
    if (reason || !siteswapIsValid(text)) {
      rejected.push({ source: text, reason: reason || "invalid" });
    } else {
      accepted.push(text);
    }
  }
  return { accepted, rejected };
}
