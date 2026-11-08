import { expect, type Page } from "@playwright/test";

export async function openApp(page: Page) {
  await page.goto("/");
  await expect(page.locator("#transcript")).toBeVisible();
  await expect(page.locator("#transcript")).not.toBeEmpty();
}

export async function openSoundSettings(page: Page) {
  await page.locator("[data-sound]").click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function setWordGapMultiplier(page: Page, multiplier: number) {
  const dialog = await openSoundSettings(page);
  await dialog.locator("summary", { hasText: "Advanced sound" }).click();
  await dialog.locator('select[name="wordGapMultiplier"]').selectOption(String(multiplier));
  await dialog.getByRole("button", { name: "Apply settings" }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
}

export function transportToggle(page: Page) {
  return page.locator('[data-transport="toggle"]');
}

export async function startPlayback(page: Page) {
  const toggle = transportToggle(page);
  await expect(toggle).toHaveAttribute("aria-label", "Play");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-label", "Pause", { timeout: 15_000 });
}

export async function pausePlayback(page: Page) {
  const toggle = transportToggle(page);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-label", "Play");
}

export function elapsedLabel(page: Page) {
  return page.locator(".time-labels span").first();
}

export function totalLabel(page: Page) {
  return page.locator(".time-labels span").last();
}

export async function readDurationSeconds(page: Page) {
  await startPlayback(page);
  await expect(totalLabel(page)).not.toHaveText("--:--");
  const text = await totalLabel(page).textContent();
  await pausePlayback(page);
  return parseClock(text ?? "");
}

export function parseClock(clock: string) {
  return clock.split(":").reduce((seconds, part) => seconds * 60 + Number(part), 0);
}

/**
 * Select a character range inside the Follow along transcript. The app reads
 * the browser selection, so dispatching the same event the browser fires
 * keeps the check independent of the mouse gesture used in production.
 */
export async function selectTranscriptRange(page: Page, start: number, end: number) {
  return page.evaluate(
    ({ start, end }) => {
      const transcript = document.querySelector<HTMLElement>("#transcript");
      if (!transcript) throw new Error("Transcript is not visible");
      const walker = document.createTreeWalker(transcript, NodeFilter.SHOW_TEXT);
      let offset = 0;
      let startNode: Node | null = null;
      let startOffset = 0;
      let endNode: Node | null = null;
      let endOffset = 0;
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const length = node.textContent?.length ?? 0;
        const next = offset + length;
        if (!startNode && start >= offset && start <= next) {
          startNode = node;
          startOffset = start - offset;
        }
        if (!endNode && end >= offset && end <= next) {
          endNode = node;
          endOffset = end - offset;
        }
        offset = next;
      }
      if (!startNode || !endNode)
        throw new Error(`Selection ${start}-${end} is outside the transcript (${offset} chars)`);
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      const selection = window.getSelection();
      if (!selection) throw new Error("Selection API is unavailable");
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
      return selection.toString();
    },
    { start, end },
  );
}
