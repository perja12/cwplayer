import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

test.describe("transcript visibility", () => {
  test("keeps the transcript in place but blurred, without the follow cursor", async ({ page }) => {
    await openApp(page);

    const box = page.locator(".transcript-box");
    const transcript = page.locator("#transcript");
    const toggle = page.locator("[data-follow-toggle]");
    const content = await transcript.textContent();

    await expect(toggle).toHaveAttribute("aria-label", "Hide transcript");
    await expect(box).not.toHaveClass(/blurred/);

    await toggle.click();
    await expect(box).toBeVisible();
    await expect(box).toHaveClass(/blurred/);
    await expect(toggle).toHaveAttribute("aria-label", "Show transcript");
    await expect(transcript).toHaveText(content ?? "");
    await expect(transcript).toHaveAttribute("aria-hidden", "true");
    await expect(transcript).toHaveCSS("filter", "blur(6px)");
    await expect(transcript).toHaveCSS("pointer-events", "none");
    await expect(transcript).toHaveCSS("user-select", "none");
    await expect(transcript.locator("mark.current-char")).toHaveCount(0);

    await toggle.click();
    await expect(box).not.toHaveClass(/blurred/);
    await expect(toggle).toHaveAttribute("aria-label", "Hide transcript");
    await expect(transcript).not.toHaveAttribute("aria-hidden", "true");
  });
});
