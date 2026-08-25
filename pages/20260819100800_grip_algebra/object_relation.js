export const TAINED_SIGN = "τ";
export const LEASED_SIGN = "λ";
export const DROP_SIGN = "ρ";

export function objectRelation({ retained, returnDue }) {
  if (retained) {
    return "tained";
  }
  if (returnDue) {
    return "leased";
  }
  return "abandoned";
}

export function applyObjectEvent(state, event) {
  if (event === "throw") {
    if (!state.retained) {
      throw new Error("throw requires a tained object");
    }
    return { retained: false, returnDue: true };
  }
  if (event === "catch") {
    if (state.retained || !state.returnDue) {
      throw new Error("catch requires a leased object");
    }
    return { retained: true, returnDue: false };
  }
  if (event === "drop") {
    if (state.retained || !state.returnDue) {
      throw new Error("drop requires a leased object");
    }
    return { retained: false, returnDue: false };
  }
  if (event === "dump") {
    if (!state.retained) {
      throw new Error("dump requires a tained object");
    }
    return { retained: false, returnDue: false };
  }
  throw new Error("unknown object event");
}

export function relationsInPattern(heldFlags) {
  return heldFlags.map((retained) => objectRelation({
    retained,
    returnDue: !retained,
  }));
}

export function tainedAndLeasedTogether(relations) {
  const presence = relationPresence(relations);
  return presence.tained && presence.leased;
}

export function relationPresence(relations) {
  let tained = false;
  let leased = false;
  let dropped = false;
  for (const relation of relations) {
    if (relation === "tained") {
      tained = true;
    }
    if (relation === "leased") {
      leased = true;
    }
    if (relation === "abandoned") {
      dropped = true;
    }
  }
  return { tained, leased, dropped };
}

export function leaseTarget({ returnDue, catcher }) {
  if (!returnDue) {
    return null;
  }
  return catcher;
}

export function leaseTargetForToss(event) {
  if (event.ball === null || event.height === 0 || event.hold) {
    return null;
  }
  return event.toBody;
}
