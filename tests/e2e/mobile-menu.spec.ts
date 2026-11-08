import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

test.use({ viewport: { width: 390, height: 844 } });

test.describe("mobile navigation", () => {
  test("opens the burger drawer and switches views", async ({ page }) => {
    await openApp(page);

    const toggle = page.locator("[data-menu-toggle]");
    const drawer = page.locator("#app-menu");
    await expect(toggle).toBeVisible();
    await expect(drawer).not.toBeInViewport();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(drawer).toBeInViewport();
    await expect(drawer.locator(".nav-item")).toHaveCount(5);

    await drawer.locator('[data-nav="review"]').click();
    await expect(page.locator(".main-view h1")).toHaveText("Practice Review");
    await expect(drawer).not.toBeInViewport();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("closes the drawer from the close button", async ({ page }) => {
    await openApp(page);
    const drawer = page.locator("#app-menu");

    await page.locator("[data-menu-toggle]").click();
    await expect(drawer).toBeInViewport();
    await page.locator("#app-menu .menu-close").click();
    await expect(drawer).not.toBeInViewport();
    await expect(page.locator("[data-menu-toggle]")).toHaveAttribute("aria-expanded", "false");
  });

  test("closes the drawer from the scrim and Escape", async ({ page }) => {
    await openApp(page);
    const drawer = page.locator("#app-menu");

    await page.locator("[data-menu-toggle]").click();
    await expect(drawer).toBeInViewport();
    await page.locator(".menu-scrim").click({ position: { x: 20, y: 20 } });
    await expect(drawer).not.toBeInViewport();

    await page.locator("[data-menu-toggle]").click();
    await expect(drawer).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeInViewport();
  });

  test("opens Sound & timing from the drawer settings item", async ({ page }) => {
    await openApp(page);

    await page.locator("[data-menu-toggle]").click();
    await expect(page.locator("#app-menu")).toBeInViewport();
    await page.locator("[data-open-settings]").click();

    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("h2")).toHaveText("Sound & timing");
    await expect(page.locator("#app-menu")).not.toBeInViewport();
  });

  test("keeps the transcript central and the recognize action in the dock", async ({ page }) => {
    await openApp(page);

    await expect(page.locator(".player-cover")).toBeHidden();
    await expect(page.locator(".player-title")).toBeHidden();
    await expect(page.locator(".recognize-row")).toHaveCount(0);

    const recognize = page.locator(".dock-actions [data-recognize]");
    await expect(recognize).toBeVisible();
    await expect(recognize).toHaveAttribute("aria-label", "Mark current word recognized");

    const play = page.locator('.dock [data-transport="toggle"]');
    const playBox = await play.boundingBox();
    expect(playBox?.width ?? 0).toBeGreaterThanOrEqual(48);
    expect(playBox?.height ?? 0).toBeGreaterThanOrEqual(48);

    const thumbnail = page.locator(".dock-item .cover-art.compact");
    await expect(thumbnail).toBeVisible();
    const thumbBox = await thumbnail.boundingBox();
    expect(thumbBox?.width ?? 0).toBeGreaterThanOrEqual(30);

    const transcript = page.locator(".transcript-box");
    const box = await transcript.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(400);
  });

  test("keeps long text titles inside their library rows", async ({ page }) => {
    await openApp(page);
    await page.locator("[data-menu-toggle]").click();
    await page.locator('[data-nav="library"]').click();

    await page.locator(".text-row .row-menu").first().click();
    await page.getByRole("button", { name: "Edit text" }).click();
    const dialog = page.locator("dialog[open]");
    await dialog
      .locator('input[name="title"]')
      .fill("Nansen - with a very very very very very long title that should never overflow");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog).toHaveCount(0);

    const overflow = await page.evaluate(() => {
      const list = document.querySelector<HTMLElement>(".library-list")!;
      const rows = [...list.querySelectorAll<HTMLElement>(".text-row, .collection-row")];
      return [list, ...rows]
        .map((element) => element.scrollWidth - element.clientWidth)
        .filter((amount) => amount > 1);
    });
    expect(overflow).toEqual([]);

    const title = page.locator(".text-row .text-meta strong").first();
    await expect(title).toBeVisible();
    const style = await title.evaluate((element) => {
      const computed = getComputedStyle(element);
      return { overflow: computed.overflow, textOverflow: computed.textOverflow };
    });
    expect(style.overflow).toBe("hidden");
    expect(style.textOverflow).toBe("ellipsis");
  });
});
