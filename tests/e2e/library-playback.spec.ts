import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

test.describe("library playback", () => {
  test("plays and pauses the active text without leaving the library", async ({ page }) => {
    await openApp(page);
    await page.locator('[data-nav="library"]').click();
    await expect(page.locator(".main-view h1")).toHaveText("Library");

    const row = page.locator(".text-row").first();
    const play = row.locator("[data-play]");
    await expect(play).toHaveAttribute("aria-label", /^Play /);

    await play.click();
    await expect(play).toHaveAttribute("aria-label", /^Pause /, { timeout: 15_000 });
    await expect(page.locator(".main-view h1")).toHaveText("Library");
    await expect(page.locator('[data-transport="toggle"]')).toHaveAttribute("aria-label", "Pause");

    await play.click();
    await expect(play).toHaveAttribute("aria-label", /^Play /);
    await expect(page.locator(".main-view h1")).toHaveText("Library");
    await expect(page.locator('[data-transport="toggle"]')).toHaveAttribute("aria-label", "Play");

    // Pressing play again resumes the paused text instead of restarting it.
    await play.click();
    await expect(play).toHaveAttribute("aria-label", /^Pause /, { timeout: 15_000 });
    await expect(page.locator(".main-view h1")).toHaveText("Library");
  });
});
