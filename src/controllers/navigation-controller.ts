import { createActor, createMachine } from "xstate";
import { appStore } from "../app/app-store";
import { requestRender } from "../app/render-bus";
import { stopAllPreviews } from "../audio/preview-controller";
import type { ViewName } from "../model/types";

export type NavigationEvent = "OPEN_PLAYER" | "OPEN_LIBRARY" | "OPEN_REVIEW" | "OPEN_LOG";

const appFlow = createMachine({
  id: "cwPlayer",
  initial: "player",
  states: {
    library: { on: { OPEN_PLAYER: "player", OPEN_REVIEW: "review", OPEN_LOG: "log" } },
    player: { on: { OPEN_LIBRARY: "library", OPEN_REVIEW: "review", OPEN_LOG: "log" } },
    review: { on: { OPEN_LIBRARY: "library", OPEN_PLAYER: "player", OPEN_LOG: "log" } },
    log: { on: { OPEN_LIBRARY: "library", OPEN_PLAYER: "player", OPEN_REVIEW: "review" } },
  },
});

const actor = createActor(appFlow).start();

export function go(event: NavigationEvent, redraw = true) {
  stopAllPreviews(false);
  actor.send({ type: event });
  const state = actor.getSnapshot().value;
  appStore.view = typeof state === "string" ? (state as ViewName) : "player";
  if (redraw) requestRender();
}

export function navigateTo(view: ViewName, redraw = true) {
  const events: Record<ViewName, NavigationEvent> = {
    player: "OPEN_PLAYER",
    library: "OPEN_LIBRARY",
    review: "OPEN_REVIEW",
    log: "OPEN_LOG",
  };
  go(events[view], redraw);
}
