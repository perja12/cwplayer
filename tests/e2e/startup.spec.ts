import { expect, test } from "@playwright/test";
import { delayLibraryOpen, libraryLoaded } from "./helpers";

test.describe("startup", () => {
  test("paints the player before the stored library finishes loading", async ({ page }) => {
    await delayLibraryOpen(page);

    await page.goto("/");

    await expect(page.locator("#transcript")).toBeVisible();
    await expect(page.locator(".boot-splash")).toHaveCount(0);
    expect(await libraryLoaded(page)).toBe(false);
  });
});
