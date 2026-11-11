import { expect, test } from "@playwright/test";

test.describe("startup", () => {
  test("paints the player before the stored library finishes loading", async ({ page }) => {
    await page.addInitScript(() => {
      const state = window as unknown as { __libraryLoaded?: boolean };
      state.__libraryLoaded = false;
      // Delay only the database handshake. The bundled shell should already be
      // on screen while this promise is still pending.
      const open = indexedDB.open.bind(indexedDB);
      indexedDB.open = (name: string, version?: number) => {
        const request = open(name, version);
        let handler: ((this: IDBRequest, event: Event) => unknown) | null = null;
        Object.defineProperty(request, "onsuccess", {
          configurable: true,
          get: () => handler,
          set: (value: (this: IDBRequest, event: Event) => unknown) => {
            handler = value;
            request.addEventListener("success", (event) => {
              setTimeout(() => {
                state.__libraryLoaded = true;
                value.call(request, event);
              }, 3_000);
            });
          },
        });
        return request;
      };
    });

    await page.goto("/");

    await expect(page.locator("#transcript")).toBeVisible();
    await expect(page.locator(".boot-splash")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => (window as unknown as { __libraryLoaded?: boolean }).__libraryLoaded,
      ),
    ).toBe(false);
  });
});
