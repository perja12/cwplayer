export type AnchorRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  bottom: number;
};

export type ViewportSize = { width: number; height: number };
export type PopupSize = { width: number; height: number };
export type PopupPosition = { left: number; top: number };

/** Collapse the browser's selection across line breaks into one playable string. */
export function normalizeSelectionText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Place the selection popup below the anchor, flipping above it when there is
 * no room, and keep it inside the viewport horizontally.
 */
export function selectionPopupPosition(
  anchor: AnchorRect,
  viewport: ViewportSize,
  popup: PopupSize,
  margin = 12,
): PopupPosition {
  const center = anchor.left + anchor.width / 2;
  const left = Math.min(
    viewport.width - popup.width / 2 - margin,
    Math.max(popup.width / 2 + margin, center),
  );
  const below = anchor.bottom + 9;
  const top =
    below + popup.height > viewport.height - margin
      ? Math.max(margin, anchor.top - popup.height - 9)
      : below;
  return { left, top };
}
