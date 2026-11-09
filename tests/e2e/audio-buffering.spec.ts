import { expect, test, type Page } from "@playwright/test";
import { elapsedLabel, openApp, parseClock, startPlayback } from "./helpers";

const elapsedSeconds = async (page: Page) =>
  parseClock((await elapsedLabel(page).textContent()) ?? "");

test.describe("audio buffering", () => {
  test("keeps playing when the main thread stalls", async ({ page }) => {
    await openApp(page);
    await startPlayback(page);
    await expect.poll(() => elapsedSeconds(page)).toBeGreaterThan(1);
    const before = await elapsedSeconds(page);

    // A long transcript render or garbage collection can block the main thread
    // for a while. Buffer refills must not depend on it, or playback drops into
    // silence until the thread is free again.
    await page.evaluate(() => {
      const until = performance.now() + 2000;
      while (performance.now() < until) {
        /* Deliberately block the main thread. */
      }
    });

    await expect.poll(() => elapsedSeconds(page), { timeout: 5000 }).toBeGreaterThan(before + 1.5);
    await expect(page.locator("#toast")).not.toContainText("Audio buffer refilling");
  });
});
