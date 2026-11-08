import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "allow" });

test("service worker caches uncached responses without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
    timeout: 15_000,
  });
  await page.goto("/?_cw_reload=1");
  await page.waitForTimeout(1_500);

  expect(errors.filter((message) => message.includes("clone"))).toEqual([]);
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const entries = await Promise.all(
      names.map(async (name) => {
        const cache = await caches.open(name);
        return (await cache.keys()).map((request) => request.url);
      }),
    );
    return entries.flat();
  });
  expect(cached.some((url) => url.endsWith("/?_cw_reload=1"))).toBe(true);
});
