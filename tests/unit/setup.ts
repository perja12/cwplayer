// jsdom shims shared by unit tests that render views and UI primitives.
if (typeof window !== "undefined") {
  // Newer Node.js versions define a `localStorage` getter on globalThis that
  // resolves to undefined unless --localstorage-file is set. It shadows the
  // jsdom implementation, so point it back at jsdom's storage explicitly.
  if (typeof globalThis.localStorage === "undefined") {
    const jsdomWindow = (globalThis as { jsdom?: { window: Window } }).jsdom?.window;
    const storage = jsdomWindow?.localStorage;
    if (storage) {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        writable: true,
        value: storage,
      });
    }
  }

  if (!window.matchMedia) {
    const matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    window.matchMedia = matchMedia;
    globalThis.matchMedia = matchMedia;
  }
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = () => undefined;
  }
}

if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
}
