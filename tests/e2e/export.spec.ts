import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

// StreamSaver needs its own service worker to turn the streamed MP3 into a
// download, so this spec opts out of the global service-worker block.
test.use({ serviceWorkers: "allow" });

test("downloads an MP3 without leaving the export dialog hanging", async ({ page }) => {
  await openApp(page);
  await page.locator("[data-more]").click();

  const download = page.waitForEvent("download", { timeout: 20_000 });
  await page.locator("[data-download]").click();
  await expect(page.locator("#export-status")).toContainText("MP3 download complete.", {
    timeout: 20_000,
  });
  await expect(page.locator("[data-export-done]")).toBeVisible();

  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.mp3$/);
  expect(await file.failure()).toBeNull();
});
