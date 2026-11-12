import { expect, test, type Page } from "@playwright/test";
import { openApp, startPlayback } from "./helpers";

type MidiTestState = {
  sent: number[][];
  input: MIDIInput;
};

async function installFakeMidi(page: Page) {
  await page.addInitScript(() => {
    const sent: number[][] = [];
    const input = new EventTarget() as unknown as MIDIInput;
    Object.assign(input, {
      id: "in",
      name: "Vail Adapter",
      state: "connected",
      type: "input",
      connection: "open",
    });
    const output = new EventTarget() as unknown as MIDIOutput;
    Object.assign(output, {
      id: "out",
      name: "Vail Adapter",
      state: "connected",
      type: "output",
      connection: "open",
      send: (data: number[] | Uint8Array) => sent.push(Array.from(data)),
    });
    const access = new EventTarget() as unknown as MIDIAccess;
    Object.assign(access, {
      inputs: new Map<string, MIDIInput>([["in", input]]),
      outputs: new Map<string, MIDIOutput>([["out", output]]),
      sysexEnabled: false,
    });
    Object.defineProperty(navigator, "requestMIDIAccess", {
      configurable: true,
      value: () => Promise.resolve(access),
    });
    (window as unknown as { __midi: MidiTestState }).__midi = { sent, input };
  });
}

async function sendNote(page: Page, data: number[]) {
  await page.evaluate((bytes) => {
    const state = window as unknown as { __midi: MidiTestState };
    const event = new Event("midimessage");
    Object.defineProperty(event, "data", { value: new Uint8Array(bytes) });
    state.__midi.input.dispatchEvent(event);
  }, data);
}

test.describe("MIDI word recognition", () => {
  test("initializes the adapter and marks the current word on note presses", async ({ page }) => {
    await installFakeMidi(page);
    await openApp(page);
    await startPlayback(page);

    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __midi: MidiTestState }).__midi.sent))
      .toEqual([
        [0xb0, 0x00, 0x00],
        [0xb0, 0x01, 0x32],
        [0xc0, 0x00],
      ]);

    await sendNote(page, [0x90, 0x01, 0x7f]);
    await expect(page.locator("#toast")).toContainText("Word added to Practice Review");

    // A held note and its release must not create extra marks; the next press must.
    await sendNote(page, [0x90, 0x01, 0x7f]);
    await sendNote(page, [0x80, 0x01, 0x00]);
    await sendNote(page, [0x90, 0x01, 0x7f]);

    await page.locator('[data-nav="review"]').click();
    await expect(page.locator(".recognized-card .review-item")).toHaveCount(2);
  });

  test("explains when MIDI access is blocked", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "requestMIDIAccess", {
        configurable: true,
        value: () => Promise.reject(new Error("denied")),
      });
    });

    await openApp(page);
    await expect(page.locator("#toast")).toContainText("MIDI access was blocked");
  });
});
