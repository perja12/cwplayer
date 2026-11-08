import type { Theme } from "../model/types";

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}
