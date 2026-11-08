// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { appStore } from "../../src/app/app-store";
import { playbackStore } from "../../src/app/playback-store";
import { previewStore } from "../../src/app/preview-store";
import { defaultTexts, WORD_FREQUENCY_LIMIT } from "../../src/model/defaults";
import { todayKey } from "../../src/model/format";
import { icon } from "../../src/ui/icons";
import { renderShell } from "../../src/views/app-view";
import { renderDock } from "../../src/views/dock-view";
import { renderLibrary } from "../../src/views/library-view";
import { renderLog } from "../../src/views/log-view";
import { renderNav } from "../../src/views/nav-view";
import { renderPlayer } from "../../src/views/player-view";
import { renderReview } from "../../src/views/review-view";
import { resetStores, render, sampleText } from "./helpers";

beforeEach(resetStores);

describe("navigation view", () => {
  it("marks only the current destination active", () => {
    appStore.view = "review";
    const view = render(renderNav());

    expect(view.querySelectorAll(".nav-item")).toHaveLength(5);
    expect(view.querySelectorAll(".nav-item.active")).toHaveLength(1);
    expect(view.querySelector(".nav-item.active")?.getAttribute("data-nav")).toBe("review");
    expect(view.querySelector(".nav-item.active")?.textContent).toContain("Practice Review");
    expect(view.querySelector("[data-menu-toggle]")?.getAttribute("aria-controls")).toBe(
      "app-menu",
    );
    expect(view.querySelector("#app-menu")?.querySelectorAll(".nav-item")).toHaveLength(5);
    expect(view.querySelector("#app-menu [data-menu-close]")).not.toBeNull();
    expect(view.querySelector("#app-menu [data-open-settings]")?.textContent).toContain("Settings");
    expect(view.querySelector(".brand-name")?.textContent).toBe("CW Player");
    expect(view.querySelector("#app-menu")?.textContent).not.toContain(
      "Your texts stay on this device.",
    );
  });

  it("shows the theme action, install action, and reload action", () => {
    appStore.theme = "dark";
    const hiddenInstall = render(renderNav());
    expect(hiddenInstall.querySelector("[data-install-app]")?.hasAttribute("hidden")).toBe(true);
    expect(hiddenInstall.querySelector(".sidebar-note .theme-toggle")).not.toBeNull();
    expect(hiddenInstall.querySelector(".theme-toggle")?.textContent).toContain("Light Theme");
    expect(hiddenInstall.querySelector(".theme-toggle path")?.getAttribute("d")).toBe(
      render(icon("sun")).querySelector("path")?.getAttribute("d"),
    );

    appStore.theme = "light";
    const lightTheme = render(renderNav());
    expect(lightTheme.querySelector(".theme-toggle")?.textContent).toContain("Dark Theme");
    expect(lightTheme.querySelector(".theme-toggle path")?.getAttribute("d")).toBe(
      render(icon("moon")).querySelector("path")?.getAttribute("d"),
    );

    appStore.installPrompt = {
      prompt: () => Promise.resolve(),
      userChoice: Promise.resolve({ outcome: "accepted" }),
    } as never;
    const visibleInstall = render(renderNav());
    expect(visibleInstall.querySelector("[data-install-app]")?.hasAttribute("hidden")).toBe(false);
    expect(visibleInstall.querySelector("[data-reload-app]")?.textContent).toContain("Reload App");
    expect(visibleInstall.querySelector("[data-reload-app] path")?.getAttribute("d")).toBe(
      render(icon("downloadForOffline")).querySelector("path")?.getAttribute("d"),
    );
  });
});

describe("dock view", () => {
  it("disables transport until a text is available", () => {
    const view = render(renderDock());
    const toggle = view.querySelector('[data-transport="toggle"]');

    expect(toggle?.hasAttribute("disabled")).toBe(true);
    expect(view.querySelector(".dock-meta strong")?.textContent).toBe("Choose a text");
    expect(view.querySelectorAll(".time-labels span")[1]?.textContent).toBe("--:--");
  });

  it("shows a compact cover thumbnail for the active text", () => {
    const withItem = render(renderDock(sampleText({ coverImage: "data:image/png;base64,abc" })));
    const thumbnail = withItem.querySelector(".dock-item .cover-art.compact");
    expect(thumbnail?.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,abc");

    const withoutItem = render(renderDock());
    expect(withoutItem.querySelector(".dock-item .cover-art")).toBeNull();
  });

  it("reflects playback state, progress, and settings", () => {
    playbackStore.state = "playing";
    playbackStore.totalFrames = 1000;
    playbackStore.consumedFrames = 500;
    appStore.settings.wpm = 42;
    const view = render(renderDock(sampleText()));

    expect(view.querySelector('[data-transport="toggle"]')?.getAttribute("aria-label")).toBe(
      "Pause",
    );
    expect(view.querySelector(".progress-track span")?.getAttribute("style")).toBe("width:50%");
    expect(view.querySelector(".sound-summary")?.textContent).toContain("42 WPM");
  });

  it("exposes the recognized-word action with playback feedback", () => {
    const idle = render(renderDock(sampleText()));
    expect(idle.querySelector("[data-recognize]")?.hasAttribute("disabled")).toBe(true);

    playbackStore.state = "playing";
    const ready = render(renderDock(sampleText()));
    const button = ready.querySelector("[data-recognize]");
    expect(button?.hasAttribute("disabled")).toBe(false);
    expect(button?.getAttribute("aria-label")).toBe("Mark current word recognized");
    expect(button?.querySelector("path")?.getAttribute("d")).toBe(
      render(icon("lightbulb")).querySelector("path")?.getAttribute("d"),
    );

    playbackStore.recognizedFeedbackUntil = Date.now() + 1000;
    const confirmed = render(renderDock(sampleText()));
    const recognized = confirmed.querySelector("[data-recognize]");
    expect(recognized?.classList.contains("confirmed")).toBe(true);
    expect(recognized?.getAttribute("aria-label")).toBe("Word recognized");
    expect(recognized?.querySelector("path")?.getAttribute("d")).toBe(
      render(icon("check")).querySelector("path")?.getAttribute("d"),
    );
  });

  it("describes a queued chapter", () => {
    appStore.collections = [{ id: "c1", title: "Stories", itemIds: ["sample", "other"] }];
    appStore.playbackQueue = { collectionId: "c1", textIds: ["sample", "other"] };
    appStore.queueIndex = 1;
    const view = render(renderDock(sampleText()));

    expect(view.querySelector(".dock-meta span")?.textContent).toBe("Stories · Chapter 2 of 2");
  });
});

describe("player view", () => {
  it("renders an empty state without a text", () => {
    const view = render(renderPlayer());
    expect(view.querySelector(".empty-player h1")?.textContent).toBe("No text selected");
  });

  it("blurs the transcript and flips the visibility toggle", () => {
    playbackStore.spans = [{ startText: 0, endText: 2, startFrame: 10, endFrame: 20 }];
    playbackStore.consumedFrames = 15;
    appStore.followVisible = false;
    const view = render(renderPlayer(sampleText()));
    const box = view.querySelector(".transcript-box");
    const toggle = view.querySelector("[data-follow-toggle]");

    expect(box?.classList.contains("blurred")).toBe(true);
    expect(box?.querySelector("#transcript")?.textContent).toContain("CQ");
    expect(box?.querySelector("mark.current-char")).toBeNull();
    expect(toggle?.getAttribute("aria-label")).toBe("Show transcript");
    expect(toggle?.querySelector("path")?.getAttribute("d")).toBe(
      render(icon("visibilityOff")).querySelector("path")?.getAttribute("d"),
    );
  });

  it("shows the transcript with the visibility icon by default", () => {
    const view = render(renderPlayer(sampleText()));
    const box = view.querySelector(".transcript-box");
    const toggle = view.querySelector("[data-follow-toggle]");

    expect(box?.classList.contains("blurred")).toBe(false);
    expect(toggle?.getAttribute("aria-label")).toBe("Hide transcript");
    expect(toggle?.querySelector("path")?.getAttribute("d")).toBe(
      render(icon("visibility")).querySelector("path")?.getAttribute("d"),
    );
  });

  it("renders chapter controls and disables them at the edges", () => {
    appStore.playbackQueue = { collectionId: "c1", textIds: ["sample", "other"] };
    appStore.queueIndex = 0;
    const first = render(renderPlayer(sampleText()));
    expect(first.querySelector(".chapter-controls")?.textContent).toContain("Chapter 1 of 2");
    expect(first.querySelector('[data-queue-step="-1"]')?.hasAttribute("disabled")).toBe(true);
    expect(first.querySelector('[data-queue-step="1"]')?.hasAttribute("disabled")).toBe(false);

    appStore.queueIndex = 1;
    const last = render(renderPlayer(sampleText()));
    expect(last.querySelector('[data-queue-step="1"]')?.hasAttribute("disabled")).toBe(true);
  });

  it("highlights the active span and escapes transcript markup", () => {
    playbackStore.spans = [{ startText: 0, endText: 2, startFrame: 10, endFrame: 20 }];
    playbackStore.consumedFrames = 15;
    const view = render(renderPlayer(sampleText({ content: "CQ <b> DE" })));

    expect(view.querySelector("mark.current-char")?.textContent).toBe("CQ");
    expect(view.querySelector("b")).toBeNull();
    expect(view.querySelector("#transcript")?.textContent).toContain("<b>");
  });

  it("leaves recognized-word feedback to the dock", () => {
    playbackStore.state = "playing";
    const view = render(renderPlayer(sampleText()));
    expect(view.querySelector("[data-recognize]")).toBeNull();
    expect(view.querySelector(".recognize-row")).toBeNull();
  });

  it("falls back to the generic practice label", () => {
    const view = render(renderPlayer(sampleText({ labels: [], language: "" })));
    expect(view.querySelector(".player-title p")?.textContent).toBe("Morse practice");
  });
});

describe("library view", () => {
  it("separates collection chapters from standalone texts", () => {
    const chapter = sampleText({ id: "chapter", title: "Chapter one", collectionId: "c1" });
    const standalone = sampleText({ id: "alone", title: "Standalone" });
    appStore.texts = [chapter, standalone];
    appStore.collections = [{ id: "c1", title: "Stories", itemIds: ["chapter"] }];
    const view = render(renderLibrary());

    expect(view.querySelectorAll(".collection-block")).toHaveLength(1);
    expect(view.querySelectorAll(".chapter-row")).toHaveLength(0);
    expect(view.querySelector(".library-summary")?.textContent).toContain("1 standalone text");
    expect(view.querySelectorAll(".text-row")).toHaveLength(1);

    appStore.expandedCollections.add("c1");
    const expanded = render(renderLibrary());
    expect(expanded.querySelectorAll(".chapter-row")).toHaveLength(1);
    expect(expanded.querySelector(".chapter-row strong")?.textContent).toBe("Chapter one");
  });

  it("shows a pause control for the text and collection that are playing", () => {
    appStore.texts = [
      sampleText({ id: "a", title: "Alpha" }),
      sampleText({ id: "b", title: "Beta" }),
    ];
    appStore.activeTextId = "a";
    playbackStore.state = "playing";

    const playing = render(renderLibrary());
    expect(playing.querySelector('[data-play="a"]')?.getAttribute("aria-label")).toBe(
      "Pause Alpha",
    );
    expect(playing.querySelector('[data-play="b"]')?.getAttribute("aria-label")).toBe("Play Beta");

    appStore.collections = [{ id: "c1", title: "Stories", itemIds: ["a"] }];
    appStore.playbackQueue = { collectionId: "c1", textIds: ["a"] };
    appStore.expandedCollections.add("c1");
    const collection = render(renderLibrary());
    expect(collection.querySelector("[data-play-collection]")?.getAttribute("aria-label")).toBe(
      "Pause collection",
    );

    playbackStore.state = "paused";
    const paused = render(renderLibrary());
    expect(paused.querySelector('[data-play="a"]')?.getAttribute("aria-label")).toBe("Play Alpha");
    expect(paused.querySelector("[data-play-collection]")?.getAttribute("aria-label")).toBe(
      "Play collection",
    );
  });

  it("disables a collection that points at no existing text", () => {
    appStore.collections = [{ id: "c1", title: "Empty", itemIds: ["missing"] }];
    const view = render(renderLibrary());
    expect(view.querySelector("[data-play-collection]")?.hasAttribute("disabled")).toBe(true);
  });

  it("invites the user to add texts to an expanded empty collection", () => {
    appStore.collections = [{ id: "c1", title: "Empty", itemIds: [] }];
    appStore.expandedCollections.add("c1");
    const view = render(renderLibrary());
    expect(view.querySelector(".empty-collection")?.textContent).toContain(
      "Add texts using the text menu",
    );
  });

  it("escapes text metadata and renders an empty library state", () => {
    appStore.texts = [sampleText({ title: "<script>" })];
    const view = render(renderLibrary());
    expect(view.querySelector(".text-row strong")?.textContent).toBe("<script>");

    appStore.texts = [];
    appStore.collections = [];
    expect(render(renderLibrary()).querySelector(".empty-library")).not.toBeNull();
  });
});

describe("review view", () => {
  it("lists the most frequent words and toggles a stop action for the active word", () => {
    appStore.texts = [sampleText({ id: "freq", content: "CQ CQ DE" })];
    appStore.activeTextId = "freq";
    appStore.frequencyTextId = "freq";
    previewStore.word = "CQ";
    const view = render(renderReview());
    const rows = view.querySelectorAll(".frequency-item");

    expect(rows).toHaveLength(2);
    expect(rows[0]?.querySelector(".frequency-word")?.textContent).toBe("cq");
    expect(rows[0]?.querySelector(".frequency-count")?.textContent).toBe("2");
    expect(rows[0]?.className).toContain("playing");
    expect(rows[0]?.querySelector("[data-word-play]")?.getAttribute("aria-label")).toContain(
      "Stop cq",
    );
    expect(rows[0]?.querySelector("[data-word-play]")?.getAttribute("aria-pressed")).toBe("true");
    expect(rows[1]?.className).not.toContain("playing");
    expect(rows[1]?.querySelector("[data-word-play]")?.getAttribute("aria-label")).toContain(
      "Play de",
    );
    expect(rows[1]?.querySelector("[data-word-play]")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("limits the list and explains how many words were hidden", () => {
    const content = Array.from(
      { length: WORD_FREQUENCY_LIMIT + 10 },
      (_, index) => `word${index}`,
    ).join(" ");
    appStore.texts = [sampleText({ id: "freq", content })];
    appStore.frequencyTextId = "freq";
    const view = render(renderReview());

    expect(view.querySelectorAll(".frequency-item")).toHaveLength(WORD_FREQUENCY_LIMIT);
    expect(view.querySelector(".frequency-heading p")?.textContent).toContain(
      `${WORD_FREQUENCY_LIMIT} of ${WORD_FREQUENCY_LIMIT + 10}`,
    );
  });

  it("renders marks with their source text and falls back for removed texts", () => {
    appStore.texts = [sampleText({ id: "freq", title: "Source", content: "CQ DE" })];
    appStore.frequencyTextId = "freq";
    appStore.marks = [
      {
        id: "m1",
        itemId: "freq",
        word: "CQ",
        excerpt: "[[CQ]] DE",
        date: Date.UTC(2026, 0, 2),
        characterOffset: 0,
      },
      {
        id: "m2",
        itemId: "gone",
        word: "DE",
        excerpt: "CQ [[DE]]",
        date: Date.UTC(2026, 0, 3),
      },
    ];
    const view = render(renderReview());

    expect(view.querySelectorAll(".review-item")).toHaveLength(2);
    expect(view.querySelectorAll(".mark-anchor")[0]?.textContent).toBe("DE");
    expect(view.querySelectorAll(".review-item")[1]?.textContent).toContain("CQ DE");
    expect(view.textContent).toContain("Source");
    expect(view.textContent).toContain("Text removed");
    expect(view.querySelector(".recognized-heading h2")?.textContent).toBe("Recognized words");
    expect(view.querySelector(".page-heading [data-clear-marks]")).toBeNull();
    expect(
      view.querySelector(".recognized-heading [data-clear-marks]")?.hasAttribute("disabled"),
    ).toBe(false);
    const playButtons = view.querySelectorAll("[data-phrase-play]");
    expect(playButtons).toHaveLength(2);
    expect(playButtons[0]?.getAttribute("data-phrase-text")).toBe("CQ DE");
    expect(playButtons[0]?.getAttribute("aria-label")).toBe("Play sentence for DE");
  });

  it("highlights a recognized word while its sentence is playing", () => {
    appStore.texts = [sampleText({ id: "freq", content: "CQ DE" })];
    appStore.frequencyTextId = "freq";
    appStore.marks = [
      {
        id: "m1",
        itemId: "freq",
        word: "CQ",
        excerpt: "[[CQ]] DE",
        date: Date.UTC(2026, 0, 2),
        characterOffset: 0,
      },
    ];
    previewStore.phrase = { id: "m1", text: "CQ DE", playing: true };

    const view = render(renderReview());
    const item = view.querySelector(".review-item");
    const button = item?.querySelector("[data-phrase-play]");

    expect(item?.className).toContain("playing");
    expect(button?.className).toContain("playing");
    expect(button?.getAttribute("aria-label")).toBe("Stop sentence for CQ");
    expect(button?.getAttribute("aria-pressed")).toBe("true");
  });

  it("shows empty states when there is nothing to review", () => {
    appStore.texts = [sampleText({ id: "freq", content: "..." })];
    appStore.frequencyTextId = "freq";
    const view = render(renderReview());

    expect(view.querySelector(".frequency-empty")).not.toBeNull();
    expect(view.querySelector(".empty-state")).not.toBeNull();
    expect(view.querySelector("[data-clear-marks]")?.hasAttribute("disabled")).toBe(true);
  });

  it("omits the frequency card when the library has no texts", () => {
    appStore.texts = [];
    appStore.frequencyTextId = "";
    const view = render(renderReview());

    expect(view.querySelector(".frequency-card")).toBeNull();
    expect(view.querySelector(".empty-state")).not.toBeNull();
  });

  it("switches the frequency source through the selector", () => {
    appStore.texts = [
      sampleText({ id: "a", title: "Alpha" }),
      sampleText({ id: "b", title: "Beta" }),
    ];
    appStore.frequencyTextId = "b";
    const view = render(renderReview());
    const options = view.querySelectorAll("[data-frequency-text] option");

    expect(options).toHaveLength(2);
    expect(options[1]?.hasAttribute("selected")).toBe(true);
  });
});

describe("log view", () => {
  it("summarises today and plots the last two weeks", () => {
    appStore.log = { [todayKey()]: 90 };
    const view = render(renderLog());

    expect(view.querySelectorAll(".stat-card")).toHaveLength(3);
    expect(view.querySelector(".stat-card strong")?.textContent).toBe("0:01:30");
    expect(view.querySelectorAll(".chart-day")).toHaveLength(14);
    expect(view.querySelector(".chart-column.today")).not.toBeNull();
  });
});

describe("app shell", () => {
  it.each([
    ["player", "NOW LISTENING"],
    ["library", "Library"],
    ["review", "Practice Review"],
    ["log", "Listening Log"],
  ] as const)("renders the %s destination", (viewName, heading) => {
    appStore.view = viewName;
    const view = render(renderShell());

    expect(view.querySelector(".main-view")?.textContent).toContain(heading);
    expect(view.querySelector("#modal")).not.toBeNull();
    expect(view.querySelectorAll(".nav-item")).toHaveLength(5);
  });

  it("uses the active text for the player and dock", () => {
    appStore.texts = defaultTexts;
    appStore.activeTextId = defaultTexts[1].id;
    const view = render(renderShell());

    expect(view.querySelector(".page-heading h1")?.textContent).toBe(defaultTexts[1].title);
    expect(view.querySelector(".dock-meta strong")?.textContent).toBe(defaultTexts[1].title);
  });
});
