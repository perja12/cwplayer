import { escapeHtml } from "./html";

const coverHue = (id: string) =>
  [...id].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 7) % 360;

export function coverArtwork(image: string | undefined, id: string, compact = false) {
  const picture = image
    ? `<img src="${escapeHtml(image)}" alt="">`
    : `<span class="cover-orbit"></span><strong>CW</strong>${compact ? "" : `<span class="cover-morse" aria-hidden="true">· — · · · — ·</span>`}`;
  return `<span class="cover-art ${compact ? "compact" : ""}" style="--cover-hue:${coverHue(id)}">${picture}</span>`;
}
