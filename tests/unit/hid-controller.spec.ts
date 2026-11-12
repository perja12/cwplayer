// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  markWordRecognized: vi.fn<() => boolean>(() => true),
}));

vi.mock("../../src/controllers/player-controller", () => ({
  markWordRecognized: mocks.markWordRecognized,
}));

import { bindHidControls } from "../../src/controllers/hid-controller";

function press(code: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { code, bubbles: true, cancelable: true, ...init });
  document.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  mocks.markWordRecognized.mockReset();
  mocks.markWordRecognized.mockReturnValue(true);
  document.body.innerHTML = "";
  bindHidControls();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("external HID controls", () => {
  it("marks the current word for every configured key", () => {
    for (const code of ["ControlLeft", "ControlRight", "KeyA", "KeyS", "KeyZ", "KeyX", "Space"])
      press(code);
    expect(mocks.markWordRecognized).toHaveBeenCalledTimes(7);
  });

  it("matches physical key positions regardless of the produced character", () => {
    press("KeyA", { key: "q" });
    press("KeyZ", { key: "w" });
    expect(mocks.markWordRecognized).toHaveBeenCalledTimes(2);
  });

  it("binds the document listener only once", () => {
    bindHidControls();
    bindHidControls();
    press("KeyA");
    expect(mocks.markWordRecognized).toHaveBeenCalledTimes(1);
  });

  it("ignores auto-repeated key presses", () => {
    press("KeyA", { repeat: true });
    expect(mocks.markWordRecognized).not.toHaveBeenCalled();
  });

  it("ignores letter and space keys pressed with browser modifiers", () => {
    press("KeyA", { ctrlKey: true });
    press("KeyS", { altKey: true });
    press("KeyZ", { metaKey: true });
    press("Space", { ctrlKey: true });
    expect(mocks.markWordRecognized).not.toHaveBeenCalled();
  });

  it("still accepts the control keys themselves", () => {
    press("ControlLeft", { ctrlKey: true });
    press("ControlRight", { ctrlKey: true });
    expect(mocks.markWordRecognized).toHaveBeenCalledTimes(2);
  });

  it("ignores presses while typing in form fields", () => {
    for (const tag of ["input", "textarea", "select"]) {
      const field = document.createElement(tag);
      document.body.append(field);
      field.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyA", bubbles: true }));
    }
    expect(mocks.markWordRecognized).not.toHaveBeenCalled();
  });

  it("ignores presses while a dialog is open", () => {
    const dialog = document.createElement("dialog");
    dialog.open = true;
    document.body.append(dialog);
    press("KeyA");
    expect(mocks.markWordRecognized).not.toHaveBeenCalled();
  });

  it("prevents the default action only when a word was marked", () => {
    const marked = press("Space");
    expect(marked.defaultPrevented).toBe(true);

    mocks.markWordRecognized.mockReturnValue(false);
    const ignored = press("Space");
    expect(ignored.defaultPrevented).toBe(false);
  });
});
