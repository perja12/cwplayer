// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appStore } from "../../src/app/app-store";
import {
  requestProgressRender,
  requestRender,
  requestSelectionPopupRender,
  setRenderers,
  setSelectionPopupRenderer,
} from "../../src/app/render-bus";
import { go, navigateTo } from "../../src/controllers/navigation-controller";
import {
  loadSettings,
  loadTheme,
  readJson,
  saveSettings,
  saveTheme,
} from "../../src/data/settings-client";
import { KEYS, defaultSettings } from "../../src/model/defaults";
import { resetStores } from "./helpers";

beforeEach(() => {
  resetStores();
  localStorage.clear();
});

describe("render bus", () => {
  it("forwards render requests to the registered renderers", () => {
    const app = vi.fn();
    const progress = vi.fn();
    const popup = vi.fn();
    setRenderers(app, progress);
    setSelectionPopupRenderer(popup);

    requestRender();
    requestProgressRender();
    requestSelectionPopupRender();

    expect(app).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenCalledTimes(1);
    expect(popup).toHaveBeenCalledTimes(1);
  });
});

describe("navigation", () => {
  it("moves between destinations and requests a render", () => {
    const render = vi.fn();
    setRenderers(render, vi.fn());

    go("OPEN_LIBRARY");
    expect(appStore.view).toBe("library");
    expect(render).toHaveBeenCalledTimes(1);

    navigateTo("review");
    expect(appStore.view).toBe("review");
    expect(render).toHaveBeenCalledTimes(2);

    navigateTo("log");
    expect(appStore.view).toBe("log");
  });

  it("can change destination without rendering", () => {
    const render = vi.fn();
    setRenderers(render, vi.fn());

    navigateTo("player", false);

    expect(appStore.view).toBe("player");
    expect(render).not.toHaveBeenCalled();
  });
});

describe("settings client", () => {
  it("round-trips settings and falls back for missing or malformed values", () => {
    expect(loadSettings()).toEqual({});
    localStorage.setItem(KEYS.settings, "{not json");
    expect(loadSettings()).toEqual({});

    saveSettings({ ...defaultSettings, wpm: 31 });
    expect(loadSettings()).toMatchObject({ wpm: 31 });
  });

  it("reads the stored theme and otherwise follows the system preference", () => {
    expect(loadTheme()).toBe("dark");
    saveTheme("light");
    expect(loadTheme()).toBe("light");
  });

  it("returns the fallback when storage access throws", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readJson("any", { safe: true })).toEqual({ safe: true });
    getItem.mockRestore();
  });
});
