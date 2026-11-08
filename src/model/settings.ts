import type { Settings } from "./types";

/** The subset of `FormData` the settings parser needs. */
export type SettingsForm = Pick<FormData, "get" | "has">;

/**
 * Convert the sound dialog form into settings. Number inputs arrive as strings;
 * empty optional fields become zero and the extra word gap is clamped to the
 * range the engine accepts.
 */
export function settingsFromFormData(form: SettingsForm): Settings {
  return {
    wpm: Number(form.get("wpm")),
    frequency: Number(form.get("frequency")),
    volume: Number(form.get("volume")),
    envelope: Number(form.get("envelope")),
    shape: Number(form.get("shape")),
    farnsworthWpm: Number(form.get("farnsworthWpm")) || 0,
    paragraphPause: Number(form.get("paragraphPause")),
    wordGapMultiplier: Math.min(10, Math.max(1, Number(form.get("wordGapMultiplier")) || 1)),
    stereo: form.has("stereo") ? 1 : 0,
    room: form.has("room") ? 1 : 0,
    roomLevel: Number(form.get("roomLevel")),
    phase: Number(form.get("phase")),
    secondFrequency: Number(form.get("secondFrequency")) || 0,
  };
}
