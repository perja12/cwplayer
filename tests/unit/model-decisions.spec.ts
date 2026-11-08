import { describe, expect, it } from "vitest";
import { mp3FileName } from "../../src/model/export";
import {
  playableQueueTextIds,
  removeQueuedText,
  textDraftFromFormData,
} from "../../src/model/library";
import {
  byteOffsetAt,
  listeningSeconds,
  nextPlayableQueueIndex,
  stepQueueIndex,
  textPositionAtFrame,
  transportAction,
} from "../../src/model/playback";
import { normalizeSelectionText, selectionPopupPosition } from "../../src/model/selection";
import { settingsFromFormData } from "../../src/model/settings";
import { decodeByteSpans } from "../../src/model/spans";
import { defaultSettings } from "../../src/model/defaults";
import type { PlaybackState, TextSpan } from "../../src/model/types";

const spans: TextSpan[] = [
  { startText: 0, endText: 2, startFrame: 10, endFrame: 20 },
  { startText: 3, endText: 6, startFrame: 30, endFrame: 40 },
];

describe("decodeByteSpans", () => {
  it("maps UTF-8 byte offsets to UTF-16 offsets", () => {
    const content = "Aé€😀B";
    const decoded = decodeByteSpans(content, [
      { startByte: 0, endByte: 1, startFrame: 0, endFrame: 1 },
      { startByte: 1, endByte: 3, startFrame: 1, endFrame: 2 },
      { startByte: 3, endByte: 6, startFrame: 2, endFrame: 3 },
      { startByte: 6, endByte: 10, startFrame: 3, endFrame: 4 },
      { startByte: 10, endByte: 11, startFrame: 4, endFrame: 5 },
    ]);

    expect(decoded.map((span) => [span.startText, span.endText])).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 5],
      [5, 6],
    ]);
    expect(content.slice(decoded[3].startText, decoded[3].endText)).toBe("😀");
  });

  it("preserves frame indices and falls back for unknown byte offsets", () => {
    const decoded = decodeByteSpans("CQ", [
      { startByte: 0, endByte: 2, startFrame: 7, endFrame: 9 },
      { startByte: 999, endByte: 1000, startFrame: 10, endFrame: 11 },
    ]);

    expect(decoded[0]).toEqual({ startText: 0, endText: 2, startFrame: 7, endFrame: 9 });
    expect(decoded[1]).toEqual({ startText: 0, endText: 0, startFrame: 10, endFrame: 11 });
  });

  it("handles empty content", () => {
    expect(decodeByteSpans("", [])).toEqual([]);
    expect(decodeByteSpans("", [{ startByte: 0, endByte: 0, startFrame: 0, endFrame: 1 }])).toEqual(
      [{ startText: 0, endText: 0, startFrame: 0, endFrame: 1 }],
    );
  });
});

describe("transportAction", () => {
  it("maps every playback state to the toggle action", () => {
    const cases: Array<[PlaybackState, string]> = [
      ["playing", "pause"],
      ["paused", "resume"],
      ["idle", "start"],
      ["preparing", "start"],
      ["stopping", "start"],
      ["ended", "start"],
    ];
    for (const [state, action] of cases) expect(transportAction(state)).toBe(action);
  });
});

describe("textPositionAtFrame", () => {
  it("returns the active span start", () => {
    expect(textPositionAtFrame(spans, 10)).toBe(0);
    expect(textPositionAtFrame(spans, 19)).toBe(0);
    expect(textPositionAtFrame(spans, 30)).toBe(3);
  });

  it("falls back to the last finished span inside a gap", () => {
    expect(textPositionAtFrame(spans, 20)).toBe(0);
    expect(textPositionAtFrame(spans, 29)).toBe(0);
    expect(textPositionAtFrame(spans, 999)).toBe(3);
  });

  it("returns zero before playback starts or without spans", () => {
    expect(textPositionAtFrame(spans, 0)).toBe(0);
    expect(textPositionAtFrame([], 50)).toBe(0);
  });
});

describe("byteOffsetAt", () => {
  it("translates a UTF-16 character offset into UTF-8 bytes", () => {
    expect(byteOffsetAt("CQ DE", 3)).toBe(3);
    expect(byteOffsetAt("Aé€😀B", 1)).toBe(1);
    expect(byteOffsetAt("Aé€😀B", 2)).toBe(3);
    expect(byteOffsetAt("Aé€😀B", 3)).toBe(6);
    expect(byteOffsetAt("Aé€😀B", 4)).toBe(10);
    expect(byteOffsetAt("Aé€😀B", 5)).toBe(10);
    expect(byteOffsetAt("Aé€😀B", 6)).toBe(11);
  });

  it("clamps out-of-range offsets", () => {
    expect(byteOffsetAt("CQ", -5)).toBe(0);
    expect(byteOffsetAt("CQ", 99)).toBe(2);
    expect(byteOffsetAt("", 5)).toBe(0);
  });
});

describe("queue decisions", () => {
  it("finds the next text that still exists", () => {
    const ids = ["a", "b", "c", "d"];
    expect(nextPlayableQueueIndex(ids, 0, ["a", "b", "c", "d"])).toBe(1);
    expect(nextPlayableQueueIndex(ids, 0, ["a", "c", "d"])).toBe(2);
    expect(nextPlayableQueueIndex(ids, 1, ["a", "b", "c"])).toBe(2);
    expect(nextPlayableQueueIndex(ids, 3, ["a", "b", "c", "d"])).toBe(-1);
    expect(nextPlayableQueueIndex(ids, 0, [])).toBe(-1);
    expect(nextPlayableQueueIndex([], 0, ["a"])).toBe(-1);
  });

  it("steps within queue bounds only", () => {
    expect(stepQueueIndex(1, 1, 3)).toBe(2);
    expect(stepQueueIndex(1, -1, 3)).toBe(0);
    expect(stepQueueIndex(0, -1, 3)).toBeNull();
    expect(stepQueueIndex(2, 1, 3)).toBeNull();
    expect(stepQueueIndex(5, 1, 5)).toBeNull();
  });

  it("keeps only existing texts in collection order", () => {
    expect(playableQueueTextIds(["a", "b", "c"], ["c", "a"])).toEqual(["a", "c"]);
    expect(playableQueueTextIds(["a", "a"], ["a"])).toEqual(["a", "a"]);
    expect(playableQueueTextIds([], ["a"])).toEqual([]);
  });
});

describe("removeQueuedText", () => {
  const queue = { collectionId: "c1", textIds: ["a", "b", "c"] };

  it("clears the queue when the current chapter is removed", () => {
    expect(removeQueuedText(queue, 1, "b")).toEqual({ queue: null, queueIndex: 1 });
  });

  it("keeps the listener on the same text when an earlier chapter is removed", () => {
    expect(removeQueuedText(queue, 2, "a")).toEqual({
      queue: { collectionId: "c1", textIds: ["b", "c"] },
      queueIndex: 1,
    });
  });

  it("keeps the index when a later chapter is removed", () => {
    expect(removeQueuedText(queue, 0, "c")).toEqual({
      queue: { collectionId: "c1", textIds: ["a", "b"] },
      queueIndex: 0,
    });
  });

  it("leaves an unrelated queue untouched", () => {
    expect(removeQueuedText(queue, 1, "missing")).toEqual({ queue, queueIndex: 1 });
    expect(removeQueuedText(null, 0, "a")).toEqual({ queue: null, queueIndex: 0 });
    expect(queue.textIds).toEqual(["a", "b", "c"]);
  });
});

describe("listeningSeconds", () => {
  it("converts a frame delta at the context rate", () => {
    expect(listeningSeconds(48000, 24000, 48000)).toBe(0.5);
    expect(listeningSeconds(10, 10, 16000)).toBe(0);
  });

  it("never reports negative listening time", () => {
    expect(listeningSeconds(10, 20, 16000)).toBe(0);
  });
});

describe("textDraftFromFormData", () => {
  it("trims the title and content and splits labels", () => {
    const form = new FormData();
    form.set("title", "  A friendly QSO  ");
    form.set("content", "\n CQ CQ DE LB2KK \n");
    form.set("language", "English");
    form.set("labels", " Stories, Practice ,, ");
    form.set("collection", "c1");

    expect(textDraftFromFormData(form)).toEqual({
      title: "A friendly QSO",
      content: "CQ CQ DE LB2KK",
      language: "English",
      labels: ["Stories", "Practice"],
      collectionId: "c1",
    });
  });

  it("rejects a missing or blank title or content", () => {
    const missing = new FormData();
    expect(textDraftFromFormData(missing)).toBeNull();

    const blank = new FormData();
    blank.set("title", "   ");
    blank.set("content", "CQ");
    expect(textDraftFromFormData(blank)).toBeNull();

    const emptyContent = new FormData();
    emptyContent.set("title", "Title");
    emptyContent.set("content", " \n ");
    expect(textDraftFromFormData(emptyContent)).toBeNull();
  });

  it("maps an empty collection selection to standalone", () => {
    const form = new FormData();
    form.set("title", "Title");
    form.set("content", "Text");
    form.set("collection", "");

    const draft = textDraftFromFormData(form);
    expect(draft?.collectionId).toBeNull();
    expect(draft?.language).toBe("");
    expect(draft?.labels).toEqual([]);
  });
});

describe("settingsFromFormData", () => {
  it("parses a complete sound form", () => {
    const form = new FormData();
    form.set("wpm", "30");
    form.set("frequency", "610");
    form.set("volume", "80");
    form.set("envelope", "4.4");
    form.set("shape", "1");
    form.set("farnsworthWpm", "12");
    form.set("paragraphPause", "0.5");
    form.set("wordGapMultiplier", "3");
    form.set("roomLevel", "25");
    form.set("phase", "0.39");
    form.set("secondFrequency", "700");
    form.append("stereo", "on");
    form.append("room", "on");

    expect(settingsFromFormData(form)).toEqual({
      ...defaultSettings,
      wpm: 30,
      frequency: 610,
      volume: 80,
      envelope: 4.4,
      shape: 1,
      farnsworthWpm: 12,
      paragraphPause: 0.5,
      wordGapMultiplier: 3,
      roomLevel: 25,
      phase: 0.39,
      secondFrequency: 700,
      stereo: 1,
      room: 1,
    });
  });

  it("treats absent checkboxes and optional tones as off", () => {
    const form = new FormData();
    form.set("wpm", "20");
    form.set("frequency", "500");
    form.set("volume", "100");
    form.set("envelope", "5");
    form.set("shape", "0");
    form.set("paragraphPause", "0");
    form.set("roomLevel", "0");
    form.set("phase", "0");

    const settings = settingsFromFormData(form);
    expect(settings.stereo).toBe(0);
    expect(settings.room).toBe(0);
    expect(settings.farnsworthWpm).toBe(0);
    expect(settings.secondFrequency).toBe(0);
    expect(settings.wordGapMultiplier).toBe(1);
  });

  it("clamps the extra word gap to the engine range", () => {
    const low = new FormData();
    low.set("wordGapMultiplier", "0");
    expect(settingsFromFormData(low).wordGapMultiplier).toBe(1);

    const high = new FormData();
    high.set("wordGapMultiplier", "99");
    expect(settingsFromFormData(high).wordGapMultiplier).toBe(10);

    const invalid = new FormData();
    invalid.set("wordGapMultiplier", "not a number");
    expect(settingsFromFormData(invalid).wordGapMultiplier).toBe(1);
  });
});

describe("mp3FileName", () => {
  it("replaces characters that are invalid in filenames", () => {
    expect(mp3FileName('a/b\\c:d*e?f"g<h>i|j')).toBe("a-b-c-d-e-f-g-h-i-j.mp3");
  });

  it("trims the title and falls back for an empty one", () => {
    expect(mp3FileName("  CQ  ")).toBe("CQ.mp3");
    expect(mp3FileName("")).toBe("cw-practice.mp3");
    expect(mp3FileName("   ")).toBe("cw-practice.mp3");
  });

  it("keeps dots, dashes, and spaces", () => {
    expect(mp3FileName("Part 1 - Evening. QSO")).toBe("Part 1 - Evening. QSO.mp3");
  });
});

describe("selection decisions", () => {
  it("normalizes selections across line breaks", () => {
    expect(normalizeSelectionText("  CQ\n\tDE   LA1ABC \n")).toBe("CQ DE LA1ABC");
    expect(normalizeSelectionText(" \n ")).toBe("");
  });

  it("places the popup below the anchor when there is room", () => {
    const position = selectionPopupPosition(
      { left: 400, top: 80, width: 100, height: 20, bottom: 100 },
      { width: 1000, height: 800 },
      { width: 120, height: 38 },
    );

    expect(position).toEqual({ left: 450, top: 109 });
  });

  it("flips above the anchor near the bottom edge", () => {
    const position = selectionPopupPosition(
      { left: 400, top: 760, width: 100, height: 20, bottom: 780 },
      { width: 1000, height: 800 },
      { width: 120, height: 38 },
    );

    expect(position).toEqual({ left: 450, top: 713 });
  });

  it("keeps the popup inside both horizontal edges", () => {
    const popup = { width: 120, height: 38 };
    const viewport = { width: 1000, height: 800 };

    expect(
      selectionPopupPosition(
        { left: 0, top: 10, width: 0, height: 10, bottom: 20 },
        viewport,
        popup,
      ).left,
    ).toBe(72);
    expect(
      selectionPopupPosition(
        { left: 2000, top: 10, width: 0, height: 10, bottom: 20 },
        viewport,
        popup,
      ).left,
    ).toBe(928);
  });
});
