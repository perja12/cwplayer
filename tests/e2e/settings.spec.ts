import { expect, test } from "@playwright/test";
import {
  openApp,
  openSoundSettings,
  parseClock,
  readDurationSeconds,
  setWordGapMultiplier,
} from "./helpers";

test.describe("Extra word gap", () => {
  test("is available under Advanced sound with 1x-4x choices", async ({ page }) => {
    await openApp(page);
    const dialog = await openSoundSettings(page);
    await dialog.locator("summary", { hasText: "Advanced sound" }).click();

    const select = dialog.locator('select[name="wordGapMultiplier"]');
    await expect(select).toHaveValue("1");
    await expect(select.locator("option")).toHaveText(["1× (standard)", "2×", "3×", "4×"]);
  });

  test("persists the choice and lengthens playback", async ({ page }) => {
    await openApp(page);

    await setWordGapMultiplier(page, 1);
    await page.reload();
    await expect(page.locator("#transcript")).toBeVisible();
    const standard = await readDurationSeconds(page);

    await setWordGapMultiplier(page, 3);
    await page.reload();
    await expect(page.locator("#transcript")).toBeVisible();
    const tripled = await readDurationSeconds(page);

    expect(tripled).toBeGreaterThan(standard);

    const dialog = await openSoundSettings(page);
    await dialog.locator("summary", { hasText: "Advanced sound" }).click();
    await expect(dialog.locator('select[name="wordGapMultiplier"]')).toHaveValue("3");
    const saved = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("cw-player-v2-settings") ?? "{}") as {
          wordGapMultiplier?: number;
        },
    );
    expect(saved.wordGapMultiplier).toBe(3);
  });

  test("keeps 1x as the default when no setting is stored", async ({ page }) => {
    await openApp(page);
    const saved = await page.evaluate(() => localStorage.getItem("cw-player-v2-settings"));
    expect(saved).toBeNull();

    const dialog = await openSoundSettings(page);
    await dialog.locator("summary", { hasText: "Advanced sound" }).click();
    await expect(dialog.locator('select[name="wordGapMultiplier"]')).toHaveValue("1");
  });
});

test("links to the GPL license and source attribution", async ({ page }) => {
  await openApp(page);
  const dialog = await openSoundSettings(page);
  const links = dialog.locator(".about-links a");

  await expect(links).toHaveCount(4);
  await expect(links.filter({ hasText: "GPLv3" })).toHaveAttribute("href", "/LICENSE.txt");
  await expect(links.filter({ hasText: "Source" })).toHaveAttribute(
    "href",
    "https://github.com/perja12/cwplayer",
  );
  await expect(links.filter({ hasText: "Third-party notices" })).toHaveAttribute(
    "href",
    "/THIRD_PARTY_NOTICES.txt",
  );

  const license = await page.request.get("/LICENSE.txt");
  expect(license.ok()).toBe(true);
  expect(await license.text()).toContain("GNU GENERAL PUBLIC LICENSE");
});

test("parseClock understands the duration label", () => {
  expect(parseClock("0:00:28")).toBe(28);
  expect(parseClock("0:01:05")).toBe(65);
});
