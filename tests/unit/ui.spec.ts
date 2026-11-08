// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTheme } from "../../src/ui/theme";
import { showToast } from "../../src/ui/toast";
import { openModal } from "../../src/ui/modal";
import { coverArtwork } from "../../src/ui/cover";
import { escapeHtml, formValue } from "../../src/ui/html";
import { icon } from "../../src/ui/icons";
import { render } from "./helpers";

beforeEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("html helpers", () => {
  it("escapes every HTML-sensitive character", () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;",
    );
  });

  it("reads only string form values", () => {
    const form = new FormData();
    form.set("title", "CQ");
    expect(formValue(form, "title")).toBe("CQ");
    expect(formValue(form, "missing")).toBe("");
  });
});

describe("icons", () => {
  it("renders known icons and falls back for unknown names", () => {
    const play = render(icon("play"));
    expect(play.querySelectorAll("path")).toHaveLength(1);
    expect(play.querySelector("svg")?.classList.contains("material-icon")).toBe(true);

    const multi = render(icon("center_focus_strong", "extra"));
    expect(multi.querySelectorAll("path")).toHaveLength(5);
    expect(multi.querySelector("svg")?.getAttribute("class")).toContain("extra");

    const unknown = render(icon("does-not-exist"));
    expect(unknown.querySelectorAll("path")).toHaveLength(1);
  });
});

describe("cover artwork", () => {
  it("uses a deterministic hue and escapes image sources", () => {
    const html = coverArtwork('"><script>', "same-id");
    const first = render(html);
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
    expect(first.querySelector(".cover-art")?.getAttribute("style")).toMatch(/--cover-hue:\d+/);

    const second = render(coverArtwork('"><script>', "same-id"));
    expect(second.querySelector(".cover-art")?.getAttribute("style")).toBe(
      first.querySelector(".cover-art")?.getAttribute("style"),
    );
  });

  it("shows the Morse placeholder and drops the extra line in compact mode", () => {
    const full = render(coverArtwork(undefined, "abc"));
    expect(full.querySelector(".cover-morse")).not.toBeNull();
    expect(full.querySelector("strong")?.textContent).toBe("CW");

    const compact = render(coverArtwork(undefined, "abc", true));
    expect(compact.querySelector(".cover-morse")).toBeNull();
    expect(compact.querySelector(".cover-art")?.classList.contains("compact")).toBe(true);
  });
});

describe("theme", () => {
  it("writes the theme to the root dataset", () => {
    applyTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

describe("toast", () => {
  it("shows a message and hides it after the timeout", () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="toast" hidden></div>';
    const toast = document.querySelector<HTMLDivElement>("#toast")!;

    showToast("Saved");
    expect(toast.textContent).toBe("Saved");
    expect(toast.hidden).toBe(false);

    vi.advanceTimersByTime(2500);
    expect(toast.hidden).toBe(true);
  });

  it("does nothing when no toast element exists", () => {
    expect(() => showToast("No host")).not.toThrow();
  });
});

describe("modal", () => {
  it("opens a dialog with the requested class and content", () => {
    document.body.innerHTML = '<dialog id="modal"></dialog>';
    const modal = openModal("form-dialog", "<h2>Edit</h2>");

    expect(modal.className).toBe("modal form-dialog");
    expect(modal.innerHTML).toBe("<h2>Edit</h2>");
    expect(modal.open).toBe(true);

    modal.close();
    expect(modal.open).toBe(false);
  });
});
