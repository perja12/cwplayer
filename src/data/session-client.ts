import { KEYS } from "../model/defaults";
import { readJson, writeJson } from "./settings-client";

export type SessionState = {
  activeTextId: string;
};

/** Restore the last played track after an app restart or Android process eviction. */
export function loadSession(): Partial<SessionState> {
  return readJson<Partial<SessionState>>(KEYS.session, {});
}

export function saveSession(session: SessionState) {
  writeJson(KEYS.session, session);
}
