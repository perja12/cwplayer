import { appStore, updateTheme } from "./app-store";
import { exportStore } from "./export-store";
import { requestRender } from "./render-bus";
import { bindHidControls } from "../controllers/hid-controller";
import { bindLibraryEvents } from "../controllers/library-controller";
import { go } from "../controllers/navigation-controller";
import { bindPlayerEvents } from "../controllers/player-controller";
import { bindReviewEvents } from "../controllers/review-controller";
import {
  afterRenderSelection,
  bindSelectionSurfaceEvents,
} from "../controllers/selection-controller";
import { bindSettingsEvents } from "../controllers/settings-controller";
import { applyTheme } from "../ui/theme";
import { showToast } from "../ui/toast";
import { renderShell } from "../views/app-view";
import { renderPlayerProgress } from "../views/player-progress-view";

const app = document.querySelector<HTMLDivElement>("#app")!;
let menuOpen = false;
let menuKeydownBound = false;

function captureScrollPositions() {
  const positions = new Map<string, number>();
  document.querySelectorAll<HTMLElement>("[data-scroll-key]").forEach((element) => {
    const key = element.dataset.scrollKey;
    if (key) positions.set(key, element.scrollTop);
  });
  return positions;
}

function restoreScrollPositions(positions: Map<string, number>) {
  document.querySelectorAll<HTMLElement>("[data-scroll-key]").forEach((element) => {
    const position = positions.get(element.dataset.scrollKey ?? "");
    if (position !== undefined) element.scrollTop = position;
  });
}

export function renderApp() {
  const scrollPositions = captureScrollPositions();
  const modal = app.querySelector<HTMLDialogElement>("#modal");
  const modalWasOpen = modal?.open ?? false;
  if (modalWasOpen) modal!.close();
  app.innerHTML = renderShell();
  if (modal) {
    app.querySelector("#modal")?.replaceWith(modal);
    if (modalWasOpen) modal.showModal();
  }
  restoreScrollPositions(scrollPositions);
  bindNavEvents();
  bindLibraryEvents();
  bindPlayerEvents();
  bindHidControls();
  bindReviewEvents();
  bindSettingsEvents();
  bindSelectionSurfaceEvents();
  afterRenderSelection();
  renderPlayerProgress();
}

function bindNavEvents() {
  const menuToggle = document.querySelector<HTMLButtonElement>("[data-menu-toggle]");
  syncMenuState(menuToggle);
  menuToggle?.addEventListener("click", () => {
    menuOpen = !menuOpen;
    syncMenuState(menuToggle);
    if (menuOpen) document.querySelector<HTMLElement>("#app-menu [data-menu-close]")?.focus();
  });
  document.querySelectorAll<HTMLElement>("[data-menu-close]").forEach((element) =>
    element.addEventListener("click", () => {
      menuOpen = false;
      syncMenuState();
      menuToggle?.focus();
    }),
  );
  if (!menuKeydownBound) {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !menuOpen) return;
      menuOpen = false;
      syncMenuState();
      document.querySelector<HTMLElement>("[data-menu-toggle]")?.focus();
    });
    menuKeydownBound = true;
  }
  document.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((button) =>
    button.addEventListener("click", () => {
      menuOpen = false;
      syncMenuState();
      if (exportStore.active) return;
      const target = button.dataset.nav!;
      go(
        (
          {
            library: "OPEN_LIBRARY",
            player: "OPEN_PLAYER",
            review: "OPEN_REVIEW",
            log: "OPEN_LOG",
          } as const
        )[target as "library" | "player" | "review" | "log"],
      );
    }),
  );
  document.querySelector<HTMLButtonElement>(".theme-toggle")?.addEventListener("click", () => {
    updateTheme(appStore.theme === "dark" ? "light" : "dark");
    applyTheme(appStore.theme);
    requestRender();
  });
  document.querySelector<HTMLButtonElement>("[data-install-app]")?.addEventListener("click", () => {
    if (!appStore.installPrompt) {
      showToast(
        window.matchMedia("(display-mode: standalone)").matches
          ? "CW Player is already installed."
          : "Open your browser menu to install CW Player.",
      );
      return;
    }
    const prompt = appStore.installPrompt;
    void (async () => {
      await prompt.prompt();
      await prompt.userChoice;
      appStore.installPrompt = null;
      requestRender();
    })();
  });
  document
    .querySelector<HTMLButtonElement>("[data-reload-app]")
    ?.addEventListener("click", reloadApp);
}

function syncMenuState(toggle = document.querySelector<HTMLButtonElement>("[data-menu-toggle]")) {
  app.classList.toggle("menu-open", menuOpen);
  toggle?.setAttribute("aria-expanded", String(menuOpen));
}

function reloadApp() {
  const url = new URL(location.href);
  url.searchParams.set("_cw_reload", String(Date.now()));
  location.replace(url.href);
}
