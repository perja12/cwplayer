import { KEYS } from "../model/defaults";
import type { Settings, Theme } from "../model/types";

export function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadSettings(): Partial<Settings> {
  return readJson<Partial<Settings>>(KEYS.settings, {});
}

export function saveSettings(settings: Settings) {
  writeJson(KEYS.settings, settings);
}

export function loadTheme(): Theme {
  return readJson<Theme>(
    KEYS.theme,
    matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark",
  );
}

export function saveTheme(theme: Theme) {
  writeJson(KEYS.theme, theme);
}
