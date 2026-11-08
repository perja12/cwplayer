import type { Settings, TextItem } from "./types";

export const KEYS = { settings: "cw-player-v2-settings", theme: "cw-player-v2-theme" };
export const WORD_FREQUENCY_LIMIT = 60;
export const WORD_PREVIEW_GAP_SECONDS = 0.7;

export const defaultSettings: Settings = {
  wpm: 30,
  frequency: 610,
  volume: 100,
  envelope: 4.4,
  shape: 1,
  farnsworthWpm: 0,
  paragraphPause: 0.5,
  wordGapMultiplier: 1,
  stereo: 1,
  room: 1,
  roomLevel: 25,
  phase: 0.39,
  secondFrequency: 0,
};

export const defaultTexts: TextItem[] = [
  {
    id: "demo-qso",
    title: "A friendly QSO",
    author: "",
    language: "English",
    labels: ["QSOs", "Two tones"],
    collectionId: null,
    lastPosition: 0,
    content: "CQ CQ DE LB2KK\n\nThis is a friendly QSO. The band is quiet tonight. How copy?",
  },
  {
    id: "demo-weekend",
    title: "Call signs from the weekend",
    author: "",
    language: "English",
    labels: ["Call signs", "Practice"],
    collectionId: null,
    lastPosition: 0,
    content: "CQ CQ CQ DE LB2KK\n\nLB2KK DE LA1ABC. Good evening and thanks for the call.",
  },
  {
    id: "demo-story",
    title: "A short evening read",
    author: "",
    language: "English",
    labels: ["Stories"],
    collectionId: null,
    lastPosition: 0,
    content:
      "A quiet evening at the station. The receiver warmed slowly.\n\nOutside, the wind moved through the trees.",
  },
];
