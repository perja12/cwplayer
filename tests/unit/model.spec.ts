import { describe, expect, it } from "vitest";
import { formatExportSize, formatTime } from "../../src/model/format";
import { uid } from "../../src/model/ids";
import { assignedCollection, describeItem } from "../../src/model/library";
import { findSpanAtFrame, isSelectionPlaybackAllowed } from "../../src/model/playback";
import {
  estimateSeconds,
  markFromPosition,
  wordAtPosition,
  wordFrequencies,
} from "../../src/model/text";
import type { Collection, TextItem, TextSpan } from "../../src/model/types";

function item(overrides: Partial<TextItem> = {}): TextItem {
  return {
    id: "one",
    title: "One",
    author: "",
    language: "English",
    labels: [],
    content: "CQ DE LA1ABC",
    collectionId: null,
    lastPosition: 0,
    ...overrides,
  };
}

describe("wordFrequencies", () => {
  it("counts case-insensitively and returns lowercase words", () => {
    expect(wordFrequencies("CQ cq CQ don't don't DE LA1ABC.")).toEqual([
      { word: "cq", count: 3 },
      { word: "don't", count: 2 },
      { word: "de", count: 1 },
      { word: "la1abc", count: 1 },
    ]);
  });

  it("merges words that differ only in case", () => {
    expect(wordFrequencies("VI vi Vi")).toEqual([{ word: "vi", count: 3 }]);
  });

  it("supports curly apostrophes and ignores punctuation", () => {
    expect(wordFrequencies("it’s it’s it's")).toEqual([
      { word: "it’s", count: 2 },
      { word: "it's", count: 1 },
    ]);
  });
});

describe("estimateSeconds", () => {
  it("uses word count and WPM", () => {
    expect(estimateSeconds("one two three four", 30)).toBe(4);
    expect(estimateSeconds("", 30)).toBe(1);
  });

  it("never divides by a speed below five", () => {
    expect(estimateSeconds("one two three four", 0)).toBe(48);
  });
});

describe("wordAtPosition", () => {
  const text = "CQ DE LA1ABC";

  it("finds the word containing the position", () => {
    expect(wordAtPosition(text, 0)?.value).toBe("CQ");
    expect(wordAtPosition(text, 3)?.value).toBe("DE");
    expect(wordAtPosition(text, 6)?.value).toBe("LA1ABC");
  });

  it("falls back to the previous word in a gap and handles the end", () => {
    expect(wordAtPosition(text, 2)?.value).toBe("CQ");
    expect(wordAtPosition(text, 100)?.value).toBe("LA1ABC");
    expect(wordAtPosition("", 0)).toBeNull();
  });
});

describe("markFromPosition", () => {
  it("builds an excerpt around the current word", () => {
    const content = "We copied CQ DE LA1ABC clearly";
    const mark = markFromPosition(content, content.indexOf("LA1ABC"));
    expect(mark?.word).toBe("LA1ABC");
    expect(mark?.excerpt).toContain("[[LA1ABC]]");
    expect(mark?.characterOffset).toBe(0);
  });

  it("reports a character offset inside the word", () => {
    const content = "We copied LA1ABC clearly";
    const mark = markFromPosition(content, content.indexOf("LA1ABC") + 2);
    expect(mark?.characterOffset).toBe(2);
  });

  it("returns null when the text has no words", () => {
    expect(markFromPosition("... --- ...", 0)).toBeNull();
  });
});

describe("library descriptions", () => {
  const text = item({ title: "A friendly QSO", author: "LB2KK" });
  const collection: Collection = { id: "c1", title: "Stories", itemIds: [text.id] };

  it("describes a queued chapter", () => {
    expect(
      describeItem(text, { collectionId: "c1", textIds: ["one", "two"] }, [collection], 0),
    ).toBe("Stories · Chapter 1 of 2");
  });

  it("falls back to author, language, then a generic label", () => {
    expect(describeItem(text, null, [], 0)).toBe("LB2KK");
    expect(describeItem(item({ author: "" }), null, [], 0)).toBe("English");
    expect(describeItem(item({ author: "", language: "" }), null, [], 0)).toBe("Morse practice");
    expect(describeItem(undefined, null, [], 0)).toBe("CW Player");
  });

  it("finds a collection by id or membership", () => {
    expect(assignedCollection([collection], text)).toBe(collection);
    expect(assignedCollection([collection], item({ id: "other", collectionId: "c1" }))).toBe(
      collection,
    );
    expect(assignedCollection([collection], item({ id: "other" }))).toBeUndefined();
  });
});

describe("playback model", () => {
  it("allows selection previews only when main playback is not busy", () => {
    expect(isSelectionPlaybackAllowed("idle")).toBe(true);
    expect(isSelectionPlaybackAllowed("paused")).toBe(true);
    expect(isSelectionPlaybackAllowed("ended")).toBe(true);
    expect(isSelectionPlaybackAllowed("playing")).toBe(false);
    expect(isSelectionPlaybackAllowed("preparing")).toBe(false);
    expect(isSelectionPlaybackAllowed("stopping")).toBe(false);
  });

  it("finds the active transcript span", () => {
    const spans: TextSpan[] = [
      { startText: 0, endText: 2, startFrame: 10, endFrame: 20 },
      { startText: 3, endText: 5, startFrame: 20, endFrame: 30 },
    ];
    expect(findSpanAtFrame(spans, 9)).toBe(-1);
    expect(findSpanAtFrame(spans, 10)).toBe(0);
    expect(findSpanAtFrame(spans, 19)).toBe(0);
    expect(findSpanAtFrame(spans, 20)).toBe(1);
    expect(findSpanAtFrame(spans, 30)).toBe(-1);
  });
});

describe("formatting", () => {
  it("formats clock values", () => {
    expect(formatTime(0)).toBe("0:00:00");
    expect(formatTime(3661)).toBe("1:01:01");
    expect(formatTime(-10)).toBe("0:00:00");
  });

  it("formats export sizes", () => {
    expect(formatExportSize(0)).toBe("1 KB");
    expect(formatExportSize(999)).toBe("1 KB");
    expect(formatExportSize(1_500_000)).toBe("1.50 MB");
  });
});

describe("identifiers", () => {
  it("creates unique RFC 4122 identifiers", () => {
    const first = uid();
    const second = uid();
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(second).not.toBe(first);
  });
});
