// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appStore } from "../../src/app/app-store";
import { playbackStore } from "../../src/app/playback-store";
import { renderPracticeExcerpt } from "../../src/views/practice-excerpt-view";
import {
  refollowTranscript,
  renderPlayerProgress,
  updateTranscriptHomeButton,
} from "../../src/views/player-progress-view";
import { highlightText } from "../../src/views/transcript-view";
import { resetStores, render, sampleText } from "./helpers";

beforeEach(resetStores);

describe("practice excerpt", () => {
  it("marks the anchor and fades the three words before it", () => {
    const html = renderPracticeExcerpt("one two three four [[CQ]] after");
    const view = render(html);

    expect(view.querySelectorAll(".mark-trail")).toHaveLength(3);
    expect(view.querySelector(".mark-trail-1")?.textContent).toBe("four");
    expect(view.querySelector(".mark-anchor")?.textContent).toBe("CQ");
    expect(view.textContent).toBe("one two three four CQ after");
  });

  it("splits the anchor around a character offset", () => {
    const view = render(renderPracticeExcerpt("prefix [[LA1ABC]] suffix", 2));

    expect(view.querySelector(".mark-char-trail")?.textContent).toBe("LA");
    expect(view.querySelector(".mark-anchor")?.textContent).toBe("1");
    expect(view.textContent).toBe("prefix LA1ABC suffix");
  });

  it("escapes plain excerpts and clamps the offset", () => {
    expect(renderPracticeExcerpt("<b>no anchor</b>")).toBe("&lt;b&gt;no anchor&lt;/b&gt;");
    const clamped = render(renderPracticeExcerpt("[[AB]]", 99));
    expect(clamped.querySelector(".mark-anchor")?.textContent).toBe("B");
  });

  it("handles an empty anchor", () => {
    const view = render(renderPracticeExcerpt("[[]]"));
    expect(view.querySelector(".mark-anchor")?.textContent).toBe("");
  });
});

describe("transcript highlight", () => {
  it("wraps the active span and escapes surrounding markup", () => {
    playbackStore.spans = [{ startText: 0, endText: 2, startFrame: 10, endFrame: 20 }];
    const html = highlightText("CQ <b> DE", 12);
    const view = render(html);

    expect(view.querySelector("mark.current-char")?.textContent).toBe("CQ");
    expect(view.querySelector("b")).toBeNull();
    expect(view.textContent).toBe("CQ <b> DE");
  });

  it("returns escaped content when no span is active", () => {
    playbackStore.spans = [{ startText: 0, endText: 2, startFrame: 10, endFrame: 20 }];
    expect(highlightText("<x>", 5)).toBe("&lt;x&gt;");
  });
});

describe("player progress view", () => {
  function buildDom() {
    document.body.innerHTML =
      '<span class="progress-track"><span></span></span><div class="time-labels"></div><div id="transcript"></div><button data-transcript-home hidden></button>';
  }

  it("updates the progress bar, labels, and transcript when the span changes", () => {
    buildDom();
    appStore.texts = [sampleText({ id: "progress", content: "CQ DE" })];
    appStore.activeTextId = "progress";
    playbackStore.spans = [
      { startText: 0, endText: 2, startFrame: 10, endFrame: 20 },
      { startText: 3, endText: 5, startFrame: 20, endFrame: 30 },
    ];
    playbackStore.totalFrames = 1000;
    playbackStore.consumedFrames = 25;
    playbackStore.sampleRate = 1000;

    renderPlayerProgress();

    expect(document.querySelector(".progress-track span")?.getAttribute("style")).toContain("2.5%");
    expect(document.querySelectorAll(".time-labels span")[0]?.textContent).toBe("0:00:00");
    expect(document.querySelectorAll(".time-labels span")[1]?.textContent).toBe("0:00:01");
    expect(document.querySelector("#transcript mark.current-char")?.textContent).toBe("DE");
    expect(playbackStore.activeSpanIndex).toBe(1);
  });

  it("does nothing without an active text", () => {
    buildDom();
    appStore.texts = [];
    playbackStore.consumedFrames = 10;
    renderPlayerProgress();
    expect(document.querySelector("#transcript")?.innerHTML).toBe("");
  });

  it("scrolls the transcript when the cursor passes the follow line", () => {
    buildDom();
    appStore.texts = [sampleText({ id: "scroll", content: "CQ DE" })];
    appStore.activeTextId = "scroll";
    appStore.transcriptFollowPaused = false;
    playbackStore.spans = [{ startText: 0, endText: 2, startFrame: 10, endFrame: 20 }];
    playbackStore.totalFrames = 100;
    playbackStore.consumedFrames = 15;

    const transcript = document.querySelector<HTMLElement>("#transcript")!;
    const scrollTo = vi.fn();
    transcript.scrollTo = scrollTo;
    const rectSpy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function rect(this: Element) {
        return (
          this.classList.contains("current-char")
            ? { bottom: 100, height: 20 }
            : { bottom: 50, height: 10 }
        ) as DOMRect;
      });

    try {
      renderPlayerProgress();
    } finally {
      rectSpy.mockRestore();
    }

    expect(scrollTo).toHaveBeenCalledWith({ top: 90, behavior: "smooth" });
  });

  it("shows the return-to-position control only while follow is paused", () => {
    buildDom();
    const transcript = document.querySelector<HTMLElement>("#transcript")!;
    transcript.innerHTML = '<mark class="current-char">CQ</mark>';
    const button = document.querySelector<HTMLButtonElement>("[data-transcript-home]")!;
    let cursorVisible = true;
    const rectSpy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function rect(this: Element) {
        if (this.classList.contains("current-char"))
          return (
            cursorVisible
              ? { top: 10, bottom: 20, left: 10, right: 20 }
              : { top: 40, bottom: 50, left: 10, right: 20 }
          ) as DOMRect;
        return { top: 0, bottom: 30, left: 0, right: 30 } as DOMRect;
      });

    try {
      appStore.transcriptFollowPaused = false;
      updateTranscriptHomeButton();
      expect(button.hidden).toBe(true);

      appStore.transcriptFollowPaused = true;
      updateTranscriptHomeButton();
      expect(button.hidden).toBe(true);

      cursorVisible = false;
      updateTranscriptHomeButton();
      expect(button.hidden).toBe(false);
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("leaves the control alone when there is no cursor", () => {
    buildDom();
    const button = document.querySelector<HTMLButtonElement>("[data-transcript-home]")!;
    button.hidden = true;
    updateTranscriptHomeButton();
    expect(button.hidden).toBe(true);
  });

  it("re-aligns the transcript when a font swap moves the cursor out of view", () => {
    buildDom();
    const transcript = document.querySelector<HTMLElement>("#transcript")!;
    transcript.innerHTML = '<mark class="current-char">CQ</mark>';
    appStore.followVisible = true;
    appStore.transcriptFollowPaused = false;
    const scrollTo = vi.fn();
    transcript.scrollTo = scrollTo;
    let markTop = 290;
    const rectSpy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function rect(this: Element) {
        return (
          this.classList.contains("current-char")
            ? { top: markTop, bottom: markTop + 30, height: 30, left: 0, right: 30 }
            : { top: 0, bottom: 300, height: 300, left: 0, right: 300 }
        ) as DOMRect;
      });

    try {
      refollowTranscript();
      expect(scrollTo).toHaveBeenLastCalledWith({ top: 80, behavior: "auto" });

      // Above the viewport: scroll back up so the cursor sits on the follow line.
      markTop = -40;
      transcript.scrollTop = 600;
      refollowTranscript();
      expect(scrollTo).toHaveBeenLastCalledWith({ top: 350, behavior: "auto" });

      // Fully in the comfortable band: leave the scroll position alone.
      markTop = 100;
      scrollTo.mockClear();
      refollowTranscript();
      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("ignores font swaps while follow is paused, hidden, or has no cursor", () => {
    buildDom();
    const transcript = document.querySelector<HTMLElement>("#transcript")!;
    transcript.innerHTML = '<mark class="current-char">CQ</mark>';
    const scrollTo = vi.fn();
    transcript.scrollTo = scrollTo;
    const rectSpy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function rect(this: Element) {
        return (
          this.classList.contains("current-char")
            ? { top: 290, bottom: 320, height: 30, left: 0, right: 30 }
            : { top: 0, bottom: 300, height: 300, left: 0, right: 300 }
        ) as DOMRect;
      });

    try {
      appStore.followVisible = true;
      appStore.transcriptFollowPaused = true;
      refollowTranscript();
      expect(scrollTo).not.toHaveBeenCalled();

      appStore.followVisible = false;
      appStore.transcriptFollowPaused = false;
      refollowTranscript();
      expect(scrollTo).not.toHaveBeenCalled();

      transcript.innerHTML = "";
      refollowTranscript();
      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      rectSpy.mockRestore();
    }

    document.body.innerHTML = "";
    expect(() => refollowTranscript()).not.toThrow();
  });
});
