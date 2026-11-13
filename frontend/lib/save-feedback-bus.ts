type SaveEvent = "start" | "ok" | "fail";

const listeners = new Set<(event: SaveEvent) => void>();

export function subscribeSaveFeedback(listener: (event: SaveEvent) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function saveFeedbackBegin() {
  for (const listener of listeners) listener("start");
}

export function saveFeedbackEnd(ok: boolean) {
  const event: SaveEvent = ok ? "ok" : "fail";
  for (const listener of listeners) listener(event);
}
