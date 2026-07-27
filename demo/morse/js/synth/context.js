let sharedContext = null;
let overrideContext = null;

export function getAudioContext() {
  if (overrideContext) return overrideContext;
  if (!sharedContext) {
    sharedContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedContext.state === "suspended") {
    sharedContext.resume();
  }
  return sharedContext;
}

export async function ensureAudio() {
  const context = getAudioContext();
  if (context.state === "suspended") await context.resume();
  return context;
}

/** Run work against a temporary AudioContext (offline render). */
export async function withAudioContext(context, work) {
  const previous = overrideContext;
  overrideContext = context;
  try {
    return await work(context);
  } finally {
    overrideContext = previous;
  }
}
