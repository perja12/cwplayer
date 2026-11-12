import { expect, test } from "@playwright/test";
import { openApp, startPlayback } from "./helpers";

test.describe("External HID word recognition", () => {
  test("marks the current word for the controller keys while playing", async ({ page }) => {
    await openApp(page);
    await startPlayback(page);

    for (const key of ["a", "s", "z", "x", "Space"]) {
      await page.keyboard.press(key);
      await expect(page.locator("#toast")).toContainText("Word added to Practice Review");
    }

    // Playwright cannot address the right-hand Control key by name, so send
    // the same event the browser produces for the HID device.
    for (const code of ["ControlLeft", "ControlRight"])
      await page.evaluate(
        (code) =>
          document.dispatchEvent(
            new KeyboardEvent("keydown", { code, key: "Control", bubbles: true, cancelable: true }),
          ),
        code,
      );

    await page.locator('[data-nav="review"]').click();
    await expect(page.locator(".recognized-card .review-item")).toHaveCount(7);
  });

  test("does not mark words while typing into a form field", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openApp(page);
    await startPlayback(page);

    await page.locator("[data-menu-toggle]").click();
    await page.locator('[data-nav="library"]').click();
    await page.locator(".text-row .row-menu").first().click();
    await page.getByRole("button", { name: "Edit text" }).click();

    const dialog = page.locator("dialog[open]");
    const title = dialog.locator('input[name="title"]');
    await title.fill("HID");
    await title.press("a");
    await title.press("s");
    await expect(page.locator("#toast")).not.toContainText("Word added to Practice Review");

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await page.locator("[data-menu-toggle]").click();
    await page.locator('[data-nav="review"]').click();
    await expect(page.locator(".recognized-card .review-item")).toHaveCount(0);
  });
});
