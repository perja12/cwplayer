import { expect, test, type Page } from "@playwright/test";
import { elapsedLabel, openApp, parseClock, startPlayback } from "./helpers";

const elapsedSeconds = async (page: Page) =>
  parseClock((await elapsedLabel(page).textContent()) ?? "");

test.describe("listening position", () => {
  test("resumes after stopping and reloading, and Start over rewinds", async ({ page }) => {
    await openApp(page);
    await startPlayback(page);
    await expect.poll(() => elapsedSeconds(page)).toBeGreaterThan(2);

    await page.locator('[data-transport="stop"]').click();
    const stoppedAt = await elapsedSeconds(page);
    expect(stoppedAt).toBeGreaterThan(2);

    // Let the IndexedDB position write settle before reloading the app.
    await page.waitForTimeout(700);

    await page.reload();
    await expect(page.locator("#transcript")).toBeVisible();
    await startPlayback(page);
    await expect.poll(() => elapsedSeconds(page)).toBeGreaterThanOrEqual(stoppedAt - 2);

    await page.locator("[data-more]").click();
    await page.getByRole("button", { name: "Start over" }).click();
    await expect.poll(() => elapsedSeconds(page)).toBeLessThan(3);
  });

  test("restores the last played track after reloading", async ({ page }) => {
    await openApp(page);
    await page.locator('[data-nav="library"]').click();
    const row = page.locator(".text-row", { hasText: "Call signs from the weekend" });
    await row.locator("[data-play]").click();
    await expect(page.locator('[data-transport="toggle"]')).toHaveAttribute("aria-label", "Pause", {
      timeout: 15_000,
    });
    await page.locator('[data-transport="stop"]').click();
    await expect(page.locator('[data-transport="toggle"]')).toHaveAttribute("aria-label", "Play");

    await page.reload();

    await expect(page.locator(".main-view h1")).toHaveText("Call signs from the weekend");
  });

  test("resumes deep into a long text without re-rendering the prefix", async ({ page }) => {
    await openApp(page);
    const content =
      "CQ CQ DE LB2KK THIS IS A FRIENDLY QSO THE BAND IS QUIET TONIGHT HOW COPY.\n\n".repeat(120);
    await page.evaluate(async (content) => {
      const lastPosition = Math.floor(content.length * 0.4);
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("cw-player-library", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not open the library."));
      });
      type TextRecord = {
        key: string;
        value: Array<{ content: string; lastPosition: number }>;
      };
      const read = () =>
        new Promise<TextRecord>((resolve, reject) => {
          const request = database
            .transaction("records", "readonly")
            .objectStore("records")
            .get("texts") as IDBRequest<TextRecord>;
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error ?? new Error("Could not read the texts."));
        });
      const record = await read();
      record.value[0].content = content;
      record.value[0].lastPosition = lastPosition;
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction("records", "readwrite");
        transaction.objectStore("records").put({ key: "texts", value: record.value });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
          reject(transaction.error ?? new Error("Could not save the text."));
      });
      database.close();
    }, content);

    await page.reload();
    await expect(page.locator("#transcript")).toBeVisible();
    await startPlayback(page);

    // The saved position is over 20 minutes in. The old resume path rendered
    // that whole prefix (~7 s here); restoring the timeline metadata is instant.
    await expect.poll(() => elapsedSeconds(page), { timeout: 3000 }).toBeGreaterThan(1200);
    await expect(page.locator("#toast")).not.toContainText("Audio buffer refilling");
  });
});
