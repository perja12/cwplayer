let renderApp: () => void = () => undefined;
let renderProgress: () => void = () => undefined;
let renderSelectionPopup: () => void = () => undefined;

export function setRenderers(app: () => void, progress: () => void) {
  renderApp = app;
  renderProgress = progress;
}

export function setSelectionPopupRenderer(renderer: () => void) {
  renderSelectionPopup = renderer;
}

export function requestRender() {
  renderApp();
}

export function requestProgressRender() {
  renderProgress();
}

export function requestSelectionPopupRender() {
  renderSelectionPopup();
}
