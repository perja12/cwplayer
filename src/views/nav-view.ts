import { appStore } from "../app/app-store";
import { icon } from "../ui/icons";

export function renderNav() {
  const route = appStore.view;
  const items: Array<[string, string]> = [
    ["player", "Player"],
    ["library", "Library"],
    ["review", "Practice Review"],
    ["log", "Listening Log"],
  ];
  const themeLabel = appStore.theme === "dark" ? "Light Theme" : "Dark Theme";
  return `<button class="menu-toggle" data-menu-toggle aria-label="Open menu" aria-expanded="false" aria-controls="app-menu">${icon("menu")}</button><div class="menu-scrim" data-menu-close></div><aside class="sidebar" id="app-menu"><button class="menu-close" data-menu-close aria-label="Close menu">${icon("close")}</button><div class="brand"><span class="brand-name">CW Player</span><span class="brand-by">BY LB2KK</span></div><nav aria-label="Main navigation">${items
    .map(
      ([id, label]) =>
        `<button class="nav-item ${route === id ? "active" : ""}" data-nav="${id}">${icon(id)}<span>${label}</span></button>`,
    )
    .join(
      "",
    )}<button class="nav-item settings-item" data-open-settings data-menu-close>${icon("settings")}<span>Settings</span></button></nav><div class="sidebar-note"><button class="sidebar-action theme-toggle">${icon(appStore.theme === "dark" ? "sun" : "moon")}<span>${themeLabel}</span></button><button class="install-app" data-install-app ${appStore.installPrompt ? "" : "hidden"}>Install CW Player</button><button class="sidebar-action reload-app" data-reload-app>${icon("downloadForOffline")} Reload App</button></div></aside>`;
}
