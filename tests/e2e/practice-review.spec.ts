import { expect, test } from "@playwright/test";
import { openApp, startPlayback } from "./helpers";

test.describe("Practice Review", () => {
  test("lists words from the active text and toggles a looping preview", async ({ page }) => {
    await openApp(page);
    await page.locator('[data-nav="review"]').click();

    const items = page.locator(".frequency-item");
    await expect(items.first()).toBeVisible();
    await expect(items.filter({ hasText: "cq" })).toHaveCount(1);
    const words = await page.locator(".frequency-word").allTextContents();
    expect(words.every((word) => word === word.toLowerCase())).toBe(true);

    const firstPlay = page.locator(".word-play").first();
    await expect(firstPlay).toHaveAttribute("aria-label", /^Play /);
    await firstPlay.click();
    await expect(page.locator(".word-play").first()).toHaveAttribute("aria-label", /^Stop /);
    await expect(page.locator(".frequency-item.playing")).toHaveCount(1);
    await expect(page.locator(".word-play.playing")).toHaveCount(1);
    await page.locator(".word-play").first().click();
    await expect(page.locator(".word-play").first()).toHaveAttribute("aria-label", /^Play /);
    await expect(page.locator(".frequency-item.playing")).toHaveCount(0);
  });

  test("keeps the frequency list scrolled while a word is playing", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 480 });
    await openApp(page);
    await page.locator('[data-nav="review"]').click();

    const list = page.locator(".frequency-list");
    const lastPlay = page.locator(".word-play").last();
    await lastPlay.scrollIntoViewIfNeeded();
    const scrollTop = await list.evaluate((element) => element.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);

    await lastPlay.click();
    await expect(page.locator(".word-play").last()).toHaveAttribute("aria-label", /^Stop /);
    await expect(list).toHaveJSProperty("scrollTop", scrollTop);

    await page.locator(".word-play").last().click();
    await expect(page.locator(".word-play").last()).toHaveAttribute("aria-label", /^Play /);
    await expect(list).toHaveJSProperty("scrollTop", scrollTop);
  });

  test("moves recognized words into their own panel and previews a sentence", async ({ page }) => {
    await openApp(page);
    await startPlayback(page);
    await page.locator("[data-recognize]").click();
    await expect(page.locator("#toast")).toBeVisible();
    await expect(page.locator("#toast")).toContainText("Word added to Practice Review");
    await page.locator('[data-nav="review"]').click();

    const panel = page.locator(".recognized-card");
    await expect(panel.locator(".recognized-heading h2")).toHaveText("Recognized words");
    const items = panel.locator(".review-item");
    await expect(items).toHaveCount(1);

    const play = panel.locator(".sentence-play");
    await expect(play).toHaveAttribute("aria-label", /^Play sentence for /);
    await play.click();
    await expect(play).toHaveAttribute("aria-label", /^Stop sentence for /);
    await expect(panel.locator(".review-item.playing")).toHaveCount(1);
    await expect(play).toHaveAttribute("aria-pressed", "true");

    await play.click();
    await expect(play).toHaveAttribute("aria-label", /^Play sentence for /);
    await expect(panel.locator(".review-item.playing")).toHaveCount(0);
  });

  test("keeps long titles inside the review cards", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openApp(page);

    await page.locator("[data-menu-toggle]").click();
    await page.locator('[data-nav="library"]').click();
    await page.locator(".text-row .row-menu").first().click();
    await page.getByRole("button", { name: "Edit text" }).click();
    const dialog = page.locator("dialog[open]");
    await dialog
      .locator('input[name="title"]')
      .fill("Nansen - with a very very loooooooooooooooooooooooong title");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog).toHaveCount(0);

    await page.locator("[data-menu-toggle]").click();
    await page.locator('[data-nav="player"]').click();
    await startPlayback(page);
    await page.locator("[data-recognize]").click();
    await expect(page.locator("#toast")).toContainText("Word added to Practice Review");

    await page.locator("[data-menu-toggle]").click();
    await page.locator('[data-nav="review"]').click();
    await expect(page.locator(".frequency-heading")).toContainText("loooooooooooooooooooooo");

    const overflow = await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>(".frequency-card")!;
      const select = document.querySelector<HTMLElement>("[data-frequency-text]")!;
      return {
        card: card.scrollWidth - card.clientWidth,
        selectRight: select.getBoundingClientRect().right - card.getBoundingClientRect().right,
        items: [...document.querySelectorAll<HTMLElement>(".review-item")].map(
          (item) => item.scrollWidth - item.clientWidth,
        ),
      };
    });
    expect(overflow.card).toBeLessThanOrEqual(1);
    expect(overflow.selectRight).toBeLessThanOrEqual(0);
    expect(overflow.items.every((amount) => amount <= 1)).toBe(true);
  });

  test("switches the frequency list to another text", async ({ page }) => {
    await openApp(page);
    await page.locator('[data-nav="review"]').click();

    const select = page.locator("[data-frequency-text]");
    await expect(select).toBeVisible();
    await select.selectOption("demo-weekend");
    await expect(page.locator(".frequency-heading")).toContainText("Call signs from the weekend");
    await expect(page.locator(".frequency-item").filter({ hasText: "lb2kk" })).toHaveCount(1);
  });
});
