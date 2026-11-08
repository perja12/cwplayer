// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }));
const toast = vi.hoisted(() => vi.fn());

vi.mock("../../src/data/storage-client", () => ({
  loadPlayerData: storage.load,
  savePlayerData: storage.save,
}));
vi.mock("../../src/ui/toast", () => ({ showToast: toast }));

import {
  addListeningTime,
  appStore,
  currentItem,
  hydrateStore,
  persistLibrary,
  persistLog,
  persistTexts,
  setInstallPrompt,
  updateSettings,
  updateTheme,
} from "../../src/app/app-store";
import { resetPlaybackPosition, playbackStore } from "../../src/app/playback-store";
import { KEYS, defaultSettings, defaultTexts } from "../../src/model/defaults";
import { todayKey } from "../../src/model/format";
import type { Settings } from "../../src/model/types";
import { resetStores, sampleText } from "./helpers";

beforeEach(() => {
  resetStores();
  vi.clearAllMocks();
  localStorage.clear();
  storage.load.mockResolvedValue({
    texts: [],
    collections: [],
    marks: [],
    log: {},
  });
  storage.save.mockResolvedValue(undefined);
});

describe("hydrateStore", () => {
  it("loads the library and seeds the frequency source from the active text", async () => {
    storage.load.mockResolvedValue({
      texts: [sampleText({ id: "first" }), sampleText({ id: "second" })],
      collections: [{ id: "c1", title: "Stories", itemIds: ["first"] }],
      marks: [{ id: "m1", itemId: "first", word: "CQ", excerpt: "[[CQ]]", date: 1 }],
      log: { "2026-01-01": 30 },
    });

    await hydrateStore();

    expect(appStore.texts).toHaveLength(2);
    expect(appStore.collections).toHaveLength(1);
    expect(appStore.marks).toHaveLength(1);
    expect(appStore.log["2026-01-01"]).toBe(30);
    expect(appStore.activeTextId).toBe("first");
    expect(appStore.frequencyTextId).toBe("first");
  });

  it("leaves the active text empty for a new library", async () => {
    await hydrateStore();

    expect(appStore.activeTextId).toBe("");
    expect(appStore.frequencyTextId).toBe("");
  });

  it("propagates storage failures to the bootstrap", async () => {
    storage.load.mockRejectedValue(new Error("IndexedDB blocked"));

    await expect(hydrateStore()).rejects.toThrow("IndexedDB blocked");
  });
});

describe("currentItem", () => {
  it("prefers the active id and falls back to the first text", () => {
    appStore.texts = [sampleText({ id: "a" }), sampleText({ id: "b" })];

    appStore.activeTextId = "b";
    expect(currentItem()?.id).toBe("b");

    appStore.activeTextId = "missing";
    expect(currentItem()?.id).toBe("a");

    appStore.texts = [];
    expect(currentItem()).toBeUndefined();
  });
});

describe("persistence", () => {
  it("writes a cloned library snapshot", async () => {
    appStore.texts = [sampleText({ id: "a" })];
    appStore.collections = [{ id: "c1", title: "Stories", itemIds: ["a"] }];
    appStore.marks = [{ id: "m1", itemId: "a", word: "CQ", excerpt: "[[CQ]]", date: 1 }];

    persistLibrary();

    await vi.waitFor(() => expect(storage.save).toHaveBeenCalledTimes(1));
    const saved = storage.save.mock.calls[0][0] as {
      texts: unknown[];
      collections: unknown[];
      marks: unknown[];
    };
    expect(saved.texts).toHaveLength(1);
    expect(saved.collections).toHaveLength(1);
    expect(saved.marks).toHaveLength(1);
    expect(saved.texts[0]).not.toBe(appStore.texts[0]);
    expect(saved).not.toHaveProperty("log");
  });

  it("reports library save failures without throwing", async () => {
    storage.save.mockRejectedValueOnce(new Error("quota exceeded"));

    persistLibrary();

    await vi.waitFor(() =>
      expect(toast).toHaveBeenCalledWith("Could not save local data: quota exceeded"),
    );
  });

  it("stringifies non-Error library failures", async () => {
    storage.save.mockRejectedValueOnce("plain failure");

    persistLibrary();

    await vi.waitFor(() =>
      expect(toast).toHaveBeenCalledWith("Could not save local data: plain failure"),
    );
  });

  it("saves only cloned text records for listening positions", async () => {
    appStore.texts = [sampleText({ id: "a", lastPosition: 12 })];

    persistTexts();

    await vi.waitFor(() =>
      expect(storage.save).toHaveBeenCalledWith({
        texts: [expect.objectContaining({ id: "a", lastPosition: 12 })],
      }),
    );
    const saved = storage.save.mock.calls[0][0] as { texts: unknown[] };
    expect(saved.texts[0]).not.toBe(appStore.texts[0]);
  });

  it("reports listening-position save failures", async () => {
    storage.save.mockRejectedValueOnce(new Error("quota exceeded"));

    persistTexts();

    await vi.waitFor(() =>
      expect(toast).toHaveBeenCalledWith("Could not save the listening position: quota exceeded"),
    );
  });

  it("saves only the listening log and reports failures", async () => {
    appStore.log = { "2026-01-01": 60 };
    persistLog();
    await vi.waitFor(() =>
      expect(storage.save).toHaveBeenCalledWith({ log: { "2026-01-01": 60 } }),
    );

    storage.save.mockRejectedValueOnce(new Error("disk full"));
    persistLog();
    await vi.waitFor(() =>
      expect(toast).toHaveBeenCalledWith("Could not save listening time: disk full"),
    );

    storage.save.mockRejectedValueOnce("plain failure");
    persistLog();
    await vi.waitFor(() =>
      expect(toast).toHaveBeenCalledWith("Could not save listening time: plain failure"),
    );
  });
});

describe("preferences", () => {
  it("stores settings and updates the shared store", () => {
    const next: Settings = { ...defaultSettings, wpm: 55, wordGapMultiplier: 3 };
    updateSettings(next);

    expect(appStore.settings).toEqual(next);
    expect(JSON.parse(localStorage.getItem(KEYS.settings)!)).toMatchObject({
      wpm: 55,
      wordGapMultiplier: 3,
    });
  });

  it("stores the theme", () => {
    updateTheme("light");
    expect(appStore.theme).toBe("light");
    expect(localStorage.getItem(KEYS.theme)).toBe('"light"');
  });

  it("accumulates listening time for today", () => {
    addListeningTime(15);
    addListeningTime(20);
    expect(appStore.log[todayKey()]).toBe(35);
  });

  it("keeps the install prompt in the store", () => {
    const prompt = {
      prompt: () => Promise.resolve(),
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    };
    setInstallPrompt(prompt);
    expect(appStore.installPrompt).toBe(prompt);
    setInstallPrompt(null);
    expect(appStore.installPrompt).toBeNull();
  });
});

describe("defaults", () => {
  it("provides demo texts for a fresh install", () => {
    expect(defaultTexts.length).toBeGreaterThan(0);
    expect(defaultTexts.every((text) => text.content.length > 0)).toBe(true);
  });
});

describe("playback store", () => {
  it("resets the playback position and span cursor", () => {
    playbackStore.totalFrames = 100;
    playbackStore.consumedFrames = 50;
    playbackStore.spans = [{ startText: 0, endText: 2, startFrame: 0, endFrame: 10 }];
    playbackStore.activeSpanIndex = 3;
    playbackStore.lastLogFrame = 40;

    resetPlaybackPosition();

    expect(playbackStore.totalFrames).toBe(0);
    expect(playbackStore.consumedFrames).toBe(0);
    expect(playbackStore.spans).toEqual([]);
    expect(playbackStore.activeSpanIndex).toBe(-2);
    expect(playbackStore.lastLogFrame).toBe(0);
  });
});
