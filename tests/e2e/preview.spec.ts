import { expect, test } from "@playwright/test";
import {
  delayLibraryOpen,
  elapsedLabel,
  openApp,
  pausePlayback,
  selectTranscriptRange,
  startPlayback,
  transportToggle,
} from "./helpers";

test.describe("Follow along selection preview", () => {
  test("waits for the hydrated render before offering a selection", async ({ page }) => {
    await delayLibraryOpen(page, 1_500);

    await openApp(page);
    await selectTranscriptRange(page, 0, 2);
    await expect(page.locator(".selection-play-popup")).toBeVisible();
  });

  test("is offered only when main playback is idle or paused", async ({ page }) => {
    await openApp(page);
    const popup = page.locator(".selection-play-popup");

    await selectTranscriptRange(page, 0, 2);
    await expect(popup).toBeVisible();
    await expect(popup).toContainText("Play selection");

    await transportToggle(page).click();
    await expect(transportToggle(page)).toHaveAttribute("aria-label", "Pause", { timeout: 15_000 });
    await selectTranscriptRange(page, 0, 2);
    await expect(popup).toBeHidden();

    await pausePlayback(page);
    await selectTranscriptRange(page, 0, 2);
    await expect(popup).toBeVisible();
  });

  test("keeps the transcript selection while playing and stopping the preview", async ({
    page,
  }) => {
    await openApp(page);
    const selected = await selectTranscriptRange(page, 0, 4);
    const popup = page.locator(".selection-play-popup");
    await expect(popup).toBeVisible();

    await popup.click();
    await expect(popup).toContainText("Stop");
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(selected);

    await popup.click();
    await expect(popup).toBeHidden();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(selected);
  });

  test("plays once and preserves the paused main-playback position", async ({ page }) => {
    await openApp(page);
    await startPlayback(page);
    await pausePlayback(page);

    const pausedTime = await elapsedLabel(page).textContent();
    const pausedWidth = await page.locator(".progress-track span").getAttribute("style");
    expect(pausedTime).toBeTruthy();

    await selectTranscriptRange(page, 0, 2);
    const popup = page.locator(".selection-play-popup");
    await expect(popup).toBeVisible();
    await expect(popup).toContainText("Play selection");

    await popup.click();
    await expect(popup).toContainText("Stop");
    await expect(elapsedLabel(page)).toHaveText(pausedTime!);
    await expect(page.locator(".progress-track span")).toHaveAttribute("style", pausedWidth!);

    await expect(popup).toContainText("Play selection", { timeout: 15_000 });
    await expect(elapsedLabel(page)).toHaveText(pausedTime!);
    await expect(page.locator(".progress-track span")).toHaveAttribute("style", pausedWidth!);

    await transportToggle(page).click();
    await expect(transportToggle(page)).toHaveAttribute("aria-label", "Pause");
    await expect(elapsedLabel(page)).not.toHaveText(pausedTime!);
  });
});
