import { markWordRecognized } from "./player-controller";

/**
 * Physical keys the external USB HID controller can send. `code` is used
 * instead of `key` so the mapping follows physical positions and keeps working
 * with non-US keyboard layouts.
 */
const HID_CODES = new Set(["ControlLeft", "ControlRight", "KeyA", "KeyS", "KeyZ", "KeyX", "Space"]);

/**
 * Letter and space keys must be modifier-free so ordinary browser shortcuts
 * such as Ctrl+A or Ctrl+S are not mistaken for a HID press.
 */
const MODIFIER_SENSITIVE_CODES = new Set(["KeyA", "KeyS", "KeyZ", "KeyX", "Space"]);

let hidBound = false;

/** Listen once for the external controller, independent of full re-renders. */
export function bindHidControls() {
  if (hidBound) return;
  hidBound = true;
  document.addEventListener("keydown", handleHidKeydown);
}

function handleHidKeydown(event: KeyboardEvent) {
  if (event.repeat || event.isComposing || !HID_CODES.has(event.code)) return;
  if (MODIFIER_SENSITIVE_CODES.has(event.code) && (event.altKey || event.ctrlKey || event.metaKey))
    return;
  if (isTypingTarget(event.target) || document.querySelector("dialog[open]")) return;
  if (!markWordRecognized()) return;
  event.preventDefault();
  event.stopPropagation();
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}
