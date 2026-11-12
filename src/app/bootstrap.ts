import { renderApp } from "./app-controller";
import { appStore, hydrateStore, primeStore, setInstallPrompt } from "./app-store";
import { setRenderers } from "./render-bus";
import { initSelectionController } from "../controllers/selection-controller";
import { bindMidiControls } from "../controllers/midi-controller";
import { escapeHtml } from "../ui/html";
import { applyTheme } from "../ui/theme";
import { showToast } from "../ui/toast";
import { renderPlayerProgress } from "../views/player-progress-view";
import type { InstallPromptEvent } from "../model/types";

const app = document.querySelector<HTMLDivElement>("#app")!;

export async function bootstrap() {
  // Start reading the stored library right away, but paint the bundled shell
  // while IndexedDB opens instead of leaving the screen blank.
  const hydration = hydrateStore();
  const canRenderEarly = primeStore();
  applyTheme(appStore.theme);
  initSelectionController();
  setRenderers(renderApp, renderPlayerProgress);
  if (canRenderEarly) {
    app.inert = true;
    renderApp();
  }
  try {
    await hydration;
  } catch (error) {
    app.inert = false;
    app.innerHTML = `<main class="storage-error"><h1>CW Player could not open local storage</h1><p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p><p>Check that this site is allowed to use IndexedDB, then reload.</p></main>`;
    return;
  }
  app.inert = false;
  renderApp();
  bindMidiControls();
  if ("serviceWorker" in navigator && import.meta.env.PROD)
    await Promise.all([
      navigator.serviceWorker
        .register("/sw.js")
        .catch(() => showToast("Offline support could not be enabled.")),
      navigator.serviceWorker
        .register("/vendor/streamsaver/sw.js", { scope: "/vendor/streamsaver/" })
        .catch(() => undefined),
    ]);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    setInstallPrompt(event as InstallPromptEvent);
    renderApp();
  });
  window.addEventListener("appinstalled", () => {
    setInstallPrompt(null);
    renderApp();
  });
}
